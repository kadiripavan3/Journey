package app.journey.api.media;

import app.journey.api.common.ApiProblem;
import app.journey.api.common.Http;
import app.journey.api.media.MediaStore.MediaRow;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Clips with Mux. The API asks Mux for a link, the phone sends the clip straight to it, Mux converts it and
 * calls {@code /webhooks/mux} when it can be watched. The clip plays from Mux's own addresses.
 *
 * <p>Four calls to Mux's API are all this needs (start an upload, look an upload up, look an asset up, delete
 * an asset), so they are made directly rather than through Mux's own library.
 */
@Component
@ConditionalOnProperty(name = "journey.video.mode", havingValue = "mux")
public class MuxVideoService implements VideoService {

    private static final Logger log = LoggerFactory.getLogger(MuxVideoService.class);

    /** How long the phone has to send the clip through the link, in seconds. */
    private static final int UPLOAD_WINDOW = 3600;

    private static final ParameterizedTypeReference<Map<String, Object>> JSON = new ParameterizedTypeReference<>() {};

    private final RestClient mux;
    private final RestClient images;

    MuxVideoService(
            @Value("${journey.video.mux.api-url:https://api.mux.com}") String apiUrl,
            @Value("${journey.video.mux.image-url:https://image.mux.com}") String imageUrl,
            @Value("${journey.video.mux.token-id:}") String tokenId,
            @Value("${journey.video.mux.token-secret:}") String tokenSecret) {
        if (tokenId.isBlank() || tokenSecret.isBlank()) {
            throw new IllegalStateException(
                    "journey.video.mode=mux needs a Mux access token: set MUX_TOKEN_ID and MUX_TOKEN_SECRET"
                            + " (or JOURNEY_VIDEO_MODE=off to run without clips).");
        }
        this.mux = Http.client()
                .baseUrl(apiUrl.replaceAll("/+$", ""))
                .defaultHeaders(headers -> headers.setBasicAuth(tokenId.trim(), tokenSecret.trim()))
                .build();
        this.images = Http.client(java.time.Duration.ofSeconds(6))
                .baseUrl(imageUrl.replaceAll("/+$", ""))
                .build();
    }

    @Override
    public ClipUpload startUpload(UUID mediaId, String storageKey, String contentType) {
        Map<String, Object> request = Map.of(
                "cors_origin",
                "*",
                "timeout",
                UPLOAD_WINDOW,
                // The media id comes back in the webhook, which is how the finished clip finds its record.
                "new_asset_settings",
                Map.of("playback_policy", List.of("public"), "passthrough", mediaId.toString()));
        try {
            Map<?, ?> upload = data(mux.post()
                    .uri("/video/v1/uploads")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .body(JSON));
            if (!(upload.get("url") instanceof String url) || !(upload.get("id") instanceof String id)) {
                throw new IllegalStateException("Mux's answer has no upload link");
            }
            return new ClipUpload(new MediaStorage.UploadTarget(url, "PUT", Map.of()), id);
        } catch (RestClientException | IllegalStateException e) {
            log.warn("Mux didn't start an upload: {}", e.toString());
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

    /** Three frames: near the start, the middle and near the end. Mux makes each when it is first asked for. */
    @Override
    public Optional<List<byte[]>> stills(String playbackId, Integer durationSeconds) {
        double length = durationSeconds == null || durationSeconds < 1 ? 1 : durationSeconds;
        List<byte[]> frames = new ArrayList<>();
        for (double part : new double[] {0.1, 0.5, 0.9}) {
            byte[] frame = images.get()
                    .uri("/{id}/thumbnail.jpg?width=640&time={time}", playbackId, Math.round(length * part * 10) / 10.0)
                    .retrieve()
                    .body(byte[].class);
            if (frame != null && frame.length > 0) {
                frames.add(frame);
            }
        }
        return Optional.of(frames);
    }

    @Override
    public Optional<Found> lookUp(MediaRow clip) {
        String assetId = clip.videoAssetId();
        if (assetId == null) {
            if (clip.videoUploadId() == null) {
                return Optional.empty();
            }
            Map<?, ?> upload = get("/video/v1/uploads/{id}", clip.videoUploadId());
            if (upload == null) {
                return Optional.of(new Found(true, null, null, null)); // Mux no longer knows the upload
            }
            String status = String.valueOf(upload.get("status"));
            if (status.equals("errored") || status.equals("cancelled") || status.equals("timed_out")) {
                return Optional.of(new Found(true, null, null, null));
            }
            if (!(upload.get("asset_id") instanceof String made)) {
                return Optional.empty(); // the phone hasn't sent it yet, or Mux hasn't started
            }
            assetId = made;
        }
        Map<?, ?> asset = get("/video/v1/assets/{id}", assetId);
        if (asset == null || "errored".equals(asset.get("status"))) {
            return Optional.of(new Found(true, assetId, null, null));
        }
        if (!"ready".equals(asset.get("status"))) {
            return Optional.empty();
        }
        String playbackId = asset.get("playback_ids") instanceof List<?> ids
                        && !ids.isEmpty()
                        && ids.get(0) instanceof Map<?, ?> first
                        && first.get("id") instanceof String id
                ? id
                : null;
        Double seconds = asset.get("duration") instanceof Number number ? number.doubleValue() : null;
        return playbackId == null
                ? Optional.of(new Found(true, assetId, null, null))
                : Optional.of(new Found(false, assetId, playbackId, seconds));
    }

    @Override
    public void delete(String storageKey, String assetId) {
        if (assetId == null) {
            return; // never converted: Mux drops an unused upload link by itself
        }
        try {
            mux.delete().uri("/video/v1/assets/{id}", assetId).retrieve().toBodilessEntity();
        } catch (HttpClientErrorException.NotFound gone) {
            // Already gone.
        }
    }

    /** One thing by its id, or null when Mux says it doesn't exist. */
    private Map<?, ?> get(String path, String id) {
        try {
            return data(mux.get().uri(path, id).retrieve().body(JSON));
        } catch (HttpClientErrorException.NotFound gone) {
            return null;
        }
    }

    private static Map<?, ?> data(Map<String, Object> answer) {
        if (answer == null || !(answer.get("data") instanceof Map<?, ?> data)) {
            throw new IllegalStateException("Mux's answer has no data");
        }
        return data;
    }
}
