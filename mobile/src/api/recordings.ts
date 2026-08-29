import { buildUrl, request } from './client';
import type { MutationResult, Recording, StorageStats } from './types';

export async function listRecordings(cameraId?: string): Promise<Recording[]> {
  const data = await request<{ recordings: Recording[] }>('/api/recordings', {
    params: { camera_id: cameraId },
  });
  return data.recordings ?? [];
}

export function deleteRecording(cameraId: string, filename: string) {
  return request<MutationResult>(
    `/api/recordings/${encodeURIComponent(cameraId)}/${encodeURIComponent(filename)}`,
    { method: 'DELETE' },
  );
}

export function getStorageStats() {
  return request<StorageStats>('/api/storage/stats');
}

export function thumbnailUrl(cameraId: string, thumbnail: string, mediaToken: string | null) {
  return buildUrl(
    `/thumbnails/${encodeURIComponent(cameraId)}/${encodeURIComponent(thumbnail)}`,
    mediaToken ? { token: mediaToken } : undefined,
  );
}

export function playbackUrl(cameraId: string, filename: string, mediaToken: string | null) {
  return buildUrl(
    `/recordings/play/${encodeURIComponent(cameraId)}/${encodeURIComponent(filename)}`,
    mediaToken ? { token: mediaToken } : undefined,
  );
}

export function downloadUrl(cameraId: string, filename: string, mediaToken: string | null) {
  return buildUrl(
    `/recordings/${encodeURIComponent(cameraId)}/${encodeURIComponent(filename)}`,
    mediaToken ? { token: mediaToken } : undefined,
  );
}

export function embedStreamUrl(
  cameraId: string,
  mediaToken: string | null,
  fit: 'contain' | 'cover' = 'contain',
) {
  return buildUrl(`/embed/stream/${encodeURIComponent(cameraId)}`, {
    token: mediaToken ?? undefined,
    fit,
  });
}
