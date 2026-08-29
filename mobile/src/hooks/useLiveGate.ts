import { useCallback, useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useFocusEffect } from 'expo-router';

/** True while the app is in the foreground. */
export function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      setActive(next === 'active');
    });
    return () => subscription.remove();
  }, []);

  return active;
}

/** True while this screen is focused. */
export function useScreenFocused(): boolean {
  const [focused, setFocused] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  return focused;
}

/**
 * Gate for polling and live streams: only run when the screen is focused and
 * the app is foregrounded, so we never hold MJPEG sockets open in the
 * background.
 */
export function useLiveGate(): boolean {
  const appActive = useAppActive();
  const focused = useScreenFocused();
  return appActive && focused;
}
