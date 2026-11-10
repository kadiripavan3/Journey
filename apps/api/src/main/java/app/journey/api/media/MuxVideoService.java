package app.journey.api.media;

import app.journey.api.common.ApiProblem;
import app.journey.api.media.MediaStore.MediaRow;
import com.mux.ApiClient;
import com.mux.ApiException;
import com.mux.sdk.AssetsApi;
import com.mux.sdk.DirectUploadsApi;
import com.mux.sdk.models.CreateAssetRequest;
import com.mux.sdk.models.CreateUploadRequest;
import com.mux.sdk.models.PlaybackPolicy;
import com.mux.sdk.models.Upload;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * Clips on Mux. The phone uploads straight to Mux through a one-time link ("direct upload"). Mux converts the
 * clip and calls {@link MuxWebhookController} when it is ready; until then the clip is "processing". Playing
 * and still frames come from Mux's own addresses, built from the clip's playback id.
 *
 * <p>Needs a Mux access token (id and secret) and, for the webhook, its signing secret.
 */
@Component
@ConditionalOnProperty(name = "journey.video.mode", havingValue = "mux")
public class MuxVideoService implements VideoService {

    private static final Logger log = LoggerFactory.getLogger(MuxVideoService.class);

    /** How long the phone has to send the clip through the link, in seconds. */
    private static final int UPLOAD_WINDOW = 3600;

    private final DirectUploadsApi uploads;
    private final AssetsApi assets;

    MuxVideoService(
            @Value("${journey.video.mux.api-url:https://api.mux.com}") String apiUrl,
            @Value("${journey.video.mux.token-id:}") String tokenId,
            @Value("${journey.video.mux.token-secret:}") String tokenSecret) {
        if (tokenId.isBlank() || tokenSecret.isBlank()) {
            throw new IllegalStateException(
                    "journey.video.mode=mux needs a Mux access token: set MUX_TOKEN_ID and MUX_TOKEN_SECRET"
                            + " (or use the local profile, which keeps clips on this computer).");
        }
        ApiClient client = new ApiClient();
        client.setBasePath(apiUrl.replaceAll("/+$", ""));
        client.setUsername(tokenId);
        client.setPassword(tokenSecret);
        client.setConnectTimeout(5_000);
        client.setReadTimeout(15_000);
        this.uploads = new DirectUploadsApi(client);
        this.assets = new AssetsApi(client);
    }

    @Override
    public ClipUpload startUpload(UUID mediaId, String storageKey, String contentType) {
        CreateUploadRequest request = new CreateUploadRequest()
                .corsOrigin("*")
                .timeout(UPLOAD_WINDOW)
                // The media id comes back in the webhook, which is how the finished clip finds its record.
                .newAssetSettings(new CreateAssetRequest()
                        .addPlaybackPolicyItem(PlaybackPolicy.PUBLIC)
                        .passthrough(mediaId.toString()));
        try {
            Upload upload = uploads.createDirectUpload(request).execute().getData();
            return new ClipUpload(new MediaStorage.UploadTarget(upload.getUrl(), "PUT", Map.of()), upload.getId());
        } catch (ApiException e) {
            log.warn("Mux refused to start an upload ({}): {}", e.getCode(), e.getResponseBody());
            throw new ApiProblem(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "video_unavailable",
                    "Clips can't be uploaded right now. Try again in a moment.");
        }
    }

    /** Mux has the clip; nothing is known about it until its webhook arrives. */
    @Override
    public ClipState afterUpload(MediaRow clip) {
        return new ClipState(MediaStatus.PROCESSING, null, null, null, clip.durationS());
    }

    @Override
    public String playbackUrl(String storageKey, String playbackId) {
        return playbackId == null ? null : "https://stream.mux.com/" + playbackId + ".m3u8";
    }

    @Override
    public String stillUrl(String playbackId, int width) {
        return playbackId == null
                ? null
                : "https://image.mux.com/" + playbackId + "/thumbnail.jpg?width=" + width + "&fit_mode=preserve";
    }

    @Override
    public void delete(String storageKey, String assetId) {
        if (assetId == null) {
            return; // never converted: Mux drops an unused upload link by itself
        }
        try {
            assets.deleteAsset(assetId).execute();
        } catch (ApiException e) {
            if (e.getCode() != 404) {
                // A clip left behind costs a little storage; it must not stop an account from being deleted.
                log.warn("Could not delete Mux asset {} ({}): {}", assetId, e.getCode(), e.getResponseBody());
            }
        }
    }
}
