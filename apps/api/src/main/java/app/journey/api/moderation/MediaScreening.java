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

    /**
     * Looks at one photo.
     *
     * @param jpeg the photo as a JPEG, at most 800 pixels on its long side (the medium size made at upload)
     */
    Verdict screen(byte[] jpeg);
}
