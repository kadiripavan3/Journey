package app.journey.api.notify;

import app.journey.api.common.Rules;
import app.journey.api.common.Sql;
import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * The outbox of pushes: one row per message for one person. Rows are written here when something happens
 * (in the same transaction as the thing itself), and read here when they are due to be sent.
 *
 * <p>Every "tell these people" statement leaves out people who switched that kind of notification off and
 * people with no device to push to. Whether the person may still see what the message is about is checked
 * again when it is sent, because a lot can change in the minutes or the hour in between.
 */
@Repository
public class OutboxStore {

    /** A message that is due, with the names needed to word it and whether it may still be sent. */
    public record Due(
            UUID id,
            UUID userId,
            NotificationKind kind,
            int count,
            String text,
            UUID journeyId,
            UUID entryId,
            Instant createdAt,
            String actorName,
            String actorUsername,
            String journeyTitle,
            String entryTitle,
            String entryLabel,
            boolean deliverable) {}

    private static final String HAS_DEVICE = "exists (select 1 from devices d where d.user_id = %s)";

    /** Rows that share a person and a batch key, and haven't been sent, are one message that counts up. */
    private static final String MERGE = """
            on conflict (user_id, batch_key) where status = 'pending' and batch_key is not null
            do update set count = notifications.count + 1, entry_id = excluded.entry_id, actor_id = excluded.actor_id
            """;

    private final JdbcClient jdbc;

