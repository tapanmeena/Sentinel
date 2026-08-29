import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getMotionStatus, setMotionEnabled, setMotionSettings } from '@/api/cameras';
import { describeError } from '@/api/errors';
import { queryKeys } from '@/api/queryKeys';
import type { MotionSettings, MotionStatus } from '@/api/types';
import { toast } from '@/components/ui/Toast';

const POLL_MS = 2000;

export function useMotionStatus(cameraId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.motionStatus(cameraId ?? 'none'),
    queryFn: () => getMotionStatus(cameraId as string),
    enabled: Boolean(cameraId) && enabled,
    refetchInterval: enabled ? POLL_MS : false,
    refetchIntervalInBackground: false,
    staleTime: 1000,
  });
}

export function useMotionControls(cameraId: string | null) {
  const queryClient = useQueryClient();
  const key = queryKeys.motionStatus(cameraId ?? 'none');

  const toggle = useMutation({
    mutationFn: (enabled: boolean) => setMotionEnabled(cameraId as string, enabled),
    onMutate: async (enabled) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<MotionStatus>(key);
      if (previous) queryClient.setQueryData<MotionStatus>(key, { ...previous, enabled });
      return { previous };
    },
    onError: (error, _enabled, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      toast.error(describeError(error));
    },
    onSuccess: (_result, enabled) => {
      toast.success(enabled ? 'Motion detection on' : 'Motion detection off');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: queryKeys.cameras() });
    },
  });

  const updateSettings = useMutation({
    mutationFn: (settings: Partial<MotionSettings>) =>
      setMotionSettings(cameraId as string, settings),
    onMutate: async (settings) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<MotionStatus>(key);
      if (previous) queryClient.setQueryData<MotionStatus>(key, { ...previous, ...settings });
      return { previous };
    },
    onError: (error, _settings, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      toast.error(describeError(error));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  return { toggle, updateSettings };
}
