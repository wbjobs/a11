export interface CameraConstraints {
  width?: number;
  height?: number;
  frameRate?: number;
  facingMode?: 'user' | 'environment';
  deviceId?: string;
}

export interface FrameBlob {
  blob: Blob;
  timestamp: number;
  width: number;
  height: number;
}

export type CaptureFormat = 'image/png' | 'image/jpeg' | 'image/webp';

export class CameraError extends Error {
  constructor(
    message: string,
    public code: 'PERMISSION_DENIED' | 'DEVICE_NOT_FOUND' | 'CONSTRAINT_NOT_SATISFIED' | 'NOT_SUPPORTED' | 'UNKNOWN'
  ) {
    super(message);
    this.name = 'CameraError';
  }
}

class CameraService {
  private currentStream: MediaStream | null = null;
  private currentConstraints: CameraConstraints = {
    width: 1280,
    height: 720,
    frameRate: 30,
  };

  async getCameraDevices(): Promise<MediaDeviceInfo[]> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        throw new CameraError('浏览器不支持设备枚举功能', 'NOT_SUPPORTED');
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');

      if (videoDevices.length === 0) {
        throw new CameraError('未找到可用的摄像头设备', 'DEVICE_NOT_FOUND');
      }

      return videoDevices;
    } catch (error) {
      if (error instanceof CameraError) {
        throw error;
      }
      throw new CameraError(
        (error as Error).message || '获取摄像头设备列表失败',
        'UNKNOWN'
      );
    }
  }

  async startCamera(constraints?: CameraConstraints): Promise<MediaStream> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new CameraError('浏览器不支持摄像头功能', 'NOT_SUPPORTED');
      }

      const mergedConstraints: MediaStreamConstraints = {
        video: {
          width: { ideal: constraints?.width ?? this.currentConstraints.width },
          height: { ideal: constraints?.height ?? this.currentConstraints.height },
          frameRate: { ideal: constraints?.frameRate ?? this.currentConstraints.frameRate },
          facingMode: constraints?.facingMode ?? this.currentConstraints.facingMode,
          deviceId: constraints?.deviceId ?? this.currentConstraints.deviceId,
        },
        audio: false,
      };

      this.currentStream = await navigator.mediaDevices.getUserMedia(mergedConstraints);

      this.currentConstraints = {
        width: constraints?.width ?? this.currentConstraints.width,
        height: constraints?.height ?? this.currentConstraints.height,
        frameRate: constraints?.frameRate ?? this.currentConstraints.frameRate,
        facingMode: constraints?.facingMode ?? this.currentConstraints.facingMode,
        deviceId: constraints?.deviceId ?? this.currentConstraints.deviceId,
      };

      return this.currentStream;
    } catch (error) {
      if (error instanceof CameraError) {
        throw error;
      }

      const err = error as { name?: string; message?: string };

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        throw new CameraError('摄像头权限被拒绝，请在浏览器设置中允许访问摄像头', 'PERMISSION_DENIED');
      }

      if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        throw new CameraError('未找到可用的摄像头设备', 'DEVICE_NOT_FOUND');
      }

      if (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError') {
        throw new CameraError('无法满足指定的摄像头参数要求', 'CONSTRAINT_NOT_SATISFIED');
      }

      throw new CameraError(err.message || '启动摄像头失败', 'UNKNOWN');
    }
  }

  stopCamera(): void {
    if (this.currentStream) {
      this.currentStream.getTracks().forEach(track => {
        track.stop();
      });
      this.currentStream = null;
    }
  }

  async captureFrame(
    videoElement: HTMLVideoElement,
    format: CaptureFormat = 'image/png',
    quality: number = 0.92
  ): Promise<FrameBlob> {
    if (!videoElement || !videoElement.videoWidth || !videoElement.videoHeight) {
      throw new CameraError('视频元素未准备好或未加载视频流', 'UNKNOWN');
    }

    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new CameraError('无法创建 Canvas 上下文', 'UNKNOWN');
    }

    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        blob => {
          if (blob) {
            resolve({
              blob,
              timestamp: Date.now(),
              width: canvas.width,
              height: canvas.height,
            });
          } else {
            reject(new CameraError('帧捕获失败', 'UNKNOWN'));
          }
        },
        format,
        quality
      );
    });
  }

  async captureFrameAsBase64(
    videoElement: HTMLVideoElement,
    format: CaptureFormat = 'image/png',
    quality: number = 0.92
  ): Promise<string> {
    const frame = await this.captureFrame(videoElement, format, quality);
    const arrayBuffer = await frame.blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    return `data:${format};base64,${btoa(binary)}`;
  }

  createVideoElement(stream: MediaStream): HTMLVideoElement {
    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    return video;
  }

  setCameraConstraints(width: number, height: number, frameRate: number): void {
    this.currentConstraints = {
      ...this.currentConstraints,
      width,
      height,
      frameRate,
    };
  }

  toggleStream(stream: MediaStream, enabled: boolean, type: 'video' | 'audio' = 'video'): void {
    const tracks = type === 'video' ? stream.getVideoTracks() : stream.getAudioTracks();
    tracks.forEach(track => {
      track.enabled = enabled;
    });
  }

  getCurrentStream(): MediaStream | null {
    return this.currentStream;
  }

  getCurrentConstraints(): CameraConstraints {
    return { ...this.currentConstraints };
  }
}

export const cameraService = new CameraService();
