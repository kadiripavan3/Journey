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
      UUID id, UUID ownerId, MediaKind kind, String contentType, String storageKey, Integer width, Integer height, Integer durationS, String status) {

    public boolean ready() {
      return "ready".equals(status);
    }
  }

  /** A file to remove from storage. */
  public record StoredFile(UUID id, String storageKey) {}

  private final JdbcClient jdbc;

  MediaStore(JdbcClient jdbc) {
    this.jdbc = jdbc;
  }

  public UUID insert(UUID ownerId, MediaKind kind, String contentType, String storageKey) {
    return jdbc.sql("insert into media (owner_id, kind, content_type, storage_key) values (:owner, :kind, :type, :key) returning id")
        .param("owner", ownerId).param("kind", kind.code()).param("type", contentType).param("key", storageKey)
        .query(UUID.class).single();
  }

  public Optional<MediaRow> find(UUID id) {
    return findAll(List.of(id)).stream().findFirst();
  }

  public List<MediaRow> findAll(List<UUID> ids) {
    if (ids.isEmpty()) {
      return List.of();
    }
    return jdbc.sql("select id, owner_id, kind, content_type, storage_key, width, height, duration_s, status from media where id in (:ids)")
        .param("ids", ids)
        .query((rs, n) -> new MediaRow(
            rs.getObject("id", UUID.class), rs.getObject("owner_id", UUID.class), MediaKind.read(rs.getString("kind")), rs.getString("content_type"),
            rs.getString("storage_key"), (Integer) rs.getObject("width"), (Integer) rs.getObject("height"), (Integer) rs.getObject("duration_s"),
            rs.getString("status")))
        .list();
  }

  public void markReady(UUID id, long bytes, Integer width, Integer height) {
    jdbc.sql("update media set status = 'ready', bytes = :bytes, width = :w, height = :h where id = :id")
        .param("bytes", bytes).param("w", width).param("h", height).param("id", id).update();
  }

  /** Every file a person uploaded, for deleting their account. */
  public List<String> keysOwnedBy(UUID ownerId) {
    return jdbc.sql("select storage_key from media where owner_id = :owner").param("owner", ownerId).query(String.class).list();
  }

  public void deleteOwnedBy(UUID ownerId) {
    jdbc.sql("delete from media where owner_id = :owner").param("owner", ownerId).update();
  }

  /**
   * Uploads nobody used: started and never finished, or finished and never put on an entry, a journey or a
   * profile. A day is plenty of time to finish writing an entry.
   */
  public List<StoredFile> abandoned(int olderThanHours, int limit) {
    return jdbc.sql(
            """
            select m.id, m.storage_key from media m
            where m.created_at < now() - make_interval(hours => :hours)
              and not exists (select 1 from entry_media em where em.media_id = m.id)
              and not exists (select 1 from journeys j where j.cover_media_id = m.id)
              and not exists (select 1 from profiles p where p.avatar_media_id = m.id)
            order by m.created_at limit :limit
            """)
        .param("hours", olderThanHours).param("limit", limit)
        .query((rs, n) -> new StoredFile(rs.getObject("id", UUID.class), rs.getString("storage_key")))
        .list();
  }

  public void delete(List<UUID> ids) {
    if (!ids.isEmpty()) {
      jdbc.sql("delete from media where id in (:ids)").param("ids", ids).update();
    }
  }
}
