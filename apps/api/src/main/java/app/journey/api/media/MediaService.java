package app.journey.api.media;

import app.journey.api.common.ApiProblem;
import app.journey.api.common.PublicUrls;
import app.journey.api.media.MediaStore.MediaRow;
import app.journey.api.profile.PersonResponse;
import io.swagger.v3.oas.annotations.media.Schema;
import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/** Photos and clips: what may be uploaded, and turning stored files into addresses the app can show. */
@Service
public class MediaService {

    public static final int MAX_PHOTOS_PER_ENTRY = 10;
    public static final int MAX_CLIPS_PER_ENTRY = 3;
    public static final long MAX_PHOTO_BYTES = 15L * 1024 * 1024;
    public static final long MAX_CLIP_BYTES = 200L * 1024 * 1024;
    /** A clip is at most a minute long. */
    public static final int MAX_CLIP_SECONDS = 60;

    /** Where an upload sits until the photo that is kept has been made from it. Nothing here is ever shown. */
    static final String INCOMING = "incoming";

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

    /** How many uploads one person may have started and not finished, and how many they may send in a day. */
    static final int MAX_UNFINISHED = 40;

    static final int MAX_PHOTOS_A_DAY = 400;
    static final int MAX_CLIPS_A_DAY = 40;

    /** After this many tries at which the automatic check couldn't look, a person looks instead. */
    static final int CHECK_TRIES = 5;

    private final MediaStore store;
    private final MediaStorage storage;
    private final MediaSizes sizes;
    private final VideoService video;
    private final PhotoCheck check;
    private final PublicUrls urls;
    private final TransactionTemplate transaction;

    MediaService(
            MediaStore store,
            MediaStorage storage,
            MediaSizes sizes,
            VideoService video,
            PhotoCheck check,
            PublicUrls urls,
            TransactionTemplate transaction) {
        this.store = store;
        this.storage = storage;
        this.sizes = sizes;
        this.video = video;
        this.check = check;
        this.urls = urls;
        this.transaction = transaction;
    }

    /**
     * Starts an upload: a record of the file to come, and where the phone sends it. Photos go to storage;
     * clips go to the video service. For a clip the app says how long it is, and one over a minute is refused
     * before anything is sent. Nobody may pile up uploads without end.
     *
     * <p>No transaction is open while the video service is asked for a link.
     */
    public NewUpload startUpload(UUID ownerId, MediaKind kind, String contentType, Integer durationSeconds) {
        String type = contentType == null
                ? ""
                : contentType.toLowerCase().split(";")[0].trim();
        boolean clip = kind == MediaKind.VIDEO;
        String extension = (clip ? CLIP_TYPES : PHOTO_TYPES).get(type);
        if (extension == null) {
            throw ApiProblem.badRequest(
                    "unsupported_media",
                    clip
                            ? "That clip's format isn't supported. Use MP4 or MOV."
                            : "That photo's format isn't supported. Use JPEG or PNG.");
        }
        if (clip && durationSeconds != null && (durationSeconds < 0 || durationSeconds > MAX_CLIP_SECONDS)) {
            throw ApiProblem.badRequest("clip_too_long", "Keep clips to " + MAX_CLIP_SECONDS + " seconds or less.");
        }
        if (clip && !store.hasProfile(ownerId)) {
            // Before the profile exists, the only upload there is a reason for is a profile picture.
            throw ApiProblem.conflict("profile_required", "Finish setting up your profile first.");
        }
        MediaStore.Recent recent = store.recentOf(ownerId);
        if (recent.unfinished() >= MAX_UNFINISHED
                || (clip ? recent.clipsToday() >= MAX_CLIPS_A_DAY : recent.photosToday() >= MAX_PHOTOS_A_DAY)) {
            throw new ApiProblem(
                    HttpStatus.TOO_MANY_REQUESTS,
                    "too_many_uploads",
                    clip
                            ? "That's a lot of clips for one day. Try again tomorrow."
                            : "That's a lot of photos at once. Give it a moment and try again.");
        }
        UUID id = UUID.randomUUID();
        LocalDate today = LocalDate.now();
        // Where the phone sends it. A photo is made into its kept version, under another address, when it is done.
        String key = "%s/%d-%02d/%s.%s"
                .formatted(clip ? "clips" : INCOMING, today.getYear(), today.getMonthValue(), id, extension);
        if (!clip) {
            store.insert(id, ownerId, kind, type, key, null, null);
            return new NewUpload(id, storage.uploadTarget(id, key, type));
        }
        VideoService.ClipUpload upload = video.startUpload(id, key, type);
        store.insert(id, ownerId, kind, type, key, durationSeconds, upload.uploadId());
        return new NewUpload(id, upload.target());
    }

