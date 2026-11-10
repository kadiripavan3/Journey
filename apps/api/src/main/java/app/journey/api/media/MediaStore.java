package app.journey.api.media;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Reads and writes the records of uploaded photos and clips. The files themselves are in {@link MediaStorage}. */
@Repository
public class MediaStore {

    public record MediaRow(
            UUID id,
            UUID ownerId,
            MediaKind kind,
            String contentType,
            String storageKey,
            Integer width,
            Integer height,
            Integer durationS,
            MediaStatus status,
            String videoUploadId,
            String videoAssetId,
            String playbackId) {

        public boolean ready() {
            return status == MediaStatus.READY;
        }

        /** Can go on an entry: ready, or a clip the video service is still converting. */
        public boolean usable() {
            return ready() || (kind == MediaKind.VIDEO && status == MediaStatus.PROCESSING);
        }
    }

    private final JdbcClient jdbc;

    MediaStore(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** A record of a file to come. For a clip, {@code uploadId} is the video service's own id for the upload. */
    public void insert(
            UUID id,
            UUID ownerId,
            MediaKind kind,
            String contentType,
            String storageKey,
            Integer durationS,
            String uploadId) {
        jdbc.sql("""
            insert into media (id, owner_id, kind, content_type, storage_key, duration_s, video_upload_id)
            values (:id, :owner, :kind, :type, :key, :duration, :upload)
            """)
                .param("id", id)
                .param("owner", ownerId)
                .param("kind", kind.code())
                .param("type", contentType)
                .param("key", storageKey)
                .param("duration", durationS)
                .param("upload", uploadId)
                .update();
    }

    public boolean hasProfile(UUID userId) {
        return jdbc.sql("select exists (select 1 from profiles where id = :id)")
                .param("id", userId)
                .query(Boolean.class)
                .single();
    }

    /** What a person has on the way and has sent lately, for the ceilings on uploads. */
    public record Recent(int unfinished, int photosToday, int clipsToday) {}

    public Recent recentOf(UUID ownerId) {
        return jdbc.sql("""
            select count(*) filter (where status = 'pending') as unfinished,
                   count(*) filter (where kind = 'photo') as photos,
                   count(*) filter (where kind = 'video') as clips
            from media where owner_id = :owner and created_at > now() - interval '24 hours'
            """)
                .param("owner", ownerId)
                .query((rs, n) -> new Recent(rs.getInt("unfinished"), rs.getInt("photos"), rs.getInt("clips")))
                .single();
    }

    /**
     * Takes a pending upload to work on, so two "it is sent" calls never work on the same file. False when
     * someone else has it. A claim that is a few minutes old was given up (the work died half-way).
     */
    public boolean claim(UUID id) {
        return jdbc.sql("""
            update media set claimed_at = now()
            where id = :id and status = 'pending' and (claimed_at is null or claimed_at < now() - interval '3 minutes')
            """).param("id", id).update() > 0;
    }

    public void release(UUID id) {
        jdbc.sql("update media set claimed_at = null where id = :id and status = 'pending'")
                .param("id", id)
                .update();
    }

    /** The clip is with the video service, which is converting it. */
    public void markProcessing(UUID id, Long bytes) {
        jdbc.sql(
                        "update media set status = 'processing', bytes = coalesce(:bytes, bytes) where id = :id and status = 'pending'")
                .param("bytes", bytes)
                .param("id", id)
                .update();
    }

    /**
     * The video service has converted the clip. Its ids and its real length are kept; it stays "being
     * converted" until {@link #clipReady} says it has been looked at.
     */
    public void clipConverted(UUID id, String assetId, String playbackId, Integer durationS) {
        jdbc.sql("""
            update media set video_asset_id = coalesce(:asset, video_asset_id), playback_id = coalesce(:playback, playback_id),
              duration_s = coalesce(:duration, duration_s)
            where id = :id
            """)
                .param("asset", assetId)
                .param("playback", playbackId)
                .param("duration", durationS)
                .param("id", id)
                .update();
    }

    /** The clip can be watched, and this is what the check made of it. */
    public void clipReady(UUID id, Long bytes, PhotoCheck.Result check) {
        jdbc.sql("""
            update media set status = 'ready', bytes = coalesce(:bytes, bytes), claimed_at = null,
              held = :held, held_reason = :reason, screened_at = case when :settled then now() else null end,
              screen_attempts = case when :tried then 1 else 0 end
            where id = :id and status <> 'ready'
            """)
                .param("bytes", bytes)
                .param("held", check.held())
                .param("reason", check.held() ? check.reason() : null)
                .param("settled", check.settled())
                .param("tried", check.outcome() == PhotoCheck.Outcome.NOT_LOOKED)
                .param("id", id)
                .update();
    }

    public void markFailed(UUID id, String assetId) {
        jdbc.sql("update media set status = 'failed', video_asset_id = coalesce(:asset, video_asset_id) where id = :id")
                .param("asset", assetId)
                .param("id", id)
                .update();
    }

    public Optional<MediaRow> find(UUID id) {
        return findAll(List.of(id)).stream().findFirst();
    }

    private static final String SELECT =
            "select id, owner_id, kind, content_type, storage_key, width, height, duration_s, status, video_upload_id, video_asset_id, playback_id from media";

    public List<MediaRow> findAll(List<UUID> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        return jdbc.sql(SELECT + " where id in (:ids)")
                .param("ids", ids)
                .query(ROW)
                .list();
    }

    private static final org.springframework.jdbc.core.RowMapper<MediaRow> ROW = (rs, n) -> new MediaRow(
            rs.getObject("id", UUID.class),
            rs.getObject("owner_id", UUID.class),
            MediaKind.read(rs.getString("kind")),
            rs.getString("content_type"),
            rs.getString("storage_key"),
            (Integer) rs.getObject("width"),
            (Integer) rs.getObject("height"),
            (Integer) rs.getObject("duration_s"),
            MediaStatus.read(rs.getString("status")),
            rs.getString("video_upload_id"),
            rs.getString("video_asset_id"),
            rs.getString("playback_id"));

    /** Clips the video service has had for a while without saying they are ready, oldest first. */
    public List<MediaRow> clipsStillConverting(int olderThanMinutes, int limit) {
        return jdbc.sql(SELECT + """
             where kind = 'video' and status = 'processing' and created_at < now() - make_interval(mins => :minutes)
            order by created_at limit :limit
            """)
                .param("minutes", olderThanMinutes)
                .param("limit", limit)
                .query(ROW)
                .list();
    }

    /** True while the automatic check has the photo held for a reviewer. */
    public boolean held(UUID id) {
        return jdbc.sql("select held from media where id = :id")
                .param("id", id)
                .query(Boolean.class)
                .optional()
                .orElse(false);
    }

    /**
     * The photo is stored under its final address, in every size, and this is what the check made of it. From
     * here on it can be used, and seen by others unless it is held.
     */
    public void photoReady(UUID id, String finalKey, long bytes, int width, int height, PhotoCheck.Result check) {
        jdbc.sql("""
            update media set status = 'ready', sized = true, storage_key = :key, content_type = 'image/jpeg',
              bytes = :bytes, width = :w, height = :h, claimed_at = null,
              held = :held, held_reason = :reason, screened_at = case when :settled then now() else null end,
              screen_attempts = case when :tried then 1 else 0 end
            where id = :id
            """)
                .param("key", finalKey)
                .param("bytes", bytes)
                .param("w", width)
                .param("h", height)
                .param("held", check.held())
                .param("reason", check.held() ? check.reason() : null)
                .param("settled", check.settled())
                .param("tried", check.outcome() == PhotoCheck.Outcome.NOT_LOOKED)
                .param("id", id)
                .update();
    }

    // ---- the check, later ----

    /** Something the check hasn't looked at yet. */
    public record Unscreened(UUID id, MediaKind kind, String storageKey, String playbackId, Integer durationS) {}

    /**
     * Ready photos and clips nobody has looked at (the check couldn't be reached, or was switched off when
     * they came). The ones tried least come first, so one the check keeps failing on can't hold up the rest.
     */
    public List<Unscreened> unscreened(int limit) {
        return jdbc.sql("""
            select id, kind, storage_key, playback_id, duration_s from media
            where status = 'ready' and screened_at is null order by screen_attempts, created_at limit :limit
            """)
                .param("limit", limit)
                .query((rs, n) -> new Unscreened(
                        rs.getObject("id", UUID.class),
                        MediaKind.read(rs.getString("kind")),
                        rs.getString("storage_key"),
                        rs.getString("playback_id"),
                        (Integer) rs.getObject("duration_s")))
                .list();
    }

    /**
     * Writes down what a later look found. When nobody could look once more, that is counted; after
     * {@code maxTries} the photo is held for a person instead of being tried for ever.
     */
    public void screened(UUID id, PhotoCheck.Result check, int maxTries) {
        if (check.settled()) {
            jdbc.sql("update media set screened_at = now(), held = :held, held_reason = :reason where id = :id")
                    .param("held", check.held())
                    .param("reason", check.held() ? check.reason() : null)
                    .param("id", id)
                    .update();
        } else if (check.outcome() == PhotoCheck.Outcome.NOT_LOOKED) {
            jdbc.sql("""
                update media set screen_attempts = screen_attempts + 1,
                  held = held or screen_attempts + 1 >= :max,
                  held_reason = case when screen_attempts + 1 >= :max
                    then 'The automatic check could not look at this after several tries' else held_reason end,
                  screened_at = case when screen_attempts + 1 >= :max then now() else null end
                where id = :id
                """).param("max", maxTries).param("id", id).update();
        }
    }

    /** A reviewer has looked and lets it through. True when it was held and no longer is. */
    public boolean letThrough(UUID id) {
        return jdbc.sql("update media set held = false, held_reason = null, appeal_at = null where id = :id and held")
                        .param("id", id)
                        .update()
                > 0;
    }

    /** The owner asks for a second look. True when the file is theirs and is held. */
    public boolean askAgain(UUID id, UUID ownerId) {
        return jdbc.sql("update media set appeal_at = now() where id = :id and owner_id = :owner and held")
                        .param("id", id)
                        .param("owner", ownerId)
                        .update()
                > 0;
    }

    // ---- removing ----

    /**
     * Deletes these records and, in the same transaction, queues their files for removal. The files go a
     * moment later, and are tried again until they are really gone (see {@link MediaCleanup}).
     */
    public int deleteAndQueueFiles(List<UUID> ids) {
        if (ids.isEmpty()) {
            return 0;
        }
        jdbc.sql("""
            insert into removed_files (kind, storage_key, video_asset_id)
            select kind, storage_key, video_asset_id from media where id in (:ids)
            """).param("ids", ids).update();
        return jdbc.sql("delete from media where id in (:ids)")
                .param("ids", ids)
                .update();
    }

    /** Everything a person uploaded, for deleting their account. */
    public int deleteOwnedBy(UUID ownerId) {
        jdbc.sql("""
            insert into removed_files (kind, storage_key, video_asset_id)
            select kind, storage_key, video_asset_id from media where owner_id = :owner
            """).param("owner", ownerId).update();
        return jdbc.sql("delete from media where owner_id = :owner")
                .param("owner", ownerId)
                .update();
    }

    /**
     * Takes files whose last use just went away (an entry, a journey or an account was deleted, or the photo
     * was taken off) and returns the ones nothing uses any more. Call inside a transaction: the rows it takes
     * are gone when it commits, and another copy of the API skips them meanwhile.
     */
    public List<UUID> takeNoLongerUsed(int limit) {
        List<UUID> taken = jdbc.sql("""
            delete from media_orphan_checks where media_id in (
              select media_id from media_orphan_checks order by queued_at limit :limit for update skip locked)
            returning media_id
            """).param("limit", limit).query(UUID.class).list();
        if (taken.isEmpty()) {
            return List.of();
        }
        return jdbc.sql("""
            select m.id from media m where m.id in (:ids)
              and not exists (select 1 from entry_media em where em.media_id = m.id)
              and not exists (select 1 from journeys j where j.cover_media_id = m.id)
              and not exists (select 1 from profiles p where p.avatar_media_id = m.id)
            """).param("ids", taken).query(UUID.class).list();
    }

    /**
     * Uploads nobody used: started and not finished within a day, or finished and never put on an entry, a
     * journey or a profile within a week (an entry written without a connection can wait that long).
     */
    public List<UUID> neverUsed(int limit) {
        return jdbc.sql("""
            select id from media
            where attached_at is null
              and created_at < now() - case when status = 'pending' then interval '1 day' else interval '7 days' end
            order by created_at limit :limit
            """).param("limit", limit).query(UUID.class).list();
    }

    /** Queues one file for removal that has no record (any more). */
    public void queueRemoval(MediaKind kind, String storageKey, String videoAssetId) {
        jdbc.sql("insert into removed_files (kind, storage_key, video_asset_id) values (:kind, :key, :asset)")
                .param("kind", kind.code())
                .param("key", storageKey)
                .param("asset", videoAssetId)
                .update();
    }

    public boolean olderThanADay(UUID id) {
        return jdbc.sql("select created_at < now() - interval '1 day' from media where id = :id")
                .param("id", id)
                .query(Boolean.class)
                .optional()
                .orElse(false);
    }

    /** A file waiting to be removed from storage or from the video service. */
    public record Removal(long id, MediaKind kind, String storageKey, String videoAssetId, int attempts) {}

    /**
     * Takes files that are due to be removed. Each is put off for a while as it is taken, so another copy of
     * the API doesn't take it too, and so one that fails is tried again later (a little later each time).
     */
    public List<Removal> takeRemovals(int limit) {
        return jdbc.sql("""
            update removed_files set attempts = attempts + 1,
              next_try_at = now() + make_interval(mins => least(5 * power(2, attempts)::int, 720))
            where id in (select id from removed_files where next_try_at <= now() order by next_try_at limit :limit
                         for update skip locked)
            returning id, kind, storage_key, video_asset_id, attempts
            """)
                .param("limit", limit)
                .query((rs, n) -> new Removal(
                        rs.getLong("id"),
                        MediaKind.read(rs.getString("kind")),
                        rs.getString("storage_key"),
                        rs.getString("video_asset_id"),
                        rs.getInt("attempts")))
                .list();
    }

    public void removed(long removalId) {
        jdbc.sql("delete from removed_files where id = :id")
                .param("id", removalId)
                .update();
    }

    /** How many files are waiting to be removed. */
    public int removalsWaiting() {
        return jdbc.sql("select count(*) from removed_files")
                .query(Integer.class)
                .single();
    }
}
