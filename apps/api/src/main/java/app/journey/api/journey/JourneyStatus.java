package app.journey.api.journey;

import app.journey.api.common.ApiProblem;
import app.journey.api.common.Codes;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/** Where a journey stands. A completed journey takes no new entries. */
public enum JourneyStatus {
    ACTIVE,
    PAUSED,
    COMPLETED;

    @JsonValue
    public String code() {
        return Codes.of(this);
    }

    @JsonCreator
    public static JourneyStatus of(String code) {
        return Codes.parse(
                JourneyStatus.class,
                code,
                () -> ApiProblem.badRequest(
                        "invalid_status", "A journey can be paused or resumed here. Completing it has its own step."));
    }

    /** From a database column. */
    public static JourneyStatus read(String code) {
        return Codes.read(JourneyStatus.class, code);
    }
}