    /**
     * The app says an upload is done. For a photo the API opens what arrived, makes the photo it keeps from
     * it (see {@link MediaSizes}), has it looked at, and only then is it ready to use. Saying "done" twice is
     * fine. No database connection is held while the file is read, made and looked at.
     */
    public void completeUpload(UUID id, UUID ownerId) {
        MediaRow row = store.find(id)
                .filter(found -> found.ownerId().equals(ownerId))
                .orElseThrow(
                        () -> ApiProblem.badRequest("unknown_media", "That upload couldn't be found. Add it again."));
        if (row.usable()) {
            return;
        }
        if (row.status() == MediaStatus.FAILED) {
            throw ApiProblem.badRequest("media_not_ready", "That upload couldn't be used. Add it again.");
        }
        if (!store.claim(id)) {
            // Another "done" for the same file is being worked on right now.
            throw new ApiProblem(
                    HttpStatus.SERVICE_UNAVAILABLE, "busy", "We're still getting that ready. Try again in a moment.");
        }
        try {
            if (row.kind() == MediaKind.VIDEO) {
                completeClip(row);
            } else {
                completePhoto(row);
            }
        } catch (RuntimeException failed) {
            store.release(id);
            throw failed;
        }
    }

    private void completePhoto(MediaRow row) {
        long bytes = storage.size(row.storageKey()).orElse(0);
        if (bytes == 0) {
            throw ApiProblem.badRequest("upload_missing", "The photo didn't arrive. Try again.");
        }
        try {
            if (bytes > MAX_PHOTO_BYTES) {
                throw new ApiProblem(HttpStatus.CONTENT_TOO_LARGE, "too_large", "That photo is too big.");
            }
            String kept = row.storageKey()
                            .replaceFirst("^" + INCOMING + "/", "photos/")
                            .replaceFirst("\\.[a-z]+$", "") + "-"
                    + UUID.randomUUID().toString().substring(0, 8) + ".jpg";
            MediaSizes.Made made = sizes.make(row.storageKey(), kept);
            PhotoCheck.Result looked = check.look(made.preview());
            store.photoReady(row.id(), kept, made.bytes(), made.width(), made.height(), looked);
            if (looked.held()) {
                log.info("Photo {} is held for review: {}", row.id(), looked.reason());
            }
        } catch (ApiProblem refused) {
            if (refused.status().is4xxClientError()) {
                quietly(() ->
                        storage.delete(row.storageKey())); // nothing good comes of keeping a file that was refused
            }
            throw refused;
        }
    }

    private void completeClip(MediaRow row) {
        // The video service says where the clip stands: ready at once (the local stand-in), or being converted.
        VideoService.ClipState state = video.afterUpload(row);
        if (state.status() == MediaStatus.READY) {
            store.clipConverted(row.id(), state.assetId(), state.playbackId(), state.durationSeconds());
            store.clipReady(row.id(), state.bytes(), lookAtClip(state.playbackId(), state.durationSeconds()));
        } else {
            store.markProcessing(row.id(), state.bytes());
        }
    }

