package app.journey.api.journey;

import java.util.UUID;

/** Announced when a journey pauses by itself after 30 quiet days. Notifications listen for it, to tell its owner once. */
public record JourneyAutoPaused(UUID journeyId, UUID ownerId) {}
