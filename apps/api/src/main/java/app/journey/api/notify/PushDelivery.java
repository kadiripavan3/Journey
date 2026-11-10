package app.journey.api.notify;

import app.journey.api.common.Jobs;
import app.journey.api.notify.OutboxStore.Due;
import app.journey.api.notify.PushSender.Handed;
import app.journey.api.notify.PushSender.Outcome;
import app.journey.api.notify.PushWording.Wording;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Sends the pushes that are due. It runs every half minute in every copy of the API, in three short steps:
 *
 * <ol>
 *   <li><b>Take.</b> In one transaction: lock the messages that are due, check each again (the person may have
 *       switched that kind off, blocked the other person, lost sight of the journey, or have no phone left),
 *       word the ones that may go, and mark them as being sent. Two copies never take the same message.
 *   <li><b>Hand over.</b> With no transaction open, so no database connection waits on another company's
 *       server: one call to the push service per hundred pushes.
 *   <li><b>Note the answer.</b> In a transaction per call: the messages of a call that worked are sent; the
 *       messages of a call that failed go back to be tried later. Only the failed call's, so nobody gets a
 *       push twice because a later call failed.
 * </ol>
 *
 * <p>If the API stops between the second and third step, those messages stay "being sent"; after a quarter of
 * an hour they are tried again. That is the one case in which a push can arrive twice.
 */
@Component
public class PushDelivery {

    private static final Logger log = LoggerFactory.getLogger(PushDelivery.class);
    static final int AT_ONCE = 100;
    static final int TRIES = 5;
    /** A person's newest phones get the push; nobody has more than a handful. */
    static final int PHONES_EACH = 10;
    /** How long a message may stay "being sent" before it is taken to be stuck. */
    static final Duration STUCK_AFTER = Duration.ofMinutes(15);
    /** The push service knows what became of a push a few minutes after taking it, and for about a day. */
    static final Duration ASK_AFTER = Duration.ofMinutes(15);

    static final Duration ANSWERS_KEPT = Duration.ofHours(24);
    static final int TICKETS_AT_ONCE = 900;

    /** One message for one person, worded, with the phones it goes to. */
    private record Ready(UUID id, List<PushMessage> pushes) {}

    private final OutboxStore outbox;
    private final DeviceStore devices;
    private final PushWording wording;
    private final PushSender sender;
    private final TransactionTemplate transaction;
    private final Jobs jobs;

    PushDelivery(
            OutboxStore outbox,
            DeviceStore devices,
            PushWording wording,
            PushSender sender,
            TransactionTemplate transaction,
            Jobs jobs) {
        this.outbox = outbox;
        this.devices = devices;
        this.wording = wording;
        this.sender = sender;
        this.transaction = transaction;
        this.jobs = jobs;
    }

    @Scheduled(
            initialDelayString = "${journey.push.deliver-every:PT30S}",
            fixedDelayString = "${journey.push.deliver-every:PT30S}")
    void everyHalfMinute() {
        int stuck = putBackStuck();
        if (stuck > 0) {
            log.warn("{} pushes were taken but never marked as sent; they will be tried again.", stuck);
        }
        // Keep going while there is a full batch waiting, but never hog the scheduler.
        for (int round = 0; round < 20 && deliverDue() == AT_ONCE; round++) {
            log.debug("More pushes are waiting.");
        }
    }

    /** Sends one batch of the pushes that are due. Returns how many messages it handled (sent, dropped or put back). */
    public int deliverDue() {
        List<Ready> ready = new ArrayList<>();
        Integer taken = transaction.execute(status -> take(ready));
        for (List<Ready> call : calls(ready)) {
            List<UUID> ids = call.stream().map(Ready::id).toList();
            List<PushMessage> pushes =
                    call.stream().flatMap(one -> one.pushes().stream()).toList();
            Handed handed;
            try {
                handed = sender.send(pushes);
            } catch (RuntimeException unreachable) {
                log.warn(
                        "Couldn't hand {} pushes to the push service; they will be tried again: {}",
                        ids.size(),
                        unreachable.toString());
                outbox.retryLater(ids, TRIES);
                continue;
            }
            transaction.executeWithoutResult(status -> {
                outbox.markSent(ids);
                devices.forget(handed.gone());
                devices.remember(handed.tickets());
            });
        }
        return taken == null ? 0 : taken;
    }

