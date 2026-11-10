package app.journey.api.profile;

import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

/** The rules for usernames, in one place: the API, the database check and the app all follow them. */
public final class Usernames {

  public static final String PATTERN = "^[a-z0-9._]{3,20}$";
  private static final Pattern VALID = Pattern.compile(PATTERN);

  /** Names that would confuse people or collide with addresses the app uses. */
  private static final Set<String> RESERVED =
      Set.of("admin", "journey", "support", "help", "official", "me", "settings", "discover", "activity", "about", "terms", "privacy", "join", "api");

  private Usernames() {}

  /** What a person typed, tidied: no leading @, lower case, no spaces around it. */
  public static String normalize(String raw) {
    String value = raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT);
    return value.startsWith("@") ? value.substring(1) : value;
  }

  /** Empty when the name is allowed; otherwise a plain sentence saying why not. */
  public static Optional<String> problemWith(String username) {
    if (username.length() < 3) {
      return Optional.of("Use at least 3 characters.");
    }
    if (username.length() > 20) {
      return Optional.of("Use 20 characters or fewer.");
    }
    if (!VALID.matcher(username).matches()) {
      return Optional.of("Use only letters, numbers, dots and underscores.");
    }
    if (username.startsWith(".") || username.endsWith(".") || username.contains("..")) {
      return Optional.of("Dots can't be first, last or doubled.");
    }
    if (RESERVED.contains(username)) {
      return Optional.of("That name is reserved. Try another.");
    }
    return Optional.empty();
  }
}
