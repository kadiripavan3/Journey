package app.journey.api.entry;

import app.journey.api.common.ApiProblem;
import app.journey.api.entry.EntryStore.EntryMediaRow;
import app.journey.api.entry.EntryStore.EntryRow;
import app.journey.api.journey.JourneyService;
import app.journey.api.journey.JourneyStore.JourneyRow;
import app.journey.api.media.MediaService;
import app.journey.api.media.MediaService.MediaResponse;
import app.journey.api.media.MediaService.MediaRow;
import app.journey.api.profile.PersonResponse;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The rules for entries: who may add, change and remove them, and what an entry may hold. */
@Service
public class EntryService {

  static final int TIMELINE_LIMIT = 500;

  public record EntryViewerResponse(boolean canEdit, boolean canDelete, boolean hasLiked) {}

  public record EntryResponse(
      UUID id, UUID journeyId, String journeyTitle, PersonResponse author, Instant happenedAt, LocalDate happenedOn,
      @Schema(description = "Ready to show: \"Day 14\" or \"Part 3\"") String label,
      int number, String title, String body,
      @Schema(nullable = true) String placeName,
      boolean isMilestone, List<MediaResponse> media, int likeCount, int commentCount, Instant createdAt, boolean edited, EntryViewerResponse viewer) {}

  private final EntryStore entries;
  private final JourneyService journeys;
  private final MediaService media;
  private final ApplicationEventPublisher events;

  EntryService(EntryStore entries, JourneyService journeys, MediaService media, ApplicationEventPublisher events) {
    this.entries = entries;
    this.journeys = journeys;
    this.media = media;
    this.events = events;
  }

  /** A journey's story, in the order things happened. */
  public List<EntryResponse> timeline(UUID journeyId, UUID viewer) {
    journeys.require(journeyId, viewer);
    return views(entries.timeline(journeyId, viewer, TIMELINE_LIMIT), viewer);
  }

  public EntryResponse get(UUID id, UUID viewer) {
    return views(List.of(require(id, viewer)), viewer).get(0);
  }

  @Transactional
  public EntryResponse add(UUID journeyId, UUID author, String title, String body, Instant happenedAt, LocalDate happenedOn, String placeName,
      boolean milestone, List<UUID> mediaIds) {
    JourneyRow journey = journeys.require(journeyId, author);
    if (!journeys.canAddEntry(journey, author)) {
      throw new ApiProblem(HttpStatus.FORBIDDEN, "cannot_add_entry",
          "completed".equals(journey.status()) ? "This journey is completed, so it takes no new entries." : "Only the owner can add entries to this journey.");
    }
    Content content = check(journey, author, title, body, happenedAt, happenedOn, placeName, mediaIds);
    UUID id = entries.insert(journeyId, author, content.happenedAt, content.happenedOn, content.title, content.body, content.placeName, milestone);
    entries.replaceMedia(id, content.mediaIds);
    entries.refreshJourneyCounters(journeyId, true);
    events.publishEvent(new EntryAdded(id, journeyId, author));
    return get(id, author);
  }

  @Transactional
  public EntryResponse change(UUID id, UUID viewer, String title, String body, Instant happenedAt, LocalDate happenedOn, String placeName,
      boolean milestone, List<UUID> mediaIds) {
    EntryRow entry = require(id, viewer);
    if (!entry.authorId().equals(viewer)) {
      throw new ApiProblem(HttpStatus.FORBIDDEN, "not_yours", "Only the person who wrote an entry can change it.");
    }
    JourneyRow journey = journeys.require(entry.journeyId(), viewer);
    Content content = check(journey, viewer, title, body, happenedAt == null ? entry.happenedAt() : happenedAt, happenedOn, placeName, mediaIds);
    entries.update(id, content.happenedAt, content.happenedOn, content.title, content.body, content.placeName, milestone);
    entries.replaceMedia(id, content.mediaIds);
    return get(id, viewer);
  }

  @Transactional
  public void delete(UUID id, UUID viewer) {
    EntryRow entry = require(id, viewer);
    if (!entry.authorId().equals(viewer) && !entry.journeyOwnerId().equals(viewer)) {
      throw new ApiProblem(HttpStatus.FORBIDDEN, "not_yours", "Only the author or the journey's owner can delete an entry.");
    }
    entries.delete(id);
    entries.refreshJourneyCounters(entry.journeyId(), false);
  }

  /** The newest entries by other people in a journey, for the Home feed. */
  public List<EntryResponse> latestByOthers(UUID journeyId, UUID reader, int limit) {
    return views(entries.latestByOthers(journeyId, reader, limit), reader);
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

  private record Content(String title, String body, Instant happenedAt, LocalDate happenedOn, String placeName, List<UUID> mediaIds) {}

  private Content check(JourneyRow journey, UUID author, String title, String body, Instant happenedAt, LocalDate happenedOn, String placeName, List<UUID> mediaIds) {
    List<UUID> ids = mediaIds == null ? List.of() : mediaIds.stream().distinct().toList();
    List<MediaRow> files = media.requireOwn(ids, author, null);
    long photos = files.stream().filter(f -> "photo".equals(f.kind())).count();
    long clips = files.size() - photos;
    if (photos > MediaService.MAX_PHOTOS_PER_ENTRY) {
      throw ApiProblem.badRequest("too_many_photos", "An entry holds up to " + MediaService.MAX_PHOTOS_PER_ENTRY + " photos.");
    }
    if (clips > MediaService.MAX_CLIPS_PER_ENTRY) {
      throw ApiProblem.badRequest("too_many_clips", "An entry holds up to " + MediaService.MAX_CLIPS_PER_ENTRY + " clips.");
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
      throw ApiProblem.badRequest("before_start", "This is before the journey's start date. Change the start date first.");
    }
    String place = placeName == null || placeName.isBlank() ? null : placeName.trim();
    return new Content(cleanTitle, cleanBody, at, on, place, ids);
  }

  private List<EntryResponse> views(List<EntryRow> rows, UUID viewer) {
    Map<UUID, List<EntryMediaRow>> mediaByEntry = entries.mediaFor(rows.stream().map(EntryRow::id).toList());
    return rows.stream().map(e -> {
      boolean day = "day".equals(e.labelStyle());
      int number = day ? e.dayNumber() : e.partNumber();
      List<MediaResponse> files = mediaByEntry.getOrDefault(e.id(), List.of()).stream()
          .map(m -> media.view(m.mediaId(), m.kind(), m.storageKey(), m.width(), m.height(), m.durationS())).toList();
      return new EntryResponse(
          e.id(), e.journeyId(), e.journeyTitle(),
          new PersonResponse(e.authorId(), e.authorUsername(), e.authorName(), media.urlFor(e.authorAvatarKey())),
          e.happenedAt(), e.happenedOn(), (day ? "Day " : "Part ") + number, number, e.title(), e.body(), e.placeName(), e.milestone(), files,
          e.likeCount(), e.commentCount(), e.createdAt(), e.editedAt() != null,
          new EntryViewerResponse(e.authorId().equals(viewer), e.authorId().equals(viewer) || e.journeyOwnerId().equals(viewer), e.liked()));
    }).toList();
  }
}
