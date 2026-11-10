package app.journey.api.journey;

import app.journey.api.catalog.Catalog;
import app.journey.api.common.ApiProblem;
import app.journey.api.common.Keyset;
import app.journey.api.common.Page;
import app.journey.api.common.PublicUrls;
import app.journey.api.journey.JourneyStore.JourneyRow;
import app.journey.api.journey.JourneyStore.Shelf;
import app.journey.api.media.MediaService;
import app.journey.api.media.MediaSize;
import app.journey.api.people.PeopleService;
import app.journey.api.profile.PersonResponse;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The rules for journeys: who may see, change and follow them. */
@Service
public class JourneyService {

    static final int MAX_TAGS = 5;
    /** Discover only shows journeys with a cover and at least this many entries. */
    static final int DISCOVER_MIN_ENTRIES = 3;
    /** In "Trending now", a journey in a category the reader picked counts for this many times its score. */
    static final double INTEREST_BOOST = 1.5;
    /** In "New journeys", a journey in a category the reader picked is treated as this many days newer. */
    static final int INTEREST_HEAD_START_DAYS = 7;

    public record JourneyViewerResponse(
            boolean isOwner,
            boolean isFollowing,
            boolean canAddEntry,

            @Schema(description = "True when the viewer is a friend who joined this shared journey")
            boolean isMember,

            @Schema(
                    nullable = true,
                    description =
                            "When the viewer last read this journey. Entries created after it are new to them. Null unless they follow it.")
            Instant lastReadAt) {}

    public record JourneyResponse(
            UUID id,
            String title,
            String description,
            String category,
            String template,
            LabelStyle labelStyle,
            Visibility visibility,
            JourneyStatus status,
            List<String> tags,
            @Schema(nullable = true) String coverUrl,

            @Schema(nullable = true, description = "A smaller version of the cover, for cards and lists")
            String coverThumbUrl,

            LocalDate startDate,
            @Schema(nullable = true) Integer targetDays,

            @Schema(description = "Day or part number of the latest entry; 0 before the first one")
            int latestNumber,

            @Schema(description = "Ready to show: \"Day 14\", \"Day 12 of 30\", \"Part 5\" or \"Not started\"")
            String progressLabel,

            int entryCount,
            int followerCount,
            @Schema(nullable = true) Instant lastEntryAt,
            @Schema(nullable = true) Instant completedAt,
            @Schema(nullable = true) String closingNote,

            @Schema(
                    nullable = true,
                    description =
                            "The web page to share: it opens for anyone, with or without the app. Null for a private journey.")
            String shareUrl,

            PersonResponse owner,

            @Schema(
                    description =
                            "Everyone who writes in this journey: the owner first, then the friends who joined. More than one means it is shared.")
            List<PersonResponse> authors,

            JourneyViewerResponse viewer,

            @Schema(
                    description =
                            "True when the journey paused by itself after 30 days without an entry, not because its owner paused it")
            boolean pausedAutomatically) {}

    private final JourneyStore journeys;
    private final MediaService media;
    private final PeopleService people;
    private final PublicUrls urls;

    private final ApplicationEventPublisher events;

    JourneyService(
            JourneyStore journeys,
            MediaService media,
            PeopleService people,
            PublicUrls urls,
            ApplicationEventPublisher events) {
        this.journeys = journeys;
        this.media = media;
        this.people = people;
        this.urls = urls;
        this.events = events;
    }

    /** The journey, if this person may see it (see Rules). A private journey looks exactly like one that doesn't exist, except to its authors. */
    public JourneyRow require(UUID id, UUID viewer) {
        return journeys.find(id, viewer)
                .orElseThrow(() ->
                        new ApiProblem(HttpStatus.NOT_FOUND, "journey_not_found", "This journey isn't available."));
    }

    public JourneyRow requireOwned(UUID id, UUID viewer) {
        JourneyRow journey = require(id, viewer);
        if (!journey.ownerId().equals(viewer)) {
            throw new ApiProblem(HttpStatus.FORBIDDEN, "not_yours", "Only the owner can change this journey.");
        }
        return journey;
    }

    public boolean canAddEntry(JourneyRow journey, UUID viewer) {
        return (journey.ownerId().equals(viewer) || journey.member()) && journey.status() != JourneyStatus.COMPLETED;
    }

