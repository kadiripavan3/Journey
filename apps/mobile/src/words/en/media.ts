/** Photos and clips: choosing them, sending them up, and looking at them. */
import { plural } from './plural';

export const media = {
  /** The phone's photo picker couldn't be opened. */
  photosClosed: "We couldn't open your photos. Check that Journey may see them in the phone's Settings.",

  /** What the picker left out, and why. `count` is how many were left out. */
  leftOut: {
    tooLong: (seconds: number, count: number) => `Clips can be up to ${seconds} seconds, so ${count === 1 ? 'one was' : `${count} were`} left out.`,
    clips: (most: number, count: number) => `An entry holds ${plural(most, 'clip')}, so ${count === 1 ? 'one was' : `${count} were`} left out.`,
    photos: (most: number, count: number) => `An entry holds ${plural(most, 'photo')}, so ${count === 1 ? 'one was' : `${count} were`} left out.`,
  },

  // Sending a file up didn't work
  uploads: {
    photoUnreadable: "A photo of this entry can't be read any more. Open the entry, take it out and add it again.",
    photoUnreachable: "A photo couldn't be uploaded. Check your connection and try again.",
    photoFailed: "A photo couldn't be uploaded. Try again.",
    clipUnreachable: "A clip couldn't be uploaded. Check your connection and try again.",
    clipFailed: "A clip couldn't be uploaded. Try again.",
    fileFailed: "A file couldn't be uploaded. Open the entry and try again.",
    fileGone: 'A photo or clip of this entry is no longer on your phone. Open the entry, take it out and add it again.',
  },

  // Photos full screen
  viewer: {
    close: 'Close photos',
    /** "2 of 5": which photo is showing. */
    position: (index: number, count: number) => `${index} of ${count}`,
    photoSpoken: (index: number, count: number) => `Photo ${index} of ${count}`,
  },

  // A clip. `length` is how long it is, written "0:42", or empty when that isn't known.
  clip: {
    badge: 'Clip',
    tapToPlay: (length: string) => `Tap to play${length ? ` · ${length}` : ''}`,
    playSpoken: (length: string) => `Play the clip${length ? `. ${length}` : ''}`,
    preparing: 'Your clip is getting ready. Others see it once it is.',
    preparingSpoken: 'This clip is still getting ready',
    failed: "This clip couldn't be used. Edit the entry to remove it or add it again.",
    failedSpoken: "This clip couldn't be used",
  },
} as const;
