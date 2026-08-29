import { request } from './client';
import type {
  CameraStatus,
  MotionSettings,
  MotionStatus,
  MutationResult,
  RecordingStatus,
} from './types';

export async function listCameras(): Promise<CameraStatus[]> {
  const data = await request<{ cameras: CameraStatus[] }>('/api/cameras');
  return data.cameras ?? [];
}

export function getCameraStatus(cameraId: string) {
  return request<CameraStatus>(`/api/camera/${encodeURIComponent(cameraId)}/status`);
}

export function getRecordingStatus(cameraId: string) {
  return request<RecordingStatus>(`/api/recording/status/${encodeURIComponent(cameraId)}`);
}

export function startRecording(cameraId: string) {
  return request<MutationResult>(`/api/recording/start/${encodeURIComponent(cameraId)}`, {
    method: 'POST',
  });
}

export function stopRecording(cameraId: string) {
  return request<MutationResult>(`/api/recording/stop/${encodeURIComponent(cameraId)}`, {
    method: 'POST',
  });
}

export function captureSnapshot(cameraId: string) {
  return request<MutationResult>(`/api/snapshot/${encodeURIComponent(cameraId)}`, {
    method: 'POST',
  });
}

export function getMotionStatus(cameraId: string) {
  return request<MotionStatus>(`/api/motion/status/${encodeURIComponent(cameraId)}`);
}

export function setMotionEnabled(cameraId: string, enabled: boolean) {
  const action = enabled ? 'enable' : 'disable';
  return request<MutationResult>(`/api/motion/${action}/${encodeURIComponent(cameraId)}`, {
    method: 'POST',
  });
}

/**
 * Always camera-scoped: the non-scoped variant skips
 * `CameraManager.save_motion_configs()`, so changes would not persist.
 */
export function setMotionSettings(cameraId: string, settings: Partial<MotionSettings>) {
  return request<MutationResult>(`/api/motion/settings/${encodeURIComponent(cameraId)}`, {
    method: 'POST',
    body: settings,
  });
}
