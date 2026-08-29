import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { describeError } from '@/api/errors';
import { queryKeys } from '@/api/queryKeys';
import { deleteRecording, getStorageStats, listRecordings } from '@/api/recordings';
import type { Recording } from '@/api/types';
import { toast } from '@/components/ui/Toast';
import { useAuthStore } from '@/store/authStore';

export function useRecordings(cameraId?: string) {
  const token = useAuthStore((s) => s.token);

  return useQuery({
    queryKey: queryKeys.recordings(cameraId),
    queryFn: () => listRecordings(cameraId),
    enabled: Boolean(token),
    staleTime: 20_000,
  });
}

export function useStorageStats() {
  const token = useAuthStore((s) => s.token);

  return useQuery({
    queryKey: queryKeys.storage(),
    queryFn: getStorageStats,
    enabled: Boolean(token),
    staleTime: 30_000,
  });
}

export function useDeleteRecording(activeFilter?: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.recordings(activeFilter);

  return useMutation({
    mutationFn: ({ cameraId, filename }: { cameraId: string; filename: string }) =>
      deleteRecording(cameraId, filename),
    onMutate: async ({ cameraId, filename }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Recording[]>(key);
      queryClient.setQueryData<Recording[]>(key, (current) =>
        (current ?? []).filter((r) => !(r.camera_id === cameraId && r.filename === filename)),
      );
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      toast.error(describeError(error));
    },
    onSuccess: (result) => {
      if (result.success) toast.success('Recording deleted');
      else toast.error(result.message ?? 'Could not delete recording');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recordings() });
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: queryKeys.storage() });
    },
  });
}
