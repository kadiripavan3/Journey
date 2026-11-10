package app.journey.api.media;

import app.journey.api.common.ApiProblem;
import app.journey.api.common.PublicUrls;
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
import org.springframework.context.ApplicationEventPublisher;
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
    /** A clip is at most a minute long. */
    public static final int MAX_CLIP_SECONDS = 60;

    /** The picture shown for a clip that has no still frame of its own (yet). */
    static final String CLIP_STILL = "/share/clip.jpg";

    private static final Logger log = LoggerFactory.getLogger(MediaService.class);
    // The app turns every photo into a JPEG before sending it; PNG is accepted too. Both are formats the API can make
    // smaller.
    private static final Map<String, String> PHOTO_TYPES = Map.of("image/jpeg", "jpg", "image/png", "png");
    // Phones record MP4 and MOV; a browser (the web preview) records WebM.
    private static final Map<String, String> CLIP_TYPES =
            Map.of("video/mp4", "mp4", "video/quicktime", "mov", "video/webm", "webm");

    /** What the app needs to show one photo or clip. */
    public record MediaResponse(
            UUID id,
            MediaKind kind,

            @Schema(
                    description =
                            "ready, or for a clip that its author still sees: processing (being converted) or failed. Other people only ever get ready ones.")
            MediaStatus status,

            @Schema(description = "A picture to show: the photo itself, or a clip's still frame")
            String url,

            @Schema(description = "A smaller version of that picture, for lists and grids")
            String thumbUrl,

            @Schema(
                    nullable = true,
                    description = "For a clip that is ready: the address to play it from. Null for photos.")
            String playbackUrl,

            @Schema(nullable = true) Integer width,
            @Schema(nullable = true) Integer height,

            @Schema(nullable = true, description = "A clip's length")
            Integer durationSeconds,

            @Schema(
                    description =
                            "True while the automatic check has this photo held for a reviewer. Only its owner ever sees a held photo.")
            boolean held) {}

    public record NewUpload(UUID mediaId, MediaStorage.UploadTarget target) {}

    private final MediaStore store;
    private final MediaStorage storage;
    private final MediaSizes sizes;
    private final VideoService video;
    private final PublicUrls urls;
    private final ApplicationEventPublisher events;

    MediaService(
            MediaStore store,
            MediaStorage storage,
            MediaSizes sizes,
            VideoService video,
            PublicUrls urls,
            ApplicationEventPublisher events) {
        this.store = store;
        this.storage = storage;
        this.sizes = sizes;
        this.video = video;
        this.urls = urls;
        this.events = events;
    }

    /**
     * Starts an upload: a record of the file to come, and where the phone sends it. Photos go to storage;
     * clips go to the video service. For a clip the app says how long it is, and one over a minute is refused
     * before anything is sent.
     */
    @Transactional
    public NewUpload startUpload(UUID ownerId, MediaKind kind, String contentType, Integer durationSeconds) {
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
        boolean clip = kind == MediaKind.VIDEO;
        if (clip && durationSeconds != null && (durationSeconds < 0 || durationSeconds > MAX_CLIP_SECONDS)) {
            throw ApiProblem.badRequest("clip_too_long", "Keep clips to " + MAX_CLIP_SECONDS + " seconds or less.");
        }
        LocalDate today = LocalDate.now();
        String key = "%d/%02d/%s.%s".formatted(today.getYear(), today.getMonthValue(), UUID.randomUUID(), extension);
        UUID id = store.insert(ownerId, kind, type, key, clip ? durationSeconds : null);
        if (!clip) {
            return new NewUpload(id, storage.uploadTarget(id, key, type));
        }
        VideoService.ClipUpload upload = video.startUpload(id, key, type);
        if (upload.uploadId() != null) {
            store.setVideoUpload(id, upload.uploadId());
        }
        return new NewUpload(id, upload.target());
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
        if (row.usable()) {
            return;
        }
        if (row.kind() == MediaKind.VIDEO) {
            // The video service says where the clip stands: ready at once (the local stand-in), or being converted.
            VideoService.ClipState state = video.afterUpload(row);
            if (state.status() == MediaStatus.READY) {
                store.markClipReady(id, state.bytes(), state.assetId(), state.playbackId(), state.durationSeconds());
            } else {
                store.markProcessing(id, state.bytes());
            }
            return;
        }
        long bytes = storage.size(row.storageKey()).orElse(0);
        if (bytes == 0) {
            throw ApiProblem.badRequest("upload_missing", "The photo didn't arrive. Try again.");
        }
        try {
            if (bytes > MAX_PHOTO_BYTES) {
                throw new ApiProblem(HttpStatus.CONTENT_TOO_LARGE, "too_large", "That photo is too big.");
            }
            MediaSizes.Dimensions size = sizes.make(row.storageKey());
            store.markReady(id, bytes, size.width(), size.height());
            events.publishEvent(new MediaReady(id, ownerId, row.kind(), row.storageKey())); // the photo check listens
        } catch (ApiProblem refused) {
            deletePhotoFiles(row.storageKey()); // nothing good comes of keeping a file that was refused
            throw refused;
        }
    }

    /**
     * The video service has converted a clip, and it can be watched. Its real length is known only now, so a
     * clip over a minute is refused here and removed from the service.
     */
    @Transactional
    public void clipConverted(UUID mediaId, String assetId, String playbackId, Double seconds) {
        MediaRow clip =
                store.find(mediaId).filter(row -> row.kind() == MediaKind.VIDEO).orElse(null);
        if (clip == null) {
            video.delete(null, assetId); // its record was deleted while it was being converted
            return;
        }
        if (seconds != null && seconds > MAX_CLIP_SECONDS + 1) {
            store.markFailed(mediaId, assetId);
            afterCommit(() -> video.delete(clip.storageKey(), assetId));
            return;
        }
        store.markClipReady(mediaId, null, assetId, playbackId, seconds == null ? null : (int) Math.round(seconds));
    }

    /** The video service couldn't convert a clip. Its author sees that it failed and can remove it. */
    @Transactional
    public void clipFailed(UUID mediaId) {
        store.markFailed(mediaId, null);
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

    /** Removes a photo and the smaller versions made of it, or a clip from the video service. */
    private void deleteFiles(MediaStore.StoredFile file) {
        if (file.kind() == MediaKind.VIDEO) {
            video.delete(file.storageKey(), file.videoAssetId());
        } else {
            deletePhotoFiles(file.storageKey());
        }
    }

    private void deletePhotoFiles(String storageKey) {
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
                    if (!row.usable()) {
                        throw ApiProblem.badRequest(
                                "media_not_ready",
                                row.status() == MediaStatus.FAILED
                                        ? "A clip couldn't be used. Remove it and add it again."
                                        : "A photo or clip is still uploading. Wait a moment and try again.");
                    }
                    return row;
                })
                .toList();
    }

    /**
     * For a cover or a profile picture, which everyone sees: the photo must be this person's and ready, and it
     * can't be one that is being reviewed.
     */
    public void requireOwnShowable(UUID id, UUID ownerId) {
        requireOwn(List.of(id), ownerId, MediaKind.PHOTO);
        if (store.held(id)) {
            throw ApiProblem.badRequest(
                    "photo_under_review", "That photo is being reviewed, so it can't be used here yet.");
        }
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

    /**
     * A photo or clip as the app shows it. `url` and `thumbUrl` are always pictures: for a clip, its still
     * frame, or a neutral picture while it has none. A clip's `playbackUrl` is there once it can be watched.
     */
    public MediaResponse view(
            UUID id,
            MediaKind kind,
            MediaStatus status,
            String storageKey,
            String playbackId,
            Integer width,
            Integer height,
            Integer durationS,
            boolean held) {
        if (kind == MediaKind.PHOTO) {
            return new MediaResponse(
                    id,
                    kind,
                    status,
                    storage.publicUrl(storageKey),
                    storage.publicUrl(MediaSize.MEDIUM.keyFor(storageKey)),
                    null,
                    width,
                    height,
                    null,
                    held);
        }
        boolean ready = status == MediaStatus.READY;
        String still = ready ? video.stillUrl(playbackId, 1280) : null;
        String small = ready ? video.stillUrl(playbackId, 640) : null;
        String blank = urls.to(CLIP_STILL);
        return new MediaResponse(
                id,
                kind,
                status,
                still == null ? blank : still,
                small == null ? blank : small,
                ready ? video.playbackUrl(storageKey, playbackId) : null,
                width,
                height,
                durationS,
                held);
    }

    /**
     * Removes one upload for good: its record now, its files once that change is kept. For a reviewer who
     * removes a held photo.
     */
    @Transactional
    public void remove(UUID id) {
        store.find(id).ifPresent(row -> {
            store.delete(List.of(id));
            afterCommit(() ->
                    deleteFiles(new MediaStore.StoredFile(row.id(), row.kind(), row.storageKey(), row.videoAssetId())));
        });
    }

    /** Deletes everything a person uploaded: the records now, the files right after. */
    @Transactional
    public void deleteAllOwnedBy(UUID ownerId) {
        List<MediaStore.StoredFile> files = store.filesOwnedBy(ownerId);
        store.deleteOwnedBy(ownerId);
        afterCommit(() -> files.forEach(this::deleteFiles));
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
        afterCommit(() -> files.forEach(this::deleteFiles));
        if (!files.isEmpty()) {
            log.info("Removed {} uploads that were never used.", files.size());
        }
        return files.size();
    }
}
