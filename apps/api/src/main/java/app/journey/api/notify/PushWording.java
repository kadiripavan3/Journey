package app.journey.api.notify;

import app.journey.api.notify.OutboxStore.Due;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * What each push says and where it opens. The title is the journey's name where there is one, so the lock
 * screen reads like the story it belongs to; the sentence under it says who did what, in plain words.
 */
@Component
class PushWording {

    record Wording(String title, String body, String url) {}

    private static final String APP = "Journey";

    private final OutboxStore outbox;

    PushWording(OutboxStore outbox) {
        this.outbox = outbox;
    }

    Wording of(Due due) {
        String who = due.actorName() == null ? "Someone" : firstName(due.actorName());
        String journey = due.journeyTitle() == null ? APP : due.journeyTitle();
        String entry = due.entryTitle() == null || due.entryTitle().isBlank() ? "an entry" : quote(due.entryTitle());
        String journeyPath = "/journey/" + due.journeyId();
        return switch (due.kind()) {
            case NEW_ENTRIES -> new Wording(journey, newEntries(due, who), journeyPath + "/timeline");
            case JOURNEY_COMPLETED ->
                new Wording(journey, who + " completed the journey. See how it ended.", journeyPath + "/recap");
            case LIKES ->
                new Wording(
                        journey,
                        due.count() > 1
                                ? "%s and %s liked %s.".formatted(who, others(due.count() - 1), entry)
                                : "%s liked %s.".formatted(who, entry),
                        "/entry/" + due.entryId());
            case COMMENT ->
                new Wording(
                        journey,
                        "%s commented on %s: %s".formatted(who, entry, words(due.text())),
                        "/entry/" + due.entryId() + "?comments=1");
            case REPLY ->
                new Wording(
                        journey,
                        "%s replied to your comment: %s".formatted(who, words(due.text())),
                        "/entry/" + due.entryId() + "?comments=1");
            case JOURNEY_FOLLOW ->
                new Wording(journey, who + " started following your journey.", "/profile/" + due.actorUsername());
            case PROFILE_FOLLOW -> new Wording(APP, who + " started following you.", "/profile/" + due.actorUsername());
            case INVITATION ->
                new Wording(journey, who + " invited you to add to this journey.", "/invitation/" + due.journeyId());
            case FRIEND_JOINED -> new Wording(journey, who + " joined your journey.", journeyPath + "/people");
            case REMINDER -> new Wording(journey, due.text(), journeyPath + "/add");
            case WEEKLY_DIGEST -> new Wording("This week in the journeys you follow", due.text(), "/digest");
            case JOURNEY_PAUSED ->
                new Wording(
                        journey,
                        "Paused after 30 quiet days. Add an entry whenever you're ready and it picks up again.",
                        journeyPath);
        };
    }

    /** "Maya posted Day 23: “Roads that look like rivers”", or for a burst "Maya added 3 entries: A, B and C." */
    private String newEntries(Due due, String who) {
        if (due.count() <= 1) {
            String label = due.entryLabel() == null ? "an entry" : due.entryLabel();
            return due.entryTitle() == null || due.entryTitle().isBlank()
                    ? "%s posted %s.".formatted(who, label)
                    : "%s posted %s: %s".formatted(who, label, quote(due.entryTitle()));
        }
        List<String> titles = outbox.entryTitlesSince(due.journeyId(), due.userId(), due.createdAt(), 3).stream()
                .filter(title -> title != null && !title.isBlank())
                .toList();
        String added = "%s added %d entries".formatted(who, due.count());
        return titles.isEmpty() ? added + "." : added + ": " + list(titles) + ".";
    }

    /** "A", "A and B", "A, B and C". */
    static String list(List<String> items) {
        if (items.size() == 1) {
            return items.get(0);
        }
        return String.join(", ", items.subList(0, items.size() - 1)) + " and " + items.get(items.size() - 1);
    }

    private static String others(int count) {
        return count == 1 ? "1 other" : count + " others";
    }

    private static String quote(String text) {
        return "“" + text.trim() + "”";
    }

    /** Someone's words, short enough for a lock screen. */
    private static String words(String text) {
        if (text == null || text.isBlank()) {
            return "";
        }
        String oneLine = text.replaceAll("\\s+", " ").trim();
        return quote(oneLine.length() > 100 ? oneLine.substring(0, 99).trim() + "…" : oneLine);
    }

    private static String firstName(String displayName) {
        String trimmed = displayName.trim();
        int space = trimmed.indexOf(' ');
        return space > 0 ? trimmed.substring(0, space) : trimmed;
    }
}
