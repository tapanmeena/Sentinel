import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { thumbnailUrl } from '@/api/recordings';
import type { Recording } from '@/api/types';
import { useTheme } from '@/theme/ThemeProvider';
import { formatFileSize, formatRelative, recordingTitle, recordingTrigger } from '@/utils/format';
import { Icon } from './ui/Icon';
import { Badge } from './ui/Button';
import { Txt } from './ui/Layout';

interface CommonProps {
  recording: Recording;
  mediaToken: string | null;
  onPlay: () => void;
  onMore: () => void;
}

function Thumbnail({
  recording,
  mediaToken,
  radius,
}: {
  recording: Recording;
  mediaToken: string | null;
  radius: number;
}) {
  const theme = useTheme();
  const uri =
    recording.thumbnail && mediaToken
      ? thumbnailUrl(recording.camera_id, recording.thumbnail, mediaToken)
      : null;

  return (
    <View
      style={[
        styles.thumb,
        { backgroundColor: theme.colors.surfaceSunken, borderRadius: radius },
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={styles.thumbImage}
          contentFit="cover"
          transition={140}
          cachePolicy="memory-disk"
        />
      ) : (
        <View style={styles.thumbFallback}>
          <Icon name="image" size={20} color={theme.colors.textFaint} />
          <Txt variant="overline" tone="faint" uppercase>
            No preview
          </Txt>
        </View>
      )}

      <LinearGradient
        colors={theme.colors.videoScrim as unknown as [string, string]}
        style={styles.thumbScrim}
        pointerEvents="none"
      />

      <View style={[styles.playBadge, { backgroundColor: theme.colors.scrim }]} pointerEvents="none">
        <Icon name="play" size={13} color="#FFFFFF" />
      </View>
    </View>
  );
}

function RecordingCardBase({ recording, mediaToken, onPlay, onMore }: CommonProps) {
  const theme = useTheme();
  const trigger = recordingTrigger(recording.filename);

  return (
    <Pressable
      onPress={onPlay}
      onLongPress={onMore}
      accessibilityRole="button"
      accessibilityLabel={`Play ${recordingTitle(recording.filename)} from ${recording.camera_name}`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.lg,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Thumbnail recording={recording} mediaToken={mediaToken} radius={theme.radius.md} />

      <View style={[styles.cardBody, { padding: theme.space.md, gap: theme.space.xs }]}>
        <Txt variant="bodyStrong" numberOfLines={1}>
          {recordingTitle(recording.filename)}
        </Txt>
        <Txt variant="small" tone="muted" numberOfLines={1}>
          {recording.camera_name}
        </Txt>

        <View style={[styles.cardMeta, { marginTop: theme.space.xs }]}>
          <Badge label={trigger} tone={trigger === 'motion' ? 'warning' : 'brand'} />
          <Txt variant="small" tone="faint">
            {formatFileSize(recording.size)}
          </Txt>
        </View>
        <Txt variant="small" tone="faint">
          {formatRelative(recording.created)}
        </Txt>
      </View>
    </Pressable>
  );
}

function RecordingRowBase({ recording, mediaToken, onPlay, onMore }: CommonProps) {
  const theme = useTheme();
  const trigger = recordingTrigger(recording.filename);

  return (
    <Pressable
      onPress={onPlay}
      onLongPress={onMore}
      accessibilityRole="button"
      accessibilityLabel={`Play ${recordingTitle(recording.filename)} from ${recording.camera_name}`}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.md,
          padding: theme.space.sm + 2,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.rowThumb}>
        <Thumbnail recording={recording} mediaToken={mediaToken} radius={theme.radius.sm} />
      </View>

      <View style={styles.rowBody}>
        <Txt variant="bodyStrong" numberOfLines={1}>
          {recordingTitle(recording.filename)}
        </Txt>
        <Txt variant="small" tone="muted" numberOfLines={1}>
          {recording.camera_name} · {formatFileSize(recording.size)}
        </Txt>
        <View style={styles.rowMeta}>
          <Badge label={trigger} tone={trigger === 'motion' ? 'warning' : 'brand'} />
          <Txt variant="small" tone="faint">
            {formatRelative(recording.created)}
          </Txt>
        </View>
      </View>

      <Pressable
        onPress={onMore}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Recording actions"
        style={styles.rowMore}
      >
        <Icon name="chevronRight" size={18} color={theme.colors.textFaint} />
      </Pressable>
    </Pressable>
  );
}

export const RecordingCard = memo(RecordingCardBase);
export const RecordingRow = memo(RecordingRowBase);

const styles = StyleSheet.create({
  card: {
    flex: 1,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  cardBody: {},
  cardMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  thumb: {
    width: '100%',
    aspectRatio: 16 / 9,
    overflow: 'hidden',
  },
  thumbImage: { width: '100%', height: '100%' },
  thumbFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  thumbScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 34 },
  playBadge: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  rowThumb: { width: 104 },
  rowBody: { flex: 1, gap: 3 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  rowMore: { paddingHorizontal: 2 },
});
