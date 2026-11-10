package app.journey.api.account;

import app.journey.api.common.ApiProblem;
import app.journey.api.common.Codes;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/** What a report is about. */
public enum ReportTarget {
  JOURNEY, ENTRY, COMMENT, PROFILE;

  @JsonValue
  public String code() {
    return Codes.of(this);
  }

  @JsonCreator
  public static ReportTarget of(String code) {
    return Codes.parse(ReportTarget.class, code, () -> ApiProblem.badRequest("invalid_report", "Choose what you're reporting."));
  }
}
