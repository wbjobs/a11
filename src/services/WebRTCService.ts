export interface WebRTCSignal {
  from: string;
  to: string;
  type: 'offer' | 'answer' | 'ice';
  sdp?: string;
  candidate?: RTCIceCandidateInit;
}

interface PeerConnection {
  id: string;
  connection: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
  stream?: MediaStream;
  reconnectAttempts: number;
  lastState: RTCPeerConnectionState;
  reconnectTimer?: ReturnType<typeof setTimeout>;
  heartbeatTimer?: ReturnType<typeof setInterval>;
}

const iceServers: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY = 1000;
const CONNECTION_TIMEOUT = 15000;
const HEARTBEAT_INTERVAL = 5000;
const MAX_PEER_CONNECTIONS = 8;

class SimpleEventEmitter {
  private listeners: Map<string, Set<Function>> = new Map();

  on(event: string, callback: Function): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => this.off(event, callback);
  }

  off(event: string, callback: Function): void {
    this.listeners.get(event)?.delete(callback);
  }

  emit(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach((cb) => cb(...args));
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }

  setMaxListeners(_n: number): void {
  }
}

export class WebRTCService {
  private localUserId: string = '';
  private localStream: MediaStream | null = null;
  private peers: Map<string, PeerConnection> = new Map();
  private emitter: SimpleEventEmitter = new SimpleEventEmitter();
  private streamCallbacks: Set<(peerId: string, stream: MediaStream) => void> = new Set();
  private signalCallbacks: Set<(peerId: string, signal: WebRTCSignal) => void> = new Set();
  private pendingConnections: Map<string, { stream?: MediaStream; timeout: ReturnType<typeof setTimeout> }> = new Map();
  private isDestroyed = false;

  constructor() {
    this.emitter.setMaxListeners(100);
  }

  initialize(localUserId: string, localStream?: MediaStream): void {
    this.localUserId = localUserId;
    this.isDestroyed = false;
    if (localStream) {
      this.localStream = localStream;
    }
  }

  setLocalStream(stream: MediaStream): void {
    this.localStream = stream;
    this.peers.forEach((peer) => {
      if (this.localStream && peer.connection.connectionState !== 'closed') {
        const senders = peer.connection.getSenders();
        this.localStream.getTracks().forEach((track) => {
          const existingSender = senders.find((s) => s.track?.kind === track.kind);
          if (!existingSender) {
            try {
              peer.connection.addTrack(track, this.localStream!);
            } catch (e) {
              console.debug('Track already added:', e);
            }
          }
        });
      }
    });
  }

  onSignal(callback: (peerId: string, signal: WebRTCSignal) => void): () => void {
    this.signalCallbacks.add(callback);
    return () => this.signalCallbacks.delete(callback);
  }

  addStreamCallback(callback: (peerId: string, stream: MediaStream) => void): () => void {
    this.streamCallbacks.add(callback);
    return () => this.streamCallbacks.delete(callback);
  }

  onConnect(callback: (peerId: string) => void): () => void {
    const handler = (peerId: string) => callback(peerId);
    this.emitter.on('connect', handler);
    return () => this.emitter.off('connect', handler);
  }

  onClose(callback: (peerId: string) => void): () => void {
    const handler = (peerId: string) => callback(peerId);
    this.emitter.on('close', handler);
    return () => this.emitter.off('close', handler);
  }

  onError(callback: (peerId: string, error: Error) => void): () => void {
    const handler = (peerId: string, error: Error) => callback(peerId, error);
    this.emitter.on('error', handler);
    return () => this.emitter.off('error', handler);
  }

  onReconnecting(callback: (peerId: string, attempt: number) => void): () => void {
    const handler = (peerId: string, attempt: number) => callback(peerId, attempt);
    this.emitter.on('reconnecting', handler);
    return () => this.emitter.off('reconnecting', handler);
  }

  private createPeerConnection(peerId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({
      iceServers,
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.emitSignal(peerId, {
          from: this.localUserId,
          to: peerId,
          type: 'ice',
          candidate: event.candidate.toJSON(),
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.debug(`ICE connection state with ${peerId}: ${pc.iceConnectionState}`);
      const peer = this.peers.get(peerId);
      if (peer) {
        if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
          this.scheduleReconnect(peerId);
        } else if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          this.clearReconnect(peer);
          this.startHeartbeat(peer);
        }
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`Connection state with ${peerId}: ${pc.connectionState}`);
      const peer = this.peers.get(peerId);
      if (peer) {
        peer.lastState = pc.connectionState;
      }

      if (pc.connectionState === 'connected') {
        this.clearPendingConnection(peerId);
        this.emitter.emit('connect', peerId);
      } else if (pc.connectionState === 'failed') {
        this.scheduleReconnect(peerId);
      } else if (pc.connectionState === 'disconnected') {
        this.scheduleReconnect(peerId);
      } else if (pc.connectionState === 'closed') {
        this.removePeer(peerId);
      }
    };

    pc.onsignalingstatechange = () => {
      console.debug(`Signaling state with ${peerId}: ${pc.signalingState}`);
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) {
        const peer = this.peers.get(peerId);
        if (peer) {
          peer.stream = stream;
        }
        this.streamCallbacks.forEach((cb) => cb(peerId, stream));
        this.emitter.emit('stream', peerId, stream);
      }
    };

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    return pc;
  }

