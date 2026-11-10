package app.journey.api.people;

import app.journey.api.common.Keyset;
import app.journey.api.common.Page;
import app.journey.api.common.Rules;
import app.journey.api.common.Sql;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Everything the API reads and writes about people as others see them: public profiles and who follows whom. */
@Repository
public class PeopleStore {

    public record PersonRow(UUID id, String username, String displayName, String avatarKey) {}

    /** Who a username belongs to, for the viewer: their id, and whether the viewer has blocked them. */
    public record Found(UUID id, boolean blockedByViewer) {}

    public record ProfileRow(
            UUID id,
            String username,
            String displayName,
            String bio,
            String link,
            String avatarKey,
            int journeyCount,
            int entryCount,
            int followerCount,
            int followingCount,
            boolean following,
            boolean followsViewer,
            boolean blockedByViewer) {}

    public record ListedRow(
            UUID id,
            String username,
            String displayName,
            String avatarKey,
            String latestJourney,
            boolean following,
            Instant since) {}

    /** A person's profile picture, left out while it is being held (see {@link Rules#chosenPhoto}). */
    private static final String AVATAR = Rules.chosenPhoto("a", "p.avatar_media_id");

    /**
     * The one place blocking works in one direction only, on purpose: someone who blocked you doesn't exist
     * for you, but you can still open the profile of someone you blocked, to unblock them.
     */
    private static final String EXISTS_FOR_VIEWER =
            "not exists (select 1 from blocks b where b.blocker_id = p.id and b.blocked_id = :viewer)";

    /** What a person in a list shows: the title of their newest public journey, and whether the viewer follows them. */
    private static final String LISTED = """
                   (select j.title from journeys j where j.owner_id = p.id and j.visibility = 'public' order by j.created_at desc limit 1) as latest_journey,
                   exists (select 1 from profile_follows v where v.follower_id = :viewer and v.followee_id = p.id) as following
            """;

    private static final RowMapper<PersonRow> PERSON = (rs, n) -> new PersonRow(
            rs.getObject("id", UUID.class),
            rs.getString("username"),
            rs.getString("display_name"),
            rs.getString("avatar_key"));

    private static final RowMapper<ListedRow> LISTED_ROW = (rs, n) -> new ListedRow(
            rs.getObject("id", UUID.class),
            rs.getString("username"),
            rs.getString("display_name"),
            rs.getString("avatar_key"),
            rs.getString("latest_journey"),
            rs.getBoolean("following"),
            Sql.instant(rs, "since"));

    private final JdbcClient jdbc;