    /** Starts a journey. Sending the same draft twice (same clientId) gives back the first one, never a second. */
    @Transactional
    public JourneyResponse create(
            UUID owner,
            UUID clientId,
            String title,
            String description,
            String templateId,
            String category,
            LocalDate startDate,
            Visibility visibility,
            LabelStyle labelStyle,
            List<String> tags,
            UUID coverMediaId) {
        if (clientId != null) {
            Optional<UUID> existing = journeys.findByClientId(owner, clientId);
            if (existing.isPresent()) {
                return view(require(existing.get(), owner), owner);
            }
        }
        Catalog.Template template = Catalog.template(templateId)
                .orElseThrow(() -> ApiProblem.badRequest("unknown_template", "Pick one of the starting points."));
        String chosenCategory = category == null || category.isBlank() ? template.defaultCategory() : category;
        requireCategory(chosenCategory);
        requireSensibleStart(startDate);
        if (coverMediaId != null) {
            media.requireOwnShowable(coverMediaId, owner);
        }
        Optional<UUID> started = journeys.insert(
                owner,
                clientId,
                title.trim(),
                clean(description),
                chosenCategory,
                template.id(),
                labelStyle == null ? LabelStyle.read(template.labelStyle()) : labelStyle,
                visibility,
                cleanTags(tags),
                coverMediaId,
                startDate,
                template.targetDays());
        if (started.isEmpty()) {
            // The same draft arrived twice at the same moment and the other request saved it first.
            return view(require(journeys.findByClientId(owner, clientId).orElseThrow(), owner), owner);
        }
        UUID id = started.get();
        if (visibility == Visibility.PUBLIC) {
            journeys.followForFollowersOf(owner, id); // people who follow the creator get their new journeys
        }
        return view(require(id, owner), owner);
    }

    @Transactional
    public JourneyResponse update(
            UUID id,
            UUID viewer,
            String title,
            String description,
            String category,
            LocalDate startDate,
            Visibility visibility,
            LabelStyle labelStyle,
            List<String> tags,
            UUID coverMediaId,
            boolean clearCover,
            JourneyStatus status) {
        JourneyRow current = requireOwned(id, viewer);
        if (title != null && title.isBlank()) {
            throw ApiProblem.badRequest("invalid_title", "Give your journey a title.");
        }
        if (category != null) {
            requireCategory(category);
        }
        if (startDate != null && !startDate.equals(current.startDate())) {
            requireSensibleStart(startDate);
            LocalDate earliest = journeys.earliestEntryDate(id);
            if (earliest != null && startDate.isAfter(earliest)) {
                throw ApiProblem.badRequest(
                        "start_after_entries", "The journey can't start after its first entry. Move that entry first.");
            }
        }
        if (status != null && status != current.status()) {
            if (current.status() == JourneyStatus.COMPLETED || status == JourneyStatus.COMPLETED) {
                throw ApiProblem.badRequest(
                        "invalid_status", "A journey can be paused or resumed here. Completing it has its own step.");
            }
        }
        UUID cover = clearCover ? null : coverMediaId != null ? coverMediaId : journeys.coverMediaId(id);
        if (coverMediaId != null) {
            media.requireOwnShowable(coverMediaId, viewer);
        }
        journeys.update(
                id,
                title == null ? current.title() : title.trim(),
                description == null ? current.description() : clean(description),
                category == null ? current.category() : category,
                labelStyle == null ? current.labelStyle() : labelStyle,
                visibility == null ? current.visibility() : visibility,
                tags == null ? current.tags() : cleanTags(tags),
                cover,
                startDate == null ? current.startDate() : startDate,
                status == null ? current.status() : status);
        if (visibility == Visibility.PUBLIC && current.visibility() != Visibility.PUBLIC) {
            journeys.followForFollowersOf(current.ownerId(), id); // it just became public
        }
        if (visibility == Visibility.PRIVATE && current.visibility() != Visibility.PRIVATE) {
            journeys.dropFollowers(id); // nobody but its authors can see it any more
        }
        return view(require(id, viewer), viewer);
    }

