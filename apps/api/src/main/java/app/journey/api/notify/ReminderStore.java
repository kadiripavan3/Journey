package app.journey.api.notify;

import app.journey.api.common.Sql;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** What the reminder job needs to know: whose evening it is, and how their own journeys stand. */
@Repository
public class ReminderStore {

    /** What a time zone's clock shows at the moment the job runs: the hour of the day, and the date. */
    public record LocalTime(String zone, int hour, LocalDate today) {}

    /**
     * One active journey of a person whose reminder hour it is, as the database knows it. When it was last
     * posted to is a moment in time; which day that was for the person is worked out from their time zone.
     */
    public record Due(
            UUID userId,
            String zone,
            LocalDate today,
            UUID journeyId,
            String title,
            Integer targetDays,
            int entryCount,
            LocalDate startDate,
            Instant lastEntryAt,
            boolean doneToday) {}

    private final JdbcClient jdbc;

    ReminderStore(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * The person's time zone is the one of the device they used last. Written against the alias s (settings).
     */
    private static final String NEWEST_DEVICE =
            " cross join lateral (select d.time_zone from devices d where d.user_id = s.user_id order by d.seen_at desc limit 1) dev ";

    /** The time zones of the people who asked for reminders: a few hundred at most, however many people there are. */
    public List<String> timeZones() {
        return jdbc.sql("select distinct dev.time_zone from settings s" + NEWEST_DEVICE + " where s.reminders")
                .query(String.class)
                .list();
    }

    /**
     * The active journeys, already started, of everyone who asked for reminders, whose own clock shows their
     * reminder hour right now, and who wasn't reminded in the last 20 hours (one reminder a day at most).
     * One statement for everyone: the people are chosen here, not by going through them one by one. For each
     * person the journeys come challenges first, then the most recently written in.
     *
     * @param clocks what each time zone's clock shows now (see {@link #timeZones()})
     */
    public List<Due> due(List<LocalTime> clocks) {
        if (clocks.isEmpty()) {
            return List.of();
        }
        return jdbc.sql("""
            select s.user_id, clock.zone, clock.today, j.id, j.title, j.target_days, j.entry_count, j.start_date, j.last_entry_at,
                   exists (select 1 from entries e where e.journey_id = j.id and e.happened_on = clock.today) as done_today
            from settings s
            """ + NEWEST_DEVICE + """
            join unnest(cast(:zones as text[]), cast(:hours as int[]), cast(:days as date[])) as clock(zone, hour, today)
              on clock.zone = dev.time_zone and clock.hour = s.reminder_hour
            join journeys j on j.owner_id = s.user_id and j.status = 'active' and j.start_date <= clock.today
            where s.reminders
              and not exists (select 1 from notifications n
                              where n.user_id = s.user_id and n.kind = 'reminder' and n.created_at > now() - interval '20 hours')
            order by s.user_id, (j.target_days is not null) desc, coalesce(j.last_entry_at, j.created_at) desc
            """)
                .param("zones", clocks.stream().map(LocalTime::zone).toArray(String[]::new))
                .param("hours", clocks.stream().map(LocalTime::hour).toArray(Integer[]::new))
                .param("days", clocks.stream().map(c -> c.today().toString()).toArray(String[]::new))
                .query((rs, n) -> new Due(
                        rs.getObject("user_id", UUID.class),
                        rs.getString("zone"),
                        rs.getObject("today", LocalDate.class),
                        rs.getObject("id", UUID.class),
                        rs.getString("title"),
                        (Integer) rs.getObject("target_days"),
                        rs.getInt("entry_count"),
                        rs.getObject("start_date", LocalDate.class),
                        Sql.instant(rs, "last_entry_at"),
                        rs.getBoolean("done_today")))
                .list();
    }
}
