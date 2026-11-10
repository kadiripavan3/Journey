package app.journey.api.moderation;

import app.journey.api.common.Codes;

/** How a request to delete an account, made on the web, ended. */
public enum DeletionOutcome {
    /** The account was deleted. */
    DELETED,
    /** Nobody signs in with the address that was given. */
    NO_ACCOUNT,
    /** Closed without deleting: the person didn't answer, or it wasn't them. */
    CLOSED;

    public String code() {
        return Codes.of(this);
    }
}
