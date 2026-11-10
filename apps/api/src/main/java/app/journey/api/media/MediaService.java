package app.journey.api.media;

import app.journey.api.common.ApiProblem;
import app.journey.api.media.MediaStore.MediaRow;
import app.journey.api.profile.PersonResponse;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/** Photos and clips: what may be uploaded, and turning stored files into addresses the app can show. */
@Service
public class MediaService {

    public static final int MAX_PHOTOS_PER_ENTRY = 10;
    public static final int MAX_CLIPS_PER_ENTRY = 3;
    public static final long MAX_PHOTO_BYTES = 15L * 1024 * 1024;
    public static final long MAX_CLIP_BYTES = 200L * 1024 * 1024;

    private static final Logger log = LoggerFactory.getLogger(MediaService.class);
    // The app turns every photo into a JPEG before sending it; PNG is accepted too. Both are formats the API can make
    // smaller.
    private static final Map<String, String> PHOTO_TYPES = Map.of("image/jpeg", "jpg", "image/png", "png");
    private static final Map<String, String> CLIP_TYPES = Map.of("video/mp4", "mp4", "video/quicktime", "mov");

    /** What the app needs to show one photo or clip. */
    public record MediaResponse(
            UUID id,
            MediaKind kind,
            String url,

            @Schema(nullable = true, description = "A smaller version of a photo, for lists and grids. Null for clips.")
            String thumbUrl,

            @Schema(nullable = true) Integer width,
            @Schema(nullable = true) Integer height,
            @Schema(nullable = true) Integer durationSeconds) {}

    public record NewUpload(UUID mediaId, MediaStorage.UploadTarget target) {}

    private final MediaStore store;
    private final MediaStorage storage;
    private final MediaSizes sizes;

    MediaService(MediaStore store, MediaStorage storage, MediaSizes sizes) {
        this.store = store;
        this.storage = storage;
        this.sizes = sizes;
    }

    @Transactional
    public NewUpload startUpload(UUID ownerId, MediaKind kind, String contentType) {
        String type = contentType == null
                ? ""
                : contentType.toLowerCase().split(";")[0].trim();
        String extension = (kind == MediaKind.VIDEO ? CLIP_TYPES : PHOTO_TYPES).get(type);
        if (extension == null) {
            throw ApiProblem.badRequest(
                    "unsupported_media",
                    kind == MediaKind.VIDEO
                            ? "That clip's format isn't supported. Use MP4 or MOV."
                            : "That photo's format isn't supported. Use JPEG or PNG.");
        }
        LocalDate today = LocalDate.now();
        String key = "%d/%02d/%s.%s".formatted(today.getYear(), today.getMonthValue(), UUID.randomUUID(), extension);
        UUID id = store.insert(ownerId, kind, type, key);
        return new NewUpload(id, storage.uploadTarget(id, key, type));
    }

    /**
     * The app says an upload is done. The API looks at what arrived: it must be there, within the size allowed
     * and, for a photo, a picture it can read. Then the smaller versions are made and the file is ready to use.
     * Saying "done" twice is fine.
     */
    @Transactional
    public void completeUpload(UUID id, UUID ownerId) {
        MediaRow row = store.find(id)
                .filter(found -> found.ownerId().equals(ownerId))
                .orElseThrow(
                        () -> ApiProblem.badRequest("unknown_media", "That upload couldn't be found. Add it again."));
        if (row.ready()) {
            return;
        }
        boolean clip = row.kind() == MediaKind.VIDEO;
        long bytes = storage.size(row.storageKey()).orElse(0);
        if (bytes == 0) {
            throw ApiProblem.badRequest(
                    "upload_missing",
                    clip ? "The clip didn't arrive. Try again." : "The photo didn't arrive. Try again.");
        }
        try {
            if (bytes > (clip ? MAX_CLIP_BYTES : MAX_PHOTO_BYTES)) {
                throw new ApiProblem(
                        HttpStatus.CONTENT_TOO_LARGE,
                        "too_large",
                        clip ? "That clip is too big. Keep clips under 60 seconds." : "That photo is too big.");
            }
            MediaSizes.Dimensions size = clip ? null : sizes.make(row.storageKey());
            store.markReady(id, bytes, size == null ? null : size.width(), size == null ? null : size.height());
        } catch (ApiProblem refused) {
            deleteFiles(row.storageKey()); // nothing good comes of keeping a file that was refused
            throw refused;
        }
    }

