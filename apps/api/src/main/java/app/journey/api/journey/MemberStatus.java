package app.journey.api.journey;

import app.journey.api.common.ApiProblem;
import app.journey.api.common.Codes;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/** A friend on a shared journey: asked, or writing in it. */
public enum MemberStatus {
    INVITED,
    JOINED;

    @JsonValue
    public String code() {
        return Codes.of(this);
    }

    @JsonCreator
    public static MemberStatus of(String code) {
        return Codes.parse(
                MemberStatus.class,
                code,
                () -> ApiProblem.badRequest(
                        "invalid_member_status", "That isn't something a friend on a journey can be."));
    }

    /** From a database column. */
    public static MemberStatus read(String code) {
        return Codes.read(MemberStatus.class, code);
    }
}
