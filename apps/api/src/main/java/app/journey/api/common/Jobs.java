package app.journey.api.common;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Makes sure a scheduled job runs once per period even when several copies of the API are running: each
 * copy tries to write the same row, and only the one that succeeds does the work.
 */
@Component
public class Jobs {

    private final JdbcClient jdbc;

    Jobs(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** True for the one caller that gets to run this job for this period ("2026-W46", "2026-11-10"). */
    public boolean claim(String job, String period) {
        return jdbc.sql("insert into job_runs (job, period) values (:job, :period) on conflict do nothing")
                        .param("job", job)
                        .param("period", period)
                        .update()
                > 0;
    }

    /** Once a night: the record of runs from more than two months ago is of no use to anyone. */
    @Scheduled(cron = "0 40 3 * * *", zone = "UTC")
    void forgetOldRuns() {
        jdbc.sql("delete from job_runs where started_at < now() - interval '60 days'")
                .update();
    }
}