    /**
     * Makes the smaller versions for photos that don't have them yet (uploaded before they were made at upload).
     * Runs when the API starts and picks up where it left off. Returns how many photos it handled.
     */
    public int makeMissingSizes() {
        int handled = 0;
        List<MediaStore.StoredFile> batch;
        while (!(batch = store.withoutSizes(100)).isEmpty()) {
            for (MediaStore.StoredFile photo : batch) {
                try {
                    sizes.make(photo.storageKey());
                } catch (RuntimeException gone) {
                    // The original is missing or unreadable; its addresses stay dead either way, and it isn't tried
                    // again.
                    log.warn("No smaller versions for {}: {}", photo.storageKey(), gone.getMessage());
                }
                store.markSized(photo.id());
                handled++;
            }
        }
        if (handled > 0) {
            log.info("Made the smaller versions of {} photos.", handled);
        }
        return handled;
    }

    /** Removes a file and the smaller versions made of it. */
    private void deleteFiles(String storageKey) {
        storage.delete(storageKey);
        for (MediaSize size : MediaSize.values()) {
            storage.delete(size.keyFor(storageKey));
        }
    }

    /** Checks that every id is an uploaded file belonging to this person, of the kind wanted (or any kind when null). Keeps the order given. */
    public List<MediaRow> requireOwn(List<UUID> ids, UUID ownerId, MediaKind kind) {
        Map<UUID, MediaRow> found =
                store.findAll(ids).stream().collect(Collectors.toMap(MediaRow::id, Function.identity()));
        return ids.stream()
                .map(id -> {
                    MediaRow row = found.get(id);
                    if (row == null || !row.ownerId().equals(ownerId) || (kind != null && kind != row.kind())) {
                        throw ApiProblem.badRequest(
                                "unknown_media", "One of the photos couldn't be found. Add it again.");
                    }
                    if (!row.ready()) {
                        throw ApiProblem.badRequest(
                                "media_not_ready", "A photo is still uploading. Wait a moment and try again.");
                    }
                    return row;
                })
                .toList();
    }

    /** The full-size file. */
    public String urlFor(String storageKey) {
        return storageKey == null ? null : storage.publicUrl(storageKey);
    }

    /** A smaller version of a photo. */
    public String urlFor(String storageKey, MediaSize size) {
        return storageKey == null ? null : storage.publicUrl(size.keyFor(storageKey));
    }

    /** A person as shown next to what they wrote: their names and a small picture. */
    public PersonResponse person(UUID id, String username, String displayName, String avatarKey) {
        return new PersonResponse(id, username, displayName, urlFor(avatarKey, MediaSize.SMALL));
    }

    public MediaResponse view(
            UUID id, MediaKind kind, String storageKey, Integer width, Integer height, Integer durationS) {
        return new MediaResponse(
                id,
                kind,
                storage.publicUrl(storageKey),
                kind == MediaKind.PHOTO ? storage.publicUrl(MediaSize.MEDIUM.keyFor(storageKey)) : null,
                width,
                height,
                durationS);
    }

    /** Deletes everything a person uploaded: the records now, the files right after. */
    @Transactional
    public void deleteAllOwnedBy(UUID ownerId) {
        List<String> keys = store.keysOwnedBy(ownerId);
        store.deleteOwnedBy(ownerId);
        afterCommit(() -> keys.forEach(this::deleteFiles));
    }

    /**
     * Files are removed only once the change to the database has been kept. If the change is undone instead
     * (something failed further on), the records are back and so the files must still be there.
     */
    private static void afterCommit(Runnable work) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            work.run();
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                work.run();
            }
        });
    }

    /** Removes uploads nobody used (see {@link MediaStore#abandoned}). Returns how many. */
    @Transactional
    public int removeAbandoned() {
        List<MediaStore.StoredFile> files = store.abandoned(24, 500);
        store.delete(files.stream().map(MediaStore.StoredFile::id).toList());
        afterCommit(() -> files.forEach(file -> deleteFiles(file.storageKey())));
        if (!files.isEmpty()) {
            log.info("Removed {} uploads that were never used.", files.size());
        }
        return files.size();
    }
}
