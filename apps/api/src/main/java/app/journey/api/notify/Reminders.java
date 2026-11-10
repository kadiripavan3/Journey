package app.journey.api.notify;

import app.journey.api.common.Jobs;
import app.journey.api.notify.DeviceStore.Reminded;
import app.journey.api.notify.ReminderStore.Candidate;
import java.time.DateTimeException;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Gentle reminders to add an entry, for people who haven't switched them off.
 *
 * <p>The job looks every hour and reminds the people for whom it is now their reminder hour (7 pm unless they
 * chose another), in the time zone of their phone. The rules:
 *
 * <ul>
 *   <li>a challenge (a journey with a number of days to reach) is nudged on every day that has no entry yet;
 *   <li>any other journey is nudged after 3, 7 and 14 quiet days, and then left alone;
 *   <li>one reminder a day per person at most, about one journey: a challenge first, otherwise the journey
 *       they wrote in most recently;
 *   <li>never for a paused or completed journey, or one that hasn't started.
 * </ul>
 */
@Component
public class Reminders {

    private static final Logger log = LoggerFactory.getLogger(Reminders.class);
    private static final Set<Integer> QUIET_DAYS = Set.of(3, 7, 14);

    private final DeviceStore devices;
    private final ReminderStore journeys;
    private final OutboxStore sentBefore;
    private final Outbox outbox;
    private final Jobs jobs;

    Reminders(DeviceStore devices, ReminderStore journeys, OutboxStore sentBefore, Outbox outbox, Jobs jobs) {
        this.devices = devices;
        this.journeys = journeys;
        this.sentBefore = sentBefore;
        this.outbox = outbox;
        this.jobs = jobs;
    }

    @Scheduled(cron = "${journey.reminders.cron:0 0 * * * *}", zone = "UTC")
    void hourly() {
        Instant now = Instant.now();
        if (jobs.claim(
                "reminders",
                now.atOffset(ZoneOffset.UTC).truncatedTo(ChronoUnit.HOURS).toString())) {
            int reminded = remindAt(now);
            if (reminded > 0) {
                log.info("Reminded {} people to add an entry.", reminded);
            }
        }
    }

    /** Queues a reminder for everyone whose own clock shows their reminder hour at this moment. Returns how many. */
    public int remindAt(Instant now) {
        int reminded = 0;
        for (Reminded person : devices.wantingReminders()) {
            ZonedDateTime theirTime = now.atZone(zone(person.timeZone()));
            if (theirTime.getHour() != person.reminderHour() || sentBefore.remindedLately(person.userId())) {
                continue;
            }
            for (Candidate journey : journeys.candidates(person.userId(), theirTime.toLocalDate())) {
                Optional<String> words = wordsFor(journey);
                if (words.isPresent()) {
                    outbox.remind(person.userId(), journey.journeyId(), words.get());
                    reminded++;
                    break; // one a day
                }
            }
        }
        return reminded;
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
