import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as ScreenOrientation from 'expo-screen-orientation';
import { LinearGradient } from 'expo-linear-gradient';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { captureSnapshot } from '@/api/cameras';
import { describeError } from '@/api/errors';
import { queryKeys } from '@/api/queryKeys';
import { CameraGrid } from '@/components/CameraGrid';
import { CameraSelectorButton, CameraSelectorSheet } from '@/components/CameraSelector';
import { ConnectionOverlay } from '@/components/ConnectionOverlay';
import { LiveControls } from '@/components/LiveControls';
import { MjpegStream } from '@/components/MjpegStream';
import { IconButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Card, Txt } from '@/components/ui/Layout';
import { Screen } from '@/components/ui/Screen';
import { Sheet } from '@/components/ui/Sheet';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { StatusPill } from '@/components/ui/Status';
import { toast } from '@/components/ui/Toast';
import { useActiveCamera } from '@/hooks/useCameras';
import { useLiveGate } from '@/hooks/useLiveGate';
import { useMediaToken } from '@/hooks/useMediaToken';
import { useMotionControls, useMotionStatus } from '@/hooks/useMotion';
import {
  useRecordingControls,
  useRecordingElapsed,
  useRecordingStatus,
} from '@/hooks/useRecordingStatus';
import { useUiStore } from '@/store/uiStore';
import { useTheme } from '@/theme/ThemeProvider';
import { formatDuration, resolutionLabel } from '@/utils/format';

