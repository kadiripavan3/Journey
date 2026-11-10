package app.journey.api.media;

/**
 * The look every photo and every clip gets before anyone but its owner can see it. The media package asks;
 * the moderation package answers (with the automatic check, when one is switched on).
 */
public interface PhotoCheck {

    enum Outcome {
        /** Looked at, nothing to hold. */
        CLEAN,
        /** Looked at, and a person should see it before others do. */
        FLAGGED,
        /** The check refuses this picture (it can't read it). Trying again won't help, so a person looks. */
        UNREADABLE,
        /** Nobody looked: the check couldn't be reached. It is tried again later; the picture is shown meanwhile. */
        NOT_LOOKED,
        /** Nobody looks, because the automatic check is switched off. */
        OFF
    }

    /** What came of it. The reason is for the reviewer, never for the owner. */
    record Result(Outcome outcome, String reason) {

        public static Result of(Outcome outcome) {
            return new Result(outcome, null);
        }

        /** True when the picture is hidden from everyone but its owner until a reviewer has looked. */
        public boolean held() {
            return outcome == Outcome.FLAGGED || outcome == Outcome.UNREADABLE;
        }

        /** True when the question is settled: the check doesn't need to look again. */
        public boolean settled() {
            return outcome != Outcome.NOT_LOOKED && outcome != Outcome.OFF;
        }

        /** Of two results for the same thing (two frames of a clip), the one that matters more. */
        public Result worseOf(Result other) {
            return severity(other) > severity(this) ? other : this;
        }

        private static int severity(Result result) {
            return switch (result.outcome) {
                case FLAGGED -> 4;
                case UNREADABLE -> 3;
                case NOT_LOOKED -> 2;
                case OFF -> 1;
                case CLEAN -> 0;
            };
        }
    }

    /** Looks at one picture: a JPEG, at most 800 pixels on its long side. Never throws. */
    Result look(byte[] jpeg);
}
