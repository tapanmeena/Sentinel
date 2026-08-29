export type CameraConnectionState =
  | 'connected'
  | 'connecting'
  | 'reconnecting'
  | 'offline'
  | 'disabled';

export type CameraKind = 'PiCamera' | 'RTSPCamera';

export interface CameraStatus {
  camera_id: string;
  name: string;
  type: CameraKind | string;
  state: CameraConnectionState;
  enabled: boolean;
  last_error: string | null;
  resolution: [number, number];
  framerate: number;
  is_recording: boolean;
  motion_enabled: boolean;
  motion_detected: boolean;
  /** RTSP cameras only. */
  retry_count?: number;
  /** RTSP cameras only, seconds until the next reconnect attempt. */
  next_retry_in?: number | null;
}

export interface RecordingStatus {
  is_recording: boolean;
  is_motion_recording: boolean;
  /** Full path from status/stop, bare filename from start. Normalise before display. */
  filename: string | null;
  duration: number | null;
  start_time: string | null;
  camera_id: string;
}

export interface Recording {
  filename: string;
  camera_id: string;
  camera_name: string;
  size: number;
  created: string;
  thumbnail: string | null;
}

export interface MotionStatus {
  camera_id: string;
  enabled: boolean;
  motion_detected: boolean;
  is_motion_recording: boolean;
  sensitivity: number;
  cooldown: number;
  buffer_seconds: number;
  time_since_motion: number | null;
}

export interface MotionSettings {
  sensitivity: number;
  cooldown: number;
  buffer_seconds: number;
}

export interface MutationResult {
  success: boolean;
  message?: string;
  filename?: string;
  camera_id?: string;
  start_time?: string;
  duration?: number;
  size?: number;
  type?: 'manual' | 'motion' | string;
}

export interface StorageStats {
  recordings_count: number;
  total_size_bytes: number;
  per_camera: {
    camera_id: string;
    camera_name: string;
    count: number;
    size: number;
  }[];
}

export interface LoginResponse {
  token: string;
  username: string;
  expires_at: string;
}

export interface MeResponse {
  username: string;
  authenticated: boolean;
  server?: string;
}

export interface MediaTokenResponse {
  token: string;
  expires_in: number;
}

/** Motion setting bounds, mirrored from `BaseCamera.set_motion_settings`. */
export const MOTION_BOUNDS = {
  sensitivity: { min: 1, max: 100 },
  cooldown: { min: 3, max: 60 },
  buffer_seconds: { min: 1, max: 10 },
} as const;