export default function LiveScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const gate = useLiveGate();

  const liveLayout = useUiStore((s) => s.liveLayout);
  const setLiveLayout = useUiStore((s) => s.setLiveLayout);
  const setSelectedCamera = useUiStore((s) => s.setSelectedCamera);

  const { cameras, activeCamera, isLoading, isError, error, refetch, isRefetching } =
    useActiveCamera(gate);
  const { mediaToken } = useMediaToken();

  const cameraId = activeCamera?.camera_id ?? null;
  const recording = useRecordingStatus(cameraId, gate);
  const motion = useMotionStatus(cameraId, gate);
  const { start, stop, isBusy: recordBusy } = useRecordingControls(cameraId);
  const { toggle: motionToggle } = useMotionControls(cameraId);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const isRecording = recording.data?.is_recording ?? activeCamera?.is_recording ?? false;
  const elapsed = useRecordingElapsed(
    isRecording,
    recording.data?.duration,
    recording.dataUpdatedAt,
  );
  const motionEnabled = motion.data?.enabled ?? activeCamera?.motion_enabled ?? false;
  const motionDetected = motion.data?.motion_detected ?? activeCamera?.motion_detected ?? false;

  const snapshot = useMutation({
    mutationFn: () => captureSnapshot(cameraId as string),
    onSuccess: (result) => {
      if (result.success) toast.success(`Snapshot saved: ${result.filename ?? 'image'}`);
      else toast.error(result.message ?? 'Could not capture snapshot');
    },
    onError: (err) => toast.error(describeError(err)),
  });

  // Haptic pulse on the rising edge of a motion event only.
  const motionWasDetected = useRef(false);
  useEffect(() => {
    if (motionDetected && !motionWasDetected.current) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    motionWasDetected.current = motionDetected;
  }, [motionDetected]);

  useEffect(() => {
    if (!fullscreen) return;
    ScreenOrientation.unlockAsync().catch(() => {});
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, [fullscreen]);

  const onToggleRecord = useCallback(() => {
    if (!cameraId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (isRecording) stop.mutate();
    else start.mutate();
  }, [cameraId, isRecording, start, stop]);

  const refreshAll = useCallback(() => {
    refetch();
    queryClient.invalidateQueries({ queryKey: queryKeys.cameras() });
    if (cameraId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.recordingStatus(cameraId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.motionStatus(cameraId) });
    }
  }, [cameraId, queryClient, refetch]);

  const infoRows = useMemo(() => {
    if (!activeCamera) return [];
    return [
      { label: 'Camera ID', value: activeCamera.camera_id },
      {
        label: 'Source',
        value: activeCamera.type === 'PiCamera' ? 'Raspberry Pi camera' : 'RTSP network camera',
      },
      {
        label: 'Resolution',
        value: `${activeCamera.resolution?.[0] ?? '--'} x ${activeCamera.resolution?.[1] ?? '--'} (${resolutionLabel(activeCamera.resolution)})`,
      },
      { label: 'Frame rate', value: `${activeCamera.framerate} fps` },
      { label: 'Codec', value: 'MJPEG live / MP4 recordings' },
      { label: 'Motion detection', value: motionEnabled ? 'Enabled' : 'Disabled' },
      ...(activeCamera.retry_count != null
        ? [{ label: 'Reconnect attempts', value: String(activeCamera.retry_count) }]
        : []),
      ...(activeCamera.last_error
        ? [{ label: 'Last error', value: activeCamera.last_error }]
        : []),
    ];
  }, [activeCamera, motionEnabled]);

  if (isLoading) {
    return (
      <Screen>
        <View style={{ padding: theme.space.lg, gap: theme.space.lg }}>
          <Skeleton height={38} width="55%" radius={theme.radius.pill} />
          <Skeleton height={200} radius={theme.radius.lg} />
          <Skeleton height={62} radius={theme.radius.lg} />
        </View>
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen>
        <ErrorState message={describeError(error)} onRetry={refetch} />
      </Screen>
    );
  }

  if (!activeCamera) {
    return (
      <Screen>
        <EmptyState
          icon="camera"
          title="No cameras configured"
          message="Add a camera to CAMERAS in config.py on your Sentinel server, then restart it."
          actionLabel="Refresh"
          onAction={refreshAll}
        />
      </Screen>
    );
  }

  const videoStack = (
    <>
      <MjpegStream
        cameraId={activeCamera.camera_id}
        mediaToken={mediaToken}
        active={gate && activeCamera.state !== 'disabled'}
      />

      <LinearGradient
        colors={theme.colors.videoScrim as unknown as [string, string]}
        style={styles.bottomScrim}
        pointerEvents="none"
      />

      <View style={styles.topOverlay} pointerEvents="none">
        <View style={[styles.liveBadge, { backgroundColor: theme.colors.scrim }]}>
          <View style={[styles.liveDot, { backgroundColor: theme.colors.live }]} />
          <Txt variant="overline" uppercase style={styles.overlayText}>
            Live
          </Txt>
        </View>

        {isRecording ? (
          <View style={[styles.liveBadge, { backgroundColor: theme.colors.live }]}>
            <View style={styles.recSquare} />
            <Txt variant="mono" style={styles.overlayText}>
              {formatDuration(elapsed)}
            </Txt>
          </View>
        ) : null}
      </View>

      <View style={styles.bottomOverlay} pointerEvents="box-none">
        <Txt variant="label" numberOfLines={1} style={[styles.overlayText, styles.flex]}>
          {activeCamera.name}
        </Txt>
        <IconButton
          icon={fullscreen ? 'minimize' : 'maximize'}
          label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          onPress={() => setFullscreen((v) => !v)}
          size={36}
          variant="plain"
          style={{ backgroundColor: theme.colors.scrim }}
        />
      </View>

      {motionDetected ? (
        <View
          style={[styles.motionBanner, { backgroundColor: theme.colors.live }]}
          pointerEvents="none"
        >
          <Icon name="activity" size={13} color="#FFFFFF" />
          <Txt variant="overline" uppercase style={styles.overlayText}>
            Motion detected
          </Txt>
        </View>
      ) : null}

      <ConnectionOverlay camera={activeCamera} />
    </>
  );

  return (
    <Screen>
      <View style={[styles.header, { paddingHorizontal: theme.space.lg }]}>
        <CameraSelectorButton
          camera={activeCamera}
          cameraCount={cameras.length}
          onPress={() => setPickerOpen(true)}
        />
        <View style={styles.headerActions}>
          {cameras.length > 1 ? (
            <IconButton
              icon={liveLayout === 'grid' ? 'square' : 'grid'}
              label={liveLayout === 'grid' ? 'Single camera view' : 'Grid view'}
              onPress={() => setLiveLayout(liveLayout === 'grid' ? 'single' : 'grid')}
              size={38}
              tone={liveLayout === 'grid' ? 'brand' : 'default'}
            />
          ) : null}
          <IconButton icon="refresh" label="Refresh" onPress={refreshAll} size={38} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: theme.space.lg, paddingTop: 0, gap: theme.space.lg }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refreshAll}
            tintColor={theme.colors.brand}
            colors={[theme.colors.brand]}
          />
        }
      >
        {liveLayout === 'grid' && cameras.length > 1 ? (
          <CameraGrid
            cameras={cameras}
            mediaToken={mediaToken}
            active={gate}
            onExpand={(id) => {
              setSelectedCamera(id);
              setLiveLayout('single');
            }}
          />
        ) : (
          <>
            <View
              style={[
                styles.videoFrame,
                {
                  borderRadius: theme.radius.lg,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.videoBackdrop,
                },
              ]}
            >
              {videoStack}
            </View>

            <LiveControls
              isRecording={isRecording}
              recordBusy={recordBusy}
              onToggleRecord={onToggleRecord}
              onSnapshot={() => snapshot.mutate()}
              snapshotBusy={snapshot.isPending}
              motionEnabled={motionEnabled}
              motionBusy={motionToggle.isPending}
              onToggleMotion={() => motionToggle.mutate(!motionEnabled)}
              onShowInfo={() => setInfoOpen(true)}
              disabled={activeCamera.state === 'disabled'}
            />

            <Card padded={false}>
              <View style={[styles.statusRow, { padding: theme.space.lg }]}>
                <View style={styles.statusItem}>
                  <Txt variant="overline" tone="faint" uppercase>
                    Status
                  </Txt>
                  <StatusPill state={activeCamera.state} />
                </View>
                <View style={styles.statusItem}>
                  <Txt variant="overline" tone="faint" uppercase>
                    Quality
                  </Txt>
                  <Txt variant="bodyStrong">
                    {resolutionLabel(activeCamera.resolution)} · {activeCamera.framerate}fps
                  </Txt>
                </View>
                <View style={styles.statusItem}>
                  <Txt variant="overline" tone="faint" uppercase>
                    Motion
                  </Txt>
                  <Txt variant="bodyStrong" tone={motionEnabled ? 'success' : 'muted'}>
                    {motionEnabled ? 'Armed' : 'Off'}
                  </Txt>
                </View>
              </View>
            </Card>
          </>
        )}
      </ScrollView>

      <CameraSelectorSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        cameras={cameras}
        activeId={activeCamera.camera_id}
        onSelect={setSelectedCamera}
      />

      <Sheet visible={infoOpen} onClose={() => setInfoOpen(false)} title={activeCamera.name} scrollable>
        <View style={{ gap: theme.space.xs }}>
          {infoRows.map((row) => (
            <View
              key={row.label}
              style={[styles.infoRow, { borderBottomColor: theme.colors.border }]}
            >
              <Txt variant="small" tone="muted">
                {row.label}
              </Txt>
              <Txt variant="small" style={styles.infoValue} numberOfLines={2}>
                {row.value}
              </Txt>
            </View>
          ))}
        </View>
      </Sheet>

      <Modal
        visible={fullscreen}
        animationType="fade"
        statusBarTranslucent
        supportedOrientations={['portrait', 'landscape']}
        onRequestClose={() => setFullscreen(false)}
      >
        <Pressable
          style={[styles.fullscreen, { backgroundColor: theme.colors.videoBackdrop }]}
          onPress={() => setFullscreen(false)}
          accessibilityRole="button"
          accessibilityLabel="Exit fullscreen"
        >
          <MjpegStream
            cameraId={activeCamera.camera_id}
            mediaToken={mediaToken}
            active={activeCamera.state !== 'disabled'}
          />
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  videoFrame: {
    width: '100%',
    aspectRatio: 16 / 9,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  topOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  recSquare: { width: 8, height: 8, borderRadius: 2, backgroundColor: '#FFFFFF' },
  overlayText: { color: '#FFFFFF' },
  flex: { flex: 1 },
  bottomScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 76,
  },
  bottomOverlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  motionBanner: {
    position: 'absolute',
    alignSelf: 'center',
    top: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statusItem: { gap: 6, flex: 1 },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
  },
  infoValue: { flexShrink: 1, textAlign: 'right' },
  fullscreen: { flex: 1 },
});
