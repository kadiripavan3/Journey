package app.journey.api.moderation;

import app.journey.api.account.ReportTarget;
import app.journey.api.common.Codes;
import app.journey.api.common.Sql;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Reads and writes what waits for a reviewer (reports, held photos and comments, deletion requests) and what reviewers did. */
@Repository
public class ModerationStore {

    /** A report, with a few words about what it points at. {@code what} is null when the thing is already gone. */
    public record ReportRow(
            UUID id,
            ReportTarget targetType,
            UUID targetId,
            String reason,
            String note,
            Instant createdAt,
            String reporter,
            String what,
            String byWhom) {}

    public record HeldPhotoRow(
            UUID id, String storageKey, String reason, String owner, Instant uploadedAt, Instant askedAgainAt) {}

    public record HeldCommentRow(UUID id, String body, String author, String journeyTitle, Instant createdAt) {}

    public record DeletionRequestRow(UUID id, String email, String username, String note, Instant createdAt) {}

    public record LogRow(String reviewer, String action, String targetType, String targetId, String note, Instant at) {}

    /** A photo waiting for the automatic check. */
    public record Unscreened(UUID id, String storageKey) {}

    private final JdbcClient jdbc;

    ModerationStore(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    // ---- photos ----

    public void markScreened(UUID mediaId, boolean held, String reason) {
        jdbc.sql("update media set screened_at = now(), held = :held, held_reason = :reason where id = :id")
                .param("held", held)
                .param("reason", reason)
                .param("id", mediaId)
                .update();
    }

    public boolean isHeld(UUID mediaId) {
        return jdbc.sql("select held from media where id = :id")
                .param("id", mediaId)
                .query(Boolean.class)
                .optional()
                .orElse(false);
    }

    /** Ready photos the check hasn't looked at yet (it was unreachable, or they are older than the check), oldest first. */
    public List<Unscreened> unscreened(int limit) {
        return jdbc.sql("""
            select id, storage_key from media
            where kind = 'photo' and status = 'ready' and screened_at is null order by created_at limit :limit
            """)
                .param("limit", limit)
                .query((rs, n) -> new Unscreened(rs.getObject("id", UUID.class), rs.getString("storage_key")))
                .list();
    }

    /** True when the photo is this person's and is held: they asked for a second look. */
    public boolean askAgain(UUID mediaId, UUID ownerId) {
        return jdbc.sql("update media set appeal_at = now() where id = :id and owner_id = :owner and held")
                        .param("id", mediaId)
                        .param("owner", ownerId)
                        .update()
                > 0;
    }

    public List<HeldPhotoRow> heldPhotos(int limit) {
        return jdbc.sql("""
            select m.id, m.storage_key, m.held_reason, p.username, m.created_at, m.appeal_at
            from media m left join profiles p on p.id = m.owner_id
            where m.held order by m.appeal_at nulls last, m.created_at limit :limit
            """)
                .param("limit", limit)
                .query((rs, n) -> new HeldPhotoRow(
                        rs.getObject("id", UUID.class),
                        rs.getString("storage_key"),
                        rs.getString("held_reason"),
                        rs.getString("username"),
                        Sql.instant(rs, "created_at"),
                        Sql.instant(rs, "appeal_at")))
                .list();
    }

    /** True when the photo was held and no longer is. */
    public boolean releasePhoto(UUID mediaId) {
        return jdbc.sql("update media set held = false, held_reason = null, appeal_at = null where id = :id and held")
                        .param("id", mediaId)
                        .update()
                > 0;
    }

    // ---- comments ----

    public List<HeldCommentRow> heldComments(int limit) {
        return jdbc.sql("""
            select c.id, c.body, p.username, j.title, c.created_at
            from comments c join profiles p on p.id = c.author_id join entries e on e.id = c.entry_id join journeys j on j.id = e.journey_id
            where c.held order by c.created_at limit :limit
            """)
                .param("limit", limit)
                .query((rs, n) -> new HeldCommentRow(
                        rs.getObject("id", UUID.class),
                        rs.getString("body"),
                        rs.getString("username"),
                        rs.getString("title"),
                        Sql.instant(rs, "created_at")))
                .list();
    }

    /** True when the comment was held and no longer is. (The database then counts it on its entry.) */
    public boolean releaseComment(UUID commentId) {
        return jdbc.sql("update comments set held = false where id = :id and held")
                        .param("id", commentId)
                        .update()
                > 0;
    }

    // ---- reports ----

    public List<ReportRow> openReports(int limit) {
        return openReports(null, limit);
    }

    public Optional<ReportRow> openReport(UUID id) {
        return openReports(id, 1).stream().findFirst();
    }

    private List<ReportRow> openReports(UUID only, int limit) {
        return jdbc.sql("""
            select r.id, r.target_type, r.target_id, r.reason, r.note, r.created_at, rp.username as reporter,
                   case r.target_type
                     when 'journey' then (select j.title from journeys j where j.id = r.target_id)
                     when 'entry' then (select coalesce(nullif(e.title, ''), nullif(left(e.body, 160), ''), 'An entry with photos only') from entries e where e.id = r.target_id)
                     when 'comment' then (select c.body from comments c where c.id = r.target_id)
                     when 'profile' then (select p.display_name from profiles p where p.id = r.target_id)
                   end as what,
                   case r.target_type
                     when 'journey' then (select p.username from journeys j join profiles p on p.id = j.owner_id where j.id = r.target_id)
                     when 'entry' then (select p.username from entries e join profiles p on p.id = e.author_id where e.id = r.target_id)
                     when 'comment' then (select p.username from comments c join profiles p on p.id = c.author_id where c.id = r.target_id)
                     when 'profile' then (select p.username from profiles p where p.id = r.target_id)
                   end as by_whom
            from reports r left join profiles rp on rp.id = r.reporter_id
            where r.status = 'open' and (cast(:only as uuid) is null or r.id = cast(:only as uuid))
            order by r.created_at limit :limit
            """)
                .param("only", only == null ? null : only.toString())
                .param("limit", limit)
                .query((rs, n) -> new ReportRow(
                        rs.getObject("id", UUID.class),
                        Codes.read(ReportTarget.class, rs.getString("target_type")),
                        rs.getObject("target_id", UUID.class),
                        rs.getString("reason"),
                        rs.getString("note"),
                        Sql.instant(rs, "created_at"),
                        rs.getString("reporter"),
                        rs.getString("what"),
                        rs.getString("by_whom")))
                .list();
    }

    /** Closes every open report about the same thing: once a reviewer has decided, the others are answered too. */
    public int closeReportsAbout(ReportTarget type, UUID targetId, String reviewer, String outcome) {
        return jdbc.sql("""
            update reports set status = 'reviewed', reviewed_by = :reviewer, reviewed_at = now(), outcome = :outcome
            where status = 'open' and target_type = :type and target_id = :target
            """)
                .param("reviewer", reviewer)
                .param("outcome", outcome)
                .param("type", type.code())
                .param("target", targetId)
                .update();
    }

    /** Removes what a report points at. Returns false for a person: an account is never removed from the queue. */
    public boolean removeTarget(ReportTarget type, UUID targetId) {
        String table = switch (type) {
            case JOURNEY -> "journeys";
            case ENTRY -> "entries";
            case COMMENT -> "comments";
            case PROFILE -> null;
        };
        if (table == null) {
            return false;
        }
        jdbc.sql("delete from " + table + " where id = :id")
                .param("id", targetId)
                .update();
        return true;
    }

    /** Deletes a comment (its replies go with it) and returns what it said, for the record. Empty when it was already gone. */
    public Optional<String> deleteComment(UUID commentId) {
        return jdbc.sql("delete from comments where id = :id returning body")
                .param("id", commentId)
                .query(String.class)
                .optional();
    }

    // ---- requests to delete an account, made on the web ----

    /** Records a request. Asking twice with the same address while the first is open changes nothing. */
    public void addDeletionRequest(String email, String username, String note) {
        jdbc.sql("""
            insert into deletion_requests (email, username, note)
            select :email, :username, :note
            where not exists (select 1 from deletion_requests d where d.status = 'open' and lower(d.email) = lower(:email))
            """)
                .param("email", email)
                .param("username", username)
                .param("note", note)
                .update();
    }

    public List<DeletionRequestRow> openDeletionRequests(int limit) {
        return jdbc.sql(
                        "select id, email, username, note, created_at from deletion_requests where status = 'open' order by created_at limit :limit")
                .param("limit", limit)
                .query((rs, n) -> new DeletionRequestRow(
                        rs.getObject("id", UUID.class),
                        rs.getString("email"),
                        rs.getString("username"),
                        rs.getString("note"),
                        Sql.instant(rs, "created_at")))
                .list();
    }

    public boolean markDeletionDone(UUID id, String reviewer) {
        return jdbc.sql(
                                "update deletion_requests set status = 'done', done_by = :reviewer, done_at = now() where id = :id and status = 'open'")
                        .param("reviewer", reviewer)
                        .param("id", id)
                        .update()
                > 0;
    }

    // ---- the record of what reviewers did ----

    public void log(String reviewer, String action, String targetType, String targetId, String note) {
        jdbc.sql(
                        "insert into review_log (reviewer, action, target_type, target_id, note) values (:reviewer, :action, :type, :target, :note)")
                .param("reviewer", reviewer)
                .param("action", action)
                .param("type", targetType)
                .param("target", targetId)
                .param("note", note == null ? "" : note)
                .update();
    }

    public List<LogRow> recentLog(int limit) {
        return jdbc.sql(
                        "select reviewer, action, target_type, target_id, note, created_at from review_log order by created_at desc limit :limit")
                .param("limit", limit)
                .query((rs, n) -> new LogRow(
                        rs.getString("reviewer"),
                        rs.getString("action"),
                        rs.getString("target_type"),
                        rs.getString("target_id"),
                        rs.getString("note"),
                        Sql.instant(rs, "created_at")))
                .list();
    }
}
