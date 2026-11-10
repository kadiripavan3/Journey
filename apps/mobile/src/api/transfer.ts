import { File, UploadType } from 'expo-file-system';

/** Where a file goes, as the API hands it out. */
export type Target = { uploadUrl: string; method: string; headers: Record<string, string> };

/**
 * Sends a file on the phone to where the API said, and returns the answer's status (0 when nothing answered).
 * The phone's own transfer service does the sending, so a long clip keeps going when the app is put away.
 */
export async function sendFile(uri: string, target: Target, onProgress?: (fraction: number) => void): Promise<number> {
  try {
    const result = await new File(uri).upload(target.uploadUrl, {
      httpMethod: target.method.toUpperCase() === 'POST' ? 'POST' : 'PUT',
      uploadType: UploadType.BINARY_CONTENT,
      headers: target.headers,
      sessionType: 'background',
      onProgress: onProgress ? ({ bytesSent, totalBytes }) => onProgress(totalBytes > 0 ? Math.min(bytesSent / totalBytes, 1) : 0) : undefined,
    });
    return result.status;
  } catch {
    return 0;
  }
}
