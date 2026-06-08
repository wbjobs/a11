import { useState, useEffect, useRef, useCallback, RefObject } from 'react';
import { FrameBlob, CaptureFormat, CameraError } from '@/services/CameraService';

export interface UseFrameCaptureOptions {
  interval?: number;
  maxQueueSize?: number;
  format?: CaptureFormat;
  quality?: number;
  autoStart?: boolean;
  onFrame?: (frame: FrameBlob) => void;
}

export interface UseFrameCaptureReturn {
  frames: FrameBlob[];
  isCapturing: boolean;
  isPaused: boolean;
  error: Error | null;
  startCapture: () => void;
  stopCapture: () => void;
  pauseCapture: () => void;
  resumeCapture: () => void;
  clearFrames: () => void;
  captureSingleFrame: () => Promise<FrameBlob | null>;
}

export function useFrameCapture(
  videoRef: RefObject<HTMLVideoElement>,
  options: UseFrameCaptureOptions = {}
): UseFrameCaptureReturn {
  const {
    interval = 500,
    maxQueueSize = 30,
    format = 'image/png',
    quality = 0.92,
    autoStart = false,
    onFrame,
  } = options;

  const [frames, setFrames] = useState<FrameBlob[]>([]);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const intervalRef = useRef<number | null>(null);
  const isProcessingRef = useRef<boolean>(false);

  const captureSingleFrame = useCallback(async (): Promise<FrameBlob | null> => {
    const video = videoRef.current;

    if (!video) {
      setError(new CameraError('视频元素未提供', 'UNKNOWN'));
      return null;
    }

    if (!video.videoWidth || !video.videoHeight) {
      return null;
    }

    if (isProcessingRef.current) {
      return null;
    }

    isProcessingRef.current = true;
    setError(null);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new CameraError('无法创建 Canvas 上下文', 'UNKNOWN');
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          b => {
            if (b) {
              resolve(b);
            } else {
              reject(new CameraError('帧捕获失败', 'UNKNOWN'));
            }
          },
          format,
          quality
        );
      });

      const frame: FrameBlob = {
        blob,
        timestamp: Date.now(),
        width: canvas.width,
        height: canvas.height,
      };

      if (onFrame) {
        onFrame(frame);
      }

      setFrames(prev => {
        const newFrames = [...prev, frame];
        if (maxQueueSize > 0 && newFrames.length > maxQueueSize) {
          return newFrames.slice(newFrames.length - maxQueueSize);
        }
        return newFrames;
      });

      return frame;
    } catch (err) {
      setError(err as Error);
      return null;
    } finally {
      isProcessingRef.current = false;
    }
  }, [format, quality, maxQueueSize, onFrame, videoRef]);

  const startCapture = useCallback(() => {
    if (isCapturing) {
      return;
    }

    setIsCapturing(true);
    setIsPaused(false);
    setError(null);

    captureSingleFrame();

    intervalRef.current = window.setInterval(() => {
      if (!isPaused) {
        captureSingleFrame();
      }
    }, interval);
  }, [isCapturing, isPaused, interval, captureSingleFrame]);

  const stopCapture = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsCapturing(false);
    setIsPaused(false);
    isProcessingRef.current = false;
  }, []);

  const pauseCapture = useCallback(() => {
    if (isCapturing && !isPaused) {
      setIsPaused(true);
    }
  }, [isCapturing, isPaused]);

  const resumeCapture = useCallback(() => {
    if (isCapturing && isPaused) {
      setIsPaused(false);
    }
  }, [isCapturing, isPaused]);

  const clearFrames = useCallback(() => {
    setFrames([]);
  }, []);

  useEffect(() => {
    if (autoStart && videoRef.current) {
      startCapture();
    }

    return () => {
      stopCapture();
    };
  }, [autoStart, videoRef, startCapture, stopCapture]);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = window.setInterval(() => {
        if (!isPaused && isCapturing) {
          captureSingleFrame();
        }
      }, interval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [interval]);

  useEffect(() => {
    return () => {
      stopCapture();
    };
  }, [stopCapture]);

  return {
    frames,
    isCapturing,
    isPaused,
    error,
    startCapture,
    stopCapture,
    pauseCapture,
    resumeCapture,
    clearFrames,
    captureSingleFrame,
  };
}
