import { onlineManager } from '@tanstack/react-query';
import * as Network from 'expo-network';

/**
 * Tells the data layer when the phone has no connection. Without a connection it waits instead of failing:
 * what was loaded stays on screen (no "can't reach Journey" over a page you were reading), and whatever was
 * waiting is asked again by itself when the connection is back.
 */
export function watchConnection() {
  onlineManager.setEventListener((setOnline) => {
    // "Unknown" counts as connected, as it does for the offline banner.
    const heard = (state: Network.NetworkState) => setOnline(state.isConnected !== false);
    const subscription = Network.addNetworkStateListener(heard);
    void Network.getNetworkStateAsync()
      .then(heard)
      .catch(() => undefined);
    return () => subscription.remove();
  });
}