  private startHeartbeat(peer: PeerConnection): void {
    this.stopHeartbeat(peer);
    
    peer.heartbeatTimer = setInterval(() => {
      if (peer.dataChannel?.readyState === 'open') {
        try {
          peer.dataChannel.send(JSON.stringify({ type: 'heartbeat', timestamp: Date.now() }));
        } catch (e) {
          console.debug('Heartbeat send failed:', e);
        }
      }
    }, HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat(peer: PeerConnection): void {
    if (peer.heartbeatTimer) {
      clearInterval(peer.heartbeatTimer);
      peer.heartbeatTimer = undefined;
    }
  }

  private scheduleReconnect(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (!peer || peer.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS || this.isDestroyed) {
      if (peer?.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.warn(`Max reconnection attempts reached for ${peerId}, giving up`);
        this.emitter.emit('error', peerId, new Error('Max reconnection attempts reached'));
      }
      this.removePeer(peerId);
      return;
    }

    if (peer.reconnectTimer) {
      return;
    }

    peer.reconnectAttempts++;
    const delay = BASE_RECONNECT_DELAY * Math.pow(2, peer.reconnectAttempts - 1);
    
    console.log(`Scheduling reconnection to ${peerId} (attempt ${peer.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) in ${delay}ms`);
    this.emitter.emit('reconnecting', peerId, peer.reconnectAttempts);

    peer.reconnectTimer = setTimeout(async () => {
      try {
        await this.reconnectPeer(peerId);
      } catch (e) {
        console.error(`Reconnection to ${peerId} failed:`, e);
        this.scheduleReconnect(peerId);
      }
    }, delay);
  }

  private clearReconnect(peer: PeerConnection): void {
    if (peer.reconnectTimer) {
      clearTimeout(peer.reconnectTimer);
      peer.reconnectTimer = undefined;
    }
    peer.reconnectAttempts = 0;
  }

  private clearPendingConnection(peerId: string): void {
    const pending = this.pendingConnections.get(peerId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingConnections.delete(peerId);
    }
  }

  private async reconnectPeer(peerId: string): Promise<void> {
    const peer = this.peers.get(peerId);
    if (!peer || this.isDestroyed) return;

    console.log(`Attempting to reconnect to ${peerId}`);

    try {
      peer.connection.close();
    } catch (e) {
      console.debug('Error closing old connection:', e);
    }

    const pc = this.createPeerConnection(peerId);
    peer.connection = pc;
    peer.dataChannel = undefined;

    try {
      const dataChannel = pc.createDataChannel('data');
      peer.dataChannel = dataChannel;

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
        iceRestart: true,
      });
      await pc.setLocalDescription(offer);

      this.emitSignal(peerId, {
        from: this.localUserId,
        to: peerId,
        type: 'offer',
        sdp: offer.sdp,
      });

      const timeout = setTimeout(() => {
        console.warn(`Connection timeout for ${peerId}`);
        this.scheduleReconnect(peerId);
      }, CONNECTION_TIMEOUT);
      
      this.pendingConnections.set(peerId, { timeout });

    } catch (error) {
      console.error('Error during reconnection:', error);
      this.emitter.emit('error', peerId, error);
      throw error;
    }
  }

  private emitSignal(peerId: string, signal: WebRTCSignal): void {
    this.signalCallbacks.forEach((cb) => cb(peerId, signal));
  }

