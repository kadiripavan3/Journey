package app.journey.api.media;

import app.journey.api.common.ApiProblem;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Photos and clips: what may be uploaded, and turning stored files into addresses the app can show. */
@Service
public class MediaService {

  public static final int MAX_PHOTOS_PER_ENTRY = 10;
  public static final int MAX_CLIPS_PER_ENTRY = 3;
  public static final long MAX_PHOTO_BYTES = 15L * 1024 * 1024;
  public static final long MAX_CLIP_BYTES = 200L * 1024 * 1024;

  private static final Map<String, String> PHOTO_TYPES = Map.of("image/jpeg", "jpg", "image/png", "png", "image/webp", "webp", "image/heic", "heic");
  private static final Map<String, String> CLIP_TYPES = Map.of("video/mp4", "mp4", "video/quicktime", "mov");

  /** What the app needs to show one photo or clip. */
  public record MediaResponse(
      UUID id, @Schema(allowableValues = {"photo", "video"}) String kind, String url,
      @Schema(nullable = true) Integer width, @Schema(nullable = true) Integer height, @Schema(nullable = true) Integer durationSeconds) {}

  public record MediaRow(UUID id, UUID ownerId, String kind, String contentType, String storageKey, Integer width, Integer height, Integer durationS, String status) {}

  public record NewUpload(UUID mediaId, MediaStorage.UploadTarget target) {}

  private final JdbcClient jdbc;
  private final MediaStorage storage;

  MediaService(JdbcClient jdbc, MediaStorage storage) {
    this.jdbc = jdbc;
    this.storage = storage;
  }

  @Transactional
  public NewUpload startUpload(UUID ownerId, String kind, String contentType) {
    String type = contentType == null ? "" : contentType.toLowerCase().split(";")[0].trim();
    String extension = ("video".equals(kind) ? CLIP_TYPES : PHOTO_TYPES).get(type);
    if (extension == null) {
      throw ApiProblem.badRequest("unsupported_media", "video".equals(kind) ? "That clip's format isn't supported. Use MP4 or MOV." : "That photo's format isn't supported. Use JPEG or PNG.");
    }
    LocalDate today = LocalDate.now();
    String key = "%d/%02d/%s.%s".formatted(today.getYear(), today.getMonthValue(), UUID.randomUUID(), extension);
    UUID id =
        jdbc.sql("insert into media (owner_id, kind, content_type, storage_key) values (:owner, :kind, :type, :key) returning id")
            .param("owner", ownerId).param("kind", kind).param("type", type).param("key", key)
            .query(UUID.class).single();
    return new NewUpload(id, storage.uploadTarget(id, type));
  }

  public MediaRow find(UUID id) {
    return jdbc.sql("select id, owner_id, kind, content_type, storage_key, width, height, duration_s, status from media where id = :id")
        .param("id", id)
        .query((rs, n) -> new MediaRow(
            rs.getObject("id", UUID.class), rs.getObject("owner_id", UUID.class), rs.getString("kind"), rs.getString("content_type"), rs.getString("storage_key"),
            (Integer) rs.getObject("width"), (Integer) rs.getObject("height"), (Integer) rs.getObject("duration_s"), rs.getString("status")))
        .optional()
        .orElse(null);
  }

  public void markReady(UUID id, long bytes, Integer width, Integer height) {
    jdbc.sql("update media set status = 'ready', bytes = :bytes, width = :w, height = :h where id = :id")
        .param("bytes", bytes).param("w", width).param("h", height).param("id", id).update();
  }

  /** Checks that every id is an uploaded file belonging to this person, of the kind wanted (or any kind when null). */
  public List<MediaRow> requireOwn(List<UUID> ids, UUID ownerId, String kind) {
    return ids.stream().map(id -> {
      MediaRow row = find(id);
      if (row == null || !row.ownerId().equals(ownerId) || (kind != null && !kind.equals(row.kind()))) {
        throw ApiProblem.badRequest("unknown_media", "One of the photos couldn't be found. Add it again.");
      }
      if (!"ready".equals(row.status())) {
        throw ApiProblem.badRequest("media_not_ready", "A photo is still uploading. Wait a moment and try again.");
      }
      return row;
    }).toList();
  }

  public String urlFor(String storageKey) {
    return storageKey == null ? null : storage.publicUrl(storageKey);
  }

  public MediaResponse view(UUID id, String kind, String storageKey, Integer width, Integer height, Integer durationS) {
    return new MediaResponse(id, kind, storage.publicUrl(storageKey), width, height, durationS);
  }
}
