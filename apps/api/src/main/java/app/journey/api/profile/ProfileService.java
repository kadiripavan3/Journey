package app.journey.api.profile;

import app.journey.api.common.ApiProblem;
import app.journey.api.media.MediaService;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The rules for profiles: which usernames are allowed, and that each belongs to one person. */
@Service
public class ProfileService {

    static final int MAX_INTERESTS = 20;

    private final ProfileStore profiles;
    private final MediaService media;

    ProfileService(ProfileStore profiles, MediaService media) {
        this.profiles = profiles;
        this.media = media;
    }

    /** The address of a profile's picture, or null when it has none. */
    public String avatarUrl(Profile profile) {
        return media.urlFor(profile.avatarKey());
    }

    public Optional<Profile> find(UUID userId) {
        return profiles.find(userId);
    }

    /** Empty when the name is free for this person; otherwise why it can't be used. */
    public Optional<String> whyUnavailable(String username, UUID askingUserId) {
        Optional<String> problem = Usernames.problemWith(username);
        if (problem.isPresent()) {
            return problem;
        }
        return profiles.usernameTaken(username, askingUserId)
                ? Optional.of("That name is taken. Try another.")
                : Optional.empty();
    }

    /** Creates the profile the first time, and updates it after that. */
    @Transactional
    public Profile save(
            UUID userId,
            String rawUsername,
            String displayName,
            String bio,
            String link,
            List<String> interests,
            UUID avatarMediaId,
            boolean removeAvatar,
            boolean ageConfirmed) {
        String username = Usernames.normalize(rawUsername);
        Usernames.problemWith(username).ifPresent(reason -> {
            throw ApiProblem.badRequest("invalid_username", reason);
        });
        if (profiles.usernameTaken(username, userId)) {
            throw taken();
        }
        Optional<Profile> current = profiles.find(userId);
        if (current.isEmpty() && !ageConfirmed) {
            throw ApiProblem.badRequest(
                    "age_required", "Journey is for people aged 13 and over. Confirm your age to continue.");
        }
        // Fields the request leaves out stay as they are, so a screen can save just what it shows.
        List<String> nextInterests = interests == null
                ? current.map(Profile::interests).orElse(List.of())
                : interests.stream()
                        .map(String::trim)
                        .filter(i -> !i.isEmpty())
                        .distinct()
                        .limit(MAX_INTERESTS)
                        .toList();
        UUID avatar = removeAvatar
                ? null
                : avatarMediaId != null
                        ? avatarMediaId
                        : current.map(Profile::avatarMediaId).orElse(null);
        if (avatarMediaId != null) {
            media.requireOwnShowable(avatarMediaId, userId);
        }
        try {
            profiles.save(
                    userId,
                    username,
                    displayName.trim(),
                    bio == null ? "" : bio.trim(),
                    blankToNull(link),
                    nextInterests,
                    avatar);
        } catch (DuplicateKeyException e) {
            // Two people asked for the same name at the same moment; the database's unique rule decided.
            throw taken();
        }
        if (current.isEmpty()) {
            profiles.confirmAge(userId);
        }
        return profiles.find(userId).orElseThrow();
    }

    private static ApiProblem taken() {
        return ApiProblem.conflict("username_taken", "That name is taken. Try another.");
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
