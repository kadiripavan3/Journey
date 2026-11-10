/** Photos and clips: choosing them, sending them up, and looking at them. */

export const media = {
  /** The phone's photo picker couldn't be opened. */
  photosClosed: "We couldn't open your photos. Check that Journey may see them in the phone's Settings.",

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
} as const;
