package app.journey.api.people;

import java.util.UUID;

/** Announced when someone starts following a person. Notifications listen for it. */
public record PersonFollowed(UUID followerId, UUID followeeId) {}
