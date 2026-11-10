package app.journey.api.activity;

import app.journey.api.common.Rules;
import app.journey.api.common.Sql;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * The questions Activity asks. Nothing is stored for the inbox: each kind of line is read straight from what
 * happened (entries, likes, comments, follows) over the last 30 days, grouped so a busy day stays one line.
 */
@Repository
public class ActivityStore {

    /** How many lines of each kind are read; the service keeps the newest of all of them together. */
    static final int PER_KIND = 30;

    private static final String RECENT = "now() - interval '30 days'";
    private static final String VISIBLE = Rules.visibleJourney("j", ":me");

    /** One line before the people and pictures are looked up. */
    public record Line(
            String id,
            ActivityKind kind,
            Instant at,
            List<UUID> actors,
            int actorCount,
            int count,
            UUID journeyId,
            String journeyTitle,
            UUID entryId,
            String entryTitle,
            String text,
            boolean followsActor) {}

    private final JdbcClient jdbc;

    ActivityStore(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** When the person last opened Activity. Lines after it are new. */
    public Instant seenAt(UUID me) {
        return jdbc.sql("select activity_seen_at from profiles where id = :me")
                .param("me", me)
                .query((rs, n) -> Sql.instant(rs, "activity_seen_at"))
                .optional()
                .orElse(Instant.EPOCH);
    }

    public void markSeen(UUID me) {
        jdbc.sql("update profiles set activity_seen_at = now() where id = :me")
                .param("me", me)
                .update();
    }

    /** "Maya added 3 entries to Southeast Asia by motorbike": one line per journey per day, for journeys the person follows. */
    public List<Line> newEntries(UUID me) {
        return jdbc.sql("""
            select e.journey_id, j.title as journey_title, (e.created_at at time zone 'UTC')::date as day, count(*) as n, max(e.created_at) as at,
                   (array_agg(e.id order by e.created_at desc))[1] as entry_id,
                   (array_agg(e.author_id order by e.created_at desc))[1] as actor,
                   (array_agg(coalesce(nullif(e.title, ''), left(e.body, 80)) order by e.created_at desc))[1] as entry_title
            from entries e
            join journey_follows f on f.journey_id = e.journey_id and f.user_id = :me
            join journeys j on j.id = e.journey_id
            where %s and e.author_id <> :me and e.created_at > f.created_at and e.created_at > %s and %s
            group by e.journey_id, j.title, day
            order by at desc limit :limit
            """.formatted(VISIBLE, RECENT, Rules.entryBy("e", ":me")))
                .param("me", me)
                .param("limit", PER_KIND)
                .query((rs, n) -> new Line(
                        "entries:" + rs.getString("journey_id") + ":" + rs.getString("day"),
                        ActivityKind.NEW_ENTRIES,
                        Sql.instant(rs, "at"),
                        List.of(rs.getObject("actor", UUID.class)),
                        1,
                        rs.getInt("n"),
                        rs.getObject("journey_id", UUID.class),
                        rs.getString("journey_title"),
                        rs.getObject("entry_id", UUID.class),
                        rs.getString("entry_title"),
                        null,
                        false))
                .list();
    }

    /** "Jonas completed Cappadocia by balloon", for journeys the person follows. */
    public List<Line> completedJourneys(UUID me) {
        return jdbc.sql("""
            select j.id, j.title, j.owner_id, j.completed_at
            from journeys j join journey_follows f on f.journey_id = j.id and f.user_id = :me
            where %s and j.status = 'completed' and j.owner_id <> :me and j.completed_at > f.created_at and j.completed_at > %s
            order by j.completed_at desc limit :limit
            """.formatted(VISIBLE, RECENT))
                .param("me", me)
                .param("limit", PER_KIND)
                .query((rs, n) -> new Line(
                        "completed:" + rs.getString("id"),
                        ActivityKind.JOURNEY_COMPLETED,
                        Sql.instant(rs, "completed_at"),
                        List.of(rs.getObject("owner_id", UUID.class)),
                        1,
                        0,
                        rs.getObject("id", UUID.class),
                        rs.getString("title"),
                        null,
                        null,
                        null,
                        false))
                .list();
    }

    /** "Lena, Kai and 46 others liked Skógafoss in the rain": one line per entry of the person's. */
    public List<Line> likes(UUID me) {
        return jdbc.sql("""
            select l.entry_id, e.journey_id, coalesce(nullif(e.title, ''), left(e.body, 80)) as entry_title, count(*) as n, max(l.created_at) as at,
                   (array_agg(l.user_id order by l.created_at desc))[1\\:2] as actors
            from entry_likes l join entries e on e.id = l.entry_id join journeys j on j.id = e.journey_id
            where %s and e.author_id = :me and l.user_id <> :me and l.created_at > %s and %s
            group by l.entry_id, e.journey_id, e.title, e.body
            order by at desc limit :limit
            """.formatted(VISIBLE, RECENT, Rules.notBlocked("l.user_id", ":me")))
                .param("me", me)
                .param("limit", PER_KIND)
                .query((rs, n) -> new Line(
                        "likes:" + rs.getString("entry_id"),
                        ActivityKind.LIKES,
                        Sql.instant(rs, "at"),
                        uuids(rs, "actors"),
                        rs.getInt("n"),
                        0,
                        rs.getObject("journey_id", UUID.class),
                        null,
                        rs.getObject("entry_id", UUID.class),
                        rs.getString("entry_title"),
                        null,
                        false))
                .list();
    }

    /** Comments on the person's entries and journeys, and replies to their comments. */
    public List<Line> comments(UUID me) {
        return jdbc.sql("""
            select c.id, c.entry_id, e.journey_id, c.body, c.created_at, c.author_id, coalesce(nullif(e.title, ''), left(e.body, 80)) as entry_title,
                   coalesce(pc.author_id = :me, false) as reply_to_me
            from comments c
            join entries e on e.id = c.entry_id
            join journeys j on j.id = e.journey_id
            left join comments pc on pc.id = c.parent_id
            where %s and c.author_id <> :me and (e.author_id = :me or j.owner_id = :me or pc.author_id = :me) and c.created_at > %s
              and %s and %s and %s
            order by c.created_at desc limit :limit
            """.formatted(
                                VISIBLE,
                                RECENT,
                                Rules.commentBy("c", ":me"),
                                Rules.entryBy("e", ":me"),
                                Rules.shownComment("c", ":me")))
                .param("me", me)
                .param("limit", PER_KIND)
                .query((rs, n) -> new Line(
                        "comment:" + rs.getString("id"),
                        rs.getBoolean("reply_to_me") ? ActivityKind.REPLY : ActivityKind.COMMENT,
                        Sql.instant(rs, "created_at"),
                        List.of(rs.getObject("author_id", UUID.class)),
                        1,
                        0,
                        rs.getObject("journey_id", UUID.class),
                        null,
                        rs.getObject("entry_id", UUID.class),
                        rs.getString("entry_title"),
                        rs.getString("body"),
                        false))
                .list();
    }

    /** "Theo started following Iceland ring road". Follows made automatically for a creator's followers are left out. */
    public List<Line> journeyFollows(UUID me) {
        return jdbc.sql("""
            select f.journey_id, j.title, f.user_id, f.created_at
            from journey_follows f join journeys j on j.id = f.journey_id
            where j.owner_id = :me and f.user_id <> :me and not f.auto and not f.author and f.created_at > %s
            order by f.created_at desc limit :limit
            """.formatted(RECENT))
                .param("me", me)
                .param("limit", PER_KIND)
                .query((rs, n) -> new Line(
                        "jfollow:" + rs.getString("journey_id") + ":" + rs.getString("user_id"),
                        ActivityKind.JOURNEY_FOLLOW,
                        Sql.instant(rs, "created_at"),
                        List.of(rs.getObject("user_id", UUID.class)),
                        1,
                        0,
                        rs.getObject("journey_id", UUID.class),
                        rs.getString("title"),
                        null,
                        null,
                        null,
                        false))
                .list();
    }

    /** "Theo started following you", with whether the person follows them back. */
    public List<Line> profileFollows(UUID me) {
        return jdbc.sql("""
            select f.follower_id, f.created_at,
                   exists (select 1 from profile_follows b where b.follower_id = :me and b.followee_id = f.follower_id) as follows_back
            from profile_follows f
            where f.followee_id = :me and f.created_at > %s
            order by f.created_at desc limit :limit
            """.formatted(RECENT))
                .param("me", me)
                .param("limit", PER_KIND)
                .query((rs, n) -> new Line(
                        "pfollow:" + rs.getString("follower_id"),
                        ActivityKind.PROFILE_FOLLOW,
                        Sql.instant(rs, "created_at"),
                        List.of(rs.getObject("follower_id", UUID.class)),
                        1,
                        0,
                        null,
                        null,
                        null,
                        null,
                        null,
                        rs.getBoolean("follows_back")))
                .list();
    }

    /** "Nora invited you to add to Iceland ring road", and for an owner, "Alex joined Iceland ring road". */
    public List<Line> sharedJourneys(UUID me) {
        return jdbc.sql("""
            select m.journey_id, j.title, m.status, m.user_id, m.invited_by, coalesce(m.joined_at, m.created_at) as at
            from journey_members m join journeys j on j.id = m.journey_id
            where ((m.user_id = :me and m.status = 'invited') or (j.owner_id = :me and m.status = 'joined')) and coalesce(m.joined_at, m.created_at) > %s
            order by at desc limit :limit
            """.formatted(RECENT))
                .param("me", me)
                .param("limit", PER_KIND)
                .query((rs, n) -> {
                    boolean invitation = "invited".equals(rs.getString("status"));
                    return new Line(
                            (invitation ? "invite:" : "joined:") + rs.getString("journey_id") + ":"
                                    + rs.getString("user_id"),
                            invitation ? ActivityKind.INVITATION : ActivityKind.FRIEND_JOINED,
                            Sql.instant(rs, "at"),
                            List.of(rs.getObject(invitation ? "invited_by" : "user_id", UUID.class)),
                            1,
                            0,
                            rs.getObject("journey_id", UUID.class),
                            rs.getString("title"),
                            null,
                            null,
                            null,
                            false);
                })
                .list();
    }

    /** The first photo of each entry. */
    public Map<UUID, String> entryThumbs(List<UUID> entryIds) {
        Map<UUID, String> keys = new HashMap<>();
        if (!entryIds.isEmpty()) {
            jdbc.sql("""
              select distinct on (em.entry_id) em.entry_id as id, m.storage_key
              from entry_media em join media m on m.id = em.media_id
              where em.entry_id in (:ids) and m.kind = 'photo' and %s
              order by em.entry_id, em.position
              """.formatted(Rules.publicMedia("m")))
                    .param("ids", entryIds)
                    .query((rs, n) -> keys.put(rs.getObject("id", UUID.class), rs.getString("storage_key")))
                    .list();
        }
        return keys;
    }

    /** The first photo of each journey that this person may see: never one by someone they have blocked. */
    public Map<UUID, String> journeyThumbs(List<UUID> journeyIds, UUID me) {
        Map<UUID, String> keys = new HashMap<>();
        if (!journeyIds.isEmpty()) {
            jdbc.sql("""
              select distinct on (e.journey_id) e.journey_id as id, m.storage_key
              from entries e join entry_media em on em.entry_id = e.id join media m on m.id = em.media_id
              where e.journey_id in (:ids) and m.kind = 'photo' and %s and %s
              order by e.journey_id, e.happened_at, em.position
              """.formatted(Rules.publicMedia("m"), Rules.entryBy("e", ":me")))
                    .param("ids", journeyIds)
                    .param("me", me)
                    .query((rs, n) -> keys.put(rs.getObject("id", UUID.class), rs.getString("storage_key")))
                    .list();
        }
        return keys;
    }

    private static List<UUID> uuids(ResultSet rs, String column) throws SQLException {
        java.sql.Array array = rs.getArray(column);
        return array == null ? List.of() : Arrays.asList((UUID[]) array.getArray());
    }
}
