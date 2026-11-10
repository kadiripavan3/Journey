package app.journey.api.comment;

import app.journey.api.common.ApiProblem;
import app.journey.api.common.Sql;
import app.journey.api.entry.EntryService;
import app.journey.api.entry.EntryStore;
import app.journey.api.entry.EntryStore.EntryRow;
import app.journey.api.media.MediaService;
import app.journey.api.profile.PersonResponse;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Comments on entries, with one level of replies. Anyone who can see an entry can comment on it. */
@Service
public class CommentService {

  static final int MAX_LENGTH = 500;
  static final int LIST_LIMIT = 500;

  public record CommentViewerResponse(boolean canDelete) {}

  public record CommentResponse(
      UUID id, UUID entryId,
      @Schema(nullable = true, description = "The comment this one replies to. Replies are one level deep.") UUID parentId,
      PersonResponse author, String body, Instant createdAt,
      @Schema(description = "True when the journey's creator wrote it") boolean byCreator,
      CommentViewerResponse viewer) {}

  private record CommentRow(
      UUID id, UUID entryId, UUID parentId, UUID authorId, String authorUsername, String authorName, String authorAvatarKey, String body, Instant createdAt) {}

  private static final String SELECT =
      """
      select c.id, c.entry_id, c.parent_id, c.author_id, p.username, p.display_name, a.storage_key as avatar_key, c.body, c.created_at
      from comments c
      join profiles p on p.id = c.author_id
      left join media a on a.id = p.avatar_media_id
      """;

  private static final RowMapper<CommentRow> ROW =
      (rs, n) -> new CommentRow(
          rs.getObject("id", UUID.class), rs.getObject("entry_id", UUID.class), rs.getObject("parent_id", UUID.class),
          rs.getObject("author_id", UUID.class), rs.getString("username"), rs.getString("display_name"), rs.getString("avatar_key"),
          rs.getString("body"), Sql.instant(rs, "created_at"));

  private final JdbcClient jdbc;
  private final EntryService entries;
  private final EntryStore entryStore;
  private final MediaService media;

  CommentService(JdbcClient jdbc, EntryService entries, EntryStore entryStore, MediaService media) {
    this.jdbc = jdbc;
    this.entries = entries;
    this.entryStore = entryStore;
    this.media = media;
  }

  /** An entry's comments, oldest first. The app groups replies under the comment they answer. */
  public List<CommentResponse> list(UUID entryId, UUID viewer) {
    EntryRow entry = entries.require(entryId, viewer);
    return jdbc.sql(SELECT + " where c.entry_id = :entry and not exists (select 1 from blocks b where (b.blocker_id = :viewer and b.blocked_id = c.author_id) or (b.blocker_id = c.author_id and b.blocked_id = :viewer)) order by c.created_at limit :limit")
        .param("entry", entryId).param("viewer", viewer).param("limit", LIST_LIMIT).query(ROW).list().stream()
        .map(row -> view(row, entry, viewer)).toList();
  }

  @Transactional
  public CommentResponse add(UUID entryId, UUID author, String body, UUID parentId) {
    EntryRow entry = entries.require(entryId, author);
    String text = body == null ? "" : body.trim();
    if (text.isEmpty()) {
      throw ApiProblem.badRequest("empty_comment", "Write something first.");
    }
    if (text.length() > MAX_LENGTH) {
      throw ApiProblem.badRequest("comment_too_long", "Keep comments to " + MAX_LENGTH + " characters or fewer.");
    }
    UUID parent = null;
    if (parentId != null) {
      CommentRow answered = find(parentId).filter(c -> c.entryId().equals(entryId))
          .orElseThrow(() -> ApiProblem.badRequest("comment_gone", "The comment you're replying to isn't there any more."));
      // Replies are one level deep: a reply to a reply joins the same thread.
      parent = answered.parentId() == null ? answered.id() : answered.parentId();
    }
    UUID id = jdbc.sql("insert into comments (entry_id, author_id, parent_id, body) values (:entry, :author, :parent, :body) returning id")
        .param("entry", entryId).param("author", author).param("parent", parent).param("body", text)
        .query(UUID.class).single();
    entryStore.refreshCommentCount(entryId);
    return view(find(id).orElseThrow(), entry, author);
  }

  /** The person who wrote a comment can delete it, and so can the journey's creator. Its replies go with it. */
  @Transactional
  public void delete(UUID id, UUID viewer) {
    CommentRow comment = find(id).orElseThrow(CommentService::notFound);
    EntryRow entry;
    try {
      entry = entries.require(comment.entryId(), viewer);
    } catch (ApiProblem hidden) {
      throw notFound();
    }
    if (!comment.authorId().equals(viewer) && !entry.journeyOwnerId().equals(viewer)) {
      throw new ApiProblem(HttpStatus.FORBIDDEN, "not_yours", "Only the person who wrote a comment, or the journey's creator, can delete it.");
    }
    jdbc.sql("delete from comments where id = :id").param("id", id).update();
    entryStore.refreshCommentCount(comment.entryId());
  }

  private Optional<CommentRow> find(UUID id) {
    return jdbc.sql(SELECT + " where c.id = :id").param("id", id).query(ROW).optional();
  }

  private static ApiProblem notFound() {
    return new ApiProblem(HttpStatus.NOT_FOUND, "comment_not_found", "This comment isn't available.");
  }

  private CommentResponse view(CommentRow c, EntryRow entry, UUID viewer) {
    return new CommentResponse(
        c.id(), c.entryId(), c.parentId(),
        new PersonResponse(c.authorId(), c.authorUsername(), c.authorName(), media.urlFor(c.authorAvatarKey())),
        c.body(), c.createdAt(), c.authorId().equals(entry.journeyOwnerId()),
        new CommentViewerResponse(c.authorId().equals(viewer) || entry.journeyOwnerId().equals(viewer)));
  }
}
