package app.journey.api.activity;

import app.journey.api.account.AccountService;
import app.journey.api.account.AccountService.SettingsResponse;
import app.journey.api.activity.ActivityStore.Line;
import app.journey.api.media.MediaService;
import app.journey.api.media.MediaSize;
import app.journey.api.people.PeopleService;
import app.journey.api.profile.PersonResponse;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The Activity inbox: the newest lines of the last 30 days, with the people and pictures that go with them. */
@Service
public class ActivityService {

    /** Activity shows the newest lines of the last 30 days, at most this many. */
    static final int TOTAL = 60;

    public record ActivityItemResponse(
            @Schema(description = "Stable for the same line, so the app can keep its place in a list")
            String id,

            ActivityKind kind,
            Instant at,

            @Schema(description = "True when it happened after the person last opened Activity")
            boolean isNew,

            @Schema(description = "Who did it, most recent first; at most two")
            List<PersonResponse> actors,

            @Schema(description = "How many people did it, for \"and 46 others\"")
            int actorCount,

            @Schema(description = "How many entries, for new_entries")
            int count,

            @Schema(nullable = true) UUID journeyId,
            @Schema(nullable = true) String journeyTitle,
            @Schema(nullable = true) UUID entryId,

            @Schema(nullable = true, description = "The entry's title, or the start of its text")
            String entryTitle,

            @Schema(nullable = true, description = "The words of a comment or reply")
            String text,

            @Schema(nullable = true) String thumbUrl,

            @Schema(description = "For profile_follow: true when the person already follows them back")
            boolean followsActor) {}

    public record ActivityResponse(
            List<ActivityItemResponse> items,
            @Schema(description = "How many lines are new") int newCount) {}

    private final ActivityStore activity;
    private final AccountService account;
    private final PeopleService people;
    private final MediaService media;

    ActivityService(ActivityStore activity, AccountService account, PeopleService people, MediaService media) {
        this.activity = activity;
        this.account = account;
        this.people = people;
        this.media = media;
    }

    /**
     * The inbox. A kind of notification the person has switched off in their settings is left out here too;
     * invitations always show, because they need an answer.
     */
    @Transactional(readOnly = true)
    public ActivityResponse inbox(UUID me) {
        SettingsResponse wants = account.settings(me);
        List<Line> lines = new ArrayList<>();
        if (wants.notifyNewEntries()) {
            lines.addAll(activity.newEntries(me));
        }
        if (wants.notifyCompleted()) {
            lines.addAll(activity.completedJourneys(me));
        }
        if (wants.notifyLikes()) {
            lines.addAll(activity.likes(me));
        }
        if (wants.notifyComments()) {
            lines.addAll(activity.comments(me));
        }
        if (wants.notifyFollowers()) {
            lines.addAll(activity.journeyFollows(me));
            lines.addAll(activity.profileFollows(me));
        }
        lines.addAll(activity.sharedJourneys(me));
        lines.sort(Comparator.comparing(Line::at).reversed());
        List<Line> shown = lines.subList(0, Math.min(lines.size(), TOTAL));

        Instant seenAt = activity.seenAt(me);
        Set<UUID> actorIds = new HashSet<>();
        shown.forEach(line -> actorIds.addAll(line.actors()));
        Map<UUID, PersonResponse> persons = people.persons(actorIds);
        Map<UUID, String> entryThumbs = activity.entryThumbs(shown.stream()
                .map(Line::entryId)
                .filter(Objects::nonNull)
                .distinct()
                .toList());
        Map<UUID, String> journeyThumbs = activity.journeyThumbs(shown.stream()
                .filter(l -> l.entryId() == null)
                .map(Line::journeyId)
                .filter(Objects::nonNull)
                .distinct()
                .toList());

        List<ActivityItemResponse> items = shown.stream()
                .map(l -> new ActivityItemResponse(
                        l.id(),
                        l.kind(),
                        l.at(),
                        l.at().isAfter(seenAt),
                        l.actors().stream()
                                .map(persons::get)
                                .filter(Objects::nonNull)
                                .toList(),
                        l.actorCount(),
                        l.count(),
                        l.journeyId(),
                        l.journeyTitle(),
                        l.entryId(),
                        l.entryTitle(),
                        l.text(),
                        media.urlFor(
                                l.entryId() != null ? entryThumbs.get(l.entryId()) : journeyThumbs.get(l.journeyId()),
                                MediaSize.SMALL),
                        l.followsActor()))
                .toList();
        return new ActivityResponse(
                items, (int) items.stream().filter(ActivityItemResponse::isNew).count());
    }

    @Transactional
    public void markSeen(UUID me) {
        activity.markSeen(me);
    }
}
