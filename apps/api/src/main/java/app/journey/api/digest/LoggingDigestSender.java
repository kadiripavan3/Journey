package app.journey.api.digest;

import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/** The stand-in until push and email are connected: the message is written to the log. */
@Component
class LoggingDigestSender implements DigestSender {

  private static final Logger log = LoggerFactory.getLogger(LoggingDigestSender.class);

  @Override
  public void send(UUID userId, int entryCount, int journeyCount, boolean alsoByEmail) {
    log.info("Weekly digest for {}: {} new {} in {} {}{}.", userId, entryCount, entryCount == 1 ? "entry" : "entries", journeyCount,
        journeyCount == 1 ? "journey" : "journeys", alsoByEmail ? " (also by email)" : "");
  }
}
