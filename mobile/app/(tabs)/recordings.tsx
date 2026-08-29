import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';

import { describeError } from '@/api/errors';
import type { Recording } from '@/api/types';
import { RecordingCard, RecordingRow } from '@/components/RecordingItems';
import { IconButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Txt } from '@/components/ui/Layout';
import { Screen } from '@/components/ui/Screen';
import { Sheet } from '@/components/ui/Sheet';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { useCameras } from '@/hooks/useCameras';
import { useDownloadRecording } from '@/hooks/useDownloadRecording';
import { useMediaToken } from '@/hooks/useMediaToken';
import { useDeleteRecording, useRecordings } from '@/hooks/useRecordings';
import { useUiStore } from '@/store/uiStore';
import { useTheme } from '@/theme/ThemeProvider';
import { formatDateTime, formatFileSize, recordingTitle } from '@/utils/format';

export default function RecordingsScreen() {
  const theme = useTheme();
  const router = useRouter();

  const view = useUiStore((s) => s.recordingsView);
  const setView = useUiStore((s) => s.setRecordingsView);
  const filter = useUiStore((s) => s.recordingsFilter);
  const setFilter = useUiStore((s) => s.setRecordingsFilter);

  const cameras = useCameras({ poll: false });
  const { data, isLoading, isError, error, refetch, isRefetching } = useRecordings(
    filter ?? undefined,
  );
  const { mediaToken } = useMediaToken();
  const remove = useDeleteRecording(filter ?? undefined);
  const { download, isDownloading, progress } = useDownloadRecording(mediaToken);

  const [selected, setSelected] = useState<Recording | null>(null);

  const recordings = useMemo(() => data ?? [], [data]);
  const totalSize = useMemo(
    () => recordings.reduce((sum, item) => sum + item.size, 0),
    [recordings],
  );

  const openPlayer = useCallback(
    (recording: Recording) => {
      router.push({
        pathname: '/player/[cameraId]/[filename]',
        params: { cameraId: recording.camera_id, filename: recording.filename },
      });
    },
    [router],
  );

  const confirmDelete = useCallback(
    (recording: Recording) => {
      Alert.alert(
        'Delete recording?',
        `${recordingTitle(recording.filename)} from ${recording.camera_name} will be permanently removed from the server.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () =>
              remove.mutate({
                cameraId: recording.camera_id,
                filename: recording.filename,
              }),
          },
        ],
      );
    },
    [remove],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Recording; index: number }) => {
      const props = {
        recording: item,
        mediaToken,
        onPlay: () => openPlayer(item),
        onMore: () => setSelected(item),
      };
      if (view === 'list') return <RecordingRow {...props} />;
      // FlashList has no columnWrapperStyle, so the gutter is applied per item.
      return (
        <View style={index % 2 === 0 ? styles.gridLeft : styles.gridRight}>
          <RecordingCard {...props} />
        </View>
      );
    },
    [mediaToken, openPlayer, view],
  );

  const filterChips = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.chips, { gap: theme.space.sm }]}
    >
      <FilterChip label="All cameras" active={filter == null} onPress={() => setFilter(null)} />
      {(cameras.data ?? []).map((camera) => (
        <FilterChip
          key={camera.camera_id}
          label={camera.name}
          active={filter === camera.camera_id}
          onPress={() => setFilter(camera.camera_id)}
        />
      ))}
    </ScrollView>
  );

  const header = (
    <View style={{ gap: theme.space.md, paddingBottom: theme.space.md }}>
      <View style={[styles.headerRow, { paddingHorizontal: theme.space.lg }]}>
        <View style={styles.flex}>
          <Txt variant="title">Recordings</Txt>
          <Txt variant="small" tone="muted">
            {recordings.length} {recordings.length === 1 ? 'clip' : 'clips'} ·{' '}
            {formatFileSize(totalSize)}
          </Txt>
        </View>
        <IconButton
          icon={view === 'grid' ? 'list' : 'grid'}
          label={view === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
          onPress={() => setView(view === 'grid' ? 'list' : 'grid')}
          size={38}
        />
        <IconButton icon="refresh" label="Refresh recordings" onPress={refetch} size={38} />
      </View>
      {filterChips}
    </View>
  );

  if (isLoading) {
    return (
      <Screen>
        <View style={{ padding: theme.space.lg, gap: theme.space.lg }}>
          <Skeleton height={30} width="45%" />
          <Skeleton height={36} radius={theme.radius.pill} />
          <Skeleton height={190} radius={theme.radius.lg} />
          <Skeleton height={190} radius={theme.radius.lg} />
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
      <FlashList
        // Remount when the column count changes; list virtualisers cannot
        // reconfigure numColumns in place.
        key={view}
        data={recordings}
        renderItem={renderItem}
        keyExtractor={(item) => `${item.camera_id}/${item.filename}`}
        numColumns={view === 'grid' ? 2 : 1}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingHorizontal: theme.space.lg, paddingBottom: theme.space['3xl'] }}
        ItemSeparatorComponent={() => <View style={{ height: theme.space.md }} />}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={theme.colors.brand}
            colors={[theme.colors.brand]}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="film"
            title="No recordings yet"
            message={
              filter
                ? 'This camera has no saved clips. Try another camera or record from the Live tab.'
                : 'Start a recording from the Live tab, or arm motion detection to capture events automatically.'
            }
          />
        }
      />

      <Sheet
        visible={selected != null}
        onClose={() => setSelected(null)}
        title={selected ? recordingTitle(selected.filename) : ''}
      >
        {selected ? (
          <View style={{ gap: theme.space.sm }}>
            <Txt variant="small" tone="muted">
              {selected.camera_name} · {formatFileSize(selected.size)} ·{' '}
              {formatDateTime(selected.created)}
            </Txt>

            <View style={{ gap: theme.space.sm, marginTop: theme.space.sm }}>
              <SheetAction
                icon="play"
                label="Play"
                onPress={() => {
                  const item = selected;
                  setSelected(null);
                  openPlayer(item);
                }}
              />
              <SheetAction
                icon="download"
                label={
                  isDownloading ? `Saving… ${Math.round(progress * 100)}%` : 'Save to gallery'
                }
                disabled={isDownloading}
                onPress={() => download(selected.camera_id, selected.filename, 'save')}
              />
              <SheetAction
                icon="share"
                label="Share"
                disabled={isDownloading}
                onPress={() => download(selected.camera_id, selected.filename, 'share')}
              />
              <SheetAction
                icon="trash"
                label="Delete"
                destructive
                onPress={() => {
                  const item = selected;
                  setSelected(null);
                  confirmDelete(item);
                }}
              />
            </View>
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.chip,
        {
          borderRadius: theme.radius.pill,
          backgroundColor: active ? theme.colors.brandSoft : theme.colors.surface,
          borderColor: active ? theme.colors.brandBorder : theme.colors.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Txt variant="label" style={{ color: active ? theme.colors.brand : theme.colors.textMuted }}>
        {label}
      </Txt>
    </Pressable>
  );
}

function SheetAction({
  icon,
  label,
  onPress,
  destructive = false,
  disabled = false,
}: {
  icon: Parameters<typeof Icon>[0]['name'];
  label: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const fg = destructive ? theme.colors.danger : theme.colors.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.sheetAction,
        {
          backgroundColor: destructive ? theme.colors.dangerSoft : theme.colors.surface,
          borderColor: destructive ? 'transparent' : theme.colors.border,
          borderRadius: theme.radius.md,
          padding: theme.space.md,
          opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
        },
      ]}
    >
      <Icon name={icon} size={18} color={fg} />
      <Txt variant="bodyStrong" style={{ color: fg }}>
        {label}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 10 },
  flex: { flex: 1 },
  gridLeft: { flex: 1, paddingRight: 6 },
  gridRight: { flex: 1, paddingLeft: 6 },
  chips: { paddingHorizontal: 16 },
  chip: {
    height: 34,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  sheetAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
});
