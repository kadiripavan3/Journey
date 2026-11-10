package app.journey.api.comment;

import app.journey.api.common.Keyset;
import app.journey.api.common.Page;
import app.journey.api.common.Rules;
import app.journey.api.common.Sql;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Reads and writes comments. The database keeps each entry's comment count. */
@Repository
public class CommentStore {

    public record CommentRow(
            UUID id,
            UUID entryId,
            UUID parentId,
            UUID authorId,
            String authorUsername,
            String authorName,
            String authorAvatarKey,
            String body,
            Instant createdAt,
            boolean held,
            UUID threadId,
            Instant threadAt) {}

    private static final String SELECT = """
      select c.id, c.entry_id, c.parent_id, c.author_id, p.username, p.display_name, a.storage_key as avatar_key, c.body, c.created_at, c.held,
             c.thread_id, c.thread_at
      from comments c
      join profiles p on p.id = c.author_id
      """ + Rules.chosenPhoto("a", "p.avatar_media_id");

    private static final RowMapper<CommentRow> ROW = (rs, n) -> new CommentRow(
            rs.getObject("id", UUID.class),
            rs.getObject("entry_id", UUID.class),
            rs.getObject("parent_id", UUID.class),
            rs.getObject("author_id", UUID.class),
            rs.getString("username"),
            rs.getString("display_name"),
            rs.getString("avatar_key"),
            rs.getString("body"),
            Sql.instant(rs, "created_at"),
            rs.getBoolean("held"),
            rs.getObject("thread_id", UUID.class),
            Sql.instant(rs, "thread_at"));

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
                .param("author", authorId)
                .param("client", clientId)
                .query(UUID.class)
                .optional();
    }

    /** Threads in the order they were started, and inside a thread the comment first and then its replies as they came. */
    private static final String THREAD_ORDER = "c.thread_at, c.thread_id, c.created_at, c.id";

    /**
     * An entry's comments: threads in the order they were started, each comment followed by its replies, so a
     * page never shows a reply before the comment it answers. Comments by people blocked either way are left
     * out, except under the viewer's own entry or in their own journey (see {@link Rules#commentBy}).
     *
     * <p>Every comment carries its thread and when the thread started (V34), and an index holds an entry's
     * comments in exactly this order. A page starts after the last comment of the page before.
     */
    public Page<CommentRow> page(UUID entryId, UUID viewer, Keyset page) {
        String after = page.first() ? "" : " and (" + THREAD_ORDER + ") > (:threadAt, :thread, :createdAt, :after)";
        var query = jdbc.sql(SELECT + " where c.entry_id = :entry" + after + " and " + Rules.commentBy("c", ":viewer")
                        + " and " + Rules.shownComment("c", ":viewer") + " order by " + THREAD_ORDER + " limit :limit")
                .param("entry", entryId)
                .param("viewer", viewer)
                .param("limit", page.fetch());
        if (!page.first()) {
            query = query.param("threadAt", Sql.timestamp(page.instant(0)))
                    .param("thread", page.uuid(1))
                    .param("createdAt", Sql.timestamp(page.instant(2)))
                    .param("after", page.uuid(3));
        }
        return page.page(
                query.query(ROW).list(),
                row -> Keyset.cursor(row.threadAt(), row.threadId(), row.createdAt(), row.id()));
    }

    /** Adds a comment. Empty when the same one (clientId) is being saved by another request at this very moment. */
    public Optional<UUID> insert(UUID entryId, UUID authorId, UUID parentId, String body, UUID clientId, boolean held) {
        return jdbc.sql("""
            insert into comments (entry_id, author_id, parent_id, body, client_id, held)
            values (:entry, :author, :parent, :body, cast(:client as uuid), :held)
            on conflict (author_id, client_id) where client_id is not null do nothing
            returning id
            """)
                .param("entry", entryId)
                .param("author", authorId)
                .param("parent", parentId)
                .param("body", body)
                .param("client", clientId == null ? null : clientId.toString())
                .param("held", held)
                .query(UUID.class)
                .optional();
    }

    /** Deletes a comment. Its replies go with it. */
    public void delete(UUID id) {
        jdbc.sql("delete from comments where id = :id").param("id", id).update();
    }
}
