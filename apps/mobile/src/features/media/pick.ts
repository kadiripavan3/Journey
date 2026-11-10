import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import type { LocalPhoto } from '@/api/upload';
import { plural } from '@/words/en/plural';

import { photoDay, photoPoint, type Point } from './exif';

/** An entry holds up to ten photos and three short clips. */
export const MAX_PHOTOS = 10;
export const MAX_CLIPS = 3;
export const MAX_CLIP_SECONDS = 60;

/** A photo or a clip picked from the phone, not uploaded yet. */
export type LocalMedia = {
  kind: 'photo' | 'video';
  uri: string;
  width: number;
  height: number;
  /** A clip's length in whole seconds, when the phone knows it. */
  durationSeconds?: number;
  /** A clip's file type, such as "video/mp4". */
  mimeType?: string;
  /** What a photo says about itself: the day it was taken ("2026-04-01") and where. */
  takenOn?: string;
  point?: Point;
};

/** Opens the phone's photo library and returns the photos picked (none when the person cancels). */
export async function pickPhotos(limit: number): Promise<LocalPhoto[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit,
    quality: 1,
  });
  if (result.canceled) return [];
  return result.assets.slice(0, limit).map((asset) => ({ uri: asset.uri, width: asset.width, height: asset.height }));
}

/** One photo, cropped square by the person: for a profile picture. */
export async function pickSquarePhoto(): Promise<LocalPhoto | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 });
  const asset = result.canceled ? undefined : result.assets[0];
  return asset ? { uri: asset.uri, width: asset.width, height: asset.height } : null;
}

/**
 * Photos and short clips for an entry. `room` is how many more of each the entry can take. Anything over
 * that, and any clip longer than a minute, is left out; `leftOut` says so in a sentence, or is null.
 */
export async function pickMedia(room: { photos: number; clips: number }): Promise<{ picked: LocalMedia[]; leftOut: string | null }> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: room.clips > 0 ? (room.photos > 0 ? ['images', 'videos'] : ['videos']) : ['images'],
    allowsMultipleSelection: room.photos + room.clips > 1,
    selectionLimit: room.photos + room.clips,
    quality: 1,
    // The photo's own date and place, to suggest the entry's day and place. Nothing is uploaded with it.
    exif: true,
  });
  if (result.canceled) return { picked: [], leftOut: null };
  return sortPicked(result.assets.map(fromAsset), room);
}

function fromAsset(asset: ImagePicker.ImagePickerAsset): LocalMedia {
  if (asset.type === 'video') {
    // The phone gives a clip's length in milliseconds; a browser gives seconds.
    const seconds = asset.duration == null ? NaN : Platform.OS === 'web' ? asset.duration : asset.duration / 1000;
    return {
      kind: 'video',
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
      durationSeconds: Number.isFinite(seconds) && seconds > 0 ? Math.max(1, Math.round(seconds)) : undefined,
      mimeType: asset.mimeType ?? undefined,
    };
  }
  return { kind: 'photo', uri: asset.uri, width: asset.width, height: asset.height, takenOn: photoDay(asset.exif), point: photoPoint(asset.exif) };
}

/** Keeps what fits, in the order it was picked, and words what didn't. */
export function sortPicked(all: LocalMedia[], room: { photos: number; clips: number }): { picked: LocalMedia[]; leftOut: string | null } {
  const picked: LocalMedia[] = [];
  let photos = 0;
  let clips = 0;
  let tooLong = 0;
  let extraPhotos = 0;
  let extraClips = 0;
  for (const item of all) {
    if (item.kind === 'photo') {
      if (photos < room.photos) {
        photos += 1;
        picked.push(item);
      } else extraPhotos += 1;
    } else if ((item.durationSeconds ?? 0) > MAX_CLIP_SECONDS) {
      tooLong += 1;
    } else if (clips < room.clips) {
      clips += 1;
      picked.push(item);
    } else extraClips += 1;
  }
  const notes: string[] = [];
  if (tooLong > 0) notes.push(`Clips can be up to ${MAX_CLIP_SECONDS} seconds, so ${tooLong === 1 ? 'one was' : `${tooLong} were`} left out.`);
  if (extraClips > 0) notes.push(`An entry holds ${plural(MAX_CLIPS, 'clip')}, so ${extraClips === 1 ? 'one was' : `${extraClips} were`} left out.`);
  if (extraPhotos > 0) notes.push(`An entry holds ${plural(MAX_PHOTOS, 'photo')}, so ${extraPhotos === 1 ? 'one was' : `${extraPhotos} were`} left out.`);
  return { picked, leftOut: notes.length > 0 ? notes.join(' ') : null };
}
