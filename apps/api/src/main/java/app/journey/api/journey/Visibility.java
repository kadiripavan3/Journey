package app.journey.api.journey;

import app.journey.api.common.ApiProblem;
import app.journey.api.common.Codes;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/** Who may see a journey: everyone, anyone with the link, or only the people who write in it. The rule itself is in Rules. */
public enum Visibility {
  PUBLIC, UNLISTED, PRIVATE;

  @JsonValue
  public String code() {
    return Codes.of(this);
  }

  @JsonCreator
  public static Visibility of(String code) {
    return Codes.parse(Visibility.class, code, () -> ApiProblem.badRequest("invalid_visibility", "Choose who can see it."));
  }

  /** From a database column. */
  public static Visibility read(String code) {
    return Codes.read(Visibility.class, code);
  }
}
