package app.journey.api.account;

import app.journey.api.account.AccountService.SettingsResponse;
import app.journey.api.common.Page;
import app.journey.api.common.PageRequest;
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
                        Visibility.read(rs.getString("default_visibility"))))
                .optional();
    }

    public void saveSettings(UUID userId, SettingsResponse s) {
        jdbc.sql("""
            insert into settings (user_id, notify_new_entries, notify_completed, notify_comments, notify_followers, notify_likes, weekly_digest,
              digest_email, reminders, default_visibility)
            values (:me, :entries, :completed, :comments, :followers, :likes, :digest, :digestEmail, :reminders, :visibility)
            on conflict (user_id) do update set
              notify_new_entries = excluded.notify_new_entries, notify_completed = excluded.notify_completed, notify_comments = excluded.notify_comments,
              notify_followers = excluded.notify_followers, notify_likes = excluded.notify_likes, weekly_digest = excluded.weekly_digest,
              digest_email = excluded.digest_email, reminders = excluded.reminders, default_visibility = excluded.default_visibility, updated_at = now()
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
                .update();
    }

    /** The people someone has blocked, most recent first. */
    public Page<BlockedRow> blocked(UUID userId, PageRequest page) {
        List<BlockedRow> rows = jdbc.sql("""
            select p.id, p.username, p.display_name, a.storage_key as avatar_key, b.created_at
            from blocks b join profiles p on p.id = b.blocked_id left join media a on a.id = p.avatar_media_id
            where b.blocker_id = :me order by b.created_at desc, p.id limit :limit offset :offset
            """)
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

    public void unblock(UUID me, String username) {
        jdbc.sql(
                        "delete from blocks where blocker_id = :me and blocked_id = (select id from profiles where username = :username)")
                .param("me", me)
                .param("username", username)
                .update();
    }

    public UUID report(UUID reporter, ReportTarget target, UUID targetId, ReportReason reason, String note) {
        return jdbc.sql(
                        "insert into reports (reporter_id, target_type, target_id, reason, note) values (:me, :type, :target, :reason, :note) returning id")
                .param("me", reporter)
                .param("type", target.code())
                .param("target", targetId)
                .param("reason", reason.code())
                .param("note", note)
                .query(UUID.class)
                .single();
    }

    /** Removes the profile. The database removes everything that hangs off it and corrects every count. */
    public void deleteProfile(UUID userId) {
        jdbc.sql("delete from profiles where id = :me").param("me", userId).update();
    }
}
