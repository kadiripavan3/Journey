package app.journey.api.media;

import app.journey.api.common.ApiProblem;
import app.journey.api.media.MediaStore.MediaRow;
import io.swagger.v3.oas.annotations.Hidden;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.UUID;
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
    private final MediaStore media;

    LocalMediaController(LocalDiskStorage storage, MediaStore media) {
        this.storage = storage;
        this.media = media;
    }

    @PutMapping("/local-media/{id}")
    ResponseEntity<Void> receive(@PathVariable UUID id, @RequestParam String token, HttpServletRequest request)
            throws IOException {
        MediaRow row = media.find(id).orElse(null);
        if (row == null || !storage.tokenMatches(id, token)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        boolean clip = row.kind() == MediaKind.VIDEO;
        long limit = clip ? MediaService.MAX_CLIP_BYTES : MediaService.MAX_PHOTO_BYTES;
        long bytes;
        try {
            bytes = storage.store(row.storageKey(), request.getInputStream(), limit);
        } catch (LocalDiskStorage.TooLargeException e) {
            throw new ApiProblem(
                    HttpStatus.CONTENT_TOO_LARGE,
                    "too_large",
                    clip ? "That clip is too big. Keep clips under 60 seconds." : "That photo is too big.");
        }
        if (bytes == 0) {
            throw ApiProblem.badRequest("empty_file", "The file arrived empty. Try again.");
        }
        int[] size = clip ? null : LocalDiskStorage.dimensions(storage.resolve(row.storageKey()));
        if (size != null && (long) size[0] * size[1] > LocalDiskStorage.MAX_PIXELS) {
            // A small file can still unpack into an enormous picture; nothing good comes of keeping it.
            storage.delete(row.storageKey());
            throw new ApiProblem(
                    HttpStatus.CONTENT_TOO_LARGE, "too_large", "That photo is too large. Try a smaller one.");
        }
        media.markReady(id, bytes, size == null ? null : size[0], size == null ? null : size[1]);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/media/{year}/{month}/{file}")
    ResponseEntity<Resource> serve(
            @PathVariable String year,
            @PathVariable String month,
            @PathVariable String file,
            @RequestParam(name = "w", required = false) Integer width) {
        String key = year + "/" + month + "/" + file;
        Path path;
        try {
            path = storage.resolve(key);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
        if (!Files.isRegularFile(path)) {
            return ResponseEntity.notFound().build();
        }
        // Only the sizes the API itself hands out; any other number gets the original.
        path = MediaSize.ofWidth(width)
                .map(size -> storage.resolveSized(key, size))
                .orElse(path);
        Resource resource = new FileSystemResource(path);
        return ResponseEntity.ok()
                .contentType(MediaTypeFactory.getMediaType(resource).orElse(MediaType.APPLICATION_OCTET_STREAM))
                .cacheControl(
                        CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable())
                .body(resource);
    }
}
