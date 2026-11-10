package app.journey.api.digest;

import java.util.UUID;

/** Delivers the weekly digest message: a push notification, and an email for people who asked for one. */
public interface DigestSender {

  void send(UUID userId, int entryCount, int journeyCount, boolean alsoByEmail);
}
