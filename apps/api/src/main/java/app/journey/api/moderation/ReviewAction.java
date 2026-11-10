package app.journey.api.moderation;

/** What a reviewer can do. The words are what the log on the reviewer's page says after the reviewer's name. */
public enum ReviewAction {
    DISMISSED_REPORT("dismissed a report"),
    REMOVED_REPORTED("removed reported content"),
    REMOVED_PERSON("removed a person's account"),
    RELEASED_PHOTO("released a photo"),
    REMOVED_PHOTO("removed a photo"),
    RELEASED_COMMENT("released a comment"),
    REMOVED_COMMENT("removed a comment"),
    DELETED_ACCOUNT("deleted an account at its owner's request"),
    FOUND_NO_ACCOUNT("closed a deletion request: nobody signs in with that address"),
    CLOSED_REQUEST("closed a deletion request without deleting");

    private final String words;

    ReviewAction(String words) {
        this.words = words;
    }

    public String words() {
        return words;
    }
}
