package app.journey.api.journey;

import app.journey.api.auth.CurrentUser;
import app.journey.api.journey.JourneyService.DiscoverResponse;
import app.journey.api.journey.JourneyService.JourneyResponse;
import app.journey.api.profile.ProfileService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
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
      @NotBlank @Pattern(regexp = "public|unlisted|private", message = "Choose who can see it.") @Schema(allowableValues = {"public", "unlisted", "private"}) String visibility,
      @Pattern(regexp = "day|part") @Schema(allowableValues = {"day", "part"}) String labelStyle,
      List<String> tags,
      UUID coverMediaId) {}

  record UpdateJourneyRequest(
      @Size(min = 1, max = 80, message = "Use 1 to 80 characters.") String title,
      @Size(max = 300, message = "Use 300 characters or fewer.") String description,
      String category,
      LocalDate startDate,
      @Pattern(regexp = "public|unlisted|private") @Schema(allowableValues = {"public", "unlisted", "private"}) String visibility,
      @Pattern(regexp = "day|part") @Schema(allowableValues = {"day", "part"}) String labelStyle,
      List<String> tags,
      UUID coverMediaId,
      @Schema(description = "True to go back to using the first photo as the cover") Boolean clearCover,
      @Pattern(regexp = "active|paused") @Schema(allowableValues = {"active", "paused"}) String status) {}

  record CompleteJourneyRequest(@Size(max = 500, message = "Use 500 characters or fewer.") String closingNote) {}

  @PostMapping("/journeys")
  @ResponseStatus(HttpStatus.CREATED)
  @Operation(operationId = "createJourney", summary = "Start a journey")
  JourneyResponse create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody CreateJourneyRequest r) {
    return journeys.create(me(jwt), r.title(), r.description(), r.template(), r.category(), r.startDate(), r.visibility(), r.labelStyle(), r.tags(), r.coverMediaId());
  }

  @GetMapping("/journeys/{id}")
  @Operation(operationId = "getJourney", summary = "One journey, if you may see it")
  JourneyResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
    return journeys.view(journeys.require(id, me(jwt)), me(jwt));
  }

  @PatchMapping("/journeys/{id}")
  @Operation(operationId = "updateJourney", summary = "Change a journey. Only the fields you send are changed.")
  JourneyResponse update(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody UpdateJourneyRequest r) {
    return journeys.update(id, me(jwt), r.title(), r.description(), r.category(), r.startDate(), r.visibility(), r.labelStyle(), r.tags(),
        r.coverMediaId(), Boolean.TRUE.equals(r.clearCover()), r.status());
  }

  @PostMapping("/journeys/{id}/complete")
  @Operation(operationId = "completeJourney", summary = "Close a journey with a last note")
  JourneyResponse complete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody CompleteJourneyRequest r) {
    return journeys.complete(id, me(jwt), r.closingNote());
  }

  @DeleteMapping("/journeys/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Operation(operationId = "deleteJourney", summary = "Delete a journey and everything in it")
  void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
    journeys.delete(id, me(jwt));
  }

  @PutMapping("/journeys/{id}/follow")
  @Operation(operationId = "followJourney", summary = "Follow a journey")
  JourneyResponse follow(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
    return journeys.follow(id, me(jwt));
  }

  @DeleteMapping("/journeys/{id}/follow")
  @Operation(operationId = "unfollowJourney", summary = "Stop following a journey")
  JourneyResponse unfollow(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
    return journeys.unfollow(id, me(jwt));
  }

  @PostMapping("/journeys/{id}/read")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Operation(operationId = "markJourneyRead", summary = "The reader has caught up with this journey")
  void markRead(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
    journeys.markRead(id, me(jwt));
  }

  @GetMapping("/me/journeys")
  @Operation(operationId = "getMyJourneys", summary = "Your own journeys, of every visibility")
  List<JourneyResponse> mine(@AuthenticationPrincipal Jwt jwt) {
    return journeys.mine(me(jwt));
  }

  @GetMapping("/me/following")
  @Operation(operationId = "getFollowedJourneys", summary = "The journeys you follow")
  List<JourneyResponse> following(@AuthenticationPrincipal Jwt jwt) {
    return journeys.following(me(jwt));
  }

  @GetMapping("/profiles/{username}/journeys")
  @Operation(operationId = "getJourneysByUsername", summary = "Someone's public journeys")
  List<JourneyResponse> byUsername(@AuthenticationPrincipal Jwt jwt, @PathVariable String username) {
    return journeys.publicBy(username.toLowerCase(), me(jwt));
  }

  @GetMapping("/discover")
  @Operation(operationId = "getDiscover", summary = "Trending, new and recently completed journeys")
  DiscoverResponse discover(@AuthenticationPrincipal Jwt jwt, @RequestParam(required = false) String category) {
    return journeys.discover(me(jwt), category);
  }

  @GetMapping("/journeys/suggested")
  @Operation(operationId = "getSuggestedJourneys", summary = "A few journeys to follow, matched to your interests")
  List<JourneyResponse> suggested(@AuthenticationPrincipal Jwt jwt, @RequestParam(defaultValue = "6") int limit) {
    UUID me = me(jwt);
    List<String> interests = profiles.find(me).map(p -> List.of(p.getInterests())).orElse(List.of());
    return journeys.suggested(me, interests, Math.clamp(limit, 1, 20));
  }

  private static UUID me(Jwt jwt) {
    return CurrentUser.from(jwt).id();
  }
}
