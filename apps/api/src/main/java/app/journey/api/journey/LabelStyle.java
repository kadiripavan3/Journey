package app.journey.api.journey;

import app.journey.api.common.ApiProblem;
import app.journey.api.common.Codes;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/** How a journey counts its entries: by the day they happened (Day 14) or by their place in the story (Part 3). */
public enum LabelStyle {
  DAY, PART;

  @JsonValue
  public String code() {
    return Codes.of(this);
  }

  @JsonCreator
  public static LabelStyle of(String code) {
    return Codes.parse(LabelStyle.class, code, () -> ApiProblem.badRequest("invalid_label_style", "Choose days or parts."));
  }

  /** From a database column. */
  public static LabelStyle read(String code) {
    return Codes.read(LabelStyle.class, code);
  }
}
