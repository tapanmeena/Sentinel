import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { listCameras } from '@/api/cameras';
import { queryKeys } from '@/api/queryKeys';
import type { CameraStatus } from '@/api/types';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';

const POLL_MS = 3000;

export function useCameras(options: { poll?: boolean } = {}) {
  const { poll = true } = options;
  const token = useAuthStore((s) => s.token);

  return useQuery({
    queryKey: queryKeys.cameras(),
    queryFn: listCameras,
    enabled: Boolean(token),
    refetchInterval: poll ? POLL_MS : false,
    refetchIntervalInBackground: false,
    staleTime: 1500,
  });
}

/**
 * Cameras plus the resolved active selection, falling back to the first
 * available camera when the stored id is stale.
 */
export function useActiveCamera(poll = true) {
  const query = useCameras({ poll });
  const selectedCameraId = useUiStore((s) => s.selectedCameraId);
  const setSelectedCamera = useUiStore((s) => s.setSelectedCamera);

  const cameras = useMemo<CameraStatus[]>(() => query.data ?? [], [query.data]);

  const active = useMemo(() => {
    if (cameras.length === 0) return null;
    return cameras.find((c) => c.camera_id === selectedCameraId) ?? cameras[0] ?? null;
  }, [cameras, selectedCameraId]);

  useEffect(() => {
    if (active && active.camera_id !== selectedCameraId) {
      setSelectedCamera(active.camera_id);
    }
  }, [active, selectedCameraId, setSelectedCamera]);

  return { ...query, cameras, activeCamera: active };
}