    @Transactional
    public JourneyResponse complete(UUID id, UUID viewer, String closingNote) {
        JourneyRow journey = requireOwned(id, viewer);
        if (journey.status() == JourneyStatus.COMPLETED) {
            throw ApiProblem.badRequest("already_completed", "This journey is already completed.");
        }
        if (journey.entryCount() == 0) {
            throw ApiProblem.badRequest("no_entries", "Add at least one entry before completing the journey.");
        }
        journeys.complete(id, closingNote == null || closingNote.isBlank() ? null : closingNote.trim());
        events.publishEvent(new JourneyCompleted(id, viewer));
        return view(require(id, viewer), viewer);
    }

    @Transactional
    public void delete(UUID id, UUID viewer) {
        requireOwned(id, viewer);
        journeys.delete(id);
    }

    /** A reviewer removes a journey that broke the guidelines: the same removal as its owner's own. */
    @Transactional
    public void removeForReviewer(UUID id) {
        journeys.delete(id);
    }

    /**
     * Follows a journey. The journey is held while the follow is saved, so a follow and "make it private" can't
     * pass each other: either the journey is already private and the follow is refused, or the follow is there
     * for the owner's change to take away. A follow is never left behind on a journey its follower can't see.
     */
    @Transactional
    public JourneyResponse follow(UUID id, UUID viewer) {
        journeys.lock(id);
        JourneyRow journey = require(id, viewer);
        if (journey.ownerId().equals(viewer) || journey.member()) {
            throw ApiProblem.badRequest("own_journey", "You write in this journey. You already see everything in it.");
        }
        if (journeys.follow(viewer, id)) {
            events.publishEvent(new JourneyFollowed(id, viewer));
        }
        return view(require(id, viewer), viewer);
    }

    /** Always takes the follow away, also when the journey can no longer be seen: then the answer is "not found", and the follow is still gone. */
    @Transactional(noRollbackFor = ApiProblem.class)
    public JourneyResponse unfollow(UUID id, UUID viewer) {
        journeys.unfollow(viewer, id);
        return view(require(id, viewer), viewer);
    }

    @Transactional
    public void markRead(UUID id, UUID viewer) {
        require(id, viewer);
        journeys.markRead(viewer, id);
    }

    /** The journeys the viewer writes in, of every visibility: their own and the shared ones they joined. Newest activity first. */
    public Page<JourneyResponse> mine(UUID viewer, Keyset page) {
        return journeys.mine(viewer, page).map(rows -> views(rows, viewer));
    }

    /** Journeys the viewer follows, newest activity first. */
    public Page<JourneyResponse> following(UUID viewer, Keyset page) {
        return journeys.following(viewer, page).map(rows -> views(rows, viewer));
    }

    /**
     * Someone's public journeys, for their profile: the ones they own and the shared ones they write in.
     * "Not found" when there is no such person for this viewer (they don't exist, or they have blocked the
     * viewer), and nothing at all when the viewer has blocked them.
     */
    public Page<JourneyResponse> byProfile(String username, UUID viewer, Keyset page) {
        UUID person = people.idOf(username, viewer);
        return journeys.byProfile(person, viewer, page).map(rows -> views(rows, viewer));
    }

    public record DiscoverResponse(
            List<JourneyResponse> trending, List<JourneyResponse> fresh, List<JourneyResponse> completed) {}

    public record RecapResponse(
            JourneyResponse journey,

            @Schema(description = "From the start date to the last entry, counting both")
            int dayCount,

            int entryCount,
            int placeCount,
            int photoCount,
            int likeCount,
            @Schema(nullable = true) LocalDate firstDay,
            @Schema(nullable = true) LocalDate lastDay,

            @Schema(description = "Photos of the best moments: milestones first, then the most liked")
            List<String> momentUrls) {}

    /** What a journey adds up to: for the recap of a completed journey, and for the step that completes one. */
    public RecapResponse recap(UUID id, UUID viewer) {
        JourneyRow journey = require(id, viewer);
        JourneyStore.Totals totals = journeys.totals(id, viewer);
        int days =
                totals.lastDay() == null ? 0 : (int) ChronoUnit.DAYS.between(journey.startDate(), totals.lastDay()) + 1;
        return new RecapResponse(
                view(journey, viewer),
                Math.max(days, 0),
                totals.entries(),
                totals.places(),
                totals.photos(),
                totals.likes(),
                totals.firstDay(),
                totals.lastDay(),
                journeys.momentKeys(id, viewer, 3).stream().map(media::urlFor).toList());
    }

