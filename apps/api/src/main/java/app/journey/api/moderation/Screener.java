package app.journey.api.moderation;

import app.journey.api.media.PhotoCheck;
import app.journey.api.moderation.MediaScreening.UnreadablePhoto;
import app.journey.api.moderation.MediaScreening.Verdict;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

/**
 * Answers the media package's question "may others see this?" with the automatic check, whichever one is
 * switched on. It never throws: when the check can't be reached, the answer is "nobody looked", and the
 * picture is looked at again later.
 */
@Component
class Screener implements PhotoCheck {

    private static final Logger log = LoggerFactory.getLogger(Screener.class);

    private final ObjectProvider<MediaScreening> screening;

    Screener(ObjectProvider<MediaScreening> screening) {
        this.screening = screening;
    }

    @Override
    public Result look(byte[] jpeg) {
        MediaScreening check = screening.getIfAvailable();
        if (check == null) {
            return Result.of(Outcome.OFF);
        }
        try {
            Verdict verdict = check.screen(jpeg);
            return verdict.flagged() ? new Result(Outcome.FLAGGED, verdict.reason()) : Result.of(Outcome.CLEAN);
        } catch (UnreadablePhoto refused) {
            // Asking again would get the same answer, so a person looks instead.
            return new Result(
                    Outcome.UNREADABLE, "The automatic check couldn't read this picture: " + refused.getMessage());
        } catch (RuntimeException unreachable) {
            log.error(
                    "The automatic photo check couldn't be reached; this one will be looked at later: {}",
                    unreachable.toString());
            return Result.of(Outcome.NOT_LOOKED);
        }
    }
}
