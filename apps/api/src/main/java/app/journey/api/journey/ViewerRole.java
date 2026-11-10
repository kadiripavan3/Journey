package app.journey.api.journey;

import app.journey.api.common.Codes;
import com.fasterxml.jackson.annotation.JsonValue;

/** What the person looking is to a shared journey. */
public enum ViewerRole {
    OWNER,
    FRIEND,
    INVITED,
    NONE;

    @JsonValue
    public String code() {
        return Codes.of(this);
    }
}
