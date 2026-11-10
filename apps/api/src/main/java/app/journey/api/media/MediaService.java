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
    private static final Map<String, String> PHOTO_TYPES =
            Map.of("image/jpeg", "jpg", "image/png", "png", "image/webp", "webp", "image/heic", "heic");
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

    MediaService(MediaStore store, MediaStorage storage) {
        this.store = store;
        this.storage = storage;
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
        return new NewUpload(id, storage.uploadTarget(id, type));
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
        return storageKey == null ? null : storage.publicUrl(storageKey, size);
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
                kind == MediaKind.PHOTO ? storage.publicUrl(storageKey, MediaSize.MEDIUM) : null,
                width,
                height,
                durationS);
    }

    /** Deletes everything a person uploaded: the records now, the files right after. */
    @Transactional
    public void deleteAllOwnedBy(UUID ownerId) {
        List<String> keys = store.keysOwnedBy(ownerId);
        store.deleteOwnedBy(ownerId);
        afterCommit(() -> keys.forEach(storage::delete));
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
        afterCommit(() -> files.forEach(file -> storage.delete(file.storageKey())));
        if (!files.isEmpty()) {
            log.info("Removed {} uploads that were never used.", files.size());
        }
        return files.size();
    }
}
