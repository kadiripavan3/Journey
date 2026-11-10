package app.journey.api.digest;

import app.journey.api.common.PublicUrls;
import app.journey.api.digest.DigestService.DigestJourneyResponse;
import app.journey.api.digest.DigestService.DigestResponse;
import app.journey.api.notify.EmailOutbox.Letter;
import app.journey.api.profile.Profile;
import app.journey.api.profile.ProfileStore;
import java.time.temporal.IsoFields;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.thymeleaf.context.Context;
import org.thymeleaf.spring6.SpringTemplateEngine;

/**
 * Writes the weekly digest as an email, from the same week the digest page in the app shows: the journeys
 * that moved, the newest entry of each, and the ones that were finished. Every link goes to a journey's
 * web page, which opens the app when it is installed.
 */
@Component
class DigestMailer {

    private final ProfileStore profiles;
    private final SpringTemplateEngine templates;
    private final PublicUrls urls;

    DigestMailer(ProfileStore profiles, SpringTemplateEngine templates, PublicUrls urls) {
        this.profiles = profiles;
        this.templates = templates;
        this.urls = urls;
    }

    /** "5 new entries in 3 journeys you follow." */
    static String words(int entryCount, int journeyCount) {
        return "%d new %s in %s you follow."
                .formatted(
                        entryCount,
                        entryCount == 1 ? "entry" : "entries",
                        journeyCount == 1 ? "a journey" : journeyCount + " journeys");
    }

    /** The email about one person's week, or empty when the week turned out to have nothing in it after all. */
    Optional<Letter> write(UUID userId, DigestResponse week) {
        if (week.journeys().isEmpty()) {
            return Optional.empty();
        }
        String name = profiles.find(userId)
                .map(Profile::displayName)
                .map(DigestMailer::firstName)
                .orElse("there");
        String subject = words(week.entryCount(), week.journeys().size());

        Context model = new Context();
        model.setVariable("name", name);
        model.setVariable("summary", subject);
        model.setVariable("week", week);
        model.setVariable("urls", urls);
        String html = templates.process("email/digest", model);

        StringBuilder text = new StringBuilder("Hi " + name + ",\n\nThis week in the journeys you follow: ")
                .append(subject)
                .append("\n");
        for (DigestJourneyResponse line : week.journeys()) {
            text.append("\n")
                    .append(line.journey().title())
                    .append(" (")
                    .append(line.newCount())
                    .append(" new)\n  ")
                    .append(line.latest().label())
                    .append(
                            line.latest().title().isBlank()
                                    ? ""
                                    : ": " + line.latest().title())
                    .append("\n  ")
                    .append(urls.to("/j/" + line.journey().id()))
                    .append("\n");
        }
        week.finished()
                .forEach(done -> text.append("\nCompleted this week: ")
                        .append(done.title())
                        .append("\n  ")
                        .append(urls.to("/j/" + done.id()))
                        .append("\n"));
        text.append(
                "\nYou get this because you switched on the weekly digest by email. Switch it off in the app: Settings, then Notifications.\n");

        String sendOnce = "digest-%s-%d-W%02d"
                .formatted(
                        userId,
                        week.to().get(IsoFields.WEEK_BASED_YEAR),
                        week.to().get(IsoFields.WEEK_OF_WEEK_BASED_YEAR));
        return Optional.of(new Letter("This week: " + subject, html, text.toString(), sendOnce));
    }

    private static String firstName(String displayName) {
        String trimmed = displayName.trim();
        int space = trimmed.indexOf(' ');
        return space > 0 ? trimmed.substring(0, space) : trimmed;
    }
}
