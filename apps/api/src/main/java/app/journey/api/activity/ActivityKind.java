package app.journey.api.activity;

import app.journey.api.common.Codes;
import com.fasterxml.jackson.annotation.JsonValue;

/** The kinds of lines in Activity. */
public enum ActivityKind {
    NEW_ENTRIES,
    JOURNEY_COMPLETED,
    LIKES,
    COMMENT,
    REPLY,
    JOURNEY_FOLLOW,
    PROFILE_FOLLOW,
    INVITATION,
    FRIEND_JOINED;

    @JsonValue
    public String code() {
        return Codes.of(this);
    }
}
