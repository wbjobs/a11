import { useState, useRef, useEffect, useCallback } from 'react';
import { cameraService, CameraConstraints, FrameBlob, CaptureFormat, CameraError } from '@/services/CameraService';

export interface UseCameraReturn {
  stream: MediaStream | null;
  videoRef: React.RefObject<HTMLVideoElement>;
  isStreaming: boolean;
  error: Error | null;
  devices: MediaDeviceInfo[];
  startCamera: (constraints?: CameraConstraints) => Promise<MediaStream>;
  stopCamera: () => void;
  captureFrame: (format?: CaptureFormat, quality?: number) => Promise<FrameBlob>;
  switchCamera: () => Promise<MediaStream | null>;
}

export function useCamera(): UseCameraReturn {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [currentDeviceIndex, setCurrentDeviceIndex] = useState<number>(0);

  const videoRef = useRef<HTMLVideoElement>(null);

  const loadDevices = useCallback(async () => {
    try {
      const deviceList = await cameraService.getCameraDevices();
      setDevices(deviceList);
    } catch (err) {
      if (err instanceof CameraError && err.code !== 'DEVICE_NOT_FOUND') {
        setError(err);
      }
    }
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const startCamera = useCallback(async (constraints?: CameraConstraints): Promise<MediaStream> => {
    setError(null);
    try {
      const mediaStream = await cameraService.startCamera(constraints);
      setStream(mediaStream);
      setIsStreaming(true);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      const currentConstraints = cameraService.getCurrentConstraints();
      if (currentConstraints.deviceId) {
        const idx = devices.findIndex(d => d.deviceId === currentConstraints.deviceId);
        if (idx !== -1) {
          setCurrentDeviceIndex(idx);
        }
      }

      return mediaStream;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [devices]);

  const stopCamera = useCallback(() => {
    cameraService.stopCamera();
    setStream(null);
    setIsStreaming(false);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const captureFrame = useCallback(async (
    format: CaptureFormat = 'image/png',
    quality: number = 0.92
  ): Promise<FrameBlob> => {
    if (!videoRef.current) {
      throw new CameraError('视频元素未初始化', 'UNKNOWN');
    }
    return cameraService.captureFrame(videoRef.current, format, quality);
  }, []);

  const switchCamera = useCallback(async (): Promise<MediaStream | null> => {
    if (devices.length < 2) {
      return stream;
    }

    const nextIndex = (currentDeviceIndex + 1) % devices.length;
    const nextDevice = devices[nextIndex];

    try {
      stopCamera();
      const newStream = await startCamera({
        deviceId: nextDevice.deviceId,
      });
      setCurrentDeviceIndex(nextIndex);
      return newStream;
    } catch (err) {
      setError(err as Error);
      return null;
    }
  }, [devices, currentDeviceIndex, stream, startCamera, stopCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    stream,
    videoRef,
    isStreaming,
    error,
    devices,
    startCamera,
    stopCamera,
    captureFrame,
    switchCamera,
  };
}
