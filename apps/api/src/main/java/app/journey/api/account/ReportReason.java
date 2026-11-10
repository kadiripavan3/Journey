package app.journey.api.account;

import app.journey.api.common.ApiProblem;
import app.journey.api.common.Codes;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/** Why something is reported. */
public enum ReportReason {
  SPAM, HARASSMENT, NUDITY, VIOLENCE, IMPERSONATION, OTHER;

  @JsonValue
  public String code() {
    return Codes.of(this);
  }

  @JsonCreator
  public static ReportReason of(String code) {
    return Codes.parse(ReportReason.class, code, () -> ApiProblem.badRequest("invalid_reason", "Choose a reason."));
  }
}
