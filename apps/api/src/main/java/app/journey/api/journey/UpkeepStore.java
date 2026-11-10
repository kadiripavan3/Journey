package app.journey.api.journey;

import app.journey.api.common.Sql;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.support.TransactionTemplate;

/** What the background jobs do to journeys: pausing the quiet ones, and scoring what is trending. */
@Repository
public class UpkeepStore {

    private final JdbcClient jdbc;
    private final TransactionTemplate transaction;

    UpkeepStore(JdbcClient jdbc, TransactionTemplate transaction) {
        this.jdbc = jdbc;
        this.transaction = transaction;
    }

    /**
     * Pauses every active journey that has had no entry for this many days, and says which ones. It runs once
     * a night inside the job's own transaction and looks at every active journey (there is deliberately no
     * index on "last entry": one would have to be rewritten with every new entry), so it gives itself more
     * time than a request gets.
     */
    public List<JourneyAutoPaused> pauseQuiet(int days) {
        jdbc.sql(Sql.ROOM_FOR_A_JOB).update();
        return jdbc.sql("""
            update journeys set status = 'paused', auto_paused_at = now(), updated_at = now()
            where status = 'active' and coalesce(last_entry_at, created_at) < now() - make_interval(days => :days)
            returning id, owner_id
            """)
                .param("days", days)
                .query((rs, n) ->
                        new JourneyAutoPaused(rs.getObject("id", UUID.class), rs.getObject("owner_id", UUID.class)))
                .list();
    }

    /** A journey whose trending score is no longer what is stored, with what it should be. */
    public record Rescored(UUID id, double score) {}

    /**
     * Works out how much is going on in the public journeys where something happened lately, and gives back
     * the ones whose score changed. The rules, so that anyone can explain why a journey is where it is in
     * "Trending now" (they are in docs/02-tech-stack.md too; change both together):
     *
     * <ul>
     *   <li>3 points for each entry added in the last 7 days (at most 7 entries count, so posting a lot in
     *       one day doesn't win);
     *   <li>2 points for each new follower in the last 7 days;
     *   <li>1 point for each person who liked something in it and 2 for each person who commented in the
     *       last 7 days. People are counted, not likes or comments, so one person can't push a journey up
     *       by liking every entry; the people who write in the journey don't count at all; a comment that is
     *       held for review doesn't count; and likes and comments each add 30 points at most;
     *   <li>10 points if it was completed in the last 14 days;
     *   <li>a little for how many people follow it already (the logarithm, so 1,000 followers count for about
     *       7 points, not 1,000);
     *   <li>and all of it halved while the journey is paused.
     * </ul>
     *
     * <p>Only journeys that can have a different score are looked at: those with an entry, a follower, a like
     * or a comment in the last 8 days (a day more than the week that counts, so a journey is scored one last
     * time when its busy week has passed), those changed in the last 8 days, and those completed in the last
     * 15. A journey nothing has happened to keeps the score it had. Each of the four things that count is
     * read once, by when it happened, through an index on that; nothing is written here.
     */
    public List<Rescored> trendingScores() {
        return transaction.execute(status -> {
            jdbc.sql(Sql.ROOM_FOR_A_JOB).update();
            return jdbc.sql("""
                with entries_added as (
                  select e.journey_id as id, count(*) filter (where e.created_at > now() - interval '7 days') as n
                  from entries e where e.created_at > now() - interval '8 days'
                  group by e.journey_id),
                followers_gained as (
                  select f.journey_id as id, count(*) filter (where f.created_at > now() - interval '7 days') as n
                  from journey_follows f where not f.author and f.created_at > now() - interval '8 days'
                  group by f.journey_id),
                people_who_liked as (
                  select e.journey_id as id, count(distinct l.user_id) filter (where l.created_at > now() - interval '7 days') as n
                  from entry_likes l join entries e on e.id = l.entry_id
                  where l.created_at > now() - interval '8 days'
                    and not exists (select 1 from journey_follows a
                                    where a.journey_id = e.journey_id and a.user_id = l.user_id and a.author)
                  group by e.journey_id),
                people_who_commented as (
                  select e.journey_id as id, count(distinct c.author_id) filter (where c.created_at > now() - interval '7 days') as n
                  from comments c join entries e on e.id = c.entry_id
                  where c.created_at > now() - interval '8 days' and not c.held
                    and not exists (select 1 from journey_follows a
                                    where a.journey_id = e.journey_id and a.user_id = c.author_id and a.author)
                  group by e.journey_id),
                busy as (
                  select id from entries_added union select id from followers_gained
                  union select id from people_who_liked union select id from people_who_commented
                  union select j.id from journeys j
                        where j.updated_at > now() - interval '8 days' or j.completed_at > now() - interval '15 days')
                select s.id, s.score
                from (
                  select j.id, j.trending_score as stored,
                         ( 3.0 * least(coalesce(e.n, 0), 7)
                         + 2.0 * coalesce(f.n, 0)
                         + least(1.0 * coalesce(l.n, 0), 30)
                         + least(2.0 * coalesce(c.n, 0), 30)
                         + case when j.status = 'completed' and j.completed_at > now() - interval '14 days' then 10 else 0 end
                         + ln(1 + j.follower_count)
                         ) * case when j.status = 'paused' then 0.5 else 1 end as score
                  from busy b
                  join journeys j on j.id = b.id
                  left join entries_added e on e.id = j.id
                  left join followers_gained f on f.id = j.id
                  left join people_who_liked l on l.id = j.id
                  left join people_who_commented c on c.id = j.id
                  where j.visibility = 'public') s
                where s.stored is distinct from s.score
                order by s.id
                """)
                    .query((rs, n) -> new Rescored(rs.getObject("id", UUID.class), rs.getDouble("score")))
                    .list();
        });
    }

    /**
     * Stores the new scores of some journeys: one short statement, so the rows are held only for a moment and
     * a new entry or follow in one of them never waits long. Returns how many changed.
     */
    public int saveTrending(List<Rescored> scores) {
        return saveScores(scores);
    }

    /**
     * Counts the public journeys of each category and each length of challenge, and keeps the answers for the
     * pages that show them (a category's page, the page of challenges). It reads every public journey once,
     * so it is the hourly job's work and is given room. Returns how many kinds of journey there are.
     */
    public int tally() {
        Integer kinds = transaction.execute(status -> {
            jdbc.sql(Sql.ROOM_FOR_A_JOB).update();
            jdbc.sql("delete from journey_tallies").update();
            return jdbc.sql("""
                insert into journey_tallies (category, target_days, in_progress, finished_this_month)
                select j.category, coalesce(j.target_days, -1),
                       count(*) filter (where j.status = 'active'),
                       count(*) filter (where j.status = 'completed' and j.completed_at >= date_trunc('month', now()))
                from journeys j where j.visibility = 'public'
                group by j.category, coalesce(j.target_days, -1)
                """).update();
        });
        return kinds == null ? 0 : kinds;
    }

    private int saveScores(List<Rescored> scores) {
        return jdbc.sql("""
            update journeys j set trending_score = s.score
            from unnest(cast(:ids as uuid[]), cast(:scores as float8[])) as s(id, score)
            where j.id = s.id and j.trending_score is distinct from s.score
            """)
                .param(
                        "ids",
                        Sql.arrayLiteral(
                                scores.stream().map(s -> s.id().toString()).toList()))
                .param(
                        "scores",
                        Sql.arrayLiteral(scores.stream()
                                .map(s -> Double.toString(s.score()))
                                .toList()))
                .update();
    }
}
