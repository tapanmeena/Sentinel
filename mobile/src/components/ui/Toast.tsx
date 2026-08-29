import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { useTheme } from '@/theme/ThemeProvider';
import { Icon, type IconName } from './Icon';
import { Txt } from './Layout';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastState {
  queue: ToastItem[];
  show: (message: string, tone: ToastTone) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

const useToastStore = create<ToastState>((set) => ({
  queue: [],
  show: (message, tone) =>
    set((state) => ({ queue: [...state.queue.slice(-2), { id: nextId++, message, tone }] })),
  dismiss: (id) => set((state) => ({ queue: state.queue.filter((t) => t.id !== id) })),
}));

/** Imperative API so non-component code (mutations, handlers) can notify. */
export const toast = {
  success: (message: string) => useToastStore.getState().show(message, 'success'),
  error: (message: string) => useToastStore.getState().show(message, 'error'),
  info: (message: string) => useToastStore.getState().show(message, 'info'),
  warning: (message: string) => useToastStore.getState().show(message, 'warning'),
};

const ICONS: Record<ToastTone, IconName> = {
  success: 'check',
  error: 'alertCircle',
  info: 'info',
  warning: 'alertTriangle',
};

function ToastRow({ item }: { item: ToastItem }) {
  const theme = useTheme();
  const dismiss = useToastStore((s) => s.dismiss);
  const [anim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 220 }).start();
    const timer = setTimeout(() => dismiss(item.id), 3200);
    return () => clearTimeout(timer);
  }, [anim, dismiss, item.id]);

  const tint =
    item.tone === 'success'
      ? theme.colors.success
      : item.tone === 'error'
        ? theme.colors.danger
        : item.tone === 'warning'
          ? theme.colors.warning
          : theme.colors.info;

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) }],
      }}
    >
      <Pressable
        onPress={() => dismiss(item.id)}
        accessibilityRole="alert"
        accessibilityLabel={item.message}
        style={[
          styles.toast,
          {
            backgroundColor: theme.colors.surfaceHigh,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.md,
            paddingHorizontal: theme.space.lg,
            paddingVertical: theme.space.md,
          },
          theme.elevation.medium,
        ]}
      >
        <View style={[styles.toastIcon, { backgroundColor: `${tint}22` }]}>
          <Icon name={ICONS[item.tone]} size={14} color={tint} />
        </View>
        <Txt variant="small" style={styles.toastText} numberOfLines={3}>
          {item.message}
        </Txt>
      </Pressable>
    </Animated.View>
  );
}

export function ToastHost() {
  const queue = useToastStore((s) => s.queue);
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  if (queue.length === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.host,
        { top: insets.top + theme.space.sm, paddingHorizontal: theme.space.lg, gap: theme.space.sm },
      ]}
    >
      {queue.map((item) => (
        <ToastRow key={item.id} item={item} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  toastIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastText: { flex: 1 },
});
