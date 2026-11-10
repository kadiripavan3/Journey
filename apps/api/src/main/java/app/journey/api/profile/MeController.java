package app.journey.api.profile;

import app.journey.api.auth.CurrentUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1")
@Tag(name = "me", description = "The signed-in person and their profile")
class MeController {

  private final ProfileService profiles;

  MeController(ProfileService profiles) {
    this.profiles = profiles;
  }

  record ProfileResponse(
      UUID id,
      String username,
      String displayName,
      String bio,
      @Schema(nullable = true) String link,
      @Schema(nullable = true) String avatarUrl,
      List<String> interests) {

    static ProfileResponse of(Profile profile) {
      return new ProfileResponse(
          profile.getId(),
          profile.getUsername(),
          profile.getDisplayName(),
          profile.getBio(),
          profile.getLink(),
          null, // photos arrive with the Create milestone
          List.of(profile.getInterests()));
    }
  }

  record MeResponse(
      UUID id,
      String email,
      @Schema(nullable = true, description = "Null until the person has created their profile") ProfileResponse profile) {}

  record SaveProfileRequest(
      @NotBlank(message = "Add your name.") @Size(max = 50, message = "Use 50 characters or fewer.") String displayName,
      @NotBlank(message = "Choose a username.") @Size(max = 21, message = "Use 20 characters or fewer.") String username,
      @Size(max = 150, message = "Use 150 characters or fewer.") String bio,
      @Size(max = 200, message = "That link is too long.") String link,
      @Size(max = 20, message = "Pick 20 interests at most.") List<@Size(max = 30) String> interests) {}

  record UsernameCheckResponse(String username, boolean available, @Schema(nullable = true) String reason) {}

  @GetMapping("/me")
  @Operation(operationId = "getMe", summary = "Who is signed in, with their profile if they have one")
  MeResponse me(@AuthenticationPrincipal Jwt jwt) {
    CurrentUser user = CurrentUser.from(jwt);
    return new MeResponse(user.id(), user.email(), profiles.find(user.id()).map(ProfileResponse::of).orElse(null));
  }

  @PutMapping("/me/profile")
  @Operation(operationId = "saveProfile", summary = "Create the profile, or change it")
  ProfileResponse saveProfile(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody SaveProfileRequest request) {
    CurrentUser user = CurrentUser.from(jwt);
    return ProfileResponse.of(
        profiles.save(user.id(), request.username(), request.displayName(), request.bio(), request.link(), request.interests()));
  }

  @GetMapping("/usernames/{username}")
  @Operation(operationId = "checkUsername", summary = "Is this username free? Checked as the person types.")
  UsernameCheckResponse checkUsername(@AuthenticationPrincipal Jwt jwt, @PathVariable String username) {
    String normalized = Usernames.normalize(username);
    Optional<String> reason = profiles.whyUnavailable(normalized, CurrentUser.from(jwt).id());
    return new UsernameCheckResponse(normalized, reason.isEmpty(), reason.orElse(null));
  }
}
