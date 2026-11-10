import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { ApiError } from './fetcher';
import { completeUpload, startUpload } from './generated/journey';
import { sendFile } from './transfer';

/** The longest side a photo is uploaded at. Bigger photos are resized on the phone first. */
const MAX_SIDE = 2048;
/** How long one photo may take to go up, on the slowest connection worth waiting for. After that it counts as "nothing answered". */
const PHOTO_TIME_LIMIT_MS = 2 * 60 * 1000;

export type LocalPhoto = { uri: string; width: number; height: number };

/** A clip on the phone: where it is, how long it is in whole seconds (when known), and its file type. */
export type LocalClip = { uri: string; durationSeconds?: number; mimeType?: string };

/**
 * Uploads one photo and returns its media id, ready to attach to an entry, a journey or a profile.
 * The photo is resized and saved as JPEG on the phone, then sent straight to storage.
 */
export async function uploadPhoto(photo: LocalPhoto): Promise<string> {
  const longest = Math.max(photo.width, photo.height);
  const context = ImageManipulator.manipulate(photo.uri);
  if (longest > MAX_SIDE) {
    context.resize(photo.width >= photo.height ? { width: MAX_SIDE } : { height: MAX_SIDE });
  }
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.82 });

  const target = await startUpload({ kind: 'photo', contentType: 'image/jpeg' });
  const file = await (await fetch(saved.uri)).blob();
  let response: Response;
  const limit = new AbortController();
  const timer = setTimeout(() => limit.abort(), PHOTO_TIME_LIMIT_MS);
  try {
    response = await fetch(target.uploadUrl, { method: target.method, headers: target.headers, body: file, signal: limit.signal });
  } catch {
    throw new ApiError(0, 'unreachable', "A photo couldn't be uploaded. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    throw new ApiError(response.status, 'upload_failed', "A photo couldn't be uploaded. Try again.");
  }
  // Tell the API the file is there. It checks it and makes the smaller versions; only then can it be used.
  await completeUpload(target.mediaId);
  return target.mediaId;
}

/**
 * Uploads one short clip and returns its media id, ready to attach to an entry. `onProgress` hears how much
 * has gone up, from 0 to 1. The clip goes to the video service, which converts it; until that is done only
 * its author sees it on the entry.
 */
export async function uploadClip(clip: LocalClip, onProgress?: (fraction: number) => void): Promise<string> {
  const contentType = clipType(clip);
  const target = await startUpload({ kind: 'video', contentType, ...(clip.durationSeconds ? { durationSeconds: clip.durationSeconds } : {}) });
  const status = await sendFile(clip.uri, { uploadUrl: target.uploadUrl, method: target.method, headers: { 'Content-Type': contentType, ...target.headers } }, onProgress);
  if (status === 0) {
    throw new ApiError(0, 'unreachable', "A clip couldn't be uploaded. Check your connection and try again.");
  }
  if (status < 200 || status >= 300) {
    throw new ApiError(status, 'upload_failed', "A clip couldn't be uploaded. Try again.");
  }
  await completeUpload(target.mediaId);
  return target.mediaId;
}

/** The clip's file type: what the phone said, or what its name ends in. */
function clipType(clip: LocalClip): string {
  if (clip.mimeType?.startsWith('video/')) return clip.mimeType.split(';')[0]!.trim();
  const name = clip.uri.split('?')[0]!.toLowerCase();
  if (name.endsWith('.mov')) return 'video/quicktime';
  if (name.endsWith('.webm')) return 'video/webm';
  return 'video/mp4';
}
