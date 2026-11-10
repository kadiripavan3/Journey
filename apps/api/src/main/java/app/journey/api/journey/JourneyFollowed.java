package app.journey.api.journey;

import java.util.UUID;

/** Announced when someone starts following a journey themselves (not through following its creator). Notifications listen for it. */
public record JourneyFollowed(UUID journeyId, UUID userId) {}
