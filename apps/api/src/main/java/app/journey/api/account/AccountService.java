package app.journey.api.account;

import app.journey.api.common.ApiProblem;
import app.journey.api.common.Sql;
import app.journey.api.media.MediaService;
import app.journey.api.media.MediaStorage;
import app.journey.api.people.PeopleService;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** A person's own settings, the people they block, what they report, and deleting their account. */
@Service
public class AccountService {

  private static final Set<String> VISIBILITIES = Set.of("public", "unlisted", "private");
  private static final Set<String> TARGETS = Set.of("journey", "entry", "comment", "profile");
  private static final Set<String> REASONS = Set.of("spam", "harassment", "nudity", "violence", "impersonation", "other");

  public record SettingsResponse(
      @Schema(description = "New entries in journeys you follow, grouped per journey") boolean notifyNewEntries,
      @Schema(description = "Journeys you follow being completed") boolean notifyCompleted,
      boolean notifyComments, boolean notifyFollowers,
      @Schema(description = "Likes, in one batch") boolean notifyLikes,
      boolean weeklyDigest,
      @Schema(description = "Also send the weekly digest by email") boolean digestEmail,
      @Schema(description = "Gentle reminders to add an entry, at most one a day") boolean reminders,
      @Schema(description = "What new journeys start as: public, unlisted or private") String defaultVisibility) {}

  public record BlockedPersonResponse(UUID id, String username, String displayName, @Schema(nullable = true) String avatarUrl, Instant blockedAt) {}

  public record ReportResponse(UUID id) {}

  private static final SettingsResponse DEFAULTS = new SettingsResponse(true, true, true, true, true, true, false, true, "public");

  private final JdbcClient jdbc;
  private final PeopleService people;
  private final MediaService media;
  private final MediaStorage storage;
  private final List<SignInAccounts> signIns;

  AccountService(JdbcClient jdbc, PeopleService people, MediaService media, MediaStorage storage, List<SignInAccounts> signIns) {
    this.jdbc = jdbc;
    this.people = people;
    this.media = media;
    this.storage = storage;
    this.signIns = signIns;
  }

  public SettingsResponse settings(UUID me) {
    return jdbc.sql("select * from settings where user_id = :me").param("me", me)
        .query((rs, n) -> new SettingsResponse(
            rs.getBoolean("notify_new_entries"), rs.getBoolean("notify_completed"), rs.getBoolean("notify_comments"), rs.getBoolean("notify_followers"),
            rs.getBoolean("notify_likes"), rs.getBoolean("weekly_digest"), rs.getBoolean("digest_email"), rs.getBoolean("reminders"),
            rs.getString("default_visibility")))
        .optional().orElse(DEFAULTS);
  }

  @Transactional
  public SettingsResponse save(UUID me, SettingsResponse s) {
    if (s.defaultVisibility() == null || !VISIBILITIES.contains(s.defaultVisibility())) {
      throw ApiProblem.badRequest("invalid_visibility", "Choose Public, Unlisted or Private.");
    }
    jdbc.sql(
            """
            insert into settings (user_id, notify_new_entries, notify_completed, notify_comments, notify_followers, notify_likes, weekly_digest,
              digest_email, reminders, default_visibility)
            values (:me, :entries, :completed, :comments, :followers, :likes, :digest, :digestEmail, :reminders, :visibility)
            on conflict (user_id) do update set
              notify_new_entries = excluded.notify_new_entries, notify_completed = excluded.notify_completed, notify_comments = excluded.notify_comments,
              notify_followers = excluded.notify_followers, notify_likes = excluded.notify_likes, weekly_digest = excluded.weekly_digest,
              digest_email = excluded.digest_email, reminders = excluded.reminders, default_visibility = excluded.default_visibility, updated_at = now()
            """)
        .param("me", me).param("entries", s.notifyNewEntries()).param("completed", s.notifyCompleted()).param("comments", s.notifyComments())
        .param("followers", s.notifyFollowers()).param("likes", s.notifyLikes()).param("digest", s.weeklyDigest())
        .param("digestEmail", s.digestEmail()).param("reminders", s.reminders()).param("visibility", s.defaultVisibility())
        .update();
    return settings(me);
  }

