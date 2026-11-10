package app.journey.api.digest;

import app.journey.api.common.Rules;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.support.TransactionTemplate;

/** The questions the weekly digest asks of the last seven days. */
@Repository
public class DigestStore {

    /** A journey that moved this week for one reader: how many entries, the newest, and the most liked. */
    public record Moved(UUID journeyId, int count, UUID latest, UUID top, int topLikes) {}

    /** Someone who has news and wants the digest. */
    public record Due(UUID userId, int entries, int journeysMoved, boolean byEmail) {}

    private static final String WEEK = "now() - interval '7 days'";

    private final JdbcClient jdbc;
    private final TransactionTemplate transaction;

    DigestStore(JdbcClient jdbc, TransactionTemplate transaction) {
        this.jdbc = jdbc;
        this.transaction = transaction;
    }

    /** The journeys a person follows or writes in that got entries from others this week, the most recently moved first. */
    public List<Moved> moved(UUID reader, int limit) {
        return jdbc.sql("""
            select e.journey_id, count(*) as n, max(e.like_count) as top_likes,
                   (array_agg(e.id order by e.created_at desc))[1] as latest,
                   (array_agg(e.id order by e.like_count desc, e.created_at desc))[1] as top
            from entries e
            join journey_follows f on f.journey_id = e.journey_id and f.user_id = :me
            join journeys j on j.id = e.journey_id
            where e.author_id <> :me and e.created_at > %s and %s and %s
            group by e.journey_id order by max(e.created_at) desc limit :limit
            """.formatted(WEEK, Rules.visibleJourney("j", ":me"), Rules.entryBy("e", ":me")))
                .param("me", reader)
                .param("limit", limit)
                .query((rs, n) -> new Moved(
                        rs.getObject("journey_id", UUID.class),
                        rs.getInt("n"),
                        rs.getObject("latest", UUID.class),
                        rs.getObject("top", UUID.class),
                        rs.getInt("top_likes")))
                .list();
    }

    /** Followed journeys that were completed this week, newest first. */
    public List<UUID> finished(UUID reader, int limit) {
        return jdbc.sql("""
            select j.id from journeys j join journey_follows f on f.journey_id = j.id and f.user_id = :me
            where j.status = 'completed' and j.owner_id <> :me and j.completed_at > %s and %s
            order by j.completed_at desc limit :limit
            """.formatted(WEEK, Rules.visibleJourney("j", ":me")))
                .param("me", reader)
                .param("limit", limit)
                .query(UUID.class)
                .list();
    }

    /**
     * Everyone with something to catch up on who hasn't switched the digest off. It starts from the week's
     * entries (found by when they were posted, V36) and goes from each to the people who follow its journey.
     * This is the one question of the weekly job that looks at the whole week for everyone, so it gives itself
     * more time than a request gets (see "Limits on the database" in docs/02-tech-stack.md).
     */
    public List<Due> due() {
        return transaction.execute(status -> {
            jdbc.sql("set local statement_timeout = '120s'").update();
            return jdbc.sql("""
                select f.user_id, coalesce(s.digest_email, false) as by_email, count(*) as entries, count(distinct e.journey_id) as journeys
                from entries e
                join journey_follows f on f.journey_id = e.journey_id and f.user_id <> e.author_id
                join journeys j on j.id = e.journey_id and %s
                left join settings s on s.user_id = f.user_id
                where e.created_at > %s and coalesce(s.weekly_digest, true) and %s
                group by f.user_id, s.digest_email
                """.formatted(
                                    Rules.visibleJourney("j", "f.user_id"), WEEK, Rules.entryBy("e", "f.user_id")))
                    .query((rs, n) -> new Due(
                            rs.getObject("user_id", UUID.class),
                            rs.getInt("entries"),
                            rs.getInt("journeys"),
                            rs.getBoolean("by_email")))
                    .list();
        });
    }
}
