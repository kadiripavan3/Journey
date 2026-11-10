package app.journey.api.media;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.time.Duration;
import java.util.Map;
import java.util.OptionalLong;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.checksums.RequestChecksumCalculation;
import software.amazon.awssdk.core.checksums.ResponseChecksumValidation;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

/**
 * Photos and clips in Cloudflare R2, which speaks the S3 language. The phone gets a link that lets it put
 * one file, under one key, with one content type, for fifteen minutes; reading goes through R2's public
 * address (its CDN), which costs nothing per download.
 */
@Component
@ConditionalOnProperty(name = "journey.media.mode", havingValue = "r2")
public class R2Storage implements MediaStorage {

    private static final Logger log = LoggerFactory.getLogger(R2Storage.class);
    private static final Duration LINK_LIFE = Duration.ofMinutes(15);
    /** A stored file never changes (a new upload gets a new key), so phones and the CDN may keep it for good. */
    private static final String KEEP = "public, max-age=31536000, immutable";

    private final S3Client s3;
    private final S3Presigner presigner;
    private final String bucket;
    private final String publicUrl;

    R2Storage(
            @Value("${journey.media.r2.endpoint:}") String endpoint,
            @Value("${journey.media.r2.bucket:}") String bucket,
            @Value("${journey.media.r2.access-key-id:}") String accessKeyId,
            @Value("${journey.media.r2.secret-access-key:}") String secretAccessKey,
            @Value("${journey.media.r2.public-url:}") String publicUrl) {
        if (endpoint.isBlank()
                || bucket.isBlank()
                || accessKeyId.isBlank()
                || secretAccessKey.isBlank()
                || publicUrl.isBlank()) {
            throw new IllegalStateException(
                    "journey.media.mode is 'r2' but its settings are incomplete. Set R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID,"
                            + " R2_SECRET_ACCESS_KEY and R2_PUBLIC_URL (see docs/08-connect-services.md).");
        }
        StaticCredentialsProvider keys =
                StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKeyId, secretAccessKey));
        S3Configuration pathStyle =
                S3Configuration.builder().pathStyleAccessEnabled(true).build();
        this.s3 = S3Client.builder()
                .endpointOverride(URI.create(endpoint))
                .region(Region.of("auto"))
                .credentialsProvider(keys)
                .serviceConfiguration(pathStyle)
                // Newer versions of this client add checksums in a way some S3-compatible stores don't take.
                // Only doing so when the store asks for it keeps plain uploads plain.
                .requestChecksumCalculation(RequestChecksumCalculation.WHEN_REQUIRED)
                .responseChecksumValidation(ResponseChecksumValidation.WHEN_REQUIRED)
                .build();
        this.presigner = S3Presigner.builder()
                .endpointOverride(URI.create(endpoint))
                .region(Region.of("auto"))
                .credentialsProvider(keys)
                .serviceConfiguration(pathStyle)
                .build();
        this.bucket = bucket;
        this.publicUrl = publicUrl.trim().replaceAll("/+$", "");
    }

    @Override
    public UploadTarget uploadTarget(UUID mediaId, String storageKey, String contentType) {
        String url = presigner
                .presignPutObject(link -> link.signatureDuration(LINK_LIFE)
                        .putObjectRequest(put -> put.bucket(bucket)
                                .key(storageKey)
                                .contentType(contentType)
                                .cacheControl(KEEP)))
                .url()
                .toString();
        // The link is only good with exactly these headers: they are part of what was signed.
        return new UploadTarget(url, "PUT", Map.of("Content-Type", contentType, "Cache-Control", KEEP));
    }

    @Override
    public String publicUrl(String storageKey) {
        return publicUrl + "/" + storageKey;
    }

    @Override
    public OptionalLong size(String storageKey) {
        try {
            return OptionalLong.of(
                    s3.headObject(head -> head.bucket(bucket).key(storageKey)).contentLength());
        } catch (NoSuchKeyException missing) {
            return OptionalLong.empty();
        } catch (S3Exception e) {
            if (e.statusCode() == 404) {
                return OptionalLong.empty();
            }
            throw e;
        }
    }

    @Override
    public InputStream open(String storageKey) throws IOException {
        try {
            return s3.getObject(get -> get.bucket(bucket).key(storageKey));
        } catch (S3Exception e) {
            throw new IOException("Could not read " + storageKey + " from storage", e);
        }
    }

    @Override
    public void put(String storageKey, byte[] bytes, String contentType) throws IOException {
        try {
            s3.putObject(
                    put -> put.bucket(bucket)
                            .key(storageKey)
                            .contentType(contentType)
                            .cacheControl(KEEP),
                    RequestBody.fromBytes(bytes));
        } catch (S3Exception e) {
            throw new IOException("Could not store " + storageKey, e);
        }
    }

    @Override
    public void delete(String storageKey) {
        try {
            s3.deleteObject(delete -> delete.bucket(bucket).key(storageKey));
        } catch (RuntimeException e) {
            // A file left behind costs a little storage; it must not stop an account from being deleted.
            log.warn("Could not delete {} from storage: {}", storageKey, e.getMessage());
        }
    }
}
