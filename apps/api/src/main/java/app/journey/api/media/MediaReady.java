package app.journey.api.media;

import java.util.UUID;

/** An upload has been checked and can be used. Published inside the request that completed it. */
public record MediaReady(UUID mediaId, UUID ownerId, MediaKind kind, String storageKey) {}
