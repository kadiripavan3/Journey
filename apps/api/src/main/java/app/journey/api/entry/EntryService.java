package app.journey.api.entry;

import app.journey.api.common.ApiProblem;
import app.journey.api.common.Keyset;
import app.journey.api.common.Page;
import app.journey.api.entry.EntryStore.Around;
import app.journey.api.entry.EntryStore.Edge;
import app.journey.api.entry.EntryStore.EntryMediaRow;
import app.journey.api.entry.EntryStore.EntryRow;
import app.journey.api.entry.EntryStore.PinRow;
import app.journey.api.journey.JourneyService;
import app.journey.api.journey.JourneyStatus;
import app.journey.api.journey.JourneyStore;
import app.journey.api.journey.JourneyStore.JourneyRow;
import app.journey.api.journey.LabelStyle;
import app.journey.api.media.MediaKind;
import app.journey.api.media.MediaService;
import app.journey.api.media.MediaService.MediaResponse;
import app.journey.api.media.MediaStatus;
import app.journey.api.media.MediaStore.MediaRow;
import app.journey.api.people.PeopleService;
import app.journey.api.profile.PersonResponse;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The rules for entries: who may add, change and remove them, and what an entry may hold. */
@Service
public class EntryService {

    static final int PAGE = 30;
    /** How much of a journey its page shows before the reader opens the story. */
    static final int SUMMARY_PHOTOS = 12;

    static final int SUMMARY_MILESTONES = 50;
    static final int SUMMARY_DAYS = 400;

    public record EntryViewerResponse(boolean canEdit, boolean canDelete, boolean hasLiked) {}

    public record EntryResponse(
            UUID id,
            UUID journeyId,
            String journeyTitle,
            PersonResponse author,
            Instant happenedAt,
            LocalDate happenedOn,

            @Schema(description = "Ready to show: \"Day 14\" or \"Part 3\"")
            String label,

            int number,

            @Schema(description = "Its place in the story, counting from 1")
            int position,

            String title,
            String body,
            @Schema(nullable = true) String placeName,

            @Schema(
                    nullable = true,
                    description =
                            "Where it is on the map. Other people get a city-level point unless the author chose the exact spot.")
            Double lat,

            @Schema(nullable = true) Double lng,
            LocationPrecision locationPrecision,
            boolean isMilestone,
            List<MediaResponse> media,
            int likeCount,
            int commentCount,
            Instant createdAt,
            boolean edited,
            EntryViewerResponse viewer) {}

    private final EntryStore entries;
    private final JourneyService journeys;
    private final JourneyStore journeyStore;
    private final MediaService media;
    private final PeopleService people;
    private final ApplicationEventPublisher events;

    EntryService(
            EntryStore entries,
            JourneyService journeys,
            JourneyStore journeyStore,
            MediaService media,
            PeopleService people,
            ApplicationEventPublisher events) {
        this.entries = entries;
        this.journeys = journeys;
        this.journeyStore = journeyStore;
        this.media = media;
        this.people = people;
        this.events = events;
    }

    /** How many pins a map shows at most. A journey with more says so. */
    static final int MAP_PINS = 300;

    public record MapPinResponse(
            UUID entryId,

            @Schema(description = "\"Day 14\" or \"Part 3\"")
            String label,

            String title,
            String placeName,
            double lat,
            double lng,
            boolean isMilestone,
            LocalDate happenedOn,

            @Schema(nullable = true, description = "A small picture of the entry's first photo")
            String thumbUrl) {}

    public record JourneyMapResponse(
            @Schema(description = "The entries that have a place, in story order")
            List<MapPinResponse> pins,

            @Schema(description = "How many entries have a place; more than the pins when the map is capped")
            int pinCount,

            @Schema(description = "How many different places they are in")
            int placeCount,

            @Schema(description = "True when the journey has more places than a map shows at once")
            boolean capped) {}

