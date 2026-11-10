import { Linking } from 'react-native';

import { apiBaseUrl } from '@/api/config';

/**
 * Opens one of the web pages the API serves (the terms, the privacy policy, the guidelines, the contact page)
 * in the phone's browser. `path` starts with a slash: "/terms".
 */
export function openPage(path: string): void {
  void Linking.openURL(apiBaseUrl() + path).catch(() => undefined);
}