  async callPeer(peerId: string, stream?: MediaStream): Promise<void> {
    if (this.isDestroyed) return;

    if (this.peers.size >= MAX_PEER_CONNECTIONS) {
      console.warn(`Max peer connections (${MAX_PEER_CONNECTIONS}) reached`);
      this.emitter.emit('error', peerId, new Error('Max peer connections reached'));
      return;
    }

    if (this.peers.has(peerId)) {
      const peer = this.peers.get(peerId)!;
      if (peer.lastState === 'connected' || peer.lastState === 'connecting') {
        console.log(`Already connected/connecting to ${peerId}`);
        return;
      }
    }

    if (stream) {
      this.localStream = stream;
    }

    const existingTimeout = this.pendingConnections.get(peerId)?.timeout;
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const pc = this.createPeerConnection(peerId);
    const peer: PeerConnection = {
      id: peerId,
      connection: pc,
      reconnectAttempts: 0,
      lastState: 'new',
    };
    this.peers.set(peerId, peer);

    const timeout = setTimeout(() => {
      console.warn(`Connection timeout for ${peerId}`);
      this.scheduleReconnect(peerId);
    }, CONNECTION_TIMEOUT);
    
    this.pendingConnections.set(peerId, { stream, timeout });

    try {
      const dataChannel = pc.createDataChannel('data');
      peer.dataChannel = dataChannel;

      dataChannel.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'heartbeat') {
            return;
          }
        } catch (e) {
        }
      };

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offer);

      this.emitSignal(peerId, {
        from: this.localUserId,
        to: peerId,
        type: 'offer',
        sdp: offer.sdp,
      });
    } catch (error) {
      console.error('Error creating offer:', error);
      this.clearPendingConnection(peerId);
      this.emitter.emit('error', peerId, error);
      this.scheduleReconnect(peerId);
    }
  }

  async handleSignal(peerId: string, signal: WebRTCSignal): Promise<void> {
    if (this.isDestroyed) return;

    let peer = this.peers.get(peerId);

    if (!peer) {
      if (signal.type === 'offer') {
        if (this.peers.size >= MAX_PEER_CONNECTIONS) {
          console.warn(`Max peer connections (${MAX_PEER_CONNECTIONS}) reached, rejecting offer from ${peerId}`);
          return;
        }

        const pc = this.createPeerConnection(peerId);
        peer = {
          id: peerId,
          connection: pc,
          reconnectAttempts: 0,
          lastState: 'new',
        };
        this.peers.set(peerId, peer);

        pc.ondatachannel = (event) => {
          peer!.dataChannel = event.channel;
          event.channel.onmessage = (e) => {
            try {
              const data = JSON.parse(e.data);
              if (data.type === 'heartbeat') {
                return;
              }
            } catch (err) {
            }
          };
        };
      } else {
        console.warn(`No peer connection for ${peerId} and signal type is not offer`);
        return;
      }
    }

    const pc = peer.connection;

    try {
      if (signal.type === 'offer' && signal.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription({
          type: 'offer',
          sdp: signal.sdp,
        }));

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        this.emitSignal(peerId, {
          from: this.localUserId,
          to: peerId,
          type: 'answer',
          sdp: answer.sdp,
        });
      } else if (signal.type === 'answer' && signal.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription({
          type: 'answer',
          sdp: signal.sdp,
        }));
      } else if (signal.type === 'ice' && signal.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } catch (e) {
          console.debug('Error adding ICE candidate:', e);
        }
      }
    } catch (error) {
      console.error('Error handling signal:', error);
      this.emitter.emit('error', peerId, error);
    }
  }

  removePeer(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      this.clearReconnect(peer);
      this.stopHeartbeat(peer);
      
      try {
        peer.dataChannel?.close();
        peer.connection.close();
      } catch (e) {
        console.debug('Error closing peer connection:', e);
      }
      
      this.peers.delete(peerId);
      this.clearPendingConnection(peerId);
      this.emitter.emit('close', peerId);
    }
  }

  getPeers(): string[] {
    return Array.from(this.peers.keys());
  }

  getConnectedPeers(): string[] {
    return Array.from(this.peers.entries())
      .filter(([_, peer]) => peer.connection.connectionState === 'connected')
      .map(([id]) => id);
  }

  getPeerStats(peerId: string): Promise<RTCStatsReport | null> {
    const peer = this.peers.get(peerId);
    if (!peer || peer.connection.connectionState !== 'connected') {
      return Promise.resolve(null);
    }
    return peer.connection.getStats();
  }

  getRemoteStreams(): Map<string, MediaStream> {
    const streams = new Map<string, MediaStream>();
    this.peers.forEach((peer, id) => {
      if (peer.stream) {
        streams.set(id, peer.stream);
      }
    });
    return streams;
  }

  destroy(): void {
    this.isDestroyed = true;
    
    this.pendingConnections.forEach((pending) => {
      clearTimeout(pending.timeout);
    });
    this.pendingConnections.clear();

    this.peers.forEach((_, peerId) => this.removePeer(peerId));
    this.peers.clear();
    this.streamCallbacks.clear();
    this.signalCallbacks.clear();
    this.emitter.removeAllListeners();
    this.localStream = null;
    this.localUserId = '';
  }
}

export const webRTCService = new WebRTCService();
