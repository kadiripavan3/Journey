package app.journey.api.journey;

import app.journey.api.common.Jobs;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Keeps "Trending now" current. Every hour (and once when the API starts) each public journey gets a score
 * for how much is going on in it; Discover orders by that score. The rules are simple on purpose and are
 * written out in {@link UpkeepStore#rescoreTrending()} and in the tech plan: no machine learning, nothing that
 * can't be explained to a creator in one sentence.
 */
@Component
public class Trending {

    private static final Logger log = LoggerFactory.getLogger(Trending.class);

    private final UpkeepStore upkeep;
    private final Jobs jobs;

    Trending(UpkeepStore upkeep, Jobs jobs) {
        this.upkeep = upkeep;
        this.jobs = jobs;
    }

    @Scheduled(cron = "${journey.trending.cron:0 10 * * * *}", zone = "UTC")
    void hourly() {
        String hour = Instant.now()
                .atOffset(ZoneOffset.UTC)
                .truncatedTo(ChronoUnit.HOURS)
                .toString();
        if (jobs.claim("trending", hour)) {
            rescore();
        }
    }

    /** So Discover is right from the first minute, also on a computer that was just started. */
    @EventListener(ApplicationReadyEvent.class)
    void whenStarted() {
        rescore();
    }

    /** Works the scores out again. Returns how many changed. */
    public int rescore() {
        int changed = upkeep.rescoreTrending();
        log.debug("Trending scores changed for {} journeys.", changed);
        return changed;
    }
}
