package app.journey.api.journey;

import java.util.UUID;

/** Announced when a friend accepts an invitation to a shared journey. Notifications listen for it. */
public record FriendJoined(UUID journeyId, UUID friendId) {}