    /**
     * The video service has converted a clip. Its real length is known only now, so a clip over a minute is
     * refused here and removed from the service. Otherwise its still frames are looked at, and then it can be
     * watched. Hearing this twice, or after the clip's record is gone, is fine.
     */
    public void clipConverted(UUID mediaId, String assetId, String playbackId, Double seconds) {
        MediaRow clip =
                store.find(mediaId).filter(row -> row.kind() == MediaKind.VIDEO).orElse(null);
        if (clip == null) {
            // Its record was deleted while it was being converted.
            store.queueRemoval(MediaKind.VIDEO, "", assetId);
            return;
        }
        if (clip.ready()) {
            return;
        }
        if (seconds != null && seconds > MAX_CLIP_SECONDS + 1) {
            store.markFailed(mediaId, assetId);
            store.queueRemoval(MediaKind.VIDEO, clip.storageKey(), assetId);
            return;
        }
        Integer length = seconds == null ? clip.durationS() : (Integer) (int) Math.round(seconds);
        store.clipConverted(mediaId, assetId, playbackId, length);
        store.clipReady(mediaId, null, lookAtClip(playbackId, length));
    }

    /** The video service couldn't convert a clip. Its author sees that it failed and can remove it. */
    public void clipFailed(UUID mediaId) {
        store.markFailed(mediaId, null);
    }

    /**
     * Asks the video service about clips it has had for a quarter of an hour without saying they are ready:
     * its message may have been lost. One it knows nothing about after a day has failed. Returns how many
     * clips moved on.
     */
    public int askAboutSlowClips() {
        int moved = 0;
        for (MediaRow clip : store.clipsStillConverting(15, 100)) {
            try {
                Optional<VideoService.Found> found = video.lookUp(clip);
                if (found.isPresent() && found.get().failed()) {
                    store.markFailed(clip.id(), found.get().assetId());
                    moved++;
                } else if (found.isPresent()) {
                    clipConverted(
                            clip.id(),
                            found.get().assetId(),
                            found.get().playbackId(),
                            found.get().seconds());
                    moved++;
                } else if (store.olderThanADay(clip.id())) {
                    store.markFailed(clip.id(), null);
                    moved++;
                }
            } catch (RuntimeException unreachable) {
                log.warn("Couldn't ask the video service about clip {}: {}", clip.id(), unreachable.toString());
                break;
            }
        }
        return moved;
    }

    /** A clip is looked at through a few of its still frames. The worst of them decides. */
    private PhotoCheck.Result lookAtClip(String playbackId, Integer durationSeconds) {
        Optional<List<byte[]>> frames;
        try {
            frames = playbackId == null ? Optional.empty() : video.stills(playbackId, durationSeconds);
        } catch (RuntimeException unreachable) {
            log.warn("Couldn't fetch a clip's still frames; it will be looked at later: {}", unreachable.toString());
            return PhotoCheck.Result.of(PhotoCheck.Outcome.NOT_LOOKED);
        }
        if (frames.isEmpty()) {
            return PhotoCheck.Result.of(
                    PhotoCheck.Outcome.CLEAN); // this video service makes no stills: nothing to look at
        }
        if (frames.get().isEmpty()) {
            return PhotoCheck.Result.of(PhotoCheck.Outcome.NOT_LOOKED);
        }
        PhotoCheck.Result worst = PhotoCheck.Result.of(PhotoCheck.Outcome.CLEAN);
        for (byte[] frame : frames.get()) {
            worst = worst.worseOf(check.look(frame));
        }
        return worst;
    }

    /**
     * Looks at photos and clips nobody has looked at: ones that came while the automatic check couldn't be
     * reached or was switched off. Stops after a few in a row that couldn't be looked at, so an outage doesn't
     * spin; one it can never look at is held for a person after {@link #CHECK_TRIES} tries. Returns how many
     * were settled.
     */
    public int checkWaiting() {
        int settled = 0;
        int missesInARow = 0;
        Set<UUID> seen = new HashSet<>();
        List<MediaStore.Unscreened> batch;
        while (missesInARow < 3 && !(batch = unseen(store.unscreened(50), seen)).isEmpty()) {
            for (MediaStore.Unscreened one : batch) {
                seen.add(one.id());
                PhotoCheck.Result looked = lookAgain(one);
                if (looked.outcome() == PhotoCheck.Outcome.OFF) {
                    return settled; // switched off: nothing will be looked at now
                }
                store.screened(one.id(), looked, CHECK_TRIES);
                if (looked.settled()) {
                    settled++;
                    missesInARow = 0;
                } else if (++missesInARow >= 3) {
                    break;
                }
            }
        }
        return settled;
    }