    /**
     * A page of a story. Unlike other lists a story is read from the middle too (from the first new entry, or
     * from the entry someone opened), so a page also says how to get the one before it.
     */
    public record TimelinePageResponse(
            List<EntryResponse> items,

            @Schema(
                    nullable = true,
                    description = "Send as `cursor` for the entries after these. Null at the end of the story.")
            String nextCursor,

            @Schema(
                    nullable = true,
                    description = "Send as `cursor` for the entries before these. Null at the start of the story.")
            String prevCursor,

            @Schema(description = "How many entries the story has")
            int total) {}

    public record MilestoneResponse(
            UUID entryId,
            String title,

            @Schema(description = "\"Day 14\" or \"Part 3\"")
            String label,

            LocalDate happenedOn,

            @Schema(nullable = true, description = "A small picture of the entry's first photo, if it has one")
            String thumbUrl) {}

    /** One day of a story, for "Jump to": tapping it opens the story at the day's first entry. */
    public record StoryDayResponse(
            LocalDate happenedOn,

            @Schema(
                    nullable = true,
                    description = "\"Day 14\", for a journey that counts its days; null for one told in parts")
            String label,

            @Schema(nullable = true, description = "Where the day's first entry with a place was")
            String place,

            @Schema(description = "How many entries the reader can see on this day")
            int entryCount,

            UUID firstEntryId) {}

    /** What a journey's page shows of its story, without loading the story. */
    public record JourneySummaryResponse(
            @Schema(nullable = true, description = "The first entry of the story")
            EntryResponse first,

            @Schema(description = "The newest three entries, newest first")
            List<EntryResponse> latest,

            @Schema(description = "The story's first photos")
            List<MediaResponse> photos,

            int photoCount,

            @Schema(description = "The day numbers that have an entry, for a challenge's row of ticks")
            List<Integer> days,

            List<MilestoneResponse> milestones,

            @Schema(
                    description =
                            "Entries by others since the viewer last read the journey; 0 when they don't follow it")
            int newCount,

            @Schema(nullable = true, description = "Where to start reading: the first of the new entries")
            UUID firstNewEntryId) {}

    /**
     * A page of a journey's story, in the order things happened. With {@code around}, the page that holds that
     * entry; pages are cut at fixed places, so the ones before and after never overlap it.
     *
     * <p>A cursor names a place in the story (an entry's time and id) and a direction, never a count: the page
     * is read from that place through the index, however far into the story it is, and an entry added or
     * removed in between is neither repeated nor skipped. The cursor says which way it reads: "a" after the
     * place, "f" from it on, "b" before it, "u" up to and including it.
     */
    public TimelinePageResponse timeline(
            UUID journeyId, UUID viewer, String cursor, Integer limit, UUID around, String authorUsername) {
        JourneyRow journey = journeys.require(journeyId, viewer);
        // On a shared journey a reader can ask for one person's part of the story.
        UUID author = authorUsername == null || authorUsername.isBlank() ? null : people.idOf(authorUsername, viewer);
        Keyset page = Keyset.of(cursor, limit, PAGE);
        int size = page.limit();
        // Each side is asked for one entry more than the page takes, to learn whether the story goes on that way.
        Edge edge = null;
        boolean edgeGoesAfter = true;
        int before = 0;
        int after = size + 1;
        if (!page.first()) {
            edge = new Edge(page.instant(1), page.instant(2), page.uuid(3));
            switch (page.text(0)) {
                case "a" -> {
                    edgeGoesAfter = false;
                    before = 1;
                }
                case "f" -> before = 1;
                case "b" -> {
                    before = size + 1;
                    after = 1;
                }
                case "u" -> {
                    edgeGoesAfter = false;
                    before = size + 1;
                    after = 1;
                }
                default -> throw Keyset.badCursor();
            }
        } else if (around != null) {
            EntryRow opened = entries.find(around, viewer)
                    .filter(entry -> entry.journeyId().equals(journeyId))
                    .orElseThrow(EntryService::notFound);
            edge = Edge.of(opened);
            int ahead = (opened.position() - 1) % size; // how many entries of its page come before it
            before = ahead + 1;
            after = size - ahead + 1;
        }
        Around found = entries.around(journeyId, viewer, author, edge, edgeGoesAfter, before, after);
        boolean earlier = before > 0 && found.before().size() == before;
        boolean later = found.after().size() == after;
        List<EntryRow> rows = new java.util.ArrayList<>(
                found.before().subList(earlier ? 1 : 0, found.before().size()));
        rows.addAll(found.after().subList(0, later ? after - 1 : found.after().size()));

        String prev = null;
        String next = null;
        if (earlier) {
            prev = rows.isEmpty() ? cursor(edgeGoesAfter ? "b" : "u", edge) : cursor("b", Edge.of(rows.get(0)));
        }
        if (later) {
            next = rows.isEmpty()
                    ? cursor(edgeGoesAfter ? "f" : "a", edge)
                    : cursor("a", Edge.of(rows.get(rows.size() - 1)));
        }
        // The whole story's size is the count the database keeps; one person's part is counted.
        int total = author == null ? journey.entryCount() : entries.count(journeyId, viewer, author);
        return new TimelinePageResponse(views(rows, viewer), next, prev, total);
    }

