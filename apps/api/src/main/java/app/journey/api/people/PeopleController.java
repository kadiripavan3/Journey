package app.journey.api.people;

import app.journey.api.auth.CurrentUser;
import app.journey.api.people.PeopleService.ListedPersonResponse;
import app.journey.api.people.PeopleService.PublicProfileResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/profiles/{username}")
@Tag(name = "People")
class PeopleController {

  private final PeopleService people;

  PeopleController(PeopleService people) {
    this.people = people;
  }

  @GetMapping
  @Operation(operationId = "getProfile", summary = "Someone's profile, with their counts and whether you follow them")
  PublicProfileResponse profile(@AuthenticationPrincipal Jwt jwt, @PathVariable String username) {
    return people.profile(username, me(jwt));
  }

  @PutMapping("/follow")
  @Operation(operationId = "followProfile", summary = "Follow a person. Their future public journeys are followed for you.")
  PublicProfileResponse follow(@AuthenticationPrincipal Jwt jwt, @PathVariable String username) {
    return people.follow(username, me(jwt));
  }

  @DeleteMapping("/follow")
  @Operation(operationId = "unfollowProfile", summary = "Stop following a person. Journeys you already follow stay followed.")
  PublicProfileResponse unfollow(@AuthenticationPrincipal Jwt jwt, @PathVariable String username) {
    return people.unfollow(username, me(jwt));
  }

  @GetMapping("/followers")
  @Operation(operationId = "getFollowers", summary = "The people who follow someone, newest first")
  List<ListedPersonResponse> followers(@AuthenticationPrincipal Jwt jwt, @PathVariable String username) {
    return people.listed(username, true, me(jwt));
  }

  @GetMapping("/following")
  @Operation(operationId = "getFollowing", summary = "The people someone follows, newest first")
  List<ListedPersonResponse> following(@AuthenticationPrincipal Jwt jwt, @PathVariable String username) {
    return people.listed(username, false, me(jwt));
  }

  private static UUID me(Jwt jwt) {
    return CurrentUser.from(jwt).id();
  }
}
