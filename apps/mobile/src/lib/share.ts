import * as Clipboard from 'expo-clipboard';
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

/** Copies a link or a line of text. False when the phone or the browser didn't allow it. */
export async function copyText(text: string): Promise<boolean> {
  try {
    return await Clipboard.setStringAsync(text);
  } catch {
    return false;
  }
}

/** The address that opens the phone's Messages with the text already written. */
export function messageLink(text: string): string {
  // iPhones want "&" before the body where every other phone wants "?".
  return `sms:${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(text)}`;
}

/** The address that opens the phone's Mail with a subject and the text already written. */
export function mailLink(subject: string, text: string): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
}

/** A web address as people read it: without "https://" and without a slash at the end. */
export function shortLink(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}
