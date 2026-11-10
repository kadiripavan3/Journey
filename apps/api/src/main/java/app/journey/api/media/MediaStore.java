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

    /** A file to remove: a photo from storage, or a clip from the video service. */
    public record StoredFile(UUID id, MediaKind kind, String storageKey, String videoAssetId) {}

    private static final org.springframework.jdbc.core.RowMapper<StoredFile> FILE = (rs, n) -> new StoredFile(
            rs.getObject("id", UUID.class),
            MediaKind.read(rs.getString("kind")),
            rs.getString("storage_key"),
            rs.getString("video_asset_id"));

    private final JdbcClient jdbc;

    MediaStore(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public UUID insert(UUID ownerId, MediaKind kind, String contentType, String storageKey, Integer durationS) {
        return jdbc.sql(
                        "insert into media (owner_id, kind, content_type, storage_key, duration_s) values (:owner, :kind, :type, :key, :duration) returning id")
                .param("owner", ownerId)
                .param("kind", kind.code())
                .param("type", contentType)
                .param("key", storageKey)
                .param("duration", durationS)
                .query(UUID.class)
                .single();
    }

    /** Remembers the video service's own id for a clip's upload. */
    public void setVideoUpload(UUID id, String uploadId) {
        jdbc.sql("update media set video_upload_id = :upload where id = :id")
                .param("upload", uploadId)
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

    /** The clip can be watched. What the video service found out about it (its ids, its real length) is kept. */
    public void markClipReady(UUID id, Long bytes, String assetId, String playbackId, Integer durationS) {
        jdbc.sql("""
            update media set status = 'ready', bytes = coalesce(:bytes, bytes), video_asset_id = coalesce(:asset, video_asset_id),
              playback_id = coalesce(:playback, playback_id), duration_s = coalesce(:duration, duration_s)
            where id = :id
            """)
                .param("bytes", bytes)
                .param("asset", assetId)
                .param("playback", playbackId)
                .param("duration", durationS)
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

    public List<MediaRow> findAll(List<UUID> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        return jdbc.sql(
                        "select id, owner_id, kind, content_type, storage_key, width, height, duration_s, status, video_asset_id, playback_id from media where id in (:ids)")
                .param("ids", ids)
                .query((rs, n) -> new MediaRow(
                        rs.getObject("id", UUID.class),
                        rs.getObject("owner_id", UUID.class),
                        MediaKind.read(rs.getString("kind")),
                        rs.getString("content_type"),
                        rs.getString("storage_key"),
                        (Integer) rs.getObject("width"),
                        (Integer) rs.getObject("height"),
                        (Integer) rs.getObject("duration_s"),
                        MediaStatus.read(rs.getString("status")),
                        rs.getString("video_asset_id"),
                        rs.getString("playback_id")))
                .list();
    }

    /** Ready photos that were uploaded before smaller versions were made at upload, oldest first. */
    public List<StoredFile> withoutSizes(int limit) {
        return jdbc.sql(
                        "select id, kind, storage_key, video_asset_id from media where kind = 'photo' and status = 'ready' and not sized order by created_at limit :limit")
                .param("limit", limit)
                .query(FILE)
                .list();
    }

    public void markSized(UUID id) {
        jdbc.sql("update media set sized = true where id = :id").param("id", id).update();
    }

    public void markReady(UUID id, long bytes, Integer width, Integer height) {
        jdbc.sql(
                        "update media set status = 'ready', sized = true, bytes = :bytes, width = :w, height = :h where id = :id")
                .param("bytes", bytes)
                .param("w", width)
                .param("h", height)
                .param("id", id)
                .update();
    }

    /** Every file a person uploaded, for deleting their account. */
    public List<StoredFile> filesOwnedBy(UUID ownerId) {
        return jdbc.sql("select id, kind, storage_key, video_asset_id from media where owner_id = :owner")
                .param("owner", ownerId)
                .query(FILE)
                .list();
    }

    public void deleteOwnedBy(UUID ownerId) {
        jdbc.sql("delete from media where owner_id = :owner")
                .param("owner", ownerId)
                .update();
    }

    /**
     * Uploads nobody used: started and never finished, or finished and never put on an entry, a journey or a
     * profile. A day is plenty of time to finish writing an entry.
     */
    public List<StoredFile> abandoned(int olderThanHours, int limit) {
        return jdbc.sql("""
            select m.id, m.kind, m.storage_key, m.video_asset_id from media m
            where m.created_at < now() - make_interval(hours => :hours)
              and not exists (select 1 from entry_media em where em.media_id = m.id)
              and not exists (select 1 from journeys j where j.cover_media_id = m.id)
              and not exists (select 1 from profiles p where p.avatar_media_id = m.id)
            order by m.created_at limit :limit
            """)
                .param("hours", olderThanHours)
                .param("limit", limit)
                .query(FILE)
                .list();
    }

    public void delete(List<UUID> ids) {
        if (!ids.isEmpty()) {
            jdbc.sql("delete from media where id in (:ids)").param("ids", ids).update();
        }
    }
}
