package app.journey.api.journey;

import java.util.UUID;

/** Announced after someone is invited to a shared journey. Notifications listen for it; in local mode the sample creators do too. */
public record FriendInvited(UUID journeyId, UUID friendId) {}
