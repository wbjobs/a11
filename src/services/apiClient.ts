import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
  AxiosError,
} from 'axios';
import type {
  UserRole,
  CreateRoomRequest,
  CreateRoomResponse,
  JoinRoomRequest,
  JoinRoomResponse,
  FrameUploadResponse,
  PointCloudHistoryResponse,
  PointCloudData,
} from 'shared/types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
const TIMEOUT = 30000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

class ApiClient {
  private instance: AxiosInstance;
  private token: string | null = null;
  private roomId: string | null = null;

  constructor() {
    this.instance = axios.create({
      baseURL: BASE_URL,
      timeout: TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.instance.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`;
        }
        if (this.roomId) {
          config.headers['Room-Id'] = this.roomId;
        }
        return config;
      },
      (error: AxiosError) => {
        return Promise.reject(this.normalizeError(error));
      }
    );

    this.instance.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error: AxiosError) => {
        return Promise.reject(this.normalizeError(error));
      }
    );
  }

  private normalizeError(error: AxiosError): ApiError {
    const status = error.response?.status || 0;
    const message =
      (error.response?.data as { detail?: string })?.detail ||
      error.message ||
      'Unknown error occurred';

    return {
      status,
      message,
      isNetworkError: !error.response,
      isRetryable: status >= 500 || status === 408 || !error.response,
    };
  }

  private async requestWithRetry<T>(
    config: AxiosRequestConfig,
    retries: number = MAX_RETRIES
  ): Promise<T> {
    let attempt = 0;
    let lastError: ApiError | null = null;

    while (attempt <= retries) {
      try {
        const response: AxiosResponse<T> = await this.instance.request(config);
        return response.data;
      } catch (error) {
        lastError = error as ApiError;

        if (!lastError.isRetryable || attempt >= retries) {
          break;
        }

        attempt++;
        const delay = RETRY_DELAY * Math.pow(2, attempt - 1);
        await this.sleep(delay);
      }
    }

    throw lastError || new Error('Request failed');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  setToken(token: string | null): void {
    this.token = token;
  }

  setRoomId(roomId: string | null): void {
    this.roomId = roomId;
  }

  clearCredentials(): void {
    this.token = null;
    this.roomId = null;
  }

  async createRoom(username: string): Promise<CreateRoomResponse> {
    const data: CreateRoomRequest = { username };

    return this.requestWithRetry<CreateRoomResponse>({
      method: 'POST',
      url: '/room/create',
      data,
    });
  }

  async joinRoom(
    roomId: string,
    username: string,
    role: UserRole
  ): Promise<JoinRoomResponse> {
    const data: JoinRoomRequest = {
      roomId: roomId.toUpperCase(),
      username,
      role,
    };

    return this.requestWithRetry<JoinRoomResponse>({
      method: 'POST',
      url: '/room/join',
      data,
    });
  }

  async uploadFrame(
    roomId: string,
    token: string,
    formData: FormData
  ): Promise<FrameUploadResponse> {
    this.setToken(token);
    this.setRoomId(roomId);

    return this.requestWithRetry<FrameUploadResponse>({
      method: 'POST',
      url: '/frame/upload',
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 60000,
    });
  }

  async getPointCloudHistory(
    roomId: string,
    token: string
  ): Promise<PointCloudHistoryResponse> {
    this.setToken(token);
    this.setRoomId(roomId);

    return this.requestWithRetry<PointCloudHistoryResponse>({
      method: 'GET',
      url: '/pointcloud/history',
      params: {
        roomId: roomId.toUpperCase(),
      },
    });
  }

  async getPointCloudVersion(
    roomId: string,
    versionId: string,
    token: string
  ): Promise<PointCloudData> {
    this.setToken(token);
    this.setRoomId(roomId);

    return this.requestWithRetry<PointCloudData>({
      method: 'GET',
      url: `/pointcloud/${versionId}`,
    });
  }

  async getLatestPointCloud(
    roomId: string,
    token: string
  ): Promise<PointCloudData> {
    this.setToken(token);
    this.setRoomId(roomId);

    return this.requestWithRetry<PointCloudData>({
      method: 'GET',
      url: '/pointcloud/latest',
    });
  }

  async getQueueStatus(roomId: string, token: string): Promise<{
    roomId: string;
    queueSize: number;
    totalFramesProcessed: number;
  }> {
    this.setToken(token);
    this.setRoomId(roomId);

    const response = await this.requestWithRetry<{
      room_id: string;
      queue_size: number;
      total_frames_processed: number;
    }>({
      method: 'GET',
      url: '/frame/queue-status',
    });

    return {
      roomId: response.room_id,
      queueSize: response.queue_size,
      totalFramesProcessed: response.total_frames_processed,
    };
  }
}

export interface ApiError {
  status: number;
  message: string;
  isNetworkError: boolean;
  isRetryable: boolean;
  originalError?: AxiosError;
}

export const apiClient = new ApiClient();

export default apiClient;
