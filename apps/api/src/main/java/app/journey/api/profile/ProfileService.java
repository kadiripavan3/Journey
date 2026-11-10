package app.journey.api.profile;

import app.journey.api.common.ApiProblem;
import app.journey.api.media.MediaService;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProfileService {

  static final int MAX_INTERESTS = 20;

  private final ProfileRepository profiles;
  private final MediaService media;

  ProfileService(ProfileRepository profiles, MediaService media) {
    this.profiles = profiles;
    this.media = media;
  }

  /** The address of a profile's picture, or null when it has none. */
  public String avatarUrl(Profile profile) {
    if (profile.getAvatarMediaId() == null) {
      return null;
    }
    MediaService.MediaRow row = media.find(profile.getAvatarMediaId());
    return row == null ? null : media.urlFor(row.storageKey());
  }

  @Transactional(readOnly = true)
  public Optional<Profile> find(UUID userId) {
    return profiles.findById(userId);
  }

  /** Empty when the name is free for this person; otherwise why it can't be used. */
  @Transactional(readOnly = true)
  public Optional<String> whyUnavailable(String username, UUID askingUserId) {
    Optional<String> problem = Usernames.problemWith(username);
    if (problem.isPresent()) {
      return problem;
    }
    boolean taken =
        askingUserId == null
            ? profiles.existsByUsername(username)
            : profiles.existsByUsernameAndIdNot(username, askingUserId);
    return taken ? Optional.of("That name is taken. Try another.") : Optional.empty();
  }

  /** Creates the profile the first time, and updates it after that. */
  @Transactional
  public Profile save(UUID userId, String rawUsername, String displayName, String bio, String link, List<String> interests, UUID avatarMediaId, boolean removeAvatar) {
    String username = Usernames.normalize(rawUsername);
    Usernames.problemWith(username).ifPresent(reason -> {
      throw ApiProblem.badRequest("invalid_username", reason);
    });
    if (profiles.existsByUsernameAndIdNot(username, userId)) {
      throw taken();
    }
    String[] cleanInterests =
        interests == null
            ? new String[0]
            : interests.stream().map(String::trim).filter(i -> !i.isEmpty()).distinct().limit(MAX_INTERESTS).toArray(String[]::new);

    Profile profile = profiles.findById(userId).orElseGet(() -> new Profile(userId));
    // Fields the request leaves out stay as they are, so a screen can save just what it shows.
    String[] nextInterests = interests == null ? profile.getInterests() : cleanInterests;
    UUID avatar = removeAvatar ? null : avatarMediaId != null ? avatarMediaId : profile.getAvatarMediaId();
    if (avatarMediaId != null) {
      media.requireOwn(List.of(avatarMediaId), userId, "photo");
    }
    profile.update(username, displayName.trim(), bio == null ? "" : bio.trim(), blankToNull(link), nextInterests, avatar);
    try {
      return profiles.saveAndFlush(profile);
    } catch (DataIntegrityViolationException e) {
      // Two people asked for the same name at the same moment; the database's unique rule decided.
      throw taken();
    }
  }

  private static ApiProblem taken() {
    return ApiProblem.conflict("username_taken", "That name is taken. Try another.");
  }

  private static String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value.trim();
  }
}
