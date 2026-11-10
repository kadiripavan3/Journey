package app.journey.api.notify;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** What the reminder job needs to know about a person's own journeys. */
@Repository
public class ReminderStore {

    /**
     * One of a person's active journeys on a given day of theirs: which day of the journey that is, how many
     * days it has been quiet, and whether it already has an entry for that day.
     */
    public record Candidate(
            UUID journeyId,
            String title,
            Integer targetDays,
            int dayNumber,
            int quietDays,
            int entryCount,
            boolean doneToday) {}

    private final JdbcClient jdbc;

    ReminderStore(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** The person's own active journeys that have started, challenges first, then the most recently written in. */
    public List<Candidate> candidates(UUID ownerId, LocalDate today) {
        return jdbc.sql("""
            select j.id, j.title, j.target_days, j.entry_count,
                   (cast(:today as date) - j.start_date + 1) as day_number,
                   (cast(:today as date) - coalesce((select max(e.happened_on) from entries e where e.journey_id = j.id), j.start_date)) as quiet_days,
                   exists (select 1 from entries e where e.journey_id = j.id and e.happened_on = cast(:today as date)) as done_today
            from journeys j
            where j.owner_id = :owner and j.status = 'active' and j.start_date <= cast(:today as date)
            order by (j.target_days is not null) desc, coalesce(j.last_entry_at, j.created_at) desc
            limit 20
            """)
                .param("owner", ownerId)
                .param("today", today.toString())
                .query((rs, n) -> new Candidate(
                        rs.getObject("id", UUID.class),
                        rs.getString("title"),
                        (Integer) rs.getObject("target_days"),
                        rs.getInt("day_number"),
                        rs.getInt("quiet_days"),
                        rs.getInt("entry_count"),
                        rs.getBoolean("done_today")))
                .list();
    }
}
