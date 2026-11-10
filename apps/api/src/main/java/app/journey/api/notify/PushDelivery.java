package app.journey.api.notify;

import app.journey.api.common.Jobs;
import app.journey.api.notify.OutboxStore.Due;
import app.journey.api.notify.PushWording.Wording;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Sends the pushes that are due. It runs every half minute in every copy of the API; each run locks the rows
 * it takes, so two copies never send the same message.
 *
 * <p>Just before sending, each message is checked again: the person may have switched that kind off, blocked
 * the other person, lost sight of the journey, or have no phone left to push to. Those are dropped quietly.
 */
@Component
public class PushDelivery {

    private static final Logger log = LoggerFactory.getLogger(PushDelivery.class);
    static final int AT_ONCE = 100;
    static final int TRIES = 5;

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
        // Keep going while there is a full batch waiting, but never hog the scheduler.
        for (int round = 0; round < 20 && deliverDue() == AT_ONCE; round++) {
            log.debug("More pushes are waiting.");
        }
    }

    /** Sends one batch of the pushes that are due. Returns how many rows it handled (sent, dropped or put back). */
    public int deliverDue() {
        Integer handled = transaction.execute(status -> {
            List<Due> due = outbox.lockDue(AT_ONCE);
            if (due.isEmpty()) {
                return 0;
            }
            Map<UUID, List<String>> tokens = devices.tokensOf(due.stream()
                    .filter(Due::deliverable)
                    .map(Due::userId)
                    .distinct()
                    .toList());
            List<PushMessage> messages = new ArrayList<>();
            List<UUID> sending = new ArrayList<>();
            List<UUID> dropped = new ArrayList<>();
            for (Due one : due) {
                List<String> phones = tokens.getOrDefault(one.userId(), List.of());
                if (!one.deliverable() || phones.isEmpty()) {
                    dropped.add(one.id());
                    continue;
                }
                Wording words = wording.of(one);
                phones.forEach(phone ->
                        messages.add(new PushMessage(phone, words.title(), words.body(), words.url(), one.kind())));
                sending.add(one.id());
            }
            outbox.markSkipped(dropped);
            if (!sending.isEmpty()) {
                try {
                    Set<String> gone = sender.send(messages);
                    devices.forget(gone);
                    outbox.markSent(sending);
                } catch (RuntimeException unreachable) {
                    log.warn(
                            "Couldn't reach the push service; {} pushes will be tried again: {}",
                            sending.size(),
                            unreachable.toString());
                    outbox.retryLater(sending, TRIES);
                }
            }
            return due.size();
        });
        return handled == null ? 0 : handled;
    }

    /** Once a night: forget pushes that were sent or dropped more than a month ago. */
    @Scheduled(cron = "${journey.push.cleanup-cron:0 50 3 * * *}", zone = "UTC")
    void nightly() {
        if (jobs.claim("push_cleanup", LocalDate.now(ZoneOffset.UTC).toString())) {
            int removed = outbox.forgetOlderThan(30);
            if (removed > 0) {
                log.info("Forgot {} old pushes.", removed);
            }
        }
    }
}
