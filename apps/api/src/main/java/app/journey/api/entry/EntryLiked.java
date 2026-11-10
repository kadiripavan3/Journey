package app.journey.api.entry;

import java.util.UUID;

/** Announced when someone likes an entry they hadn't liked before. Notifications listen for it. */
public record EntryLiked(UUID entryId, UUID userId) {}
