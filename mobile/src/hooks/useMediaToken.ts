import { useQuery } from '@tanstack/react-query';

import { fetchMediaToken } from '@/api/auth';
import { queryKeys } from '@/api/queryKeys';
import { useAuthStore } from '@/store/authStore';

const REFRESH_MS = 4 * 60 * 1000; // Server TTL is 5 minutes.

/**
 * Short-lived token appended to media URLs, since <img>/<video> sources cannot
 * carry an Authorization header.
 */
export function useMediaToken() {
  const token = useAuthStore((s) => s.token);
  const serverUrl = useAuthStore((s) => s.serverUrl);

  const query = useQuery({
    queryKey: queryKeys.mediaToken(),
    queryFn: async () => (await fetchMediaToken()).token,
    enabled: Boolean(token && serverUrl),
    refetchInterval: REFRESH_MS,
    refetchIntervalInBackground: false,
    staleTime: REFRESH_MS,
    gcTime: REFRESH_MS * 2,
    retry: 1,
  });

  return {
    mediaToken: query.data ?? null,
    isLoading: query.isLoading,
    refresh: query.refetch,
  };
}
