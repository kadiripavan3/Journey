package app.journey.api.media;

import app.journey.api.common.ApiProblem;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.Image;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Iterator;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * Makes the smaller versions of a photo, once, when its upload finishes. The same code runs whatever the
 * storage is (a folder on this computer, or R2): it reads the original from storage and puts the smaller
 * files back next to it.
 */
@Component
public class MediaSizes {

    /** The biggest picture the API will unpack: 50 megapixels, well above any phone camera. */
    static final long MAX_PIXELS = 50_000_000L;

    /** Unpacking a photo takes a lot of memory, so only a couple are worked on at a time. */
    private final Semaphore working = new Semaphore(2);

    private final MediaStorage storage;

    MediaSizes(MediaStorage storage) {
        this.storage = storage;
    }

    public record Dimensions(int width, int height) {}

    /**
     * Checks that the stored file is a picture the API can read and isn't enormous, makes every {@link MediaSize}
     * of it, and returns its width and height. A photo already smaller than a size is stored under that size
     * as it is, so every address the API hands out exists.
     */
    public Dimensions make(String storageKey) {
        byte[] original;
        try (InputStream in = storage.open(storageKey)) {
            original = in.readAllBytes();
        } catch (IOException e) {
            throw ApiProblem.badRequest("upload_missing", "The photo didn't arrive. Try again.");
        }
        Dimensions full = dimensions(original);
        if (full == null) {
            throw ApiProblem.badRequest("unsupported_media", "That photo's format isn't supported. Use JPEG or PNG.");
        }
        if ((long) full.width() * full.height() > MAX_PIXELS) {
            // A small file can still unpack into an enormous picture; nothing good comes of keeping it.
            throw new ApiProblem(
                    HttpStatus.CONTENT_TOO_LARGE, "too_large", "That photo is too large. Try a smaller one.");
        }
        boolean mine = false;
        try {
            mine = working.tryAcquire(30, TimeUnit.SECONDS);
            if (!mine) {
                throw new ApiProblem(
                        HttpStatus.SERVICE_UNAVAILABLE, "busy", "We're a bit busy. Try again in a moment.");
            }
            BufferedImage image = ImageIO.read(new ByteArrayInputStream(original));
            for (MediaSize size : MediaSize.values()) {
                boolean smallEnough = Math.max(full.width(), full.height()) <= size.side();
                storage.put(
                        size.keyFor(storageKey),
                        smallEnough
                                ? jpeg(image, 1.0)
                                : jpeg(image, (double) size.side() / Math.max(full.width(), full.height())),
                        "image/jpeg");
            }
            return full;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ApiProblem(HttpStatus.SERVICE_UNAVAILABLE, "busy", "We're a bit busy. Try again in a moment.");
        } catch (IOException e) {
            throw new IllegalStateException("Could not store the smaller versions of " + storageKey, e);
        } finally {
            if (mine) {
                working.release();
            }
        }
    }

    /** The picture at a scale of its size, as a JPEG on a white background (a PNG may be see-through). */
    private static byte[] jpeg(BufferedImage image, double scale) throws IOException {
        int width = Math.max(1, (int) Math.round(image.getWidth() * scale));
        int height = Math.max(1, (int) Math.round(image.getHeight() * scale));
        BufferedImage out = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        // Drawing through a pre-shrunk copy keeps a big photo from turning grainy when it is made much smaller.
        g.drawImage(
                scale == 1.0 ? image : image.getScaledInstance(width, height, Image.SCALE_SMOOTH),
                0,
                0,
                Color.WHITE,
                null);
        g.dispose();
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        ImageIO.write(out, "jpg", bytes);
        return bytes.toByteArray();
    }

    /** Width and height, read from the file's header without unpacking it. Null when it isn't a picture Java can read. */
    static Dimensions dimensions(byte[] file) {
        try (ImageInputStream in = ImageIO.createImageInputStream(new ByteArrayInputStream(file))) {
            Iterator<ImageReader> readers = in == null ? null : ImageIO.getImageReaders(in);
            if (readers == null || !readers.hasNext()) {
                return null;
            }
            ImageReader reader = readers.next();
            try {
                reader.setInput(in);
                return new Dimensions(reader.getWidth(0), reader.getHeight(0));
            } finally {
                reader.dispose();
            }
        } catch (IOException | RuntimeException e) {
            return null;
        }
    }
}
