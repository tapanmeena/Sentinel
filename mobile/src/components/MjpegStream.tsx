import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { embedStreamUrl } from '@/api/recordings';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from './ui/Icon';
import { Txt } from './ui/Layout';

export type StreamState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error' | 'paused';

interface StreamMessage {
  type?: string;
  state?: StreamState;
  attempt?: number;
}

export interface MjpegStreamProps {
  cameraId: string;
  mediaToken: string | null;
  /** When false the WebView unmounts, closing the MJPEG socket on the Pi. */
  active: boolean;
  fit?: 'contain' | 'cover';
  /** Hides the built-in overlay when the parent renders its own. */
  hideOverlay?: boolean;
}

/**
 * Renders the server-side `/embed/stream/<id>` page in a WebView.
 *
 * React Native's <Image> cannot consume `multipart/x-mixed-replace` reliably on
 * Android, so the page owns decoding and reconnect backoff and reports status
 * back over postMessage.
 */
export function MjpegStream({
  cameraId,
  mediaToken,
  active,
  fit = 'contain',
  hideOverlay = false,
}: MjpegStreamProps) {
  const theme = useTheme();
  const [reported, setReported] = useState<StreamState>('idle');

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data) as StreamMessage;
      if (payload.type === 'stream-status' && payload.state) setReported(payload.state);
    } catch {
      // Ignore malformed messages from the page.
    }
  }, []);

  const canRender = active && Boolean(mediaToken);
  const state: StreamState = active ? reported : 'paused';

  const showSpinner = canRender && (state === 'idle' || state === 'connecting');
  const showReconnecting = canRender && state === 'reconnecting';
  const showError = canRender && state === 'error';

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.videoBackdrop }]}>
      {canRender ? (
        <WebView
          key={`${cameraId}:${mediaToken}`}
          source={{ uri: embedStreamUrl(cameraId, mediaToken, fit) }}
          onMessage={handleMessage}
          onLoadStart={() => setReported('connecting')}
          onError={() => setReported('error')}
          onHttpError={() => setReported('error')}
          style={styles.webview}
          containerStyle={styles.webview}
          scrollEnabled={false}
          overScrollMode="never"
          bounces={false}
          javaScriptEnabled
          domStorageEnabled={false}
          cacheEnabled={false}
          incognito
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          androidLayerType="hardware"
          setBuiltInZoomControls={false}
          setDisplayZoomControls={false}
          originWhitelist={['http://*', 'https://*']}
          // The embed page is fully self-contained; block any other navigation.
          onShouldStartLoadWithRequest={(request) => request.url.includes('/embed/stream/')}
        />
      ) : null}

      {hideOverlay ? null : (
        <View pointerEvents="none" style={styles.overlay}>
          {showSpinner ? <ActivityIndicator color={theme.colors.brand} /> : null}

          {showReconnecting ? (
            <View style={[styles.pill, { backgroundColor: theme.colors.scrim }]}>
              <ActivityIndicator size="small" color={theme.colors.warning} />
              <Txt variant="label" style={{ color: theme.colors.warning }}>
                Reconnecting
              </Txt>
            </View>
          ) : null}

          {showError ? (
            <View style={[styles.pill, { backgroundColor: theme.colors.scrim }]}>
              <Icon name="alertTriangle" size={15} color={theme.colors.danger} />
              <Txt variant="label" style={{ color: theme.colors.danger }}>
                Stream unavailable
              </Txt>
            </View>
          ) : null}

          {!active ? (
            <View style={[styles.pill, { backgroundColor: theme.colors.scrim }]}>
              <Icon name="video" size={15} color={theme.colors.textMuted} />
              <Txt variant="label" tone="muted">
                Stream paused
              </Txt>
            </View>
          ) : null}

          {active && !mediaToken ? <ActivityIndicator color={theme.colors.brand} /> : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
});
