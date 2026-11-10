package app.journey.api.profile;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

/** A person as shown next to their journeys, entries and comments. */
public record PersonResponse(UUID id, String username, String displayName, @Schema(nullable = true) String avatarUrl) {}