    private static String cursor(String direction, Edge edge) {
        return Keyset.cursor(direction, edge.happenedAt(), edge.createdAt(), edge.id());
    }

    /**
     * The journey on a map: its entries that have a place, in story order, each where its reader may see it.
     * A pin needs little of an entry, so only that is read (no authors, no likes, no text beyond a line).
     */
    public JourneyMapResponse map(UUID journeyId, UUID viewer) {
        journeys.require(journeyId, viewer);
        List<PinRow> rows = entries.pins(journeyId, viewer, MAP_PINS);
        Map<UUID, List<EntryMediaRow>> mediaByEntry =
                entries.mediaFor(rows.stream().map(PinRow::id).toList(), viewer);
        EntryStore.MapTotals totals = entries.mapTotals(journeyId, viewer);
        List<MapPinResponse> pins = rows.stream()
                .map(pin -> {
                    boolean own = pin.authorId().equals(viewer);
                    Place place = new Place(pin.placeName(), pin.lat(), pin.lng(), pin.precision()).shownTo(own);
                    return new MapPinResponse(
                            pin.id(),
                            pin.labelStyle() == LabelStyle.DAY ? "Day " + pin.dayNumber() : "Part " + pin.position(),
                            pin.title().isEmpty() ? firstWords(pin.bodyStart()) : pin.title(),
                            place.name(),
                            place.lat(),
                            place.lng(),
                            pin.milestone(),
                            pin.happenedOn(),
                            // A clip that isn't ready is shown only to its author, on a pin as in the entry.
                            mediaByEntry.getOrDefault(pin.id(), List.of()).stream()
                                    .filter(m -> own || m.status() == MediaStatus.READY)
                                    .map(m -> view(m).thumbUrl())
                                    .filter(java.util.Objects::nonNull)
                                    .findFirst()
                                    .orElse(null));
                })
                .toList();
        return new JourneyMapResponse(pins, totals.pins(), totals.places(), totals.pins() > pins.size());
    }

    private static String firstWords(String text) {
        return text.length() <= 60 ? text : text.substring(0, 60).trim() + "…";
    }

    /** How many of a story's newest entries a journey's page shows. */
    static final int SUMMARY_LATEST = 3;

    /** The days of a journey's story that have entries, newest first: every way into a long story, for "Jump to". */
    public Page<StoryDayResponse> days(UUID journeyId, UUID viewer, Keyset page) {
        boolean day = journeys.require(journeyId, viewer).labelStyle() == LabelStyle.DAY;
        return entries.storyDays(journeyId, viewer, page)
                .map(rows -> rows.stream()
                        .map(row -> new StoryDayResponse(
                                row.happenedOn(),
                                day ? "Day " + row.dayNumber() : null,
                                row.place(),
                                row.entries(),
                                row.firstId()))
                        .toList());
    }

