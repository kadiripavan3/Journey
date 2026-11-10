package app.journey.api.journey;

import app.journey.api.common.Jobs;
import app.journey.api.journey.UpkeepStore.Rescored;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Keeps "Trending now" current. Once an hour the public journeys where something happened lately get a score
 * for how much is going on in them; Discover orders by that score. The rules are simple on purpose and are
 * written out in {@link UpkeepStore#trendingScores()} and in the tech plan: no machine learning, nothing that
 * can't be explained to a creator in one sentence.
 */
@Component
public class Trending {

    private static final Logger log = LoggerFactory.getLogger(Trending.class);

    /** How many journeys get their new score in one statement, so no statement holds many rows for long. */
    static final int BATCH = 1000;

    private final UpkeepStore upkeep;
    private final Jobs jobs;

    private final boolean jobsOn;

    Trending(UpkeepStore upkeep, Jobs jobs, @Value("${journey.jobs.enabled:true}") boolean jobsOn) {
        this.upkeep = upkeep;
        this.jobs = jobs;
        this.jobsOn = jobsOn;
    }

    @Scheduled(cron = "${journey.trending.cron:0 10 * * * *}", zone = "UTC")
    void hourly() {
        oncePerHour();
    }

    /**
     * So Discover has scores soon after the API is first started, also on a computer that was just set up.
     * It counts as this hour's run: starting again within the hour (a deploy, a second copy) does nothing.
     */
    @EventListener(ApplicationReadyEvent.class)
    void whenStarted() {
        if (jobsOn) {
            oncePerHour();
        }
    }

    private void oncePerHour() {
        String hour = Instant.now()
                .atOffset(ZoneOffset.UTC)
                .truncatedTo(ChronoUnit.HOURS)
                .toString();
        jobs.run("trending", hour, () -> {
            rescore();
            count();
        });
    }

    /** Counts the public journeys of every kind, for the pages that say how many there are. Returns how many kinds. */
    public int count() {
        return upkeep.tally();
    }

    /**
     * Works the scores out again and stores the ones that changed, a thousand journeys at a time. Returns how
     * many changed.
     */
    public int rescore() {
        List<Rescored> scores = upkeep.trendingScores();
        int changed = 0;
        for (int from = 0; from < scores.size(); from += BATCH) {
            changed += upkeep.saveTrending(scores.subList(from, Math.min(from + BATCH, scores.size())));
        }
        log.debug("Trending scores changed for {} journeys.", changed);
        return changed;
    }
}
