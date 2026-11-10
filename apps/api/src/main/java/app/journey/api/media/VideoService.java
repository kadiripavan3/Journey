package app.journey.api.media;

import app.journey.api.media.MediaStore.MediaRow;
import java.util.List;
import java.util.Optional;
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

    /** False when clips are switched off: the app is told not to offer them. */
    default boolean available() {
        return true;
    }

    ClipUpload startUpload(UUID mediaId, String storageKey, String contentType);

    /** The phone says the clip is sent. Refuses a clip that didn't arrive or is too big to be one. */
    ClipState afterUpload(MediaRow clip);

    /** The address a player plays the clip from. */
    String playbackUrl(String storageKey, String playbackId);

    /** A still frame of the clip, about this many pixels wide, or null when the service can't make one. */
    String stillUrl(String playbackId, int width);

    /**
     * A few still frames of a clip, as JPEGs, for the automatic check to look at. Empty when the service
     * makes none: then there is nothing to check. Throws when the service can't be reached.
     */
    default Optional<List<byte[]>> stills(String playbackId, Integer durationSeconds) {
        return Optional.empty();
    }

    /** What the service says about a clip when asked: converted (with its ids and length), or failed. */
    record Found(boolean failed, String assetId, String playbackId, Double seconds) {}

    /**
     * Asks the service where a clip stands, for one whose "it is ready" never arrived. Empty when the service
     * has nothing to say yet (still converting), or never tells.
     */
    default Optional<Found> lookUp(MediaRow clip) {
        return Optional.empty();
    }

    /** Removes the clip for good. Nothing happens if it is already gone. Throws when it couldn't be removed. */
    void delete(String storageKey, String assetId);
}
