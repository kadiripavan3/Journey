package app.journey.api.media;

import app.journey.api.common.ApiProblem;
import app.journey.api.media.MediaStore.MediaRow;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * Local mode's stand-in for the video service. The clip is kept with the photos, exactly as it arrived, and
 * is ready the moment the phone says it is sent. Nothing is converted, so there is no still frame (the app
 * shows the clip's own first frame) and the length is what the app said it was.
 */
@Component
@ConditionalOnProperty(name = "journey.video.mode", havingValue = "local")
class LocalVideoService implements VideoService {

    private final MediaStorage storage;

    LocalVideoService(MediaStorage storage) {
        this.storage = storage;
    }

    @Override
    public ClipUpload startUpload(UUID mediaId, String storageKey, String contentType) {
        return new ClipUpload(storage.uploadTarget(mediaId, storageKey, contentType), null);
    }

    @Override
    public ClipState afterUpload(MediaRow clip) {
        long bytes = storage.size(clip.storageKey()).orElse(0);
        if (bytes == 0) {
            throw ApiProblem.badRequest("upload_missing", "The clip didn't arrive. Try again.");
        }
        if (bytes > MediaService.MAX_CLIP_BYTES) {
            storage.delete(clip.storageKey());
            throw new ApiProblem(
                    HttpStatus.CONTENT_TOO_LARGE, "too_large", "That clip is too big. Keep clips under 60 seconds.");
        }
        return new ClipState(MediaStatus.READY, bytes, null, null, clip.durationS());
    }

    @Override
    public String playbackUrl(String storageKey, String playbackId) {
        return storage.publicUrl(storageKey);
    }

    @Override
    public String stillUrl(String playbackId, int width) {
        return null;
    }

    @Override
    public void delete(String storageKey, String assetId) {
        storage.delete(storageKey);
    }
}
