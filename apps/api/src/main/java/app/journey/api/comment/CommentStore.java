package app.journey.api.comment;

import app.journey.api.common.Page;
import app.journey.api.common.PageRequest;
import app.journey.api.common.Rules;
import app.journey.api.common.Sql;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Reads and writes comments. The database keeps each entry's comment count. */
@Repository
public class CommentStore {

  public record CommentRow(
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

  CommentStore(JdbcClient jdbc) {
    this.jdbc = jdbc;
  }

  public Optional<CommentRow> find(UUID id) {
    return jdbc.sql(SELECT + " where c.id = :id").param("id", id).query(ROW).optional();
  }

  /** The comment this person already made from the same draft, if the app is sending it a second time. */
  public Optional<UUID> findByClientId(UUID authorId, UUID clientId) {
    return jdbc.sql("select id from comments where author_id = :author and client_id = :client")
        .param("author", authorId).param("client", clientId).query(UUID.class).optional();
  }

  /**
   * An entry's comments: threads in the order they were started, each comment followed by its replies, so a
   * page never shows a reply before the comment it answers. Comments by people blocked either way are left out.
   */
  public Page<CommentRow> page(UUID entryId, UUID viewer, PageRequest page) {
    List<CommentRow> rows = jdbc.sql(
            SELECT + " left join comments pc on pc.id = c.parent_id where c.entry_id = :entry and " + Rules.notBlocked("c.author_id", ":viewer")
                + " order by coalesce(pc.created_at, c.created_at), coalesce(c.parent_id, c.id), c.parent_id is not null, c.created_at, c.id"
                + " limit :limit offset :offset")
        .param("entry", entryId).param("viewer", viewer).param("limit", page.fetch()).param("offset", page.offset()).query(ROW).list();
    return Page.of(rows, page);
  }

  public UUID insert(UUID entryId, UUID authorId, UUID parentId, String body, UUID clientId) {
    return jdbc.sql(
            """
            insert into comments (entry_id, author_id, parent_id, body, client_id)
            values (:entry, :author, :parent, :body, cast(:client as uuid)) returning id
            """)
        .param("entry", entryId).param("author", authorId).param("parent", parentId).param("body", body)
        .param("client", clientId == null ? null : clientId.toString())
        .query(UUID.class).single();
  }

  /** Deletes a comment. Its replies go with it. */
  public void delete(UUID id) {
    jdbc.sql("delete from comments where id = :id").param("id", id).update();
  }
}
