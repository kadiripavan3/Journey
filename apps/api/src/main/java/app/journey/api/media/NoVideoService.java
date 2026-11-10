package app.journey.api.media;

import app.journey.api.common.ApiProblem;
import app.journey.api.media.MediaStore.MediaRow;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * Clips switched off ({@code journey.video.mode=off}): for running the API before there is an account with
 * the video service. Photos and everything else work; the catalog tells the app not to offer clips, and a
 * clip that is sent anyway is refused with a sentence.
 */
@Component
@ConditionalOnProperty(name = "journey.video.mode", havingValue = "off")
class NoVideoService implements VideoService {

    @Override
    public boolean available() {
        return false;
    }

    @Override
    public ClipUpload startUpload(UUID mediaId, String storageKey, String contentType) {
        throw new ApiProblem(HttpStatus.CONFLICT, "clips_off", "Clips aren't switched on yet. Photos work as always.");
    }

    @Override
    public ClipState afterUpload(MediaRow clip) {
        throw new ApiProblem(HttpStatus.CONFLICT, "clips_off", "Clips aren't switched on yet. Photos work as always.");
    }

    @Override
    public String playbackUrl(String storageKey, String playbackId) {
        return null;
    }

    @Override
    public String stillUrl(String playbackId, int width) {
        return null;
    }

    @Override
    public void delete(String storageKey, String assetId) {
        // Nothing was ever kept.
    }
}
