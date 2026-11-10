package app.journey.api.moderation;

import app.journey.api.common.Jobs;
import java.time.LocalDate;
import java.time.ZoneOffset;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Once a night, photos the automatic check hasn't seen are checked: ones uploaded while the check couldn't be
 * reached (they were let through meanwhile), and ones from before the check existed.
 */
@Component
class ModerationJobs {

    private static final Logger log = LoggerFactory.getLogger(ModerationJobs.class);

    private final ModerationService moderation;
    private final Jobs jobs;

    ModerationJobs(ModerationService moderation, Jobs jobs) {
        this.moderation = moderation;
        this.jobs = jobs;
    }

    @Scheduled(cron = "${journey.moderation.catch-up-cron:0 15 4 * * *}", zone = "UTC")
    void catchUp() {
        if (jobs.claim("photo_check_catch_up", LocalDate.now(ZoneOffset.UTC).toString())) {
            int checked = moderation.checkWaiting();
            if (checked > 0) {
                log.info("Checked {} photos that had not been checked yet.", checked);
            }
        }
    }
}