    /** The shortest words an index can help to find: three letters. Shorter ones are matched in titles, names and tags only. */
    static final int SEARCH_EVERYWHERE_FROM = 3;

    /**
     * Public journeys whose title, description, creator or places (where its entries happened) hold the words
     * typed, or that carry them as a tag. A tag is matched whole, the way it was saved ("#Road Trip" finds
     * "roadtrip"); everything else anywhere in the text.
     *
     * @param pattern the words as an "anywhere in the text" pattern: escaped, with a % on either side
     */
    public List<JourneyResponse> search(String pattern, UUID viewer, int limit) {
        String words = wordsOf(pattern);
        String tag = cleanTags(List.of(words)).stream().findFirst().orElse(null);
        return views(journeys.search(pattern, tag, words.length() >= SEARCH_EVERYWHERE_FROM, viewer, limit), viewer);
    }

    /** The words a search pattern was made from: without the % on either side, and without the escapes. */
    static String wordsOf(String pattern) {
        String inner = pattern.length() >= 2 && pattern.startsWith("%") && pattern.endsWith("%")
                ? pattern.substring(1, pattern.length() - 1)
                : pattern;
        StringBuilder words = new StringBuilder();
        for (int i = 0; i < inner.length(); i++) {
            char c = inner.charAt(i);
            words.append(c == '\\' && i + 1 < inner.length() ? inner.charAt(++i) : c);
        }
        return words.toString();
    }

    /** How many journeys each of Discover's lists shows. */
    static final int DISCOVER_SHELF = 12;

    /**
     * Discover uses simple rules that can be explained: what is trending, what is new, and what was recently
     * completed. The interests a person picked lean the first two their way without hiding anything: in
     * "Trending now" a journey in one of their categories counts for half as much again, and in "New journeys"
     * it is treated as a week newer than it is.
     *
     * <p>The store reads the top of each list inside and outside the person's categories, each in order from
     * an index; the leaning is applied here, to those few rows.
     */
    public DiscoverResponse discover(UUID viewer, String category, List<String> interests) {
        String only = category == null || category.isBlank() ? null : category;
        List<String> mine = Catalog.categoriesFor(interests);
        // What is going on now. The score is worked out every hour (see Trending); before its first run,
        // the most followed lead.
        List<JourneyRow> trending = top(
                journeys.discover(Shelf.TRENDING, viewer, only, mine, DISCOVER_MIN_ENTRIES, DISCOVER_SHELF),
                Comparator.<JourneyRow>comparingDouble(
                                j -> j.trendingScore() * (mine.contains(j.category()) ? INTEREST_BOOST : 1))
                        .reversed()
                        .thenComparing(Comparator.comparingInt(JourneyRow::followerCount)
                                .reversed())
                        .thenComparing(
                                JourneyRow::lastEntryAt, Comparator.nullsLast(Comparator.<Instant>reverseOrder())));
        List<JourneyRow> fresh = top(
                journeys.discover(Shelf.FRESH, viewer, only, mine, DISCOVER_MIN_ENTRIES, DISCOVER_SHELF),
                Comparator.<JourneyRow, Instant>comparing(j -> j.createdAt()
                                .plus(mine.contains(j.category()) ? INTEREST_HEAD_START_DAYS : 0, ChronoUnit.DAYS))
                        .reversed()
                        .thenComparing(JourneyRow::createdAt, Comparator.reverseOrder()));
        List<JourneyRow> completed =
                journeys.discover(Shelf.COMPLETED, viewer, only, List.of(), DISCOVER_MIN_ENTRIES, DISCOVER_SHELF);

        // The three lists are turned into what the app shows together, so the friends on shared journeys are
        // looked up once for all of them.
        List<JourneyResponse> all = views(
                Stream.of(trending, fresh, completed).flatMap(List::stream).toList(), viewer);
        return new DiscoverResponse(
                all.subList(0, trending.size()),
                all.subList(trending.size(), trending.size() + fresh.size()),
                all.subList(trending.size() + fresh.size(), all.size()));
    }

