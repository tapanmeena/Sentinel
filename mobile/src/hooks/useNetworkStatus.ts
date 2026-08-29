import { useEffect, useState } from 'react';
import * as Network from 'expo-network';

/** Coarse online/offline signal for the persistent offline banner. */
export function useNetworkStatus(): { isOffline: boolean } {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    let mounted = true;

    const apply = (state: Network.NetworkState) => {
      if (!mounted) return;
      const reachable = state.isInternetReachable ?? state.isConnected ?? true;
      setIsOffline(!reachable);
    };

    Network.getNetworkStateAsync().then(apply).catch(() => {});
    const subscription = Network.addNetworkStateListener(apply);

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return { isOffline };
}
