import type {
  User,
  Annotation,
  PointCloudData,
  ReconstructStatus,
  WebRTCSignal,
  WebSocketMessageType,
  WebSocketMessage,
} from 'shared/types';

type EventCallback<T = unknown> = (data: T) => void;

interface EventCallbacks {
  userJoin: EventCallback<User>[];
  userLeave: EventCallback<User>[];
  pointCloudUpdate: EventCallback<PointCloudData>[];
  annotationAdd: EventCallback<Annotation>[];
  annotationUpdate: EventCallback<Annotation>[];
  annotationDelete: EventCallback<{ annotationId: string; roomId: string }>[];
  reconstructStatus: EventCallback<ReconstructStatus>[];
  webrtcOffer: EventCallback<WebRTCSignal>[];
  webrtcAnswer: EventCallback<WebRTCSignal>[];
  webrtcIce: EventCallback<WebRTCSignal>[];
  connect: EventCallback<void>[];
  disconnect: EventCallback<CloseEvent>[];
  error: EventCallback<Event>[];
}

type EventName = keyof EventCallbacks;

const HEARTBEAT_INTERVAL = 30000;
const HEARTBEAT_TIMEOUT = 10000;
const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 1000;

class WebSocketService {
  private ws: WebSocket | null = null;
  private roomId: string | null = null;
  private userId: string | null = null;
  private token: string | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private isManualDisconnect = false;
  private messageQueue: WebSocketMessage[] = [];

  private callbacks: EventCallbacks = {
    userJoin: [],
    userLeave: [],
    pointCloudUpdate: [],
    annotationAdd: [],
    annotationUpdate: [],
    annotationDelete: [],
    reconstructStatus: [],
    webrtcOffer: [],
    webrtcAnswer: [],
    webrtcIce: [],
    connect: [],
    disconnect: [],
    error: [],
  };

  connect(roomId: string, userId: string, token: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.roomId = roomId;
    this.userId = userId;
    this.token = token;
    this.isManualDisconnect = false;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/${roomId}?userId=${encodeURIComponent(userId)}&token=${encodeURIComponent(token)}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = this.handleOpen.bind(this);
    this.ws.onmessage = this.handleMessage.bind(this);
    this.ws.onclose = this.handleClose.bind(this);
    this.ws.onerror = this.handleError.bind(this);
  }

  disconnect(): void {
    this.isManualDisconnect = true;
    this.stopHeartbeat();
    this.clearReconnectTimer();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send<T>(type: WebSocketMessageType, data: T): void {
    const message: WebSocketMessage<T> = {
      type,
      data,
      timestamp: Date.now(),
    };

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.messageQueue.push(message);
    }
  }

  on<T extends EventName>(event: T, callback: EventCallbacks[T][number]): () => void {
    const callbacks = this.callbacks[event] as EventCallback[];
    callbacks.push(callback);

    return () => {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    };
  }

  off<T extends EventName>(event: T, callback: EventCallbacks[T][number]): void {
    const callbacks = this.callbacks[event] as EventCallback[];
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  private handleOpen(): void {
    this.reconnectAttempts = 0;
    this.startHeartbeat();
    this.flushMessageQueue();
    this.emit('connect', undefined);
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);

      if ((message.type as string) === 'pong') {
        this.handlePong();
        return;
      }

      this.dispatchMessage(message);
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  private handleClose(event: CloseEvent): void {
    this.stopHeartbeat();
    this.emit('disconnect', event);

    if (!this.isManualDisconnect && this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      this.scheduleReconnect();
    }
  }

  private handleError(event: Event): void {
    this.emit('error', event);
  }

  private dispatchMessage(message: WebSocketMessage): void {
    const { type, data } = message;

    switch (type) {
      case 'user_join':
        this.emit('userJoin', data as User);
        break;
      case 'user_leave':
        this.emit('userLeave', data as User);
        break;
      case 'pointcloud_update':
        this.emit('pointCloudUpdate', data as PointCloudData);
        break;
      case 'annotation_add':
        this.emit('annotationAdd', data as Annotation);
        break;
      case 'annotation_update':
        this.emit('annotationUpdate', data as Annotation);
        break;
      case 'annotation_delete':
        this.emit('annotationDelete', data as { annotationId: string; roomId: string });
        break;
      case 'reconstruct_status':
        this.emit('reconstructStatus', data as ReconstructStatus);
        break;
      case 'webrtc_offer':
        this.emit('webrtcOffer', data as WebRTCSignal);
        break;
      case 'webrtc_answer':
        this.emit('webrtcAnswer', data as WebRTCSignal);
        break;
      case 'webrtc_ice':
        this.emit('webrtcIce', data as WebRTCSignal);
        break;
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      this.send('pong' as WebSocketMessageType, { timestamp: Date.now() });

      this.heartbeatTimeoutTimer = setTimeout(() => {
        this.ws?.close();
      }, HEARTBEAT_TIMEOUT);
    }, HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = null;
    }
  }

  private handlePong(): void {
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = null;
    }
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();

    const delay = BASE_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      if (this.roomId && this.userId && this.token) {
        this.connect(this.roomId, this.userId, this.token);
      }
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const message = this.messageQueue.shift();
      if (message) {
        this.ws.send(JSON.stringify(message));
      }
    }
  }

  private emit<T extends EventName>(event: T, data: EventCallbacks[T] extends EventCallback<infer D>[] ? D : never): void {
    const callbacks = this.callbacks[event] as EventCallback[];
    callbacks.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in ${event} callback:`, error);
      }
    });
  }

  getReadyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const webSocketService = new WebSocketService();
export default WebSocketService;
