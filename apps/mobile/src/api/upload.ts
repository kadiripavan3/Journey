import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { ApiError } from './fetcher';
import { startUpload } from './generated/journey';

/** The longest side a photo is uploaded at. Bigger photos are resized on the phone first. */
const MAX_SIDE = 2048;

export type LocalPhoto = { uri: string; width: number; height: number };

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
  try {
    response = await fetch(target.uploadUrl, { method: target.method, headers: target.headers, body: file });
  } catch {
    throw new ApiError(0, 'unreachable', "A photo couldn't be uploaded. Check your connection and try again.");
  }
  if (!response.ok) {
    throw new ApiError(response.status, 'upload_failed', "A photo couldn't be uploaded. Try again.");
  }
  return target.mediaId;
}