    PeopleStore(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * A profile as the viewer may see it: other people see only public journeys counted. The follower and
     * following numbers are kept by the database (V31); the journeys and entries are few enough to count from
     * their indexes.
     */
    public Optional<ProfileRow> profile(String username, UUID viewer) {
        return jdbc.sql("""
            select p.id, p.username, p.display_name, p.bio, p.link, a.storage_key as avatar_key,
                   (select count(*) from journeys j where j.owner_id = p.id and (j.visibility = 'public' or p.id = :viewer)) as journey_count,
                   (select count(*) from entries e join journeys j on j.id = e.journey_id
                     where e.author_id = p.id and (j.visibility = 'public' or p.id = :viewer)) as entry_count,
                   p.follower_count, p.following_count,
                   exists (select 1 from profile_follows f where f.follower_id = :viewer and f.followee_id = p.id) as following,
                   exists (select 1 from profile_follows f where f.follower_id = p.id and f.followee_id = :viewer) as follows_viewer,
                   exists (select 1 from blocks b where b.blocker_id = :viewer and b.blocked_id = p.id) as blocked_by_viewer
            from profiles p""" + AVATAR + " where p.username = :username and " + EXISTS_FOR_VIEWER)
                .param("username", username)
                .param("viewer", viewer)
                .query((rs, n) -> new ProfileRow(
                        rs.getObject("id", UUID.class),
                        rs.getString("username"),
                        rs.getString("display_name"),
                        rs.getString("bio"),
                        rs.getString("link"),
                        rs.getString("avatar_key"),
                        rs.getInt("journey_count"),
                        rs.getInt("entry_count"),
                        rs.getInt("follower_count"),
                        rs.getInt("following_count"),
                        rs.getBoolean("following"),
                        rs.getBoolean("follows_viewer"),
                        rs.getBoolean("blocked_by_viewer")))
                .optional();
    }

    /**
     * Who a username belongs to, when all that is needed is the person's id: one look in the index on
     * usernames, without counting anything. Empty when there is no such person, or they have blocked the viewer.
     */
    public Optional<Found> find(String username, UUID viewer) {
        return jdbc.sql(
                        "select p.id, exists (select 1 from blocks b where b.blocker_id = :viewer and b.blocked_id = p.id)"
                                + " as blocked_by_viewer from profiles p where p.username = :username and "
                                + EXISTS_FOR_VIEWER)
                .param("username", username)
                .param("viewer", viewer)
                .query((rs, n) -> new Found(rs.getObject("id", UUID.class), rs.getBoolean("blocked_by_viewer")))
                .optional();
    }

    /** True when the follow is new. */
    public boolean follow(UUID follower, UUID followee) {
        return jdbc.sql(
                                "insert into profile_follows (follower_id, followee_id) values (:follower, :followee) on conflict do nothing")
                        .param("follower", follower)
                        .param("followee", followee)
                        .update()
                > 0;
    }

    public boolean follows(UUID follower, UUID followee) {
        return jdbc.sql(
                        "select exists (select 1 from profile_follows where follower_id = :follower and followee_id = :followee)")
                .param("follower", follower)
                .param("followee", followee)
                .query(Boolean.class)
                .single();
    }

    public void unfollow(UUID follower, UUID followee) {
        jdbc.sql("delete from profile_follows where follower_id = :follower and followee_id = :followee")
                .param("follower", follower)
                .param("followee", followee)
                .update();
    }

    /**
     * The people who follow someone (followers = true) or the people they follow, newest first, with each one's
     * latest public journey. A page starts after the last row of the page before (when they followed, then their
     * id), and is read from the index that holds the list in that order (V31).
     */
    public Page<ListedRow> listed(UUID personId, boolean followers, UUID viewer, Keyset page) {
        String other = followers ? "f.follower_id" : "f.followee_id";
        String self = followers ? "f.followee_id" : "f.follower_id";
        String after = page.first() ? "" : " and (f.created_at, " + other + ") < (:at, :id)";
        var query = jdbc.sql(
                        "select p.id, p.username, p.display_name, a.storage_key as avatar_key, f.created_at as since,"
                                + LISTED + " from profile_follows f join profiles p on p.id = " + other + AVATAR
                                + " where "
                                + self + " = :person" + after + " and " + Rules.notBlocked("p.id", ":viewer")
                                + " order by f.created_at desc, " + other + " desc limit :limit")
                .param("person", personId)
                .param("viewer", viewer)
                .param("limit", page.fetch());
        if (!page.first()) {
            query = query.param("at", Sql.timestamp(page.instant(0))).param("id", page.uuid(1));
        }
        return page.page(query.query(LISTED_ROW).list(), row -> Keyset.cursor(row.since(), row.id()));
    }

    /** People whose name or username matches the words typed, most followed first. */
    public List<ListedRow> search(String pattern, UUID viewer, int limit) {
        return jdbc.sql("select p.id, p.username, p.display_name, a.storage_key as avatar_key, p.created_at as since,"
                        + LISTED + " from profiles p" + AVATAR
                        + " where (p.username ilike :q or p.display_name ilike :q) and "
                        + Rules.notBlocked("p.id", ":viewer")
                        + " order by p.follower_count desc, p.username limit :limit")
                .param("q", pattern)
                .param("viewer", viewer)
                .param("limit", limit)
                .query(LISTED_ROW)
                .list();
    }

    /** People by id, for showing who did something. */
    public Map<UUID, PersonRow> byId(Collection<UUID> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        return jdbc
                .sql("select p.id, p.username, p.display_name, a.storage_key as avatar_key from profiles p" + AVATAR
                        + " where p.id in (:ids)")
                .param("ids", ids)
                .query(PERSON)
                .list()
                .stream()
                .collect(Collectors.toMap(PersonRow::id, Function.identity()));
    }
}
