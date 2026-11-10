package app.journey.api.media;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.Image;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import javax.imageio.ImageIO;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

/**
 * Local stand-in for cloud storage: files are kept in a folder on this computer and served by the API
 * itself. Addresses are built from the request, so a phone on the same Wi-Fi gets links it can open.
 */
@Component
@ConditionalOnProperty(name = "journey.media.mode", havingValue = "local")
public class LocalDiskStorage implements MediaStorage {

    /** The folder, inside the storage folder, that holds the smaller versions. */
    private static final String SIZED = ".sized";

    private final Path root;
    private final byte[] secret;

    LocalDiskStorage(
            @Value("${journey.media.local.dir}") String dir, @Value("${journey.media.local.secret}") String secret)
            throws IOException {
        this.root = Path.of(dir).toAbsolutePath().normalize();
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
        Files.createDirectories(root);
    }

    @Override
    public UploadTarget uploadTarget(UUID mediaId, String contentType) {
        String url = ServletUriComponentsBuilder.fromCurrentContextPath()
                .path("/local-media/{id}")
                .queryParam("token", tokenFor(mediaId))
                .buildAndExpand(mediaId)
                .toUriString();
        return new UploadTarget(url, "PUT", Map.of("Content-Type", contentType));
    }

    @Override
    public String publicUrl(String storageKey) {
        return ServletUriComponentsBuilder.fromCurrentContextPath()
                .path("/media/")
                .path(storageKey)
                .toUriString();
    }

    @Override
    public String publicUrl(String storageKey, MediaSize size) {
        return ServletUriComponentsBuilder.fromCurrentContextPath()
                .path("/media/")
                .path(storageKey)
                .queryParam("w", size.width())
                .toUriString();
    }

    /**
     * The smaller version of a photo, made the first time it is asked for and kept next to the originals.
     * Falls back to the original when Java can't read the format (HEIC, WebP) or the photo is already small.
     */
    public Path resolveSized(String storageKey, MediaSize size) {
        Path original = resolve(storageKey);
        Path sized = root.resolve(SIZED)
                .resolve(String.valueOf(size.width()))
                .resolve(storageKey + ".jpg")
                .normalize();
        if (Files.isRegularFile(sized)) {
            return sized;
        }
        try {
            BufferedImage image = ImageIO.read(original.toFile());
            if (image == null || Math.max(image.getWidth(), image.getHeight()) <= size.width()) {
                return original;
            }
            double scale = (double) size.width() / Math.max(image.getWidth(), image.getHeight());
            BufferedImage small = new BufferedImage(
                    Math.max(1, (int) Math.round(image.getWidth() * scale)),
                    Math.max(1, (int) Math.round(image.getHeight() * scale)),
                    BufferedImage.TYPE_INT_RGB);
            Graphics2D g = small.createGraphics();
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            // Drawing through a pre-shrunk copy keeps a big photo from turning grainy when it is made much smaller.
            g.drawImage(
                    image.getScaledInstance(small.getWidth(), small.getHeight(), Image.SCALE_SMOOTH),
                    0,
                    0,
                    Color.WHITE,
                    null);
            g.dispose();
            Files.createDirectories(sized.getParent());
            Path temp = Files.createTempFile(sized.getParent(), "sized-", ".part");
            try {
                ImageIO.write(small, "jpg", temp.toFile());
                Files.move(temp, sized, StandardCopyOption.REPLACE_EXISTING);
            } finally {
                Files.deleteIfExists(temp);
            }
            return sized;
        } catch (IOException | RuntimeException e) {
            return original;
        }
    }

    /** Proof that the API itself issued this upload link. */
    public String tokenFor(UUID mediaId) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(mediaId.toString().getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    public boolean tokenMatches(UUID mediaId, String token) {
        return MessageDigest.isEqual(
                tokenFor(mediaId).getBytes(StandardCharsets.UTF_8),
                String.valueOf(token).getBytes(StandardCharsets.UTF_8));
    }

    /** Saves a file, stopping once it grows past {@code maxBytes}. Returns its size. */
    public long store(String storageKey, InputStream data, long maxBytes) throws IOException {
        Path target = resolve(storageKey);
        Files.createDirectories(target.getParent());
        Path temp = Files.createTempFile(target.getParent(), "upload-", ".part");
        try {
            long written =
                    Files.copy(new LimitedInputStream(data, maxBytes), temp, StandardCopyOption.REPLACE_EXISTING);
            Files.move(temp, target, StandardCopyOption.REPLACE_EXISTING);
            return written;
        } finally {
            Files.deleteIfExists(temp);
        }
    }

    /** The file for a key, or an error if the key points outside the storage folder. */
    @Override
    public void delete(String storageKey) {
        try {
            Files.deleteIfExists(resolve(storageKey));
            for (MediaSize size : MediaSize.values()) {
                Files.deleteIfExists(root.resolve(SIZED)
                        .resolve(String.valueOf(size.width()))
                        .resolve(storageKey + ".jpg")
                        .normalize());
            }
        } catch (IOException | RuntimeException e) {
            // A file left behind is tidied up later; it must not stop an account from being deleted.
        }
    }

    public Path resolve(String storageKey) {
        Path path = root.resolve(storageKey).normalize();
        if (!path.startsWith(root)) {
            throw new IllegalArgumentException("Not a storage key: " + storageKey);
        }
        return path;
    }

    /** Thrown when an upload is bigger than allowed. */
    public static class TooLargeException extends IOException {
        TooLargeException() {
            super("File too large");
        }
    }

    private static final class LimitedInputStream extends java.io.FilterInputStream {
        private long remaining;

        LimitedInputStream(InputStream in, long max) {
            super(in);
            this.remaining = max;
        }

        @Override
        public int read() throws IOException {
            int b = super.read();
            if (b >= 0 && --remaining < 0) throw new TooLargeException();
            return b;
        }

        @Override
        public int read(byte[] buffer, int off, int len) throws IOException {
            int n = super.read(buffer, off, len);
            if (n > 0 && (remaining -= n) < 0) throw new TooLargeException();
            return n;
        }
    }
}
