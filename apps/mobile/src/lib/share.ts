import { Platform, Share } from 'react-native';

/**
 * Opens the phone's share sheet for a journey's link. In a browser that has no share sheet, the link
 * is copied instead. Returns what happened, so the screen can say "Link copied".
 */
export async function shareLink(title: string, url: string): Promise<'shared' | 'copied' | 'cancelled'> {
  if (Platform.OS === 'web') {
    const nav = globalThis.navigator as (Navigator & { share?: (data: { title: string; url: string }) => Promise<void> }) | undefined;
    try {
      if (nav?.share) {
        await nav.share({ title, url });
        return 'shared';
      }
      await nav?.clipboard?.writeText(url);
      return 'copied';
    } catch {
      return 'cancelled';
    }
  }
  try {
    // iOS shows the link as a rich preview when it is passed as the url; Android wants it in the message.
    const result = await Share.share(Platform.OS === 'ios' ? { message: `${title} on Journey`, url } : { message: `${title} on Journey\n${url}` });
    return result.action === Share.sharedAction ? 'shared' : 'cancelled';
  } catch {
    return 'cancelled';
  }
}
