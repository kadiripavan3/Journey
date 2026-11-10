package app.journey.api.notify;

import app.journey.api.common.Codes;
import java.util.Optional;

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

    /** From a database column that may hold a kind a newer version of the API wrote. Empty for one this version doesn't know. */
    public static Optional<NotificationKind> known(String code) {
        try {
            return Optional.of(read(code));
        } catch (RuntimeException unknown) {
            return Optional.empty();
        }
    }
}
