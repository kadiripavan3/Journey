import * as ImagePicker from 'expo-image-picker';

import type { LocalPhoto } from '@/api/upload';

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
