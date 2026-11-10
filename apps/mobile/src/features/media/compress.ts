type Compressor = typeof import('react-native-compressor');

/** True once it is known that this copy of the app has nothing to make clips smaller with (Expo Go). */
let missing = false;

/**
 * Makes a clip smaller before it is uploaded, and returns where the smaller file is. `onProgress` hears how
 * far it has come, from 0 to 1. The part of the app that does this is only in a full build; in Expo Go the
 * clip goes up as it is (the video service converts it either way).
 *
 * A failure here never stops the upload: that one clip goes up as it is, and the next one is tried again.
 */
export async function compressClip(uri: string, onProgress?: (fraction: number) => void): Promise<string> {
  if (missing) return uri;
  let compressor: Compressor;
  try {
    // Loaded only when needed: in Expo Go the module is missing, and loading it up front would break the app.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    compressor = require('react-native-compressor') as Compressor;
  } catch {
    missing = true;
    return uri;
  }
  try {
    const smaller = await compressor.Video.compress(uri, { compressionMethod: 'auto' }, onProgress);
    return smaller || uri;
  } catch {
    return uri;
  }
}