    OutboxStore(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** A new entry: everyone who follows or writes in the journey, except its author. A burst becomes one message. */
    public void newEntry(UUID entryId, UUID journeyId, UUID authorId, Duration wait) {
        jdbc.sql("""
            insert into notifications (user_id, kind, batch_key, actor_id, journey_id, entry_id, send_after)
            select f.user_id, 'new_entries', 'entries:' || :journey, :author, :journey, :entry, now() + make_interval(secs => :wait)
            from journey_follows f left join settings s on s.user_id = f.user_id
            where f.journey_id = :journey and f.user_id <> :author and coalesce(s.notify_new_entries, true) and %s
            """.formatted(HAS_DEVICE.formatted("f.user_id")) + MERGE)
                .param("journey", journeyId)
                .param("author", authorId)
                .param("entry", entryId)
                .param("wait", wait.toSeconds())
                .update();
    }

    /** A journey was completed: everyone who follows or writes in it, except its owner. */
    public void journeyCompleted(UUID journeyId, UUID ownerId) {
        jdbc.sql("""
            insert into notifications (user_id, kind, actor_id, journey_id)
            select f.user_id, 'journey_completed', :owner, :journey
            from journey_follows f left join settings s on s.user_id = f.user_id
            where f.journey_id = :journey and f.user_id <> :owner and coalesce(s.notify_completed, true) and %s
            """.formatted(HAS_DEVICE.formatted("f.user_id")))
                .param("journey", journeyId)
                .param("owner", ownerId)
                .update();
    }

    /** A like: the entry's author. Likes on one entry within the wait are one message. */
    public void liked(UUID entryId, UUID likerId, Duration wait) {
        jdbc.sql("""
            insert into notifications (user_id, kind, batch_key, actor_id, journey_id, entry_id, send_after)
            select e.author_id, 'likes', 'likes:' || e.id, :liker, e.journey_id, e.id, now() + make_interval(secs => :wait)
            from entries e left join settings s on s.user_id = e.author_id
            where e.id = :entry and e.author_id <> :liker and coalesce(s.notify_likes, true) and %s
            """.formatted(HAS_DEVICE.formatted("e.author_id")) + MERGE)
                .param("entry", entryId)
                .param("liker", likerId)
                .param("wait", wait.toSeconds())
                .update();
    }

    /**
     * A comment: the person whose comment it answers hears "replied", and the entry's author and the journey's
     * owner hear "commented" (each person once, and never the one who wrote it).
     */
    public void commented(UUID commentId) {
        jdbc.sql("""
            insert into notifications (user_id, kind, actor_id, journey_id, entry_id, text)
            select pc.author_id, 'reply', c.author_id, e.journey_id, e.id, left(c.body, 140)
            from comments c join comments pc on pc.id = c.parent_id join entries e on e.id = c.entry_id
            left join settings s on s.user_id = pc.author_id
            where c.id = :comment and pc.author_id <> c.author_id and coalesce(s.notify_comments, true) and %s
            """.formatted(HAS_DEVICE.formatted("pc.author_id")))
                .param("comment", commentId)
                .update();
        jdbc.sql("""
            insert into notifications (user_id, kind, actor_id, journey_id, entry_id, text)
            select r.user_id, 'comment', c.author_id, e.journey_id, e.id, left(c.body, 140)
            from comments c join entries e on e.id = c.entry_id join journeys j on j.id = e.journey_id
            left join comments pc on pc.id = c.parent_id
            cross join lateral (select e.author_id as user_id union select j.owner_id) r
            left join settings s on s.user_id = r.user_id
            where c.id = :comment and r.user_id <> c.author_id and (pc.author_id is null or pc.author_id <> r.user_id)
              and coalesce(s.notify_comments, true) and %s
            """.formatted(HAS_DEVICE.formatted("r.user_id")))
                .param("comment", commentId)
                .update();
    }

    /** Someone started following a journey: its owner. */
    public void journeyFollowed(UUID journeyId, UUID followerId) {
        jdbc.sql("""
            insert into notifications (user_id, kind, actor_id, journey_id)
            select j.owner_id, 'journey_follow', :follower, j.id
            from journeys j left join settings s on s.user_id = j.owner_id
            where j.id = :journey and j.owner_id <> :follower and coalesce(s.notify_followers, true) and %s
            """.formatted(HAS_DEVICE.formatted("j.owner_id")))
                .param("journey", journeyId)
                .param("follower", followerId)
                .update();
    }

    /** Someone started following a person. */
    public void personFollowed(UUID followerId, UUID followeeId) {
        jdbc.sql("""
            insert into notifications (user_id, kind, actor_id)
            select p.id, 'profile_follow', :follower
            from profiles p left join settings s on s.user_id = p.id
            where p.id = :followee and coalesce(s.notify_followers, true) and %s
            """.formatted(HAS_DEVICE.formatted("p.id")))
                .param("follower", followerId)
                .param("followee", followeeId)
                .update();
    }

    /** A friend was invited to a shared journey: the friend hears who asked. */
    public void invited(UUID journeyId, UUID friendId) {
        jdbc.sql("""
            insert into notifications (user_id, kind, actor_id, journey_id)
            select m.user_id, 'invitation', m.invited_by, m.journey_id
            from journey_members m left join settings s on s.user_id = m.user_id
            where m.journey_id = :journey and m.user_id = :friend and coalesce(s.notify_followers, true) and %s
            """.formatted(HAS_DEVICE.formatted("m.user_id")))
                .param("journey", journeyId)
                .param("friend", friendId)
                .update();
    }

    /** A friend said yes: the journey's owner. */
    public void friendJoined(UUID journeyId, UUID friendId) {
        jdbc.sql("""
            insert into notifications (user_id, kind, actor_id, journey_id)
            select j.owner_id, 'friend_joined', :friend, j.id
            from journeys j left join settings s on s.user_id = j.owner_id
            where j.id = :journey and j.owner_id <> :friend and coalesce(s.notify_followers, true) and %s
            """.formatted(HAS_DEVICE.formatted("j.owner_id")))
                .param("journey", journeyId)
                .param("friend", friendId)
                .update();
    }

    /** A message for one person about one of their journeys, or about nothing in particular (the weekly digest). */
    public void tell(UUID userId, NotificationKind kind, UUID journeyId, String text, String batchKey) {
        jdbc.sql("""
            insert into notifications (user_id, kind, batch_key, journey_id, text)
            select :user, :kind, cast(:batch as text), cast(:journey as uuid), cast(:text as text)
            where %s
            on conflict (user_id, batch_key) where status = 'pending' and batch_key is not null do nothing
            """.formatted(HAS_DEVICE.formatted(":user")))
                .param("user", userId)
                .param("kind", kind.code())
                .param("batch", batchKey)
                .param("journey", journeyId == null ? null : journeyId.toString())
                .param("text", text)
                .update();
    }

    /** True when this person was reminded of something in the last 20 hours: at most one reminder a day. */
    public boolean remindedLately(UUID userId) {
        return jdbc.sql(
                        "select exists (select 1 from notifications where user_id = :user and kind = 'reminder' and created_at > now() - interval '20 hours')")
                .param("user", userId)
                .query(Boolean.class)
                .single();
    }

    /**
     * The messages that are due, locked for this sender until the end of the (short) transaction it is called
     * in: another copy of the API skips them and takes the next ones. Each says whether it may still be sent: the person hasn't switched that kind off since, neither has
     * blocked the other, and they may still see the journey and the entry it is about.
     */
    public List<Due> lockDue(int limit) {
        return jdbc.sql("""
            select n.id, n.user_id, n.kind, n.count, n.text, n.journey_id, n.entry_id, n.created_at,
                   a.display_name as actor_name, a.username as actor_username, j.title as journey_title,
                   coalesce(nullif(e.title, ''), left(e.body, 60)) as entry_title,
                   case when e.id is null then null
                        when j.label_style = 'day' then 'Day ' || (e.happened_on - j.start_date + 1)
                        else 'Part ' || (select count(*) from entries x where x.journey_id = e.journey_id
                               and (x.happened_at, x.created_at, x.id) <= (e.happened_at, e.created_at, e.id)) end as entry_label,
                   (case n.kind
                      when 'new_entries' then coalesce(s.notify_new_entries, true)
                      when 'journey_completed' then coalesce(s.notify_completed, true)
                      when 'likes' then coalesce(s.notify_likes, true)
                      when 'comment' then coalesce(s.notify_comments, true)
                      when 'reply' then coalesce(s.notify_comments, true)
                      when 'reminder' then coalesce(s.reminders, true)
                      when 'weekly_digest' then coalesce(s.weekly_digest, true)
                      when 'journey_paused' then true
                      else coalesce(s.notify_followers, true) end
                    and (n.actor_id is null or %s)
                    and (n.journey_id is null or n.kind = 'invitation' or %s)
                    and (n.entry_id is null or %s)) as deliverable
            from notifications n
            left join profiles a on a.id = n.actor_id
            left join journeys j on j.id = n.journey_id
            left join entries e on e.id = n.entry_id
            left join settings s on s.user_id = n.user_id
            where n.status = 'pending' and n.send_after <= now()
            order by n.send_after, n.id
            limit :limit
            for update of n skip locked
            """.formatted(
                                Rules.notBlocked("n.actor_id", "n.user_id"),
                                Rules.visibleJourney("j", "n.user_id"),
                                Rules.entryBy("e", "n.user_id")))
                .param("limit", limit)
                .query((rs, n) -> new Due(
                        rs.getObject("id", UUID.class),
                        rs.getObject("user_id", UUID.class),
                        NotificationKind.read(rs.getString("kind")),
                        rs.getInt("count"),
                        rs.getString("text"),
                        rs.getObject("journey_id", UUID.class),
                        rs.getObject("entry_id", UUID.class),
                        Sql.instant(rs, "created_at"),
                        rs.getString("actor_name"),
                        rs.getString("actor_username"),
                        rs.getString("journey_title"),
                        rs.getString("entry_title"),
                        rs.getString("entry_label"),
                        rs.getBoolean("deliverable")))
                .list();
    }

    /** The titles of the newest entries others added to a journey since a moment, oldest first, for "added 3 entries: A, B and C". */
    public List<String> entryTitlesSince(UUID journeyId, UUID readerId, Instant since, int limit) {
        return jdbc.sql("""
            select title from (
              select coalesce(nullif(e.title, ''), left(e.body, 40)) as title, e.created_at
              from entries e
              where e.journey_id = :journey and e.author_id <> :reader and e.created_at >= :since
              order by e.created_at desc limit :limit) newest
            order by created_at
            """)
                .param("journey", journeyId)
                .param("reader", readerId)
                .param("since", Sql.timestamp(since))
                .param("limit", limit)
                .query(String.class)
                .list();
    }

    /** Taken by this sender: the push service is about to be called for these. */
    public void markSending(Collection<UUID> ids) {
        mark(ids, "status = 'sending', claimed_at = now()");
    }

    public void markSent(Collection<UUID> ids) {
        mark(ids, "status = 'sent', sent_at = now()");
    }

    /** Not sent and never will be: switched off, blocked, no longer visible, or no device left. */
    public void markSkipped(Collection<UUID> ids) {
        mark(ids, "status = 'skipped'");
    }

    /**
     * The push service couldn't be reached: try again later, a little later each time, and give up after a few
     * tries. A message that goes back to waiting no longer counts up with new ones (its batch key is dropped):
     * a newer message for the same thing may have started in the meantime.
     */
    public void retryLater(Collection<UUID> ids, int maxAttempts) {
        if (!ids.isEmpty()) {
            jdbc.sql("""
                update notifications set attempts = attempts + 1, batch_key = null, claimed_at = null,
                  status = case when attempts + 1 >= :max then 'skipped' else 'pending' end,
                  send_after = now() + make_interval(mins => 5 * (attempts + 1))
                where id in (:ids)
                """).param("ids", ids).param("max", maxAttempts).update();
        }
    }

    /**
     * Messages that were taken long ago and never marked as sent: the API stopped in between. They are tried
     * again, like any other message that couldn't be sent. Returns how many there were.
     */
    public int putBackStuck(Duration after, int maxAttempts) {
        List<UUID> stuck = jdbc.sql(
                        "select id from notifications where status = 'sending' and claimed_at < now() - make_interval(secs => :after)")
                .param("after", after.toSeconds())
                .query(UUID.class)
                .list();
        retryLater(stuck, maxAttempts);
        return stuck.size();
    }

    /** Messages that were sent or skipped long ago are of no use to anyone. Returns how many were removed. */
    public int forgetOlderThan(int days) {
        return jdbc.sql(
                        "delete from notifications where status <> 'pending' and created_at < now() - make_interval(days => :days)")
                .param("days", days)
                .update();
    }

    private void mark(Collection<UUID> ids, String change) {
        if (!ids.isEmpty()) {
            jdbc.sql("update notifications set " + change + " where id in (:ids)")
                    .param("ids", ids)
                    .update();
        }
    }
}
