/** Where a file goes, as the API hands it out. */
export type Target = { uploadUrl: string; method: string; headers: Record<string, string> };

/** Sends a file the browser holds to where the API said, and returns the answer's status (0 when nothing answered). */
export async function sendFile(uri: string, target: Target, onProgress?: (fraction: number) => void): Promise<number> {
  let body: Blob;
  try {
    body = await (await fetch(uri)).blob();
  } catch {
    return 0;
  }
  return new Promise((resolve) => {
    const request = new XMLHttpRequest();
    request.open(target.method, target.uploadUrl);
    for (const [name, value] of Object.entries(target.headers)) request.setRequestHeader(name, value);
    request.upload.onprogress = (event) => {
      if (onProgress && event.lengthComputable && event.total > 0) onProgress(Math.min(event.loaded / event.total, 1));
    };
    request.onload = () => resolve(request.status);
    request.onerror = () => resolve(0);
    request.onabort = () => resolve(0);
    request.send(body);
  });
}
