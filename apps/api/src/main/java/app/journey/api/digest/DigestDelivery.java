package app.journey.api.digest;

import app.journey.api.notify.EmailAddresses;
import app.journey.api.notify.EmailSender;
import app.journey.api.notify.Outbox;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * How the weekly digest reaches someone: as a push that opens the digest page, and also as an email for
 * people who switched that on. One person's email failing never stops the others'.
 */
@Component
class DigestDelivery implements DigestSender {

    private static final Logger log = LoggerFactory.getLogger(DigestDelivery.class);

    private final Outbox outbox;
    private final EmailAddresses addresses;
    private final EmailSender email;
    private final DigestMailer mailer;

    DigestDelivery(Outbox outbox, EmailAddresses addresses, EmailSender email, DigestMailer mailer) {
        this.outbox = outbox;
        this.addresses = addresses;
        this.email = email;
        this.mailer = mailer;
    }

    @Override
    public void send(UUID userId, int entryCount, int journeyCount, boolean alsoByEmail) {
        outbox.weeklyDigest(userId, words(entryCount, journeyCount));
        if (!alsoByEmail) {
            return;
        }
        try {
            addresses.of(userId).flatMap(to -> mailer.write(userId, to)).ifPresent(email::send);
        } catch (RuntimeException failed) {
            log.warn("The weekly digest email for {} wasn't sent: {}", userId, failed.toString());
        }
    }

    /** "5 new entries in 3 journeys you follow." */
    static String words(int entryCount, int journeyCount) {
        return "%d new %s in %s you follow."
                .formatted(
                        entryCount,
                        entryCount == 1 ? "entry" : "entries",
                        journeyCount == 1 ? "a journey" : journeyCount + " journeys");
    }
}
