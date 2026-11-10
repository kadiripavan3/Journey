package app.journey.api.moderation;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import org.springframework.stereotype.Component;

/** Writes a moment the way the reviewer's pages show it: "9 Nov, 14:02 UTC". Used from the page template. */
@Component("reviewTimes")
public class ReviewTimes {

    private static final DateTimeFormatter FORMAT =
            DateTimeFormatter.ofPattern("d MMM, HH:mm 'UTC'", Locale.ENGLISH).withZone(ZoneOffset.UTC);

    public String utc(Instant moment) {
        return moment == null ? "" : FORMAT.format(moment);
    }
}
