package app.journey.api.moderation;

import app.journey.api.account.ReportTarget;
import app.journey.api.common.Codes;
import app.journey.api.common.Sql;
import app.journey.api.media.MediaKind;
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

    /** A held photo or clip. */
    public record HeldPhotoRow(
            UUID id,
            MediaKind kind,
            String storageKey,
            String playbackId,
            String reason,
            String owner,
            Instant uploadedAt,
            Instant askedAgainAt) {}

    public record HeldCommentRow(UUID id, String body, String author, String journeyTitle, Instant createdAt) {}

    public record DeletionRequestRow(UUID id, String email, String username, String note, Instant createdAt) {}

    public record LogRow(String reviewer, String action, String targetType, String targetId, String note, Instant at) {}

    private final JdbcClient jdbc;

    ModerationStore(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    // ---- photos ----

    public List<HeldPhotoRow> heldPhotos(int limit) {
        return jdbc.sql("""
            select m.id, m.kind, m.storage_key, m.playback_id, m.held_reason, p.username, m.created_at, m.appeal_at
            from media m left join profiles p on p.id = m.owner_id
            where m.held order by m.appeal_at nulls last, m.created_at limit :limit
            """)
                .param("limit", limit)
                .query((rs, n) -> new HeldPhotoRow(
                        rs.getObject("id", UUID.class),
                        MediaKind.read(rs.getString("kind")),
                        rs.getString("storage_key"),
                        rs.getString("playback_id"),
                        rs.getString("held_reason"),
                        rs.getString("username"),
                        Sql.instant(rs, "created_at"),
                        Sql.instant(rs, "appeal_at")))
                .list();
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
    public int closeReportsAbout(ReportTarget type, UUID targetId, String reviewer, ReportOutcome outcome) {
        return jdbc.sql("""
            update reports set status = 'reviewed', reviewed_by = :reviewer, reviewed_at = now(), outcome = :outcome
            where status = 'open' and target_type = :type and target_id = :target
            """)
                .param("reviewer", reviewer)
                .param("outcome", outcome.code())
                .param("type", type.code())
                .param("target", targetId)
                .update();
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

    public Optional<DeletionRequestRow> openDeletionRequest(UUID id) {
        return jdbc.sql(
                        "select id, email, username, note, created_at from deletion_requests where status = 'open' and id = :id")
                .param("id", id)
                .query((rs, n) -> new DeletionRequestRow(
                        rs.getObject("id", UUID.class),
                        rs.getString("email"),
                        rs.getString("username"),
                        rs.getString("note"),
                        Sql.instant(rs, "created_at")))
                .optional();
    }

    /**
     * Closes a request, noting what became of it. The address and the note are not kept past this point: a
     * closed request says that something was asked and what was done, not by whom.
     */
    public boolean closeDeletionRequest(UUID id, String reviewer, DeletionOutcome outcome) {
        return jdbc.sql("""
            update deletion_requests set status = 'done', done_by = :reviewer, done_at = now(), outcome = :outcome,
              email = '', username = '', note = ''
            where id = :id and status = 'open'
            """)
                        .param("reviewer", reviewer)
                        .param("outcome", outcome.code())
                        .param("id", id)
                        .update()
                > 0;
    }

    /** What reviewers needed to do their work is not kept for ever. Returns how many rows went. */
    public int forgetOldRecords(int requestDays, int logDays) {
        int gone = jdbc.sql(
                        "delete from deletion_requests where status = 'done' and done_at < now() - make_interval(days => :days)")
                .param("days", requestDays)
                .update();
        gone += jdbc.sql("delete from review_log where created_at < now() - make_interval(days => :days)")
                .param("days", logDays)
                .update();
        gone += jdbc.sql(
                        "delete from reports where status <> 'open' and reviewed_at < now() - make_interval(days => :days)")
                .param("days", logDays)
                .update();
        return gone;
    }

    // ---- the record of what reviewers did ----

    public void log(String reviewer, ReviewAction action, String targetType, String targetId, String note) {
        jdbc.sql(
                        "insert into review_log (reviewer, action, target_type, target_id, note) values (:reviewer, :action, :type, :target, :note)")
                .param("reviewer", reviewer)
                .param("action", action.words())
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