    private static List<MediaStore.Unscreened> unseen(List<MediaStore.Unscreened> batch, Set<UUID> seen) {
        return batch.stream().filter(one -> !seen.contains(one.id())).toList();
    }

    private PhotoCheck.Result lookAgain(MediaStore.Unscreened one) {
        if (one.kind() == MediaKind.VIDEO) {
            return lookAtClip(one.playbackId(), one.durationS());
        }
        byte[] preview;
        try (InputStream in = storage.open(MediaSize.MEDIUM.keyFor(one.storageKey()))) {
            preview = in.readNBytes((int) MAX_PHOTO_BYTES);
        } catch (java.nio.file.NoSuchFileException gone) {
            return PhotoCheck.Result.of(PhotoCheck.Outcome.CLEAN); // the file isn't there to look at; nothing to hold
        } catch (IOException | RuntimeException unreachable) {
            return PhotoCheck.Result.of(PhotoCheck.Outcome.NOT_LOOKED);
        }
        return check.look(preview);
    }

    /** A reviewer has looked at a held photo or clip and lets it through. True when it was held. */
    public boolean letThrough(UUID id) {
        return store.letThrough(id);
    }

    /** The owner of a held photo asks for a second look. True when it is theirs and held. */
    public boolean askForSecondLook(UUID id, UUID ownerId) {
        return store.askAgain(id, ownerId);
    }

    private static void quietly(Runnable work) {
        try {
            work.run();
        } catch (RuntimeException ignored) {
            // Best effort: what is left behind is removed with the uploads nobody used.
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
     * Removes one upload for good: its record now, its files a moment later (they are queued in the same
     * transaction, and tried until they are gone). For a reviewer who removes a held photo.
     */
    @Transactional
    public void remove(UUID id) {
        store.deleteAndQueueFiles(List.of(id));
    }

    /** Deletes everything a person uploaded: the records now, the files right after. */
    @Transactional
    public void deleteAllOwnedBy(UUID ownerId) {
        store.deleteOwnedBy(ownerId);
    }

    /**
     * Tidies up, in three steps. Files whose last use went away (an entry, a journey or an account was
     * deleted; a photo was taken off) lose their record. So do uploads nobody ever used. And every file whose
     * record is gone is removed from storage or from the video service, and tried again later if that fails.
     * Returns how many files were removed.
     */
    public int sweep() {
        Integer unused = transaction.execute(status -> {
            int gone = store.deleteAndQueueFiles(store.takeNoLongerUsed(500));
            return gone + store.deleteAndQueueFiles(store.neverUsed(500));
        });
        if (unused != null && unused > 0) {
            log.info("{} uploads are no longer used; their files are being removed.", unused);
        }
        int removed = 0;
        List<MediaStore.Removal> batch;
        // Taken in a short transaction of its own; the files are then removed with no transaction open.
        while (!(batch = take()).isEmpty()) {
            for (MediaStore.Removal file : batch) {
                try {
                    if (file.kind() == MediaKind.VIDEO) {
                        video.delete(file.storageKey().isEmpty() ? null : file.storageKey(), file.videoAssetId());
                    } else {
                        sizes.remove(file.storageKey());
                    }
                    store.removed(file.id());
                    removed++;
                } catch (RuntimeException failed) {
                    log.warn(
                            "Couldn't remove {} (try {}); it will be tried again: {}",
                            file.storageKey(),
                            file.attempts(),
                            failed.toString());
                }
            }
        }
        return removed;
    }

    private List<MediaStore.Removal> take() {
        List<MediaStore.Removal> taken = transaction.execute(status -> store.takeRemovals(200));
        return taken == null ? List.of() : taken;
    }
}
