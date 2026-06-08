import { create } from 'zustand';
import type {
  User,
  UserRole,
  PointCloudData,
  PointCloudVersion,
  Annotation,
  ReconstructStatus,
  CreateRoomResponse,
  JoinRoomResponse,
} from 'shared/types';

export type ActivePanel = 'none' | 'users' | 'history' | 'annotations' | 'settings';
export type SelectedTool = 'select' | 'annotate-arrow' | 'annotate-sphere' | 'annotate-text';
export type ColorMode = 'original' | 'height' | 'curvature';

interface AppState {
  currentUser: User | null;
  token: string | null;
  roomId: string | null;

  users: User[];
  roomStatus: 'idle' | 'reconstructing' | 'paused';

  currentPointCloud: PointCloudData | null;
  pointCloudVersions: PointCloudVersion[];
  reconstructStatus: ReconstructStatus;

  annotations: Annotation[];
  selectedAnnotationId: string | null;

  wsConnected: boolean;
  webrtcConnected: boolean;

  sidebarOpen: boolean;
  activePanel: ActivePanel;
  selectedTool: SelectedTool;

  pointSize: number;
  colorMode: ColorMode;
  showAxes: boolean;
  showGrid: boolean;
  autoRotate: boolean;
}

interface AppActions {
  setUser: (userId: string, token: string, userName: string, role: UserRole) => void;
  joinRoom: (roomId: string, role: UserRole) => void;
  leaveRoom: () => void;
  addPointCloud: (pointCloud: PointCloudData) => void;
  addAnnotation: (annotation: Annotation) => void;
  updateAnnotation: (annotation: Annotation) => void;
  deleteAnnotation: (annotationId: string) => void;
  selectAnnotation: (annotationId: string | null) => void;
  setConnectionStatus: (ws: boolean, webrtc: boolean) => void;

  setRoomStatus: (status: 'idle' | 'reconstructing' | 'paused') => void;
  setPointCloudVersions: (versions: PointCloudVersion[]) => void;
  setReconstructStatus: (status: ReconstructStatus) => void;
  setUsers: (users: User[]) => void;
  updateUser: (user: User) => void;
  removeUser: (userId: string) => void;
  setSidebarOpen: (open: boolean) => void;
  setActivePanel: (panel: ActivePanel) => void;
  setSelectedTool: (tool: SelectedTool) => void;
  setAnnotations: (annotations: Annotation[]) => void;

  setPointSize: (size: number) => void;
  setColorMode: (mode: ColorMode) => void;
  setShowAxes: (show: boolean) => void;
  setShowGrid: (show: boolean) => void;
  setAutoRotate: (auto: boolean) => void;
  resetView: () => void;
}

const initialState: AppState = {
  currentUser: null,
  token: null,
  roomId: null,

  users: [],
  roomStatus: 'idle',

  currentPointCloud: null,
  pointCloudVersions: [],
  reconstructStatus: {
    status: 'idle',
    progress: 0,
    framesProcessed: 0,
    totalFrames: 0,
  },

  annotations: [],
  selectedAnnotationId: null,

  wsConnected: false,
  webrtcConnected: false,

  sidebarOpen: true,
  activePanel: 'none',
  selectedTool: 'select',

  pointSize: 0.05,
  colorMode: 'original',
  showAxes: true,
  showGrid: true,
  autoRotate: false,
};

export const useAppStore = create<AppState & AppActions>()((set) => ({
  ...initialState,

  setUser: (userId: string, token: string, userName: string, role: UserRole) => {
    set((state) => ({
      currentUser: {
        userId,
        roomId: state.roomId || '',
        name: userName,
        role,
        isOnline: true,
        hasVideo: false,
      },
      token,
    }));
  },

  joinRoom: (roomId: string, role: UserRole) => {
    set({
      roomId,
      roomStatus: 'idle',
    });
  },

  leaveRoom: () => {
    set({
      ...initialState,
    });
  },

  addPointCloud: (pointCloud: PointCloudData) => {
    set({
      currentPointCloud: pointCloud,
    });
  },

  addAnnotation: (annotation: Annotation) => {
    set((state) => ({
      annotations: [...state.annotations, annotation],
    }));
  },

  updateAnnotation: (annotation: Annotation) => {
    set((state) => ({
      annotations: state.annotations.map((a) =>
        a.annotationId === annotation.annotationId ? annotation : a
      ),
    }));
  },

  deleteAnnotation: (annotationId: string) => {
    set((state) => ({
      annotations: state.annotations.filter((a) => a.annotationId !== annotationId),
      selectedAnnotationId:
        state.selectedAnnotationId === annotationId ? null : state.selectedAnnotationId,
    }));
  },

  selectAnnotation: (annotationId: string | null) => {
    set({
      selectedAnnotationId: annotationId,
    });
  },

  setConnectionStatus: (ws: boolean, webrtc: boolean) => {
    set({
      wsConnected: ws,
      webrtcConnected: webrtc,
    });
  },

  setRoomStatus: (status: 'idle' | 'reconstructing' | 'paused') => {
    set({
      roomStatus: status,
    });
  },

  setPointCloudVersions: (versions: PointCloudVersion[]) => {
    set({
      pointCloudVersions: versions,
    });
  },

  setReconstructStatus: (status: ReconstructStatus) => {
    set({
      reconstructStatus: status,
    });
  },

  setUsers: (users: User[]) => {
    set({
      users,
    });
  },

  updateUser: (user: User) => {
    set((state) => ({
      users: state.users.map((u) => (u.userId === user.userId ? user : u)),
    }));
  },

  removeUser: (userId: string) => {
    set((state) => ({
      users: state.users.filter((u) => u.userId !== userId),
    }));
  },

  setSidebarOpen: (open: boolean) => {
    set({
      sidebarOpen: open,
    });
  },

  setActivePanel: (panel: ActivePanel) => {
    set({
      activePanel: panel,
    });
  },

  setSelectedTool: (tool: SelectedTool) => {
    set({
      selectedTool: tool,
    });
  },

  setAnnotations: (annotations: Annotation[]) => {
    set({
      annotations,
    });
  },

  setPointSize: (size: number) => {
    set({
      pointSize: size,
    });
  },

  setColorMode: (mode: ColorMode) => {
    set({
      colorMode: mode,
    });
  },

  setShowAxes: (show: boolean) => {
    set({
      showAxes: show,
    });
  },

  setShowGrid: (show: boolean) => {
    set({
      showGrid: show,
    });
  },

  setAutoRotate: (auto: boolean) => {
    set({
      autoRotate: auto,
    });
  },

  resetView: () => {
  },
}));
