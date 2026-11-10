import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

/** Where the app is running, as far as notifications care. */
export type PushSupport = 'ready' | 'browser' | 'expoGo';

/**
 * Whether this copy of the app can get notifications at all. A browser can't, and Expo Go (the app used to
 * try Journey before it is installed for real) no longer can either. Everything else is asked the usual way.
 */
export function pushSupport(): PushSupport {
  if (Platform.OS === 'web') return 'browser';
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return 'expoGo';
  return 'ready';
}

/** What to tell someone where notifications can't work. Nothing they follow is lost: it is all in Activity. */
export const WHY_NOT: Record<Exclude<PushSupport, 'ready'>, string> = {
  browser: 'Notifications arrive on your phone. In the browser, everything new shows in Activity.',
  expoGo: 'Notifications need the installed Journey app. In Expo Go, everything new shows in Activity.',
};
