package app.journey.api.media;

import app.journey.api.media.MediaStore.MediaRow;
import java.util.UUID;

/**
 * Where short clips go to be made ready for watching. The real service (Mux) takes the clip straight from the
 * phone, converts it so it streams at a quality that suits the connection, and tells the API when it is ready.
 * The local stand-in keeps the file as it arrived and serves it as it is.
 *
 * <p>Like photos, a clip follows the upload steps in {@link MediaService}: ask for a target, send the file,
 * say it is done.
 */
public interface VideoService {

    /** Where the phone sends a clip, and the service's own id for the upload if it has one. */
    record ClipUpload(MediaStorage.UploadTarget target, String uploadId) {}

    /**
     * What is known about a clip once the phone has sent it: ready to watch now, or still being converted.
     * The ids and the length are filled in as far as the service knows them.
     */
    record ClipState(MediaStatus status, Long bytes, String assetId, String playbackId, Integer durationSeconds) {}

    ClipUpload startUpload(UUID mediaId, String storageKey, String contentType);

    /** The phone says the clip is sent. Refuses a clip that didn't arrive or is too big to be one. */
    ClipState afterUpload(MediaRow clip);

    /** The address a player plays the clip from. */
    String playbackUrl(String storageKey, String playbackId);

    /** A still frame of the clip, about this many pixels wide, or null when the service can't make one. */
    String stillUrl(String playbackId, int width);

    /** Removes the clip for good. Nothing happens if it is already gone. */
    void delete(String storageKey, String assetId);
}
