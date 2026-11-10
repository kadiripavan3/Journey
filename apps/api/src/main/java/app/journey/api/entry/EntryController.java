package app.journey.api.entry;

import app.journey.api.auth.CurrentUser;
import app.journey.api.entry.EntryService.EntryResponse;
import app.journey.api.journey.JourneyService;
import app.journey.api.journey.JourneyService.JourneyResponse;
import app.journey.api.journey.JourneyStore;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1")
@Tag(name = "entries", description = "Entries, the story line and the Home feed")
class EntryController {

  private final EntryService entries;
  private final JourneyService journeys;
  private final JourneyStore journeyStore;

  EntryController(EntryService entries, JourneyService journeys, JourneyStore journeyStore) {
    this.entries = entries;
    this.journeys = journeys;
    this.journeyStore = journeyStore;
  }

  record SaveEntryRequest(
      @Size(max = 80, message = "Use 80 characters or fewer.") String title,
      @Size(max = 2000, message = "Use 2,000 characters or fewer.") String body,
      Instant happenedAt,
      LocalDate happenedOn,
      @Size(max = 80, message = "Use 80 characters or fewer.") String placeName,
      Boolean isMilestone,
      @Size(max = 13, message = "That's too many photos and clips for one entry.") List<UUID> mediaIds) {}

  record FeedGroupResponse(JourneyResponse journey, int newCount, List<EntryResponse> entries) {}

  record FeedResponse(List<FeedGroupResponse> groups, int followingCount) {}

  @GetMapping("/journeys/{journeyId}/entries")
  @Operation(operationId = "getTimeline", summary = "A journey's entries, in the order things happened")
  List<EntryResponse> timeline(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID journeyId) {
    return entries.timeline(journeyId, me(jwt));
  }

  @PostMapping("/journeys/{journeyId}/entries")
  @ResponseStatus(HttpStatus.CREATED)
  @Operation(operationId = "addEntry", summary = "Add an entry to a journey")
  EntryResponse add(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID journeyId, @Valid @RequestBody SaveEntryRequest r) {
    return entries.add(journeyId, me(jwt), r.title(), r.body(), r.happenedAt(), r.happenedOn(), r.placeName(), Boolean.TRUE.equals(r.isMilestone()), r.mediaIds());
  }

  @GetMapping("/entries/{id}")
  @Operation(operationId = "getEntry", summary = "One entry")
  EntryResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
    return entries.get(id, me(jwt));
  }

  @PutMapping("/entries/{id}")
  @Operation(operationId = "changeEntry", summary = "Change an entry. It is marked as edited.")
  EntryResponse change(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody SaveEntryRequest r) {
    return entries.change(id, me(jwt), r.title(), r.body(), r.happenedAt(), r.happenedOn(), r.placeName(), Boolean.TRUE.equals(r.isMilestone()), r.mediaIds());
  }

  @DeleteMapping("/entries/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Operation(operationId = "deleteEntry", summary = "Delete an entry")
  void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
    entries.delete(id, me(jwt));
  }

  @PutMapping("/entries/{id}/like")
  @Operation(operationId = "likeEntry", summary = "Like an entry")
  EntryResponse like(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
    return entries.like(id, me(jwt));
  }

  @DeleteMapping("/entries/{id}/like")
  @Operation(operationId = "unlikeEntry", summary = "Take a like back")
  EntryResponse unlike(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
    return entries.unlike(id, me(jwt));
  }

  @GetMapping("/feed")
  @Operation(operationId = "getFeed", summary = "Home: what's new in the journeys you follow, grouped per journey, newest first")
  FeedResponse feed(@AuthenticationPrincipal Jwt jwt) {
    UUID me = me(jwt);
    List<FeedGroupResponse> groups = journeyStore.journeysWithNewEntries(me, 30).stream()
        .flatMap(found -> journeyStore.find(found.journeyId(), me).stream()
            .map(journey -> new FeedGroupResponse(
                journeys.view(journey, me), found.newCount(), entries.latestByOthers(found.journeyId(), me, Math.min(found.newCount(), 3)))))
        .toList();
    return new FeedResponse(groups, journeyStore.followingCount(me));
  }

  private static UUID me(Jwt jwt) {
    return CurrentUser.from(jwt).id();
  }
}
