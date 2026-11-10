import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'journey.session';

/** The sign-in token is kept in the phone's secure storage (Keychain / Keystore); in a browser, in local storage. */
export async function loadToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(KEY) ?? null;
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

export async function saveToken(token: string): Promise<void> {
  try {
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(KEY, token);
    else await SecureStore.setItemAsync(KEY, token);
  } catch {
    // The person stays signed in for this run of the app; they sign in again next time.
  }
}

export async function clearToken(): Promise<void> {
  try {
    if (Platform.OS === 'web') globalThis.localStorage?.removeItem(KEY);
    else await SecureStore.deleteItemAsync(KEY);
  } catch {
    // Nothing useful to do.
  }
}
