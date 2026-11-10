import { removeFile } from '@/api/transfer';
import { uploadClip } from '@/api/upload';

import { compressClip } from './compress';

/** How much of the whole job making a clip smaller is, where the app can do that; the rest is the upload. */
const SMALLER_SHARE = 0.3;

/**
 * Uploads a clip from the phone and returns its media id: made smaller first where the app can, then sent.
 * `onProgress` hears how far the whole job has come, from 0 to 1, and whether the clip is still being made
 * smaller (`preparing`) or is going up. The smaller copy is removed again once the upload is over.
 */
export async function sendClip(
  clip: { uri: string; durationSeconds?: number; mimeType?: string },
  onProgress?: (fraction: number, preparing?: boolean) => void,
): Promise<string> {
  let prepared = 0;
  const smaller = await compressClip(clip.uri, (part) => {
    prepared = SMALLER_SHARE;
    onProgress?.(SMALLER_SHARE * Math.min(Math.max(part, 0), 1), true);
  });
  try {
    // A clip that was made smaller is a new file of its own type; the upload reads it from the file's name.
    return await uploadClip({ uri: smaller, durationSeconds: clip.durationSeconds, mimeType: smaller === clip.uri ? clip.mimeType : undefined }, (part) =>
      onProgress?.(prepared + (1 - prepared) * part, false),
    );
  } finally {
    if (smaller !== clip.uri) removeFile(smaller);
  }
}
