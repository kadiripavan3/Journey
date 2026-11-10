package app.journey.api.journey;

import java.util.UUID;

/** Announced when an owner completes a journey. Notifications listen for it. */
public record JourneyCompleted(UUID journeyId, UUID ownerId) {}
