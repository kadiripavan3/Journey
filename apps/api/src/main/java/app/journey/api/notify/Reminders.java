package app.journey.api.notify;

import app.journey.api.common.Jobs;
import app.journey.api.notify.ReminderStore.Due;
import app.journey.api.notify.ReminderStore.LocalTime;
import java.time.DateTimeException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Gentle reminders to add an entry, for people who asked for them.
 *
 * <p>The job looks every hour and reminds the people for whom it is now their reminder hour (7 pm unless they
 * chose another), in the time zone of their phone. The rules:
 *
 * <ul>
 *   <li>a challenge (a journey with a number of days to reach) is nudged on every day that has no entry yet;
 *   <li>any other journey is nudged after 3, 7 and 14 quiet days, and then left alone. A day is quiet when
 *       nothing was posted on it: what counts is when the person last added an entry, not the day that entry
 *       is dated, so writing up last week's trip today is not "quiet";
 *   <li>one reminder a day per person at most, about one journey: a challenge first, otherwise the journey
 *       they wrote in most recently;
 *   <li>never for a paused or completed journey, or one that hasn't started.
 * </ul>
 *
 * <p>The clocks are read here (Java knows every time zone a phone can name); who is due is then chosen by
 * the database in one statement, so an hour's run costs the same whether ten people are due or ten thousand.
 */
@Component
public class Reminders {

    private static final Logger log = LoggerFactory.getLogger(Reminders.class);
    private static final Set<Integer> QUIET_DAYS = Set.of(3, 7, 14);

    /**
     * One of a person's active journeys on a given day of theirs: which day of the journey that is, how many
     * days it has been quiet, and whether it already has an entry for that day.
     */
    record Candidate(
            UUID journeyId,
            String title,
            Integer targetDays,
            int dayNumber,
            int quietDays,
            int entryCount,
            boolean doneToday) {}

    private final ReminderStore journeys;
    private final Outbox outbox;
    private final Jobs jobs;

    Reminders(ReminderStore journeys, Outbox outbox, Jobs jobs) {
        this.journeys = journeys;
        this.outbox = outbox;
        this.jobs = jobs;
    }

    @Scheduled(cron = "${journey.reminders.cron:0 0 * * * *}", zone = "UTC")
    void hourly() {
        Instant now = Instant.now();
        jobs.run(
                "reminders",
                now.atOffset(ZoneOffset.UTC).truncatedTo(ChronoUnit.HOURS).toString(),
                () -> {
                    int reminded = remindAt(now);
                    if (reminded > 0) {
                        log.info("Reminded {} people to add an entry.", reminded);
                    }
                });
    }

    /** Queues a reminder for everyone whose own clock shows their reminder hour at this moment. Returns how many. */
    public int remindAt(Instant now) {
        List<LocalTime> clocks = journeys.timeZones().stream()
                .map(zone -> {
                    ZonedDateTime theirTime = now.atZone(zone(zone));
                    return new LocalTime(zone, theirTime.getHour(), theirTime.toLocalDate());
                })
                .toList();
        int reminded = 0;
        UUID done =
                null; // the journeys come person by person; the first one with something to say is the day's reminder
        for (Due due : journeys.due(clocks)) {
            if (due.userId().equals(done)) {
                continue;
            }
            Optional<String> words = wordsFor(candidate(due));
            if (words.isPresent()) {
                outbox.remind(due.userId(), due.journeyId(), words.get());
                done = due.userId();
                reminded++;
            }
        }
        return reminded;
    }

    /** The journey as the reminder rules look at it, on the person's own day. */
    static Candidate candidate(Due due) {
        LocalDate lastPosted = due.lastEntryAt() == null
                ? due.startDate()
                : due.lastEntryAt().atZone(zone(due.zone())).toLocalDate();
        return new Candidate(
                due.journeyId(),
                due.title(),
                due.targetDays(),
                (int) ChronoUnit.DAYS.between(due.startDate(), due.today()) + 1,
                (int) ChronoUnit.DAYS.between(lastPosted, due.today()),
                due.entryCount(),
                due.doneToday());
    }

    /** What to say about a journey today, or nothing when today is not a day to say anything. */
    static Optional<String> wordsFor(Candidate journey) {
        if (journey.targetDays() != null) {
            boolean running = journey.dayNumber() >= 1 && journey.dayNumber() <= journey.targetDays();
            return running && !journey.doneToday()
                    ? Optional.of("Day %d of %d is waiting. A quick check-in keeps it going."
                            .formatted(journey.dayNumber(), journey.targetDays()))
                    : Optional.empty();
        }
        if (!QUIET_DAYS.contains(journey.quietDays())) {
            return Optional.empty();
        }
        return Optional.of(
                journey.entryCount() == 0
                        ? "Your journey is ready when you are. Add the first entry."
                        : "It's been %d days since your last update. Add an entry when you're ready."
                                .formatted(journey.quietDays()));
    }

    private static ZoneId zone(String timeZone) {
        try {
            return ZoneId.of(timeZone);
        } catch (DateTimeException unknown) {
            return ZoneOffset.UTC;
        }
    }
}
