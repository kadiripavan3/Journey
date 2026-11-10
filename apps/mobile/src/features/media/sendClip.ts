import { uploadClip } from '@/api/upload';

import { compressClip } from './compress';

/**
 * Uploads a clip from the phone and returns its media id: made smaller first where the app can, then sent.
 * `onProgress` hears how much has gone up, from 0 to 1.
 */
export async function sendClip(clip: { uri: string; durationSeconds?: number; mimeType?: string }, onProgress?: (fraction: number) => void): Promise<string> {
  const smaller = await compressClip(clip.uri);
  // A clip that was made smaller is a new file of its own type; the upload reads it from the file's name.
  return uploadClip({ uri: smaller, durationSeconds: clip.durationSeconds, mimeType: smaller === clip.uri ? clip.mimeType : undefined }, onProgress);
}