  public List<BlockedPersonResponse> blocked(UUID me) {
    return jdbc.sql(
            """
            select p.id, p.username, p.display_name, a.storage_key as avatar_key, b.created_at
            from blocks b join profiles p on p.id = b.blocked_id left join media a on a.id = p.avatar_media_id
            where b.blocker_id = :me order by b.created_at desc
            """)
        .param("me", me)
        .query((rs, n) -> new BlockedPersonResponse(
            rs.getObject("id", UUID.class), rs.getString("username"), rs.getString("display_name"), media.urlFor(rs.getString("avatar_key")),
            Sql.instant(rs, "created_at")))
        .list();
  }

  /** Blocks someone and undoes every follow between the two people, in both directions. They aren't told. */
  @Transactional
  public void block(UUID me, String username) {
    UUID them = people.idOf(username, me);
    if (them.equals(me)) {
      throw ApiProblem.badRequest("thats_you", "You can't block yourself.");
    }
    jdbc.sql("insert into blocks (blocker_id, blocked_id) values (:me, :them) on conflict do nothing").param("me", me).param("them", them).update();
    jdbc.sql("delete from profile_follows where (follower_id = :me and followee_id = :them) or (follower_id = :them and followee_id = :me)")
        .param("me", me).param("them", them).update();
    jdbc.sql(
            """
            delete from journey_members m using journeys j
            where j.id = m.journey_id and ((m.user_id = :them and j.owner_id = :me) or (m.user_id = :me and j.owner_id = :them))
            """)
        .param("me", me).param("them", them).update();
    List<UUID> unfollowed = jdbc.sql(
            """
            delete from journey_follows f using journeys j
            where j.id = f.journey_id and ((f.user_id = :me and j.owner_id = :them) or (f.user_id = :them and j.owner_id = :me))
            returning f.journey_id
            """)
        .param("me", me).param("them", them).query(UUID.class).list();
    if (!unfollowed.isEmpty()) {
      jdbc.sql("update journeys j set follower_count = (select count(*) from journey_follows f where f.journey_id = j.id) where j.id in (:ids)")
          .param("ids", unfollowed).update();
    }
  }

  @Transactional
  public void unblock(UUID me, String username) {
    jdbc.sql("delete from blocks where blocker_id = :me and blocked_id = (select id from profiles where username = :username)")
        .param("me", me).param("username", username.toLowerCase()).update();
  }

  /** Reports are private and each one is reviewed by a person. Nothing is removed automatically. */
  @Transactional
  public ReportResponse report(UUID me, String targetType, UUID targetId, String reason, String note) {
    if (targetType == null || !TARGETS.contains(targetType)) {
      throw ApiProblem.badRequest("invalid_report", "Choose what you're reporting.");
    }
    if (reason == null || !REASONS.contains(reason)) {
      throw ApiProblem.badRequest("invalid_reason", "Choose a reason.");
    }
    UUID id = jdbc.sql("insert into reports (reporter_id, target_type, target_id, reason, note) values (:me, :type, :target, :reason, :note) returning id")
        .param("me", me).param("type", targetType).param("target", targetId).param("reason", reason).param("note", note == null ? "" : note.trim())
        .query(UUID.class).single();
    return new ReportResponse(id);
  }

  /**
   * Deletes the account for good: the profile, journeys, entries, comments, likes and follows (the database
   * removes what hangs off the profile), the person's photos and clips, and their sign-in.
   */
  @Transactional
  public void delete(UUID me) {
    List<String> files = jdbc.sql("delete from media where owner_id = :me returning storage_key").param("me", me).query(String.class).list();
    jdbc.sql("update journeys j set follower_count = greatest(j.follower_count - 1, 0) where j.id in (select journey_id from journey_follows where user_id = :me)")
        .param("me", me).update();
    jdbc.sql("delete from profiles where id = :me").param("me", me).update();
    signIns.forEach(signIn -> signIn.remove(me));
    files.forEach(storage::delete);
  }
}
