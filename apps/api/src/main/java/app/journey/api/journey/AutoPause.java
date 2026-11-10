package app.journey.api.journey;

import app.journey.api.common.Jobs;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * A journey with no entry for 30 days pauses by itself, once a night. Followers can still read it, the owner
 * hears about it once, and one new entry brings it back. Nothing is lost and there is no streak to break.
 */
@Component
public class AutoPause {

    private static final Logger log = LoggerFactory.getLogger(AutoPause.class);
    static final int QUIET_DAYS = 30;

    private final UpkeepStore upkeep;
    private final ApplicationEventPublisher events;
    private final TransactionTemplate transaction;
    private final Jobs jobs;

    AutoPause(UpkeepStore upkeep, ApplicationEventPublisher events, TransactionTemplate transaction, Jobs jobs) {
        this.upkeep = upkeep;
        this.events = events;
        this.transaction = transaction;
        this.jobs = jobs;
    }

    @Scheduled(cron = "${journey.autopause.cron:0 15 4 * * *}", zone = "UTC")
    void nightly() {
        if (jobs.claim("auto_pause", LocalDate.now(ZoneOffset.UTC).toString())) {
            int paused = pauseQuietJourneys();
            if (paused > 0) {
                log.info("Paused {} journeys after {} quiet days.", paused, QUIET_DAYS);
            }
        }
    }

    /** Pauses the quiet journeys and tells their owners, all or nothing. Returns how many were paused. */
    public int pauseQuietJourneys() {
        Integer paused = transaction.execute(status -> {
            List<JourneyAutoPaused> quiet = upkeep.pauseQuiet(QUIET_DAYS);
            quiet.forEach(events::publishEvent);
            return quiet.size();
        });
        return paused == null ? 0 : paused;
    }
}
