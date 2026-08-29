import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getRecordingStatus, startRecording, stopRecording } from '@/api/cameras';
import { describeError } from '@/api/errors';
import { queryKeys } from '@/api/queryKeys';
import { toast } from '@/components/ui/Toast';

const POLL_MS = 2000;

export function useRecordingStatus(cameraId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.recordingStatus(cameraId ?? 'none'),
    queryFn: () => getRecordingStatus(cameraId as string),
    enabled: Boolean(cameraId) && enabled,
    refetchInterval: enabled ? POLL_MS : false,
    refetchIntervalInBackground: false,
    staleTime: 1000,
  });
}

/**
 * Ticks a display timer anchored to the server's reported duration and the
 * moment that response arrived, so it survives backgrounding and never drifts
 * (and avoids depending on the Pi and the phone sharing a timezone).
 */
export function useRecordingElapsed(
  isRecording: boolean,
  serverDuration: number | null | undefined,
  dataUpdatedAt: number,
): number {
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!isRecording) return;
    const tick = () => setNow(Date.now());
    const immediate = setTimeout(tick, 0);
    const interval = setInterval(tick, 500);
    return () => {
      clearTimeout(immediate);
      clearInterval(interval);
    };
  }, [isRecording]);

  if (!isRecording || serverDuration == null || now === 0 || dataUpdatedAt === 0) {
    return Math.max(0, Math.floor(serverDuration ?? 0));
  }
  return Math.max(0, Math.floor(serverDuration + (now - dataUpdatedAt) / 1000));
}

export function useRecordingControls(cameraId: string | null) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    if (!cameraId) return;
    queryClient.invalidateQueries({ queryKey: queryKeys.recordingStatus(cameraId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.cameras() });
    queryClient.invalidateQueries({ queryKey: queryKeys.recordings() });
    queryClient.invalidateQueries({ queryKey: queryKeys.recordings(cameraId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.storage() });
  };

  const start = useMutation({
    mutationFn: () => startRecording(cameraId as string),
    onSuccess: (result) => {
      if (result.success) toast.success('Recording started');
      else toast.error(result.message ?? 'Could not start recording');
      invalidate();
    },
    onError: (error) => toast.error(describeError(error)),
  });

  const stop = useMutation({
    mutationFn: () => stopRecording(cameraId as string),
    onSuccess: (result) => {
      if (result.success) toast.success('Recording saved');
      else toast.error(result.message ?? 'Could not stop recording');
      invalidate();
    },
    onError: (error) => toast.error(describeError(error)),
  });

  return {
    start,
    stop,
    isBusy: start.isPending || stop.isPending,
  };
}
