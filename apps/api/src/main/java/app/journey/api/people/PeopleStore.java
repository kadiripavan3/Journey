package app.journey.api.people;

import app.journey.api.common.Page;
import app.journey.api.common.PageRequest;
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

    private static final RowMapper<PersonRow> PERSON = (rs, n) -> new PersonRow(
            rs.getObject("id", UUID.class),
            rs.getString("username"),
            rs.getString("display_name"),
            rs.getString("avatar_key"));

    private final JdbcClient jdbc;

    PeopleStore(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** A profile as the viewer may see it: other people see only public journeys counted. */
    public Optional<ProfileRow> profile(String username, UUID viewer) {
        return jdbc.sql("""
            select p.id, p.username, p.display_name, p.bio, p.link, a.storage_key as avatar_key,
                   (select count(*) from journeys j where j.owner_id = p.id and (j.visibility = 'public' or p.id = :viewer)) as journey_count,
                   (select count(*) from entries e join journeys j on j.id = e.journey_id
                     where e.author_id = p.id and (j.visibility = 'public' or p.id = :viewer)) as entry_count,
                   (select count(*) from profile_follows f where f.followee_id = p.id) as follower_count,
                   (select count(*) from profile_follows f where f.follower_id = p.id) as following_count,
                   exists (select 1 from profile_follows f where f.follower_id = :viewer and f.followee_id = p.id) as following,
                   exists (select 1 from profile_follows f where f.follower_id = p.id and f.followee_id = :viewer) as follows_viewer,
                   exists (select 1 from blocks b where b.blocker_id = :viewer and b.blocked_id = p.id) as blocked_by_viewer
            from profiles p left join media a on a.id = p.avatar_media_id
            where p.username = :username
              and not exists (select 1 from blocks b where b.blocker_id = p.id and b.blocked_id = :viewer)
            """)
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

    /** The people who follow someone (followers = true) or the people they follow, newest first, with each one's latest public journey. */
    public Page<ListedRow> listed(UUID personId, boolean followers, UUID viewer, PageRequest page) {
        String other = followers ? "f.follower_id" : "f.followee_id";
        String self = followers ? "f.followee_id" : "f.follower_id";
        List<ListedRow> rows = jdbc.sql("""
            select p.id, p.username, p.display_name, a.storage_key as avatar_key, f.created_at as since,
                   (select j.title from journeys j where j.owner_id = p.id and j.visibility = 'public' order by j.created_at desc limit 1) as latest_journey,
                   exists (select 1 from profile_follows v where v.follower_id = :viewer and v.followee_id = p.id) as following
            from profile_follows f
            join profiles p on p.id = %s
            left join media a on a.id = p.avatar_media_id
            where %s = :person and %s
            order by f.created_at desc, p.id
            limit :limit offset :offset
            """.formatted(other, self, Rules.notBlocked("p.id", ":viewer")))
                .param("person", personId)
                .param("viewer", viewer)
                .param("limit", page.fetch())
                .param("offset", page.offset())
                .query((rs, n) -> new ListedRow(
                        rs.getObject("id", UUID.class),
                        rs.getString("username"),
                        rs.getString("display_name"),
                        rs.getString("avatar_key"),
                        rs.getString("latest_journey"),
                        rs.getBoolean("following"),
                        Sql.instant(rs, "since")))
                .list();
        return Page.of(rows, page);
    }

    /** People whose name or username matches the words typed, most followed first. */
    public List<ListedRow> search(String pattern, UUID viewer, int limit) {
        return jdbc.sql("""
            select p.id, p.username, p.display_name, a.storage_key as avatar_key, p.created_at as since,
                   (select j.title from journeys j where j.owner_id = p.id and j.visibility = 'public' order by j.created_at desc limit 1) as latest_journey,
                   exists (select 1 from profile_follows v where v.follower_id = :viewer and v.followee_id = p.id) as following
            from profiles p left join media a on a.id = p.avatar_media_id
            where (p.username ilike :q or p.display_name ilike :q) and %s
            order by (select count(*) from profile_follows f where f.followee_id = p.id) desc, p.username
            limit :limit
            """.formatted(Rules.notBlocked("p.id", ":viewer")))
                .param("q", pattern)
                .param("viewer", viewer)
                .param("limit", limit)
                .query((rs, n) -> new ListedRow(
                        rs.getObject("id", UUID.class),
                        rs.getString("username"),
                        rs.getString("display_name"),
                        rs.getString("avatar_key"),
                        rs.getString("latest_journey"),
                        rs.getBoolean("following"),
                        Sql.instant(rs, "since")))
                .list();
    }

    /** People by id, for showing who did something. */
    public Map<UUID, PersonRow> byId(Collection<UUID> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        return jdbc.sql("""
            select p.id, p.username, p.display_name, a.storage_key as avatar_key
            from profiles p left join media a on a.id = p.avatar_media_id
            where p.id in (:ids)
            """).param("ids", ids).query(PERSON).list().stream()
                .collect(Collectors.toMap(PersonRow::id, Function.identity()));
    }
}
