import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { describeError } from '@/api/errors';
import type { CameraStatus } from '@/api/types';
import { MjpegStream } from '@/components/MjpegStream';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Card, Txt } from '@/components/ui/Layout';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { StatusPill } from '@/components/ui/Status';
import { useCameras } from '@/hooks/useCameras';
import { useLiveGate } from '@/hooks/useLiveGate';
import { useMediaToken } from '@/hooks/useMediaToken';
import { useTheme } from '@/theme/ThemeProvider';
import { resolutionLabel } from '@/utils/format';

/** Previews are the expensive part here, so only the first few run at once. */
const MAX_PREVIEWS = 3;

export default function DevicesScreen() {
  const theme = useTheme();
  const gate = useLiveGate();
  const { data, isLoading, isError, error, refetch, isRefetching } = useCameras({ poll: gate });
  const { mediaToken } = useMediaToken();
  const [previewsEnabled, setPreviewsEnabled] = useState(true);

  const cameras = data ?? [];

  const renderCard = useCallback(
    (camera: CameraStatus, index: number) => {
      const canPreview =
        previewsEnabled &&
        gate &&
        index < MAX_PREVIEWS &&
        (camera.state === 'connected' || camera.state === 'reconnecting');

      return (
        <Card key={camera.camera_id} padded={false}>
          <View
            style={[
              styles.preview,
              {
                backgroundColor: theme.colors.videoBackdrop,
                borderTopLeftRadius: theme.radius.lg,
                borderTopRightRadius: theme.radius.lg,
              },
            ]}
          >
            {canPreview ? (
              <MjpegStream
                cameraId={camera.camera_id}
                mediaToken={mediaToken}
                active
                fit="cover"
                hideOverlay
              />
            ) : (
              <View style={styles.previewFallback}>
                <Icon name="video" size={22} color={theme.colors.textFaint} />
                <Txt variant="overline" tone="faint" uppercase>
                  No signal
                </Txt>
              </View>
            )}
          </View>

          <View style={{ padding: theme.space.lg, gap: theme.space.md }}>
            <View style={styles.titleRow}>
              <Txt variant="heading" numberOfLines={1} style={styles.flex}>
                {camera.name}
              </Txt>
              <StatusPill state={camera.state} />
            </View>

            <View style={styles.metaGrid}>
              <Meta label="Type" value={camera.type === 'PiCamera' ? 'Pi camera' : 'RTSP'} />
              <Meta label="ID" value={camera.camera_id} />
              <Meta
                label="Stream"
                value={`${resolutionLabel(camera.resolution)} · ${camera.framerate}fps`}
              />
              <Meta
                label="Motion"
                value={camera.motion_enabled ? 'Armed' : 'Off'}
                tone={camera.motion_enabled ? 'success' : 'muted'}
              />
            </View>

            {camera.state === 'reconnecting' ? (
              <View
                style={[
                  styles.notice,
                  { backgroundColor: theme.colors.warningSoft, borderRadius: theme.radius.sm },
                ]}
              >
                <Icon name="refresh" size={14} color={theme.colors.warning} />
                <Txt variant="small" style={{ color: theme.colors.warning }}>
                  Attempt {camera.retry_count ?? 1}
                  {camera.next_retry_in != null
                    ? ` · retrying in ${Math.ceil(camera.next_retry_in)}s`
                    : ''}
                </Txt>
              </View>
            ) : null}

            {camera.last_error ? (
              <View
                style={[
                  styles.notice,
                  { backgroundColor: theme.colors.dangerSoft, borderRadius: theme.radius.sm },
                ]}
              >
                <Icon name="alertCircle" size={14} color={theme.colors.danger} />
                <Txt variant="small" style={[styles.flex, { color: theme.colors.danger }]}>
                  {camera.last_error}
                </Txt>
              </View>
            ) : null}
          </View>
        </Card>
      );
    },
    [gate, mediaToken, previewsEnabled, theme],
  );

  if (isLoading) {
    return (
      <Screen>
        <View style={{ padding: theme.space.lg, gap: theme.space.lg }}>
          <Skeleton height={30} width="40%" />
          <Skeleton height={260} radius={theme.radius.lg} />
          <Skeleton height={260} radius={theme.radius.lg} />
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

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.lg }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={theme.colors.brand}
            colors={[theme.colors.brand]}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.flex}>
            <Txt variant="title">Devices</Txt>
            <Txt variant="small" tone="muted">
              {cameras.length} {cameras.length === 1 ? 'camera' : 'cameras'} configured
            </Txt>
          </View>
        </View>

        {cameras.length === 0 ? (
          <EmptyState
            icon="hardDrive"
            title="No cameras configured"
            message="Define cameras in the CAMERAS dictionary in config.py on your Sentinel server, then restart the service."
            actionLabel="Refresh"
            onAction={refetch}
          />
        ) : (
          <>
            {cameras.map(renderCard)}
            {cameras.length > MAX_PREVIEWS ? (
              <Txt variant="small" tone="faint" align="center">
                Live previews are limited to the first {MAX_PREVIEWS} cameras to protect the Pi.
              </Txt>
            ) : null}
            <Button
              label={previewsEnabled ? 'Turn off live previews' : 'Turn on live previews'}
              icon={previewsEnabled ? 'eyeOff' : 'eye'}
              variant="secondary"
              size="sm"
              fullWidth
              onPress={() => setPreviewsEnabled((v) => !v)}
            />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function Meta({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'muted' | 'success';
}) {
  return (
    <View style={styles.meta}>
      <Txt variant="overline" tone="faint" uppercase>
        {label}
      </Txt>
      <Txt variant="small" tone={tone === 'default' ? 'default' : tone} numberOfLines={1}>
        {value}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 6 },
  flex: { flex: 1 },
  preview: {
    width: '100%',
    aspectRatio: 16 / 9,
    overflow: 'hidden',
  },
  previewFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 },
  meta: { width: '50%', gap: 3, paddingRight: 8 },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
});
