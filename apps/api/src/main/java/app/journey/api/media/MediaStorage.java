package app.journey.api.media;

import java.util.Map;
import java.util.UUID;

/**
 * Where photos and clips are kept. The phone never sends a file through the API's own endpoints: it
 * asks for an upload target and sends the file there. That is how cloud storage works (pre-signed
 * links), and the local stand-in behaves the same way, so the app doesn't change when the real
 * storage is connected.
 */
public interface MediaStorage {

  /** Where and how the phone uploads one file. */
  record UploadTarget(String url, String method, Map<String, String> headers) {}

  UploadTarget uploadTarget(UUID mediaId, String contentType);

  /** The address the file is served from once uploaded. */
  String publicUrl(String storageKey);
}