    /** Step one. Fills {@code ready} with the messages to hand over and returns how many were looked at. */
    private int take(List<Ready> ready) {
        List<Due> due = outbox.lockDue(AT_ONCE);
        if (due.isEmpty()) {
            return 0;
        }
        Map<UUID, List<String>> tokens = devices.tokensOf(due.stream()
                .filter(Due::deliverable)
                .map(Due::userId)
                .distinct()
                .toList());
        List<UUID> dropped = new ArrayList<>();
        for (Due one : due) {
            List<String> phones = tokens.getOrDefault(one.userId(), List.of());
            if (!one.deliverable() || one.kind() == null || phones.isEmpty()) {
                dropped.add(one.id());
                continue;
            }
            Wording words;
            try {
                words = wording.of(one);
            } catch (RuntimeException unwordable) {
                // One message that can't be put into words must not hold up every other one, every half minute.
                log.error(
                        "Push {} ({}) couldn't be worded and is dropped: {}",
                        one.id(),
                        one.kind(),
                        unwordable.toString());
                dropped.add(one.id());
                continue;
            }
            ready.add(new Ready(
                    one.id(),
                    phones.stream()
                            .limit(PHONES_EACH)
                            .map(phone -> new PushMessage(phone, words.title(), words.body(), words.url(), one.kind()))
                            .toList()));
        }
        outbox.markSkipped(dropped);
        outbox.markSending(ready.stream().map(Ready::id).toList());
        return due.size();
    }

    /** Groups messages into calls of at most a hundred pushes, never splitting one person's message over two calls. */
    private static List<List<Ready>> calls(List<Ready> ready) {
        List<List<Ready>> calls = new ArrayList<>();
        List<Ready> call = new ArrayList<>();
        int size = 0;
        for (Ready one : ready) {
            if (size + one.pushes().size() > PushSender.PER_CALL && !call.isEmpty()) {
                calls.add(call);
                call = new ArrayList<>();
                size = 0;
            }
            call.add(one);
            size += one.pushes().size();
        }
        if (!call.isEmpty()) {
            calls.add(call);
        }
        return calls;
    }

    /** Messages taken long ago and never marked as sent go back to be tried again. Returns how many. */
    public int putBackStuck() {
        return outbox.putBackStuck(STUCK_AFTER, TRIES);
    }

    /**
     * Asks the push service what became of the pushes it accepted a while ago, and forgets the phones it says
     * no longer exist. Every quarter of an hour, in one copy of the API.
     */
    @Scheduled(cron = "${journey.push.outcomes-cron:0 7/15 * * * *}", zone = "UTC")
    void everyQuarterHour() {
        jobs.run("push_outcomes", Instant.now().truncatedTo(ChronoUnit.MINUTES).toString(), this::readOutcomes);
    }

    /** Returns how many phones were forgotten. */
    public int readOutcomes() {
        Map<String, String> waiting = devices.ticketsOlderThan(ASK_AFTER, TICKETS_AT_ONCE);
        int forgotten = 0;
        if (!waiting.isEmpty()) {
            Outcome outcome = sender.outcomes(waiting.keySet());
            List<String> gone = outcome.gone().stream().map(waiting::get).toList();
            devices.forget(gone);
            devices.forgetTickets(outcome.answered());
            forgotten = gone.size();
        }
        devices.forgetTicketsOlderThan(ANSWERS_KEPT);
        return forgotten;
    }

    /** Once a night: forget pushes that were sent or dropped more than a month ago. */
    @Scheduled(cron = "${journey.push.cleanup-cron:0 50 3 * * *}", zone = "UTC")
    void nightly() {
        jobs.run("push_cleanup", LocalDate.now(ZoneOffset.UTC).toString(), () -> {
            int removed = outbox.forgetOlderThan(30);
            if (removed > 0) {
                log.info("Forgot {} old pushes.", removed);
            }
        });
    }
}