    public JourneySummaryResponse summary(UUID journeyId, UUID viewer) {
        JourneyRow journey = journeys.require(journeyId, viewer);
        // The story's first entry and its newest few, in story order; in a short story they are the same entries.
        List<EntryResponse> ends = views(entries.ends(journeyId, viewer, SUMMARY_LATEST), viewer);
        List<EntryResponse> latest =
                new java.util.ArrayList<>(ends.subList(Math.max(ends.size() - SUMMARY_LATEST, 0), ends.size()));
        java.util.Collections.reverse(latest);
        boolean day = journey.labelStyle() == LabelStyle.DAY;
        EntryStore.NewEntries fresh = journey.lastReadAt() == null
                ? new EntryStore.NewEntries(0, null)
                : entries.newSince(journeyId, viewer, journey.lastReadAt());
        EntryStore.Photos photos = entries.photos(journeyId, viewer, SUMMARY_PHOTOS);
        List<EntryStore.MilestoneRow> milestones = entries.milestones(journeyId, viewer, SUMMARY_MILESTONES);
        Map<UUID, List<EntryMediaRow>> milestonePhotos = entries.mediaFor(
                milestones.stream().map(EntryStore.MilestoneRow::id).toList(), viewer);
        return new JourneySummaryResponse(
                ends.isEmpty() ? null : ends.get(0),
                latest,
                photos.first().stream().map(this::view).toList(),
                photos.total(),
                journey.targetDays() != null ? entries.days(journeyId, SUMMARY_DAYS) : List.of(),
                milestones.stream()
                        .map(m -> new MilestoneResponse(
                                m.id(),
                                m.title(),
                                (day ? "Day " + m.dayNumber() : "Part " + m.position()),
                                m.happenedOn(),
                                milestonePhotos.getOrDefault(m.id(), List.of()).stream()
                                        .filter(photo -> photo.status() == MediaStatus.READY)
                                        .map(photo -> view(photo).thumbUrl())
                                        .filter(java.util.Objects::nonNull)
                                        .findFirst()
                                        .orElse(null)))
                        .toList(),
                fresh.count(),
                fresh.firstId());
    }

    public EntryResponse get(UUID id, UUID viewer) {
        return views(List.of(require(id, viewer)), viewer).get(0);
    }

    /** Adds an entry. Sending the same draft twice (same clientId) gives back the first one, never a second. */
    @Transactional
    public EntryResponse add(
            UUID journeyId,
            UUID author,
            UUID clientId,
            String title,
            String body,
            Instant happenedAt,
            LocalDate happenedOn,
            Place place,
            boolean milestone,
            List<UUID> mediaIds) {
        if (clientId != null) {
            Optional<UUID> existing = entries.findByClientId(author, clientId);
            if (existing.isPresent()) {
                return get(existing.get(), author);
            }
        }
        // Held until this is saved, so the journey can't be completed (or the author removed) between the check and the
        // entry.
        journeyStore.lock(journeyId);
        JourneyRow journey = journeys.require(journeyId, author);
        if (!journeys.canAddEntry(journey, author)) {
            throw new ApiProblem(
                    HttpStatus.FORBIDDEN,
                    "cannot_add_entry",
                    journey.status() == JourneyStatus.COMPLETED
                            ? "This journey is completed, so it takes no new entries."
                            : "Only the people on this journey can add entries to it.");
        }
        Content content = check(journey, author, title, body, happenedAt, happenedOn, place, mediaIds);
        Optional<UUID> added = entries.insert(
                journeyId,
                author,
                clientId,
                content.happenedAt,
                content.happenedOn,
                content.title,
                content.body,
                content.place,
                milestone);
        if (added.isEmpty()) {
            // The same draft arrived twice at the same moment and the other request saved it first.
            return get(entries.findByClientId(author, clientId).orElseThrow(), author);
        }
        UUID id = added.get();
        entries.replaceMedia(id, content.mediaIds);
        entries.wakeJourney(journeyId);
        events.publishEvent(new EntryAdded(id, journeyId, author));
        return get(id, author);
    }

