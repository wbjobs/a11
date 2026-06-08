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
}

const iceServers: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

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
    // no-op for compatibility
  }
}

export class WebRTCService {
  private localUserId: string = '';
  private localStream: MediaStream | null = null;
  private peers: Map<string, PeerConnection> = new Map();
  private emitter: SimpleEventEmitter = new SimpleEventEmitter();
  private streamCallbacks: Set<(peerId: string, stream: MediaStream) => void> = new Set();
  private signalCallbacks: Set<(peerId: string, signal: WebRTCSignal) => void> = new Set();

  constructor() {
    this.emitter.setMaxListeners(100);
  }

  initialize(localUserId: string, localStream?: MediaStream): void {
    this.localUserId = localUserId;
    if (localStream) {
      this.localStream = localStream;
    }
  }

  setLocalStream(stream: MediaStream): void {
    this.localStream = stream;
    this.peers.forEach((peer) => {
      if (this.localStream) {
        this.localStream.getTracks().forEach((track) => {
          try {
            peer.connection.addTrack(track, this.localStream!);
          } catch (e) {
            console.debug('Track already added:', e);
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

  private createPeerConnection(peerId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({
      iceServers,
      iceCandidatePoolSize: 10,
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

    pc.onconnectionstatechange = () => {
      console.log(`Connection state with ${peerId}: ${pc.connectionState}`);
      if (pc.connectionState === 'connected') {
        this.emitter.emit('connect', peerId);
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this.emitter.emit('close', peerId);
        this.removePeer(peerId);
      }
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

  private emitSignal(peerId: string, signal: WebRTCSignal): void {
    this.signalCallbacks.forEach((cb) => cb(peerId, signal));
  }

  async callPeer(peerId: string, stream?: MediaStream): Promise<void> {
    if (this.peers.has(peerId)) {
      console.log(`Already connected to ${peerId}`);
      return;
    }

    if (stream) {
      this.localStream = stream;
    }

    const pc = this.createPeerConnection(peerId);
    this.peers.set(peerId, { id: peerId, connection: pc });

    try {
      const dataChannel = pc.createDataChannel('data');
      this.peers.get(peerId)!.dataChannel = dataChannel;

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
      this.emitter.emit('error', peerId, error);
      this.removePeer(peerId);
    }
  }

  async handleSignal(peerId: string, signal: WebRTCSignal): Promise<void> {
    let peer = this.peers.get(peerId);

    if (!peer) {
      if (signal.type === 'offer') {
        const pc = this.createPeerConnection(peerId);
        peer = { id: peerId, connection: pc };
        this.peers.set(peerId, peer);

        pc.ondatachannel = (event) => {
          peer!.dataChannel = event.channel;
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
      try {
        peer.dataChannel?.close();
        peer.connection.close();
      } catch (e) {
        console.debug('Error closing peer connection:', e);
      }
      this.peers.delete(peerId);
      this.emitter.emit('close', peerId);
    }
  }

  getPeers(): string[] {
    return Array.from(this.peers.keys());
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
