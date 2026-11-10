package app.journey.api.journey;

import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** What the background jobs do to journeys: pausing the quiet ones, and scoring what is trending. */
@Repository
public class UpkeepStore {

    private final JdbcClient jdbc;

    UpkeepStore(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** Pauses every active journey that has had no entry for this many days, and says which ones. */
    public List<JourneyAutoPaused> pauseQuiet(int days) {
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

    /**
     * Works out again how much is going on in each public journey. The rules, so that anyone can explain why a
     * journey is where it is in "Trending now":
     *
     * <ul>
     *   <li>3 points for each entry added in the last 7 days (at most 7 entries count, so posting a lot in
     *       one day doesn't win);
     *   <li>2 points for each new follower in the last 7 days;
     *   <li>1 point for each like and 2 for each comment in the last 7 days;
     *   <li>10 points if it was completed in the last 14 days;
     *   <li>a little for how many people follow it already (the logarithm, so 1,000 followers count for about
     *       7 points, not 1,000);
     *   <li>and all of it halved while the journey is paused.
     * </ul>
     *
     * Returns how many scores changed.
     */
    public int rescoreTrending() {
        return jdbc.sql("""
            update journeys j set trending_score = s.score
            from (
              select t.id,
                     ( 3.0 * least((select count(*) from entries e where e.journey_id = t.id and e.created_at > now() - interval '7 days'), 7)
                     + 2.0 * (select count(*) from journey_follows f where f.journey_id = t.id and not f.author and f.created_at > now() - interval '7 days')
                     + 1.0 * (select count(*) from entry_likes l join entries e on e.id = l.entry_id
                               where e.journey_id = t.id and l.created_at > now() - interval '7 days')
                     + 2.0 * (select count(*) from comments c join entries e on e.id = c.entry_id
                               where e.journey_id = t.id and c.created_at > now() - interval '7 days')
                     + case when t.status = 'completed' and t.completed_at > now() - interval '14 days' then 10 else 0 end
                     + ln(1 + t.follower_count)
                     ) * case when t.status = 'paused' then 0.5 else 1 end as score
              from journeys t where t.visibility = 'public'
            ) s
            where s.id = j.id and j.trending_score is distinct from s.score
            """).update();
    }
}