    @Transactional
    public EntryResponse change(
            UUID id,
            UUID viewer,
            String title,
            String body,
            Instant happenedAt,
            LocalDate happenedOn,
            Place place,
            boolean milestone,
            List<UUID> mediaIds) {
        EntryRow entry = require(id, viewer);
        if (!entry.authorId().equals(viewer)) {
            throw new ApiProblem(
                    HttpStatus.FORBIDDEN, "not_yours", "Only the person who wrote an entry can change it.");
        }
        JourneyRow journey = journeys.require(entry.journeyId(), viewer);
        if (!journey.ownerId().equals(viewer) && !journey.member()) {
            // A friend who has left, or was taken off, the journey. What they wrote stays theirs to delete, not to
            // rewrite.
            throw new ApiProblem(
                    HttpStatus.FORBIDDEN,
                    "not_on_journey",
                    "You no longer write in this journey, so its entries can't be changed. You can still delete yours.");
        }
        Content content = check(
                journey,
                viewer,
                title,
                body,
                happenedAt == null ? entry.happenedAt() : happenedAt,
                happenedOn,
                place,
                mediaIds);
        entries.update(
                id, content.happenedAt, content.happenedOn, content.title, content.body, content.place, milestone);
        entries.replaceMedia(id, content.mediaIds);
        return get(id, viewer);
    }

    /**
     * The author can always delete what they wrote, also in a journey they can no longer open (it went
     * private, or they were taken off it). The journey's owner can delete any entry in it.
     */
    @Transactional
    public void delete(UUID id, UUID viewer) {
        EntryRow entry = entries.find(id, viewer).orElseThrow(EntryService::notFound);
        if (!entry.authorId().equals(viewer)) {
            require(id, viewer);
            if (!entry.journeyOwnerId().equals(viewer)) {
                throw new ApiProblem(
                        HttpStatus.FORBIDDEN,
                        "not_yours",
                        "Only the author or the journey's owner can delete an entry.");
            }
        }
        entries.delete(id);
    }

    /** A reviewer removes an entry that broke the guidelines: the same removal as its author's own. */
    @Transactional
    public void removeForReviewer(UUID id) {
        entries.delete(id);
    }

    /** Entries by id, for callers that have already checked the reader may see their journeys. */
    public Map<UUID, EntryResponse> byId(List<UUID> ids, UUID viewer) {
        return views(entries.findAll(ids, viewer), viewer).stream()
                .collect(Collectors.toMap(EntryResponse::id, Function.identity()));
    }

    /** For each journey, its newest entries by other people, for the Home feed and the weekly digest. */
    public Map<UUID, List<EntryResponse>> latestByOthers(List<UUID> journeyIds, UUID reader, int perJourney) {
        Map<UUID, List<EntryRow>> rows = entries.latestByOthers(journeyIds, reader, perJourney);
        Map<UUID, EntryResponse> views = views(
                        rows.values().stream().flatMap(List::stream).toList(), reader)
                .stream()
                .collect(Collectors.toMap(EntryResponse::id, Function.identity()));
        return rows.entrySet().stream()
                .collect(Collectors.toMap(
                        Map.Entry::getKey,
                        e -> e.getValue().stream()
                                .map(row -> views.get(row.id()))
                                .toList()));
    }

    /** One heart per person. Liking twice changes nothing. */
    @Transactional
    public EntryResponse like(UUID id, UUID viewer) {
        if (entries.like(require(id, viewer).id(), viewer)) {
            events.publishEvent(new EntryLiked(id, viewer));
        }
        return get(id, viewer);
    }

    @Transactional
    public EntryResponse unlike(UUID id, UUID viewer) {
        entries.unlike(require(id, viewer).id(), viewer);
        return get(id, viewer);
    }

    /** The entry, or "not found" when the viewer may not see its journey. */
    public EntryRow require(UUID id, UUID viewer) {
        EntryRow entry = entries.find(id, viewer).orElseThrow(EntryService::notFound);
        try {
            journeys.require(entry.journeyId(), viewer);
        } catch (ApiProblem hidden) {
            throw notFound(); // an entry in a journey you can't see doesn't exist for you
        }
        return entry;
    }

    private static ApiProblem notFound() {
        return new ApiProblem(HttpStatus.NOT_FOUND, "entry_not_found", "This entry isn't available.");
    }

    private record Content(
            String title, String body, Instant happenedAt, LocalDate happenedOn, Place place, List<UUID> mediaIds) {}

