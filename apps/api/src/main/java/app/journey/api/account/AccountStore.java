package app.journey.api.account;

import app.journey.api.account.AccountService.SettingsResponse;
import app.journey.api.common.Page;
import app.journey.api.common.PageRequest;
import app.journey.api.common.Rules;
import app.journey.api.common.Sql;
import app.journey.api.journey.Visibility;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Reads and writes a person's settings, blocks and reports, and removes their profile. */
@Repository
public class AccountStore {

    public record BlockedRow(UUID id, String username, String displayName, String avatarKey, Instant blockedAt) {}

    private final JdbcClient jdbc;

    AccountStore(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** The person's settings, or empty when they have never changed any. */
    public Optional<SettingsResponse> settings(UUID userId) {
        return jdbc.sql("select * from settings where user_id = :me")
                .param("me", userId)
                .query((rs, n) -> new SettingsResponse(
                        rs.getBoolean("notify_new_entries"),
                        rs.getBoolean("notify_completed"),
                        rs.getBoolean("notify_comments"),
                        rs.getBoolean("notify_followers"),
                        rs.getBoolean("notify_likes"),
                        rs.getBoolean("weekly_digest"),
                        rs.getBoolean("digest_email"),
                        rs.getBoolean("reminders"),
                        Visibility.read(rs.getString("default_visibility")),
                        rs.getInt("reminder_hour")))
                .optional();
    }

    public void saveSettings(UUID userId, SettingsResponse s) {
        jdbc.sql("""
            insert into settings (user_id, notify_new_entries, notify_completed, notify_comments, notify_followers, notify_likes, weekly_digest,
              digest_email, reminders, default_visibility, reminder_hour)
            values (:me, :entries, :completed, :comments, :followers, :likes, :digest, :digestEmail, :reminders, :visibility, :reminderHour)
            on conflict (user_id) do update set
              notify_new_entries = excluded.notify_new_entries, notify_completed = excluded.notify_completed, notify_comments = excluded.notify_comments,
              notify_followers = excluded.notify_followers, notify_likes = excluded.notify_likes, weekly_digest = excluded.weekly_digest,
              digest_email = excluded.digest_email, reminders = excluded.reminders, default_visibility = excluded.default_visibility,
              reminder_hour = excluded.reminder_hour, updated_at = now()
            """)
                .param("me", userId)
                .param("entries", s.notifyNewEntries())
                .param("completed", s.notifyCompleted())
                .param("comments", s.notifyComments())
                .param("followers", s.notifyFollowers())
                .param("likes", s.notifyLikes())
                .param("digest", s.weeklyDigest())
                .param("digestEmail", s.digestEmail())
                .param("reminders", s.reminders())
                .param("visibility", s.defaultVisibility().code())
                .param("reminderHour", s.reminderHour() == null ? 19 : s.reminderHour())
                .update();
    }

    /** The people someone has blocked, most recent first. */
    public Page<BlockedRow> blocked(UUID userId, PageRequest page) {
        List<BlockedRow> rows = jdbc.sql("""
            select p.id, p.username, p.display_name, a.storage_key as avatar_key, b.created_at
            from blocks b join profiles p on p.id = b.blocked_id %s
            where b.blocker_id = :me order by b.created_at desc, p.id limit :limit offset :offset
            """.formatted(Rules.chosenPhoto("a", "p.avatar_media_id")))
                .param("me", userId)
                .param("limit", page.fetch())
                .param("offset", page.offset())
                .query((rs, n) -> new BlockedRow(
                        rs.getObject("id", UUID.class),
                        rs.getString("username"),
                        rs.getString("display_name"),
                        rs.getString("avatar_key"),
                        Sql.instant(rs, "created_at")))
                .list();
        return Page.of(rows, page);
    }

    /**
     * Records the block and undoes what connected the two people, in both directions: following each other,
     * following each other's journeys, and writing in each other's journeys.
     */
    public void block(UUID me, UUID them) {
        jdbc.sql("insert into blocks (blocker_id, blocked_id) values (:me, :them) on conflict do nothing")
                .param("me", me)
                .param("them", them)
                .update();
        jdbc.sql(
                        "delete from profile_follows where (follower_id = :me and followee_id = :them) or (follower_id = :them and followee_id = :me)")
                .param("me", me)
                .param("them", them)
                .update();
        jdbc.sql("""
            delete from journey_members m using journeys j
            where j.id = m.journey_id and ((m.user_id = :them and j.owner_id = :me) or (m.user_id = :me and j.owner_id = :them))
            """).param("me", me).param("them", them).update();
        jdbc.sql("""
            delete from journey_follows f using journeys j
            where j.id = f.journey_id and ((f.user_id = :me and j.owner_id = :them) or (f.user_id = :them and j.owner_id = :me))
            """).param("me", me).param("them", them).update();
    }

    /**
     * Removes what the blocked person wrote under the blocker's journeys: their comments there, and with each
     * the replies under it. (The database corrects the comment counts.)
     */
    public void removeCommentsOn(UUID owner, UUID commenter) {
        jdbc.sql("""
            delete from comments c using entries e, journeys j
            where e.id = c.entry_id and j.id = e.journey_id and j.owner_id = :owner and c.author_id = :commenter
            """).param("owner", owner).param("commenter", commenter).update();
    }

    public void unblock(UUID me, String username) {
        jdbc.sql(
                        "delete from blocks where blocker_id = :me and blocked_id = (select id from profiles where username = :username)")
                .param("me", me)
                .param("username", username)
                .update();
    }

    /** A person's id by their username, whoever has blocked whom, or empty when nobody has that name. */
    public Optional<UUID> idOfUsername(String username) {
        return jdbc.sql("select id from profiles where username = :username")
                .param("username", username)
                .query(UUID.class)
                .optional();
    }

    /**
     * True when the thing is there and the reporter may see it. A journey, an entry or a comment must be in a
     * journey the reporter can open; a person can always be reported, also one who has blocked the reporter.
     */
    public boolean canReport(UUID reporter, ReportTarget target, UUID targetId) {
        String visible = Rules.visibleJourney("j", ":me");
        String sql = switch (target) {
            case JOURNEY -> "select exists (select 1 from journeys j where j.id = :id and " + visible + ")";
            case ENTRY ->
                "select exists (select 1 from entries e join journeys j on j.id = e.journey_id where e.id = :id and "
                        + visible + ")";
            case COMMENT ->
                "select exists (select 1 from comments c join entries e on e.id = c.entry_id"
                        + " join journeys j on j.id = e.journey_id where c.id = :id and " + visible + ")";
            case PROFILE -> "select exists (select 1 from profiles p where p.id = :id and p.id <> :me)";
        };
        return jdbc.sql(sql)
                .param("id", targetId)
                .param("me", reporter)
                .query(Boolean.class)
                .single();
    }

    public int reportsInTheLastDay(UUID reporter) {
        return jdbc.sql(
                        "select count(*) from reports where reporter_id = :me and created_at > now() - interval '24 hours'")
                .param("me", reporter)
                .query(Integer.class)
                .single();
    }

    /**
     * Files a report. Someone who already has an open report about the same thing gets that one back: saying
     * it twice (or tapping twice) doesn't make two.
     */
    public UUID report(UUID reporter, ReportTarget target, UUID targetId, ReportReason reason, String note) {
        return jdbc.sql("""
            insert into reports (reporter_id, target_type, target_id, reason, note) values (:me, :type, :target, :reason, :note)
            on conflict (reporter_id, target_type, target_id) where status = 'open' do nothing
            returning id
            """)
                .param("me", reporter)
                .param("type", target.code())
                .param("target", targetId)
                .param("reason", reason.code())
                .param("note", note)
                .query(UUID.class)
                .optional()
                .orElseGet(() -> jdbc.sql(
                                "select id from reports where reporter_id = :me and target_type = :type and target_id = :target and status = 'open'")
                        .param("me", reporter)
                        .param("type", target.code())
                        .param("target", targetId)
                        .query(UUID.class)
                        .single());
    }

    /**
     * Deleting an account takes everything the person made with it, which can be a lot: the transaction that
     * does it runs this first.
     */
    public void roomToDeleteAnAccount() {
        jdbc.sql(Sql.ROOM_FOR_A_JOB).update();
    }

    /** Removes the profile. The database removes everything that hangs off it and corrects every count. */
    public void deleteProfile(UUID userId) {
        jdbc.sql("delete from profiles where id = :me").param("me", userId).update();
    }

    // ---- accounts that were deleted ----

    /** Writes down that this account is gone, in the transaction that deletes it. Its sign-in is removed next. */
    public void rememberDeleted(UUID userId) {
        jdbc.sql("insert into deleted_accounts (id) values (:id) on conflict do nothing")
                .param("id", userId)
                .update();
    }

    public boolean wasDeleted(UUID userId) {
        return jdbc.sql("select exists (select 1 from deleted_accounts where id = :id)")
                .param("id", userId)
                .query(Boolean.class)
                .single();
    }

    /**
     * Accounts whose sign-in is still to be removed. Each is put off as it is taken, a little longer each
     * time, so a sign-in service that is down is asked again later and not by two copies of the API at once.
     */
    public List<UUID> takeSignInsToRemove(int limit) {
        return jdbc.sql("""
            update deleted_accounts set attempts = attempts + 1,
              next_try_at = now() + make_interval(mins => least(2 * power(2, attempts)::int, 720))
            where id in (select id from deleted_accounts where sign_in_removed_at is null and next_try_at <= now()
                         order by next_try_at limit :limit for update skip locked)
            returning id
            """).param("limit", limit).query(UUID.class).list();
    }

    public void signInRemoved(UUID userId) {
        jdbc.sql("update deleted_accounts set sign_in_removed_at = now() where id = :id")
                .param("id", userId)
                .update();
    }

    /** Long after the last token for a deleted account stopped working, the note about it is of no use. */
    public int forgetDeletedBefore(int days) {
        return jdbc.sql(
                        "delete from deleted_accounts where sign_in_removed_at is not null and deleted_at < now() - make_interval(days => :days)")
                .param("days", days)
                .update();
    }

    // ---- people a reviewer removed ----

    public void ban(String emailHash, String reviewer) {
        jdbc.sql("insert into banned_sign_ins (email_hash, banned_by) values (:hash, :by) on conflict do nothing")
                .param("hash", emailHash)
                .param("by", reviewer)
                .update();
    }

    public boolean isBanned(String emailHash) {
        return jdbc.sql("select exists (select 1 from banned_sign_ins where email_hash = :hash)")
                .param("hash", emailHash)
                .query(Boolean.class)
                .single();
    }
}
