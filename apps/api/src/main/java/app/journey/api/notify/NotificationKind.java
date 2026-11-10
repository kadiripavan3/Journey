package app.journey.api.notify;

import app.journey.api.common.Codes;

/** What a push can be about. Each kind follows one switch in the person's notification settings. */
public enum NotificationKind {
    NEW_ENTRIES,
    JOURNEY_COMPLETED,
    LIKES,
    COMMENT,
    REPLY,
    JOURNEY_FOLLOW,
    PROFILE_FOLLOW,
    INVITATION,
    FRIEND_JOINED,
    REMINDER,
    WEEKLY_DIGEST,
    JOURNEY_PAUSED;

    public String code() {
        return Codes.of(this);
    }

    /** From a database column. */
    public static NotificationKind read(String code) {
        return Codes.read(NotificationKind.class, code);
    }
}
