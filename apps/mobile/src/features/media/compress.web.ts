/** In a browser a clip goes up as it is; the video service converts it. */
export async function compressClip(uri: string, _onProgress?: (fraction: number) => void): Promise<string> {
  return uri;
}
