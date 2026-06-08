export type UserRole = 'creator' | 'collaborator' | 'viewer';

export interface User {
  userId: string;
  roomId: string;
  name: string;
  role: UserRole;
  isOnline: boolean;
  hasVideo: boolean;
  videoStreamId?: string;
  socketId?: string;
}

export interface Room {
  roomId: string;
  name: string;
  creatorId: string;
  createdAt: number;
  status: 'idle' | 'reconstructing' | 'paused';
  users: User[];
}

export interface PointCloudVersion {
  versionId: string;
  roomId: string;
  versionNumber: number;
  pointCount: number;
  progress: number;
  timestamp: number;
  dataPath?: string;
}

export interface PointCloudData {
  versionId: string;
  roomId: string;
  timestamp: number;
  versionNumber: number;
  points: number[];
  colors: number[];
  pointCount: number;
  cameraPoses?: CameraPose[];
}

export interface CameraPose {
  cameraId: string;
  position: [number, number, number];
  rotation: [number, number, number, number];
  focalLength: number;
}

export type AnnotationType = 'arrow' | 'sphere' | 'text';

export interface Annotation {
  annotationId: string;
  roomId: string;
  userId: string;
  userName: string;
  pointCloudVersionId: string;
  type: AnnotationType;
  position: [number, number, number];
  direction?: [number, number, number];
  color: string;
  size: number;
  text?: string;
  createdAt: number;
  updatedAt: number;
}

export interface WebRTCSignal {
  from: string;
  to: string;
  type: 'offer' | 'answer' | 'ice';
  sdp?: any;
  candidate?: any;
  data?: any;
}

export type WebSocketMessageType =
  | 'user_join'
  | 'user_leave'
  | 'pointcloud_update'
  | 'annotation_add'
  | 'annotation_update'
  | 'annotation_delete'
  | 'reconstruct_status'
  | 'webrtc_offer'
  | 'webrtc_answer'
  | 'webrtc_ice'
  | 'frame_data'
  | 'pong';

export interface WebSocketMessage<T = any> {
  type: WebSocketMessageType;
  data: T;
  timestamp: number;
}

export interface ReconstructStatus {
  status: 'idle' | 'processing' | 'done' | 'error';
  progress: number;
  message?: string;
  framesProcessed: number;
  totalFrames: number;
}

export interface CreateRoomRequest {
  username: string;
}

export interface CreateRoomResponse {
  roomId: string;
  userId: string;
  token: string;
}

export interface JoinRoomRequest {
  roomId: string;
  username: string;
  role: UserRole;
}

export interface JoinRoomResponse {
  userId: string;
  token: string;
  users: User[];
  pointCloud?: PointCloudData;
  annotations: Annotation[];
}

export interface FrameUploadResponse {
  success: boolean;
  queued: boolean;
  message?: string;
}

export interface PointCloudHistoryResponse {
  versions: PointCloudVersion[];
}
