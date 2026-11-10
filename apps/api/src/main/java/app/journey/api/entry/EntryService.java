package app.journey.api.entry;

import app.journey.api.common.ApiProblem;
import app.journey.api.common.PageRequest;
import app.journey.api.entry.EntryStore.EntryMediaRow;
import app.journey.api.entry.EntryStore.EntryRow;
import app.journey.api.journey.JourneyService;
import app.journey.api.journey.JourneyStatus;
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
    private final MediaService media;
    private final PeopleService people;
    private final ApplicationEventPublisher events;

    EntryService(
            EntryStore entries,
            JourneyService journeys,
            MediaService media,
            PeopleService people,
            ApplicationEventPublisher events) {
        this.entries = entries;
        this.journeys = journeys;
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

            LocalDate happenedOn) {}

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
     */
    public TimelinePageResponse timeline(
            UUID journeyId, UUID viewer, String cursor, Integer limit, UUID around, String authorUsername) {
        journeys.require(journeyId, viewer);
        // On a shared journey a reader can ask for one person's part of the story.
        UUID author = authorUsername == null || authorUsername.isBlank() ? null : people.idOf(authorUsername, viewer);
        PageRequest page = PageRequest.of(cursor, limit, PAGE);
        int offset = page.offset();
        if (around != null && (cursor == null || cursor.isBlank())) {
            require(around, viewer);
            offset = entries.countBefore(journeyId, around, viewer, author) / page.limit() * page.limit();
        }
        int total = entries.count(journeyId, viewer, author);
        List<EntryResponse> items = views(entries.timeline(journeyId, viewer, author, page.limit(), offset), viewer);
        return new TimelinePageResponse(
                items,
                offset + page.limit() < total ? PageRequest.cursor(offset + page.limit()) : null,
                offset > 0 ? PageRequest.cursor(Math.max(offset - page.limit(), 0)) : null,
                total);
    }

    /** The journey on a map: its entries that have a place, in story order, each where its reader may see it. */
    public JourneyMapResponse map(UUID journeyId, UUID viewer) {
        journeys.require(journeyId, viewer);
        List<EntryResponse> shown = views(entries.onMap(journeyId, viewer, MAP_PINS), viewer);
        EntryStore.MapTotals totals = entries.mapTotals(journeyId, viewer);
        List<MapPinResponse> pins = shown.stream()
                .map(e -> new MapPinResponse(
                        e.id(),
                        e.label(),
                        e.title().isEmpty() ? firstWords(e.body()) : e.title(),
                        e.placeName(),
                        e.lat(),
                        e.lng(),
                        e.isMilestone(),
                        e.happenedOn(),
                        e.media().stream()
                                .map(MediaResponse::thumbUrl)
                                .filter(java.util.Objects::nonNull)
                                .findFirst()
                                .orElse(null)))
                .toList();
        return new JourneyMapResponse(pins, totals.pins(), totals.places(), totals.pins() > pins.size());
    }

    private static String firstWords(String text) {
        return text.length() <= 60 ? text : text.substring(0, 60).trim() + "…";
    }

    public JourneySummaryResponse summary(UUID journeyId, UUID viewer) {
        JourneyRow journey = journeys.require(journeyId, viewer);
        List<EntryRow> rows = new java.util.ArrayList<>(entries.latest(journeyId, viewer, 3));
        int latestCount = rows.size();
        rows.addAll(entries.timeline(journeyId, viewer, null, 1, 0));
        List<EntryResponse> shown = views(rows, viewer);
        boolean day = journey.labelStyle() == LabelStyle.DAY;
        EntryStore.NewEntries fresh = journey.lastReadAt() == null
                ? new EntryStore.NewEntries(0, null)
                : entries.newSince(journeyId, viewer, journey.lastReadAt());
        return new JourneySummaryResponse(
                shown.size() > latestCount ? shown.get(latestCount) : null,
                shown.subList(0, latestCount),
                entries.photos(journeyId, viewer, SUMMARY_PHOTOS).stream()
                        .map(this::view)
                        .toList(),
                entries.photoCount(journeyId, viewer),
                journey.targetDays() != null ? entries.days(journeyId, SUMMARY_DAYS) : List.of(),
                entries.milestones(journeyId, viewer, SUMMARY_MILESTONES).stream()
                        .map(m -> new MilestoneResponse(
                                m.id(),
                                m.title(),
                                (day ? "Day " + m.dayNumber() : "Part " + m.position()),
                                m.happenedOn()))
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

    @Transactional
    public void delete(UUID id, UUID viewer) {
        EntryRow entry = require(id, viewer);
        if (!entry.authorId().equals(viewer) && !entry.journeyOwnerId().equals(viewer)) {
            throw new ApiProblem(
                    HttpStatus.FORBIDDEN, "not_yours", "Only the author or the journey's owner can delete an entry.");
        }
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
        entries.like(require(id, viewer).id(), viewer);
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
                m.durationS());
    }

    public List<EntryResponse> views(List<EntryRow> rows, UUID viewer) {
        Map<UUID, List<EntryMediaRow>> mediaByEntry =
                entries.mediaFor(rows.stream().map(EntryRow::id).toList());
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
