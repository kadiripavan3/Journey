package app.journey.api.digest;

import app.journey.api.common.Jobs;
import app.journey.api.digest.DigestService.DigestResponse;
import app.journey.api.digest.DigestStore.Due;
import app.journey.api.notify.EmailOutbox;
import app.journey.api.notify.Outbox;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Sends the weekly digest: a push that opens the digest page, and an email for people who asked for one.
 *
 * <p>It goes out on each person's own Sunday evening (from six o'clock, by the time zone of the phone they
 * used last; people without a phone on record count as UTC), not at one moment for the whole world. The job
 * runs every hour and takes whoever's turn it is. "Has had this week's" is written per person, in the same
 * transaction as the message, so a run that is cut short (a deploy) is simply continued by the next one, and
 * nobody gets it twice. A week with nothing new sends nothing.
 */
@Component
public class DigestJob {

    private static final Logger log = LoggerFactory.getLogger(DigestJob.class);

    private final DigestStore digests;
    private final DigestService weeks;
    private final DigestMailer mailer;
    private final Outbox outbox;
    private final EmailOutbox emails;
    private final JdbcClient jdbc;
    private final TransactionTemplate transaction;
    private final Jobs jobs;

    DigestJob(
            DigestStore digests,
            DigestService weeks,
            DigestMailer mailer,
            Outbox outbox,
            EmailOutbox emails,
            JdbcClient jdbc,
            TransactionTemplate transaction,
            Jobs jobs) {
        this.digests = digests;
        this.weeks = weeks;
        this.mailer = mailer;
        this.outbox = outbox;
        this.emails = emails;
        this.jdbc = jdbc;
        this.transaction = transaction;
        this.jobs = jobs;
    }

    @Scheduled(cron = "${journey.digest.cron:0 0 * * * *}", zone = "UTC")
    void hourly() {
        Instant now = Instant.now();
        jobs.run("weekly_digest", now.truncatedTo(ChronoUnit.HOURS).toString(), () -> {
            int told = sendDue(now);
            if (told > 0) {
                log.info("The weekly digest went to {} people.", told);
            }
        });
    }

    /**
     * Sends the digest to everyone whose Sunday evening it is at {@code now} and who hasn't had this week's.
     * Returns how many people got one.
     */
    public int sendDue(Instant now) {
        Map<UUID, String> turn = whoseTurn(now);
        if (turn.isEmpty()) {
            return 0;
        }
        Map<UUID, Due> news = digests.due().stream().collect(Collectors.toMap(Due::userId, Function.identity()));
        int told = 0;
        for (Map.Entry<UUID, String> person : turn.entrySet()) {
            Due due = news.get(person.getKey());
            Boolean sent = transaction.execute(status -> send(person.getKey(), person.getValue(), due));
            told += Boolean.TRUE.equals(sent) ? 1 : 0;
        }
        return told;
    }

    /** One person, in one transaction: the mark that they have had this week's, the push and the email. */
    private boolean send(UUID userId, String week, Due due) {
        boolean first = jdbc.sql("insert into digest_sent (user_id, week) values (:user, :week) on conflict do nothing")
                        .param("user", userId)
                        .param("week", week)
                        .update()
                > 0;
        if (!first || due == null) {
            return false; // had it already, or nothing new this week
        }
        outbox.weeklyDigest(userId, DigestMailer.words(due.entries(), due.journeysMoved()));
        if (due.byEmail()) {
            DigestResponse theirWeek = weeks.thisWeek(userId);
            mailer.write(userId, theirWeek).ifPresent(letter -> emails.queue(userId, letter));
        }
        return true;
    }

    /**
     * The people whose own Sunday evening it is (from 18:00 on Sunday until Monday noon, so an hour that was
     * missed is caught up), who want the digest some way, and who haven't had this week's. For each, the name
     * of their week ("2026-W46").
     */
    private Map<UUID, String> whoseTurn(Instant now) {
        record Turn(UUID userId, String week) {}
        return jdbc
                .sql("""
                    select person, to_char(local_time - interval '18 hours', 'IYYY-"W"IW') as week from (
                      select p.id as person, (cast(:now as timestamptz) at time zone coalesce(z.time_zone, 'UTC')) as local_time
                      from profiles p left join settings s on s.user_id = p.id
                      left join lateral (select d.time_zone from devices d where d.user_id = p.id
                                         order by d.seen_at desc limit 1) z on true
                      where coalesce(s.weekly_digest, true) or coalesce(s.digest_email, false)) t
                    where ((extract(isodow from local_time) = 7 and extract(hour from local_time) >= 18)
                        or (extract(isodow from local_time) = 1 and extract(hour from local_time) < 12))
                      and not exists (select 1 from digest_sent ds where ds.user_id = person
                            and ds.week = to_char(local_time - interval '18 hours', 'IYYY-"W"IW'))
                    """)
                .param("now", java.sql.Timestamp.from(now))
                .query((rs, n) -> new Turn(rs.getObject("person", UUID.class), rs.getString("week")))
                .list()
                .stream()
                .collect(Collectors.toMap(Turn::userId, Turn::week));
    }
}
