package app.journey.api.moderation;

import app.journey.api.common.Jobs;
import java.time.LocalDate;
import java.time.ZoneOffset;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Once a night, what reviewers no longer need is forgotten (see {@link ModerationService#forgetOldRecords}). */
@Component
class ModerationUpkeep {

    private static final Logger log = LoggerFactory.getLogger(ModerationUpkeep.class);

    private final ModerationService moderation;
    private final Jobs jobs;

    ModerationUpkeep(ModerationService moderation, Jobs jobs) {
        this.moderation = moderation;
        this.jobs = jobs;
    }

    @Scheduled(cron = "${journey.moderation.forget-cron:0 20 4 * * *}", zone = "UTC")
    void nightly() {
        if (jobs.claim("review_records", LocalDate.now(ZoneOffset.UTC).toString())) {
            int gone = moderation.forgetOldRecords();
            if (gone > 0) {
                log.info("Forgot {} old review records.", gone);
            }
        }
    }
}