    private Content check(
            JourneyRow journey,
            UUID author,
            String title,
            String body,
            Instant happenedAt,
            LocalDate happenedOn,
            Place place,
            List<UUID> mediaIds) {
        List<UUID> ids =
                mediaIds == null ? List.of() : mediaIds.stream().distinct().toList();
        List<MediaRow> files = media.requireOwn(ids, author, null);
        long photos = files.stream().filter(f -> f.kind() == MediaKind.PHOTO).count();
        long clips = files.size() - photos;
        if (photos > MediaService.MAX_PHOTOS_PER_ENTRY) {
            throw ApiProblem.badRequest(
                    "too_many_photos", "An entry holds up to " + MediaService.MAX_PHOTOS_PER_ENTRY + " photos.");
        }
        if (clips > MediaService.MAX_CLIPS_PER_ENTRY) {
            throw ApiProblem.badRequest(
                    "too_many_clips", "An entry holds up to " + MediaService.MAX_CLIPS_PER_ENTRY + " clips.");
        }
        String cleanTitle = title == null ? "" : title.trim();
        String cleanBody = body == null ? "" : body.trim();
        if (files.isEmpty() && cleanTitle.isEmpty() && cleanBody.isEmpty()) {
            throw ApiProblem.badRequest("empty_entry", "Add a photo or a few words.");
        }
        Instant at = happenedAt == null ? Instant.now() : happenedAt;
        if (at.isAfter(Instant.now().plus(1, ChronoUnit.DAYS))) {
            throw ApiProblem.badRequest("in_the_future", "An entry can't be dated in the future.");
        }
        LocalDate on = happenedOn == null ? at.atOffset(ZoneOffset.UTC).toLocalDate() : happenedOn;
        if (Math.abs(ChronoUnit.DAYS.between(on, at.atOffset(ZoneOffset.UTC).toLocalDate())) > 1) {
            throw ApiProblem.badRequest("date_mismatch", "The entry's day and time don't match.");
        }
        if (on.isBefore(journey.startDate())) {
            throw ApiProblem.badRequest(
                    "before_start", "This is before the journey's start date. Change the start date first.");
        }
        return new Content(cleanTitle, cleanBody, at, on, place == null ? Place.NONE : place, ids);
    }

    private MediaResponse view(EntryMediaRow m) {
        return media.view(
                m.mediaId(),
                m.kind(),
                m.status(),
                m.storageKey(),
                m.playbackId(),
                m.width(),
                m.height(),
                m.durationS(),
                m.held());
    }

    public List<EntryResponse> views(List<EntryRow> rows, UUID viewer) {
        Map<UUID, List<EntryMediaRow>> mediaByEntry =
                entries.mediaFor(rows.stream().map(EntryRow::id).toList(), viewer);
        return rows.stream()
                .map(e -> {
                    boolean day = e.labelStyle() == LabelStyle.DAY;
                    int number = day ? e.dayNumber() : e.position();
                    Place place = new Place(e.placeName(), e.lat(), e.lng(), e.precision())
                            .shownTo(e.authorId().equals(viewer));
                    boolean own = e.authorId().equals(viewer);
                    // A clip that isn't ready (still being converted, or failed) is shown only to its author.
                    List<MediaResponse> files = mediaByEntry.getOrDefault(e.id(), List.of()).stream()
                            .filter(m -> own || m.status() == MediaStatus.READY)
                            .map(this::view)
                            .toList();
                    return new EntryResponse(
                            e.id(),
                            e.journeyId(),
                            e.journeyTitle(),
                            media.person(e.authorId(), e.authorUsername(), e.authorName(), e.authorAvatarKey()),
                            e.happenedAt(),
                            e.happenedOn(),
                            (day ? "Day " : "Part ") + number,
                            number,
                            e.position(),
                            e.title(),
                            e.body(),
                            place.name(),
                            place.lat(),
                            place.lng(),
                            place.precision(),
                            e.milestone(),
                            files,
                            e.likeCount(),
                            e.commentCount(),
                            e.createdAt(),
                            e.editedAt() != null,
                            new EntryViewerResponse(
                                    e.authorId().equals(viewer),
                                    e.authorId().equals(viewer)
                                            || e.journeyOwnerId().equals(viewer),
                                    e.liked()));
                })
                .toList();
    }
}
