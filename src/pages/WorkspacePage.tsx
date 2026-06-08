import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LogOut, Maximize2, Minimize2 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { webSocketService } from '@/services/WebSocketService';
import { webRTCService } from '@/services/WebRTCService';
import { indexedDBService } from '@/services/IndexedDBService';
import { useCamera } from '@/hooks/useCamera';
import { useFrameCapture } from '@/hooks/useFrameCapture';
import { PointCloudScene } from '@/components/pointcloud/PointCloudScene';
import { PointCloudControls } from '@/components/pointcloud/PointCloudControls';
import { AnnotationManager } from '@/components/annotation/AnnotationManager';
import { AnnotationToolbar } from '@/components/annotation/AnnotationToolbar';
import { VideoStreamPanel } from '@/components/video/VideoStreamPanel';
import { PointCloudTimeline } from '@/components/timeline/PointCloudTimeline';
import { Sidebar } from '@/components/ui/Sidebar';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { GlowButton } from '@/components/ui/GlowButton';
import type { Annotation, PointCloudData, User } from 'shared/types';

export default function WorkspacePage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isControlsOpen, setIsControlsOpen] = useState(true);

  const currentUser = useAppStore((state) => state.currentUser);
  const token = useAppStore((state) => state.token);
  const currentPointCloud = useAppStore((state) => state.currentPointCloud);
  const annotations = useAppStore((state) => state.annotations);
  const selectedAnnotationId = useAppStore((state) => state.selectedAnnotationId);
  const selectedTool = useAppStore((state) => state.selectedTool);
  const pointCloudVersions = useAppStore((state) => state.pointCloudVersions);
  const users = useAppStore((state) => state.users);
  const reconstructStatus = useAppStore((state) => state.reconstructStatus);
  const wsConnected = useAppStore((state) => state.wsConnected);
  const addPointCloud = useAppStore((state) => state.addPointCloud);
  const setPointCloudVersions = useAppStore((state) => state.setPointCloudVersions);
  const addAnnotation = useAppStore((state) => state.addAnnotation);
  const updateAnnotation = useAppStore((state) => state.updateAnnotation);
  const deleteAnnotation = useAppStore((state) => state.deleteAnnotation);
  const setConnectionStatus = useAppStore((state) => state.setConnectionStatus);
  const setUsers = useAppStore((state) => state.setUsers);
  const setReconstructStatus = useAppStore((state) => state.setReconstructStatus);
  const leaveRoom = useAppStore((state) => state.leaveRoom);

  const {
    stream,
    isStreaming,
    error: cameraError,
    startCamera,
    stopCamera,
    devices,
  } = useCamera();

  const pointSize = useAppStore((state) => state.pointSize);
  const colorMode = useAppStore((state) => state.colorMode);
  const showAxes = useAppStore((state) => state.showAxes);
  const showGrid = useAppStore((state) => state.showGrid);
  const autoRotate = useAppStore((state) => state.autoRotate);
  const setPointSize = useAppStore((state) => state.setPointSize);
  const setColorMode = useAppStore((state) => state.setColorMode);
  const setShowAxes = useAppStore((state) => state.setShowAxes);
  const setShowGrid = useAppStore((state) => state.setShowGrid);
  const setAutoRotate = useAppStore((state) => state.setAutoRotate);
  const resetView = useAppStore((state) => state.resetView);

  const {
    startCapture,
    stopCapture,
    isCapturing,
  } = useFrameCapture(videoRef, {
    interval: 800,
    maxQueueSize: 50,
    onFrame: async (frame) => {
      if (!wsConnected || !roomId || !currentUser) return;
      
      const arrayBuffer = await frame.blob.arrayBuffer();
      webSocketService.send('frame_data', {
        frame: Array.from(new Uint8Array(arrayBuffer)),
        timestamp: Date.now(),
        frameIndex: Date.now(),
      });
    },
  });

  const handleLeaveRoom = useCallback(() => {
    stopCapture();
    stopCamera();
    webSocketService.disconnect();
    webRTCService.destroy();
    leaveRoom();
    navigate('/');
  }, [stopCapture, stopCamera, leaveRoom, navigate]);

  const handleAddAnnotation = useCallback((annotationData: Partial<Annotation>) => {
    if (!currentUser || !roomId || !currentPointCloud) return;

    const now = Date.now();
    const annotation: Annotation = {
      annotationId: `ann_${now}_${Math.random().toString(36).substr(2, 9)}`,
      roomId: roomId,
      userId: currentUser.userId,
      userName: currentUser.name,
      pointCloudVersionId: annotationData.pointCloudVersionId || currentPointCloud.versionId,
      type: annotationData.type || 'sphere',
      position: annotationData.position || [0, 0, 0],
      direction: annotationData.direction,
      color: annotationData.color || '#ff5500',
      size: annotationData.size || 0.5,
      text: annotationData.text,
      createdAt: now,
      updatedAt: now,
    };

    addAnnotation(annotation);
    webSocketService.send('annotation_add', annotation);
    indexedDBService.saveAnnotation(annotation);
  }, [addAnnotation, currentUser, roomId, currentPointCloud]);

  const handleUpdateAnnotation = useCallback((annotation: Annotation) => {
    updateAnnotation(annotation);
    webSocketService.send('annotation_update', annotation);
    indexedDBService.updateAnnotation(annotation);
  }, [updateAnnotation]);

  const handleDeleteAnnotation = useCallback((annotationId: string) => {
    deleteAnnotation(annotationId);
    webSocketService.send('annotation_delete', { annotationId });
    indexedDBService.deleteAnnotation(annotationId);
  }, [deleteAnnotation]);

  const handleVersionSelect = useCallback(async (versionId: string) => {
    const version = pointCloudVersions.find(v => v.versionId === versionId);
    if (!version) return;

    const data = await indexedDBService.getPointCloudData(versionId);
    if (data) {
      const pcData: PointCloudData = {
        versionId: data.versionId,
        roomId: data.roomId,
        timestamp: data.timestamp,
        versionNumber: data.versionNumber,
        points: Array.from(data.points),
        colors: Array.from(data.colors),
        pointCount: data.pointCount,
      };
      addPointCloud(pcData);
    }
  }, [pointCloudVersions, addPointCloud]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    if (!roomId || !currentUser || !token) {
      navigate('/');
      return;
    }

    indexedDBService.openDB();

    const unregisterUserJoin = webSocketService.on('userJoin', (user: User) => {
      const currentUsers = useAppStore.getState().users;
      setUsers([...currentUsers, user]);
      
      if (stream && user.userId !== currentUser.userId) {
        webRTCService.callPeer(user.userId, stream);
      }
    });

    const unregisterUserLeave = webSocketService.on('userLeave', (data: { userId: string }) => {
      const currentUsers = useAppStore.getState().users;
      setUsers(currentUsers.filter(u => u.userId !== data.userId));
      webRTCService.removePeer(data.userId);
    });

    const unregisterPointCloud = webSocketService.on('pointCloudUpdate', (data: PointCloudData) => {
      addPointCloud(data);
      indexedDBService.savePointCloudVersion({
        versionId: data.versionId,
        roomId: data.roomId,
        versionNumber: data.versionNumber,
        pointCount: data.pointCount,
        progress: 100,
        timestamp: data.timestamp,
      });
      indexedDBService.savePointCloudData(
        data.versionId,
        data.roomId,
        data.points,
        data.colors,
        data.versionNumber
      );
      
      const currentVersions = useAppStore.getState().pointCloudVersions;
      const newVersion = {
        versionId: data.versionId,
        roomId: data.roomId,
        versionNumber: data.versionNumber,
        pointCount: data.pointCount,
        progress: 100,
        timestamp: data.timestamp,
      };
      setPointCloudVersions([...currentVersions, newVersion]);
    });

    const unregisterAnnotationAdd = webSocketService.on('annotationAdd', (data: Annotation) => {
      addAnnotation(data);
      indexedDBService.saveAnnotation(data);
    });

    const unregisterAnnotationUpdate = webSocketService.on('annotationUpdate', (data: Annotation) => {
      updateAnnotation(data);
      indexedDBService.updateAnnotation(data);
    });

    const unregisterAnnotationDelete = webSocketService.on('annotationDelete', (data: { annotationId: string }) => {
      deleteAnnotation(data.annotationId);
      indexedDBService.deleteAnnotation(data.annotationId);
    });

    const unregisterReconstructStatus = webSocketService.on('reconstructStatus', (data: any) => {
      setReconstructStatus(data);
    });

    const unregisterWebRTCOffer = webSocketService.on('webrtcOffer', (data: any) => {
      if (stream) {
        webRTCService.handleSignal(data.from, {
          from: data.from,
          to: currentUser.userId,
          type: 'offer',
          sdp: data.offer,
        });
      }
    });

    const unregisterWebRTCAnswer = webSocketService.on('webrtcAnswer', (data: any) => {
      webRTCService.handleSignal(data.from, {
        from: data.from,
        to: currentUser.userId,
        type: 'answer',
        sdp: data.answer,
      });
    });

    const unregisterWebRTCIce = webSocketService.on('webrtcIce', (data: any) => {
      webRTCService.handleSignal(data.from, {
        from: data.from,
        to: currentUser.userId,
        type: 'ice',
        candidate: data.candidate,
      });
    });

    webSocketService.on('connect', () => {
      setConnectionStatus(true, false);
    });

    webSocketService.on('disconnect', () => {
      setConnectionStatus(false, false);
    });

    webRTCService.onSignal((peerId, signal) => {
      if (signal.type === 'offer') {
        webSocketService.send('webrtc_offer', {
          from: currentUser.userId,
          to: peerId,
          offer: signal.sdp,
        });
      } else if (signal.type === 'answer') {
        webSocketService.send('webrtc_answer', {
          from: currentUser.userId,
          to: peerId,
          answer: signal.sdp,
        });
      } else if (signal.type === 'ice') {
        webSocketService.send('webrtc_ice', {
          from: currentUser.userId,
          to: peerId,
          candidate: signal.candidate,
        });
      }
    });

    webRTCService.addStreamCallback((peerId, remoteStream) => {
      console.log('Received stream from:', peerId);
    });

    webSocketService.connect(roomId, currentUser.userId, token);
    webRTCService.initialize(currentUser.userId);

    (async () => {
      const versions = await indexedDBService.getPointCloudVersions(roomId);
      setPointCloudVersions(versions);
      
      const latest = await indexedDBService.getLatestPointCloud(roomId);
      if (latest) {
        const pcData: PointCloudData = {
          versionId: latest.versionId,
          roomId: latest.roomId,
          timestamp: latest.timestamp,
          versionNumber: latest.versionNumber,
          points: Array.from(latest.points),
          colors: Array.from(latest.colors),
          pointCount: latest.pointCount,
        };
        addPointCloud(pcData);
      }

      const savedAnnotations = await indexedDBService.getAnnotations(roomId);
      savedAnnotations.forEach(ann => addAnnotation(ann));
    })();

    return () => {
      unregisterUserJoin();
      unregisterUserLeave();
      unregisterPointCloud();
      unregisterAnnotationAdd();
      unregisterAnnotationUpdate();
      unregisterAnnotationDelete();
      unregisterReconstructStatus();
      unregisterWebRTCOffer();
      unregisterWebRTCAnswer();
      unregisterWebRTCIce();
    };
  }, [
    roomId, currentUser, token, navigate, stream,
    addPointCloud, addAnnotation, updateAnnotation, deleteAnnotation,
    setUsers, setPointCloudVersions, setReconstructStatus, setConnectionStatus,
  ]);

  useEffect(() => {
    if (stream) {
      webRTCService.setLocalStream(stream);
      users.forEach(user => {
        if (user.userId !== currentUser?.userId) {
          webRTCService.callPeer(user.userId, stream);
        }
      });
    }
  }, [stream, users, currentUser]);

  const remoteStreams = webRTCService.getRemoteStreams();

  return (
    <div className="h-screen w-screen bg-[#050510] overflow-hidden relative">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="hidden"
      />

      <div className="absolute inset-0">
        <PointCloudScene
          pointCloud={currentPointCloud}
          loading={!currentPointCloud && reconstructStatus.status === 'processing'}
        >
          <AnnotationManager
            annotations={annotations}
            selectedAnnotationId={selectedAnnotationId}
            selectedTool={selectedTool}
            onAddAnnotation={handleAddAnnotation}
          />
        </PointCloudScene>
      </div>

      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-4">
          <div className="px-4 py-2 bg-slate-900/80 backdrop-blur-xl rounded-xl border border-slate-700/50">
            <span className="text-slate-400 text-sm">房间</span>
            <span className="ml-2 text-tech-cyan font-mono font-bold tracking-wider">
              {roomId}
            </span>
          </div>
          <StatusIndicator
            status={wsConnected ? 'online' : 'connecting'}
            showLabel={true}
          />
          {reconstructStatus.status === 'processing' && (
            <div className="px-3 py-1.5 bg-tech-purple/20 rounded-lg border border-tech-purple/30">
              <span className="text-tech-purple text-sm">
                重建中 {Math.round(reconstructStatus.progress)}%
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isStreaming ? (
            <GlowButton
              variant="primary"
              size="sm"
              onClick={isCapturing ? stopCapture : startCapture}
            >
              {isCapturing ? '停止捕获' : '开始捕获'}
            </GlowButton>
          ) : (
            <GlowButton
              variant="primary"
              size="sm"
              onClick={() => startCamera()}
            >
              启动摄像头
            </GlowButton>
          )}
          <button
            onClick={() => setIsControlsOpen(!isControlsOpen)}
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 transition-colors"
          >
            {isControlsOpen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
          <button
            onClick={handleLeaveRoom}
            className="p-2 rounded-lg bg-status-error/20 hover:bg-status-error/30 text-status-error transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      <Sidebar
        users={users}
        currentPointCloud={currentPointCloud}
        reconstructStatus={reconstructStatus}
        roomId={roomId || ''}
        wsConnected={wsConnected}
      />

      <AnnotationToolbar
        selectedTool={selectedTool}
        disabled={currentUser?.role === 'viewer'}
      />

      <div className="absolute top-20 right-4 z-20">
        <PointCloudControls
          pointSize={pointSize}
          onPointSizeChange={setPointSize}
          colorMode={colorMode}
          onColorModeChange={setColorMode}
          showAxes={showAxes}
          onShowAxesChange={setShowAxes}
          showGrid={showGrid}
          onShowGridChange={setShowGrid}
          autoRotate={autoRotate}
          onAutoRotateChange={setAutoRotate}
          onResetView={resetView}
        />
      </div>

      <VideoStreamPanel
        localStream={stream}
        localUserName={currentUser?.name}
        isLocalVideoEnabled={isStreaming}
        remoteUsers={users.map((user) => ({
          ...user,
          stream: remoteStreams.get(user.userId) || null,
          status: user.isOnline ? 'online' : 'offline',
          isAudioEnabled: false,
        }))}
        onToggleLocalVideo={isStreaming ? stopCamera : () => startCamera()}
      />

      {isControlsOpen && (
        <div className="absolute bottom-4 left-4 right-4 z-20">
          <PointCloudTimeline
            versions={pointCloudVersions}
            currentVersionId={currentPointCloud?.versionId}
            onVersionSelect={handleVersionSelect}
            annotations={annotations}
          />
        </div>
      )}

      {cameraError && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
          <div className="p-6 bg-slate-900/95 rounded-2xl border border-status-error/30 backdrop-blur-xl max-w-md">
            <h3 className="text-status-error font-bold mb-2">摄像头访问失败</h3>
            <p className="text-slate-400 text-sm mb-4">{cameraError.message}</p>
            <GlowButton variant="primary" onClick={() => startCamera()}>
              重新尝试
            </GlowButton>
          </div>
        </div>
      )}
    </div>
  );
}