    /** The first of Discover's rows once the reader's leaning is applied. Rows that tie stay in the order the store gave. */
    private static List<JourneyRow> top(List<JourneyRow> rows, Comparator<JourneyRow> leaning) {
        return rows.stream().sorted(leaning).limit(DISCOVER_SHELF).toList();
    }

    /** A few public journeys to follow, favouring the person's interests. Never their own or ones they already follow. */
    public List<JourneyResponse> suggested(UUID viewer, List<String> interests, int limit) {
        return views(journeys.suggested(viewer, Catalog.categoriesFor(interests), limit), viewer);
    }

    public List<JourneyResponse> views(List<JourneyRow> rows, UUID viewer) {
        Map<UUID, List<JourneyStore.AuthorRow>> members = journeys.membersOf(
                rows.stream()
                        .filter(j -> j.memberCount() > 0)
                        .map(JourneyRow::id)
                        .toList(),
                viewer);
        return rows.stream()
                .map(row -> view(row, viewer, members.getOrDefault(row.id(), List.of())))
                .toList();
    }

    public JourneyResponse view(JourneyRow j, UUID viewer) {
        return views(List.of(j), viewer).get(0);
    }

    private JourneyResponse view(JourneyRow j, UUID viewer, List<JourneyStore.AuthorRow> members) {
        PersonResponse owner = media.person(j.ownerId(), j.ownerUsername(), j.ownerName(), j.ownerAvatarKey());
        List<PersonResponse> authors = new java.util.ArrayList<>(List.of(owner));
        members.forEach(m -> authors.add(media.person(m.id(), m.username(), m.displayName(), m.avatarKey())));
        int latest = latestNumber(j);
        return new JourneyResponse(
                j.id(),
                j.title(),
                j.description(),
                j.category(),
                j.template(),
                j.labelStyle(),
                j.visibility(),
                j.status(),
                j.tags(),
                media.urlFor(j.coverKey()),
                media.urlFor(j.coverKey(), MediaSize.MEDIUM),
                j.startDate(),
                j.targetDays(),
                latest,
                progressLabel(j, latest),
                j.entryCount(),
                j.followerCount(),
                j.lastEntryAt(),
                j.completedAt(),
                j.closingNote(),
                j.visibility() == Visibility.PRIVATE ? null : urls.to("/j/" + j.id()),
                owner,
                authors,
                new JourneyViewerResponse(
                        j.ownerId().equals(viewer), j.following(), canAddEntry(j, viewer), j.member(), j.lastReadAt()),
                j.status() == JourneyStatus.PAUSED && j.autoPausedAt() != null);
    }

    private static int latestNumber(JourneyRow j) {
        if (j.entryCount() == 0) {
            return 0;
        }
        if (j.labelStyle() == LabelStyle.PART || j.latestOn() == null) {
            return j.entryCount();
        }
        return (int) ChronoUnit.DAYS.between(j.startDate(), j.latestOn()) + 1;
    }

    private static String progressLabel(JourneyRow j, int latest) {
        if (latest == 0) {
            return "Not started";
        }
        if (j.labelStyle() == LabelStyle.PART) {
            return "Part " + latest;
        }
        return j.targetDays() == null ? "Day " + latest : "Day " + latest + " of " + j.targetDays();
    }

    private static void requireCategory(String category) {
        if (!Catalog.isCategory(category)) {
            throw ApiProblem.badRequest("unknown_category", "Pick one of the categories.");
        }
    }

    private static void requireSensibleStart(LocalDate startDate) {
        LocalDate today = LocalDate.now();
        if (startDate.isAfter(today.plusYears(1)) || startDate.isBefore(today.minusYears(50))) {
            throw ApiProblem.badRequest("invalid_start_date", "Check the start date.");
        }
    }

    private static String clean(String text) {
        return text == null ? "" : text.trim();
    }

    /** "#Road Trip" becomes "roadtrip": lower case, letters and digits only, no doubles. */
    static List<String> cleanTags(List<String> tags) {
        if (tags == null) {
            return List.of();
        }
        List<String> clean = tags.stream()
                .map(tag -> tag.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", ""))
                .filter(tag -> !tag.isEmpty() && tag.length() <= 30)
                .distinct()
                .toList();
        if (clean.size() > MAX_TAGS) {
            throw ApiProblem.badRequest("too_many_tags", "Use up to " + MAX_TAGS + " tags.");
        }
        return clean;
    }
}
