package app.journey.api.media;

import app.journey.api.common.ApiProblem;
import io.swagger.v3.oas.annotations.Hidden;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.json.JsonParseException;
import org.springframework.boot.json.JsonParserFactory;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Where Mux reports back: a clip is converted and ready to watch, or it failed. Anyone can reach this address,
 * so every call must carry Mux's signature, made with a secret only Mux and the API know, and must be recent.
 * It is not part of the API the app is generated from.
 */
@RestController
@Hidden
@ConditionalOnProperty(name = "journey.video.mode", havingValue = "mux")
class MuxWebhookController {

    private static final Logger log = LoggerFactory.getLogger(MuxWebhookController.class);

    /** A signed call older (or newer) than this is refused, so a recorded one can't be played back later. */
    static final Duration TOLERANCE = Duration.ofMinutes(5);

    private final MediaService media;
    private final byte[] secret;

    MuxWebhookController(MediaService media, @Value("${journey.video.mux.webhook-secret:}") String secret) {
        if (secret.isBlank()) {
            throw new IllegalStateException(
                    "journey.video.mode=mux needs the webhook's signing secret: set MUX_WEBHOOK_SECRET.");
        }
        this.media = media;
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
    }

    @PostMapping("/webhooks/mux")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void receive(@RequestHeader(name = "Mux-Signature", required = false) String signature, @RequestBody byte[] body) {
        if (!signedByMux(signature, body, Instant.now())) {
            throw ApiProblem.unauthorized("bad_signature", "This call isn't signed by the video service.");
        }
        Map<String, Object> event;
        try {
            event = JsonParserFactory.getJsonParser().parseMap(new String(body, StandardCharsets.UTF_8));
        } catch (JsonParseException e) {
            throw ApiProblem.badRequest("bad_request", "We couldn't read that. Check it and try again.");
        }
        Map<?, ?> data = event.get("data") instanceof Map<?, ?> map ? map : Map.of();
        switch (String.valueOf(event.get("type"))) {
            case "video.asset.ready" -> {
                UUID mediaId = mediaId(data.get("passthrough"));
                String playbackId = firstPlaybackId(data.get("playback_ids"));
                if (mediaId == null || playbackId == null) {
                    log.warn("Mux says asset {} is ready, but it has no media id or no playback id", data.get("id"));
                    return;
                }
                Double seconds = data.get("duration") instanceof Number number ? number.doubleValue() : null;
                media.clipConverted(mediaId, text(data.get("id")), playbackId, seconds);
            }
            case "video.asset.errored" -> failed(mediaId(data.get("passthrough")));
            case "video.upload.errored", "video.upload.cancelled" -> {
                Map<?, ?> settings = data.get("new_asset_settings") instanceof Map<?, ?> map ? map : Map.of();
                failed(mediaId(settings.get("passthrough")));
            }
            default -> {
                // Mux sends many kinds of events; the rest are not about anything the API keeps.
            }
        }
    }

    private void failed(UUID mediaId) {
        if (mediaId != null) {
            media.clipFailed(mediaId);
        }
    }

    /** Mux signs "<time>.<body>" with HMAC-SHA256 and sends "t=<time>,v1=<signature in hex>". */
    boolean signedByMux(String header, byte[] body, Instant now) {
        if (header == null) {
            return false;
        }
        String time = null;
        String given = null;
        for (String part : header.split(",")) {
            String[] pair = part.trim().split("=", 2);
            if (pair.length == 2 && pair[0].equals("t")) {
                time = pair[1];
            } else if (pair.length == 2 && pair[0].equals("v1")) {
                given = pair[1];
            }
        }
        if (time == null || given == null) {
            return false;
        }
        try {
            Instant sent = Instant.ofEpochSecond(Long.parseLong(time));
            if (Duration.between(sent, now).abs().compareTo(TOLERANCE) > 0) {
                return false;
            }
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            mac.update((time + ".").getBytes(StandardCharsets.UTF_8));
            String expected = HexFormat.of().formatHex(mac.doFinal(body));
            return MessageDigest.isEqual(
                    expected.getBytes(StandardCharsets.UTF_8), given.getBytes(StandardCharsets.UTF_8));
        } catch (NumberFormatException | java.security.GeneralSecurityException e) {
            return false;
        }
    }

    private static String text(Object value) {
        return value instanceof String string ? string : null;
    }

    private static UUID mediaId(Object passthrough) {
        try {
            return passthrough instanceof String string ? UUID.fromString(string) : null;
        } catch (IllegalArgumentException notOurs) {
            return null;
        }
    }

    private static String firstPlaybackId(Object ids) {
        if (ids instanceof List<?> list && !list.isEmpty() && list.get(0) instanceof Map<?, ?> first) {
            return text(first.get("id"));
        }
        return null;
    }
}
