package app.journey.api.entry;

import app.journey.api.auth.Me;
import app.journey.api.common.PageRequest;
import app.journey.api.entry.EntryService.EntryResponse;
import app.journey.api.entry.EntryService.JourneySummaryResponse;
import app.journey.api.entry.EntryService.TimelinePageResponse;
import app.journey.api.entry.FeedService.FeedResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1")
@Tag(name = "entries", description = "Entries, the story line and the Home feed")
class EntryController {

  private final EntryService entries;
  private final FeedService feed;

  EntryController(EntryService entries, FeedService feed) {
    this.entries = entries;
    this.feed = feed;
  }

  record SaveEntryRequest(
      @Size(max = 80, message = "Use 80 characters or fewer.") String title,
      @Size(max = 2000, message = "Use 2,000 characters or fewer.") String body,
      Instant happenedAt,
      LocalDate happenedOn,
      @Size(max = 80, message = "Use 80 characters or fewer.") String placeName,
      Boolean isMilestone,
      @Size(max = 13, message = "That's too many photos and clips for one entry.") List<UUID> mediaIds,
      @Schema(description = "An id the app makes up for this draft. Sending the same draft again gives back the entry it made the first time.") UUID clientId) {}

  @GetMapping("/journeys/{journeyId}/entries")
  @Operation(operationId = "getTimeline", summary = "A page of a journey's story, in the order things happened")
  TimelinePageResponse timeline(
      @Me UUID me, @PathVariable UUID journeyId,
      @RequestParam(required = false) String cursor,
      @RequestParam(required = false) Integer limit,
      @Parameter(description = "An entry id: start with the page that holds it") @RequestParam(required = false) UUID around) {
    return entries.timeline(journeyId, me, cursor, limit, around);
  }

  @GetMapping("/journeys/{journeyId}/summary")
  @Operation(operationId = "getJourneySummary", summary = "What a journey's page shows of its story: the newest entries, first photos, ticked days and big moments")
  JourneySummaryResponse summary(@Me UUID me, @PathVariable UUID journeyId) {
    return entries.summary(journeyId, me);
  }

  @PostMapping("/journeys/{journeyId}/entries")
  @ResponseStatus(HttpStatus.CREATED)
  @Operation(operationId = "addEntry", summary = "Add an entry to a journey")
  EntryResponse add(@Me UUID me, @PathVariable UUID journeyId, @Valid @RequestBody SaveEntryRequest r) {
    return entries.add(journeyId, me, r.clientId(), r.title(), r.body(), r.happenedAt(), r.happenedOn(), r.placeName(), Boolean.TRUE.equals(r.isMilestone()), r.mediaIds());
  }

  @GetMapping("/entries/{id}")
  @Operation(operationId = "getEntry", summary = "One entry")
  EntryResponse get(@Me UUID me, @PathVariable UUID id) {
    return entries.get(id, me);
  }

  @PutMapping("/entries/{id}")
  @Operation(operationId = "changeEntry", summary = "Change an entry. It is marked as edited.")
  EntryResponse change(@Me UUID me, @PathVariable UUID id, @Valid @RequestBody SaveEntryRequest r) {
    return entries.change(id, me, r.title(), r.body(), r.happenedAt(), r.happenedOn(), r.placeName(), Boolean.TRUE.equals(r.isMilestone()), r.mediaIds());
  }

  @DeleteMapping("/entries/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Operation(operationId = "deleteEntry", summary = "Delete an entry")
  void delete(@Me UUID me, @PathVariable UUID id) {
    entries.delete(id, me);
  }

  @PutMapping("/entries/{id}/like")
  @Operation(operationId = "likeEntry", summary = "Like an entry")
  EntryResponse like(@Me UUID me, @PathVariable UUID id) {
    return entries.like(id, me);
  }

  @DeleteMapping("/entries/{id}/like")
  @Operation(operationId = "unlikeEntry", summary = "Take a like back")
  EntryResponse unlike(@Me UUID me, @PathVariable UUID id) {
    return entries.unlike(id, me);
  }

  @GetMapping("/feed")
  @Operation(operationId = "getFeed", summary = "Home: what's new in the journeys you follow or write in, grouped per journey, newest first")
  FeedResponse feed(@Me UUID me, @RequestParam(required = false) String cursor, @RequestParam(required = false) Integer limit) {
    return feed.feed(me, PageRequest.of(cursor, limit, FeedService.PAGE));
  }
}
