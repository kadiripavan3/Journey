package app.journey.api.media;

import app.journey.api.common.Jobs;
import java.time.LocalDate;
import java.time.ZoneOffset;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Once a night, removes uploads nobody used: started and never finished, or never put on anything. */
@Component
class MediaCleanup {

    private final MediaService media;
    private final Jobs jobs;

    MediaCleanup(MediaService media, Jobs jobs) {
        this.media = media;
        this.jobs = jobs;
    }

    @Scheduled(cron = "${journey.media.cleanup-cron:0 30 3 * * *}", zone = "UTC")
    void nightly() {
        if (jobs.claim("media_cleanup", LocalDate.now(ZoneOffset.UTC).toString())) {
            media.removeAbandoned();
        }
    }
}
