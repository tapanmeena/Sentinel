export const queryKeys = {
  all: ['sentinel'] as const,
  session: () => [...queryKeys.all, 'session'] as const,
  mediaToken: () => [...queryKeys.all, 'mediaToken'] as const,
  cameras: () => [...queryKeys.all, 'cameras'] as const,
  recordingStatus: (cameraId: string) =>
    [...queryKeys.all, 'recordingStatus', cameraId] as const,
  motionStatus: (cameraId: string) => [...queryKeys.all, 'motionStatus', cameraId] as const,
  recordings: (cameraId?: string) =>
    [...queryKeys.all, 'recordings', cameraId ?? 'all'] as const,
  storage: () => [...queryKeys.all, 'storage'] as const,
} as const;
