package app.journey.api.media;

import app.journey.api.common.ApiProblem;
import app.journey.api.media.MediaService.MediaRow;
import io.swagger.v3.oas.annotations.Hidden;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Iterator;
import java.util.UUID;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.MediaTypeFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The two things cloud storage does, done locally: receive an uploaded file, and serve it back. Both
 * exist only in local mode and are not part of the API the app is generated from.
 */
@RestController
@Hidden
@ConditionalOnProperty(name = "journey.media.mode", havingValue = "local")
class LocalMediaController {

  private final LocalDiskStorage storage;
  private final MediaService media;

  LocalMediaController(LocalDiskStorage storage, MediaService media) {
    this.storage = storage;
    this.media = media;
  }

  @PutMapping("/local-media/{id}")
  ResponseEntity<Void> receive(@PathVariable UUID id, @RequestParam String token, HttpServletRequest request) throws IOException {
    MediaRow row = media.find(id);
    if (row == null || !storage.tokenMatches(id, token)) {
      return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
    }
    long limit = "video".equals(row.kind()) ? MediaService.MAX_CLIP_BYTES : MediaService.MAX_PHOTO_BYTES;
    long bytes;
    try {
      bytes = storage.store(row.storageKey(), request.getInputStream(), limit);
    } catch (LocalDiskStorage.TooLargeException e) {
      throw new ApiProblem(HttpStatus.CONTENT_TOO_LARGE, "too_large", "video".equals(row.kind()) ? "That clip is too big. Keep clips under 60 seconds." : "That photo is too big.");
    }
    if (bytes == 0) {
      throw ApiProblem.badRequest("empty_file", "The file arrived empty. Try again.");
    }
    int[] size = "photo".equals(row.kind()) ? dimensions(storage.resolve(row.storageKey())) : null;
    media.markReady(id, bytes, size == null ? null : size[0], size == null ? null : size[1]);
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/media/{year}/{month}/{file}")
  ResponseEntity<Resource> serve(@PathVariable String year, @PathVariable String month, @PathVariable String file) {
    Path path;
    try {
      path = storage.resolve(year + "/" + month + "/" + file);
    } catch (IllegalArgumentException e) {
      return ResponseEntity.notFound().build();
    }
    if (!Files.isRegularFile(path)) {
      return ResponseEntity.notFound().build();
    }
    Resource resource = new FileSystemResource(path);
    return ResponseEntity.ok()
        .contentType(MediaTypeFactory.getMediaType(resource).orElse(MediaType.APPLICATION_OCTET_STREAM))
        .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable())
        .body(resource);
  }

  /** Width and height of an image, read from its header. Null when the format isn't one Java can read. */
  private static int[] dimensions(Path file) {
    try (ImageInputStream in = ImageIO.createImageInputStream(file.toFile())) {
      Iterator<ImageReader> readers = in == null ? null : ImageIO.getImageReaders(in);
      if (readers == null || !readers.hasNext()) {
        return null;
      }
      ImageReader reader = readers.next();
      try {
        reader.setInput(in);
        return new int[] {reader.getWidth(0), reader.getHeight(0)};
      } finally {
        reader.dispose();
      }
    } catch (IOException | RuntimeException e) {
      return null;
    }
  }
}
