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
 *
 * <p>Every kind of line has one description of where it comes from (the constants below), written so that the
 * database starts from the person's own few rows (the journeys they follow, the entries they wrote, the
 * journeys they own) and looks up what happened to each through an index. The same description answers both
 * "what are the lines" and "is there anything new" ({@link #unseen}), so the dot on the tab bar and the list
 * can't disagree. In each, {@code %s} stands for the moment the question starts from.
 */
@Repository
public class ActivityStore {

    /** How many lines of each kind are read; the service keeps the newest of all of them together. */
    static final int PER_KIND = 30;

    /** Activity looks back this far and no further. */
    private static final String RECENT = "now() - interval '30 days'";

    private static final String VISIBLE = Rules.visibleJourney("j", ":me");

    /** New entries by others in the journeys the person follows or writes in, since they started following. */
    private static final String NEW_ENTRIES = """
            from journey_follows f
            join journeys j on j.id = f.journey_id
            join entries e on e.journey_id = f.journey_id and e.created_at > greatest(f.created_at, %s)
            where f.user_id = :me and e.author_id <> :me and
            """ + VISIBLE + " and " + Rules.entryBy("e", ":me");

    /** Journeys the person follows that were completed by someone else since they started following. */
    private static final String COMPLETED = """
            from journey_follows f
            join journeys j on j.id = f.journey_id
            where f.user_id = :me and j.status = 'completed' and j.owner_id <> :me
              and j.completed_at > greatest(f.created_at, %s) and
            """ + VISIBLE;

    /**
     * Likes on the person's own entries. An entry nobody has liked (the count the database keeps says so) is
     * passed over without looking for its likes.
     */
    private static final String LIKES = """
            from entries e
            join journeys j on j.id = e.journey_id
            join entry_likes l on l.entry_id = e.id and l.created_at > %s
            where e.author_id = :me and e.like_count > 0 and l.user_id <> :me and
            """ + VISIBLE + " and " + Rules.notBlocked("l.user_id", ":me");

    /**
     * Comments reach a person three ways, and each way starts from rows that are theirs: under an entry in a
     * journey they own, under an entry they wrote in someone else's journey, and as an answer to a comment of
     * theirs anywhere else. The three never overlap, so a comment is one line. An entry without comments (the
     * count the database keeps, which leaves out held ones, as these lines do) is passed over without looking.
     */
    private static final List<String> COMMENTS = List.of("""
            from journeys j
            join entries e on e.journey_id = j.id and e.comment_count > 0
            join comments c on c.entry_id = e.id and c.created_at > %s
            where j.owner_id = :me
            """, """
            from (select distinct w.journey_id from entries w where w.author_id = :me) wrote
            join journeys j on j.id = wrote.journey_id and j.owner_id <> :me
            join entries e on e.author_id = :me and e.journey_id = j.id and e.comment_count > 0
            join comments c on c.entry_id = e.id and c.created_at > %s
            where true
            """, """
            from comments mine
            join comments c on c.parent_id = mine.id and c.created_at > %s
            join entries e on e.id = c.entry_id and e.author_id <> :me
            join journeys j on j.id = e.journey_id and j.owner_id <> :me
            where mine.author_id = :me
            """);

    /** What holds for a comment whichever way it came: someone else wrote it, and the person may see it. */
    private static final String COMMENT_SHOWN = " and c.author_id <> :me and " + VISIBLE + " and "
            + Rules.commentBy("c", ":me") + " and " + Rules.entryBy("e", ":me") + " and "
            + Rules.shownComment("c", ":me");

    /** People who chose to follow one of the person's journeys. Follows made for a creator's followers are left out. */
    private static final String JOURNEY_FOLLOWS = """
            from journeys j
            join journey_follows f on f.journey_id = j.id and not f.author and not f.auto and f.created_at > %s
            where j.owner_id = :me and f.user_id <> :me and
            """ + Rules.notBlocked("f.user_id", ":me");

    /** People who started following the person. */
    private static final String PROFILE_FOLLOWS = """
            from profile_follows f
            where f.followee_id = :me and f.created_at > %s and
            """ + Rules.notBlocked("f.follower_id", ":me");

    /** Invitations waiting for the person's answer. */
    private static final String INVITATIONS = """
            from journey_members m
            join journeys j on j.id = m.journey_id
            where m.user_id = :me and m.status = 'invited' and m.created_at > %s and
            """ + Rules.notBlocked("j.owner_id", ":me");

    /** Friends who said yes to one of the person's journeys. */
    private static final String FRIENDS_JOINED = """
            from journeys j
            join journey_members m on m.journey_id = j.id and m.status = 'joined' and coalesce(m.joined_at, m.created_at) > %s
            where j.owner_id = :me and
            """ + Rules.notBlocked("m.user_id", ":me");

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

    /**
     * True when something happened since the person last opened Activity: the answer behind the dot on the tab
     * bar, in one statement. It asks each kind of line "is there one after that moment?", the cheapest first,
     * and stops at the first yes; a kind the person has switched off isn't asked. It never builds the list.
     */
    public boolean unseen(UUID me) {
        String since = "my.since";
        String comments = String.join(
                " or ",
                COMMENTS.stream()
                        .map(from -> exists(from + COMMENT_SHOWN, since))
                        .toList());
        return jdbc.sql("select " + exists(INVITATIONS, since)
                        + " or " + exists(FRIENDS_JOINED, since)
                        + " or (my.followers and (" + exists(PROFILE_FOLLOWS, since) + " or "
                        + exists(JOURNEY_FOLLOWS, since) + "))"
                        + " or (my.completed and " + exists(COMPLETED, since) + ")"
                        + " or (my.likes and " + exists(LIKES, since) + ")"
                        + " or (my.comments and (" + comments + "))"
                        + " or (my.entries and " + exists(NEW_ENTRIES, since) + ") "
                        + """
                        from (
                          select greatest(p.activity_seen_at, %s) as since,
                                 coalesce(s.notify_new_entries, true) as entries, coalesce(s.notify_completed, true) as completed,
                                 coalesce(s.notify_likes, true) as likes, coalesce(s.notify_comments, true) as comments,
                                 coalesce(s.notify_followers, true) as followers
                          from profiles p left join settings s on s.user_id = p.id
                          where p.id = :me) my
                        """.formatted(RECENT))
                .param("me", me)
                .query(Boolean.class)
                .optional()
                .orElse(false);
    }

    private static String exists(String from, String since) {
        return "exists (select 1 " + from.formatted(since) + ")";
    }

    /** "Maya added 3 entries to Southeast Asia by motorbike": one line per journey per day, for journeys the person follows. */
    public List<Line> newEntries(UUID me) {
        return jdbc.sql("""
            select e.journey_id, j.title as journey_title, (e.created_at at time zone 'UTC')::date as day, count(*) as n, max(e.created_at) as at,
                   (array_agg(e.id order by e.created_at desc))[1] as entry_id,
                   (array_agg(e.author_id order by e.created_at desc))[1] as actor,
                   (array_agg(coalesce(nullif(e.title, ''), left(e.body, 80)) order by e.created_at desc))[1] as entry_title
            """ + NEW_ENTRIES.formatted(RECENT)
                        + " group by e.journey_id, j.title, day order by at desc limit :limit")
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
        return jdbc.sql("select j.id, j.title, j.owner_id, j.completed_at " + COMPLETED.formatted(RECENT)
                        + " order by j.completed_at desc limit :limit")
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
            """ + LIKES.formatted(RECENT)
                        + " group by l.entry_id, e.journey_id, e.title, e.body order by at desc limit :limit")
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
        String line = """
            select c.id, c.entry_id, e.journey_id, c.body, c.created_at, c.author_id, coalesce(nullif(e.title, ''), left(e.body, 80)) as entry_title,
                   exists (select 1 from comments pc where pc.id = c.parent_id and pc.author_id = :me) as reply_to_me
            """;
        String ways = String.join(
                " union all ",
                COMMENTS.stream()
                        .map(from -> line + from.formatted(RECENT) + COMMENT_SHOWN)
                        .toList());
        return jdbc.sql("select * from (" + ways + ") found order by created_at desc limit :limit")
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
        return jdbc.sql("select f.journey_id, j.title, f.user_id, f.created_at " + JOURNEY_FOLLOWS.formatted(RECENT)
                        + " order by f.created_at desc limit :limit")
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
            """ + PROFILE_FOLLOWS.formatted(RECENT) + " order by f.created_at desc limit :limit")
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
        String line =
                "select m.journey_id, j.title, m.status, m.user_id, m.invited_by, coalesce(m.joined_at, m.created_at) as at ";
        return jdbc.sql("select * from (" + line + INVITATIONS.formatted(RECENT) + " union all " + line
                        + FRIENDS_JOINED.formatted(RECENT) + ") found order by at desc limit :limit")
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

    /**
     * The first photo of each journey that this person may see: never one by someone they have blocked. Each
     * journey's story is read from its start only as far as its first photo.
     */
    public Map<UUID, String> journeyThumbs(List<UUID> journeyIds, UUID me) {
        Map<UUID, String> keys = new HashMap<>();
        if (!journeyIds.isEmpty()) {
            jdbc.sql("""
              select j.id, first.storage_key
              from journeys j
              cross join lateral (
                select m.storage_key
                from entries e join entry_media em on em.entry_id = e.id join media m on m.id = em.media_id
                where e.journey_id = j.id and m.kind = 'photo' and %s and %s
                order by e.happened_at, e.created_at, e.id, em.position limit 1) first
              where j.id in (:ids)
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
