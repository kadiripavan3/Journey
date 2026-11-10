package app.journey.api.profile;

import java.util.List;
import java.util.UUID;

/** A person's public profile. Its id is the id of the signed-in user. */
public record Profile(
    UUID id, String username, String displayName, String bio, String link, UUID avatarMediaId, String avatarKey, List<String> interests) {}
