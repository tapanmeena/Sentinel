import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';
import { IconButton } from './Button';
import { Txt } from './Layout';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  scrollable?: boolean;
}

/** Bottom sheet built on the native Modal, so it works without gesture setup. */
export function Sheet({ visible, onClose, title, children, scrollable = false }: SheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const body = scrollable ? (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={{ paddingBottom: theme.space.lg }}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View>{children}</View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        style={[styles.backdrop, { backgroundColor: theme.colors.scrim }]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
      />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: theme.colors.bgElevated,
            borderTopLeftRadius: theme.radius['2xl'],
            borderTopRightRadius: theme.radius['2xl'],
            borderColor: theme.colors.border,
            paddingBottom: insets.bottom + theme.space.lg,
            paddingHorizontal: theme.space.lg,
          },
        ]}
      >
        <View style={[styles.grabber, { backgroundColor: theme.colors.borderStrong }]} />
        <View style={[styles.header, { marginBottom: theme.space.md }]}>
          <Txt variant="heading">{title}</Txt>
          <IconButton icon="close" label="Close" onPress={onClose} size={34} variant="plain" />
        </View>
        {body}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  sheet: {
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    paddingTop: 10,
    maxHeight: '80%',
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scroll: { flexGrow: 0 },
});
