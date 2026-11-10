package app.journey.api.moderation;

import app.journey.api.common.Codes;

/** How a report ended. */
public enum ReportOutcome {
    DISMISSED,
    REMOVED;

    public String code() {
        return Codes.of(this);
    }
}
