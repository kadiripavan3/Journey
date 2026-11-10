package app.journey.api.journey;

import app.journey.api.auth.Me;
import app.journey.api.common.Page;
import app.journey.api.common.PageRequest;
import app.journey.api.journey.JourneyService.DiscoverResponse;
import app.journey.api.journey.JourneyService.JourneyResponse;
import app.journey.api.profile.Profile;
import app.journey.api.profile.ProfileService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
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
@Tag(name = "journeys", description = "Journeys, following and discovery")
class JourneyController {

  private final JourneyService journeys;
  private final ProfileService profiles;

  JourneyController(JourneyService journeys, ProfileService profiles) {
    this.journeys = journeys;
    this.profiles = profiles;
  }

  record CreateJourneyRequest(
      @NotBlank(message = "Give your journey a title.") @Size(max = 80, message = "Use 80 characters or fewer.") String title,
      @Size(max = 300, message = "Use 300 characters or fewer.") String description,
      @NotBlank(message = "Pick a starting point.") String template,
      String category,
      @NotNull(message = "Choose a start date.") LocalDate startDate,
      @NotNull(message = "Choose who can see it.") Visibility visibility,
      LabelStyle labelStyle,
      List<String> tags,
      UUID coverMediaId,
      @Schema(description = "An id the app makes up for this draft. Sending the same draft again gives back the journey it made the first time.") UUID clientId) {}

  record UpdateJourneyRequest(
      @Size(min = 1, max = 80, message = "Use 1 to 80 characters.") String title,
      @Size(max = 300, message = "Use 300 characters or fewer.") String description,
      String category,
      LocalDate startDate,
      Visibility visibility,
      LabelStyle labelStyle,
      List<String> tags,
      UUID coverMediaId,
      @Schema(description = "True to go back to using the first photo as the cover") Boolean clearCover,
      @Schema(description = "active or paused. Completing a journey has its own step.") JourneyStatus status) {}

  record CompleteJourneyRequest(@Size(max = 500, message = "Use 500 characters or fewer.") String closingNote) {}

  @PostMapping("/journeys")
  @ResponseStatus(HttpStatus.CREATED)
  @Operation(operationId = "createJourney", summary = "Start a journey")
  JourneyResponse create(@Me UUID me, @Valid @RequestBody CreateJourneyRequest r) {
    return journeys.create(me, r.clientId(), r.title(), r.description(), r.template(), r.category(), r.startDate(), r.visibility(), r.labelStyle(), r.tags(), r.coverMediaId());
  }

  @GetMapping("/journeys/{id}")
  @Operation(operationId = "getJourney", summary = "One journey, if you may see it")
  JourneyResponse get(@Me UUID me, @PathVariable UUID id) {
    return journeys.view(journeys.require(id, me), me);
  }

  @PatchMapping("/journeys/{id}")
  @Operation(operationId = "updateJourney", summary = "Change a journey. Only the fields you send are changed.")
  JourneyResponse update(@Me UUID me, @PathVariable UUID id, @Valid @RequestBody UpdateJourneyRequest r) {
    return journeys.update(id, me, r.title(), r.description(), r.category(), r.startDate(), r.visibility(), r.labelStyle(), r.tags(),
        r.coverMediaId(), Boolean.TRUE.equals(r.clearCover()), r.status());
  }

  @PostMapping("/journeys/{id}/complete")
  @Operation(operationId = "completeJourney", summary = "Close a journey with a last note")
  JourneyResponse complete(@Me UUID me, @PathVariable UUID id, @Valid @RequestBody CompleteJourneyRequest r) {
    return journeys.complete(id, me, r.closingNote());
  }

  @DeleteMapping("/journeys/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Operation(operationId = "deleteJourney", summary = "Delete a journey and everything in it")
  void delete(@Me UUID me, @PathVariable UUID id) {
    journeys.delete(id, me);
  }

  @PutMapping("/journeys/{id}/follow")
  @Operation(operationId = "followJourney", summary = "Follow a journey")
  JourneyResponse follow(@Me UUID me, @PathVariable UUID id) {
    return journeys.follow(id, me);
  }

  @DeleteMapping("/journeys/{id}/follow")
  @Operation(operationId = "unfollowJourney", summary = "Stop following a journey")
  JourneyResponse unfollow(@Me UUID me, @PathVariable UUID id) {
    return journeys.unfollow(id, me);
  }

  @PostMapping("/journeys/{id}/read")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Operation(operationId = "markJourneyRead", summary = "The reader has caught up with this journey")
  void markRead(@Me UUID me, @PathVariable UUID id) {
    journeys.markRead(id, me);
  }

  @GetMapping("/me/journeys")
  @Operation(operationId = "getMyJourneys", summary = "Your own journeys, of every visibility")
  Page<JourneyResponse> mine(@Me UUID me, @RequestParam(required = false) String cursor, @RequestParam(required = false) Integer limit) {
    return journeys.mine(me, PageRequest.of(cursor, limit, 30));
  }

  @GetMapping("/me/following")
  @Operation(operationId = "getFollowedJourneys", summary = "The journeys you follow")
  Page<JourneyResponse> following(@Me UUID me, @RequestParam(required = false) String cursor, @RequestParam(required = false) Integer limit) {
    return journeys.following(me, PageRequest.of(cursor, limit, 30));
  }

  @GetMapping("/profiles/{username}/journeys")
  @Operation(operationId = "getJourneysByUsername", summary = "Someone's public journeys")
  Page<JourneyResponse> byUsername(
      @Me UUID me, @PathVariable String username, @RequestParam(required = false) String cursor, @RequestParam(required = false) Integer limit) {
    return journeys.publicBy(username.toLowerCase(), me, PageRequest.of(cursor, limit, 30));
  }

  @GetMapping("/journeys/{id}/recap")
  @Operation(operationId = "getRecap", summary = "What a journey adds up to: days, entries, places, photos and its best moments")
  JourneyService.RecapResponse recap(@Me UUID me, @PathVariable UUID id) {
    return journeys.recap(id, me);
  }

  @GetMapping("/discover")
  @Operation(operationId = "getDiscover", summary = "Trending, new and recently completed journeys")
  DiscoverResponse discover(@Me UUID me, @RequestParam(required = false) String category) {
    return journeys.discover(me, category);
  }

  @GetMapping("/journeys/suggested")
  @Operation(operationId = "getSuggestedJourneys", summary = "A few journeys to follow, matched to your interests")
  List<JourneyResponse> suggested(@Me UUID me, @RequestParam(defaultValue = "6") int limit) {
    List<String> interests = profiles.find(me).map(Profile::interests).orElse(List.of());
    return journeys.suggested(me, interests, Math.clamp(limit, 1, 20));
  }

}
