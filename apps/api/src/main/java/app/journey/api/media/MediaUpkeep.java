package app.journey.api.media;

import app.journey.api.common.Jobs;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * What happens to photos and clips by itself, in the background:
 *
 * <ul>
 *   <li>every minute, files that are no longer used are removed (see {@link MediaService#sweep});
 *   <li>every quarter of an hour, photos and clips the automatic check hasn't looked at yet are looked at,
 *       and the video service is asked about clips it has been converting for suspiciously long.
 * </ul>
 */
@Component
class MediaUpkeep {

    private static final Logger log = LoggerFactory.getLogger(MediaUpkeep.class);

    private final MediaService media;
    private final Jobs jobs;

    MediaUpkeep(MediaService media, Jobs jobs) {
        this.media = media;
        this.jobs = jobs;
    }

    /** Safe in every copy of the API at once: each takes its own rows. */
    @Scheduled(
            initialDelayString = "${journey.media.sweep-every:PT1M}",
            fixedDelayString = "${journey.media.sweep-every:PT1M}")
    void everyMinute() {
        media.sweep();
    }

    @Scheduled(cron = "${journey.media.catch-up-cron:0 4/15 * * * *}", zone = "UTC")
    void everyQuarterHour() {
        jobs.run("media_catch_up", Instant.now().truncatedTo(ChronoUnit.MINUTES).toString(), () -> {
            int looked = media.checkWaiting();
            if (looked > 0) {
                log.info("Looked at {} photos and clips that had not been looked at yet.", looked);
            }
            int moved = media.askAboutSlowClips();
            if (moved > 0) {
                log.info("{} clips the video service had not reported on are settled now.", moved);
            }
        });
    }
}
