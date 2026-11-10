/** Null until the first clip; then whether this build of the app can make clips smaller. */
let available: boolean | null = null;

/**
 * Makes a clip smaller before it is uploaded, and returns where the smaller file is. The part of the app that
 * does this is only in a full build of the app; in Expo Go the clip goes up as it is (the video service
 * converts it either way). A failure here never stops the upload.
 */
export async function compressClip(uri: string, onProgress?: (fraction: number) => void): Promise<string> {
  if (available === false) return uri;
  try {
    // Loaded only when needed: in Expo Go the module is missing, and loading it up front would break the app.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Video } = require('react-native-compressor') as typeof import('react-native-compressor');
    const smaller = await Video.compress(uri, { compressionMethod: 'auto' }, onProgress);
    available = true;
    return smaller || uri;
  } catch {
    if (available === null) available = false;
    return uri;
  }
}
