package app.journey.api.entry;

import java.util.UUID;

/** Announced after an entry is added. Notifications listen for it; in local mode the sample creators do too. */
public record EntryAdded(UUID entryId, UUID journeyId, UUID authorId) {}
