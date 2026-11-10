package app.journey.api.moderation;

/**
 * The automatic check every uploaded photo goes through. It only decides whether a person should look at the
 * photo before others see it; it never removes anything by itself.
 */
public interface MediaScreening {

    /** What the check found. A flagged photo is held for a reviewer; the reason is for the reviewer, not for the owner. */
    record Verdict(boolean flagged, String reason) {

        public static Verdict fine() {
            return new Verdict(false, null);
        }

        public static Verdict flag(String reason) {
            return new Verdict(true, reason);
        }
    }

    /** The check looked at the bytes and says they are not a picture it can judge. Trying again won't change that. */
    class UnreadablePhoto extends RuntimeException {
        private static final long serialVersionUID = 1L;

        public UnreadablePhoto(String why) {
            super(why);
        }
    }

    /**
     * Looks at one photo, or one still frame of a clip.
     *
     * @param jpeg the picture as a JPEG, at most 800 pixels on its long side
     * @throws UnreadablePhoto when the check refuses the picture itself
     * @throws RuntimeException when the check couldn't be reached (it is tried again later)
     */
    Verdict screen(byte[] jpeg);
}
