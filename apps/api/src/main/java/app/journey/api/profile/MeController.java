package app.journey.api.profile;

import app.journey.api.auth.CurrentUser;
import app.journey.api.auth.Me;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
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

        static ProfileResponse of(Profile profile, String avatarUrl) {
            return new ProfileResponse(
                    profile.id(),
                    profile.username(),
                    profile.displayName(),
                    profile.bio(),
                    profile.link(),
                    avatarUrl,
                    profile.interests());
        }
    }

    record MeResponse(
            UUID id,
            String email,

            @Schema(nullable = true, description = "Null until the person has created their profile")
            ProfileResponse profile) {}

    record SaveProfileRequest(
            @NotBlank(message = "Add your name.") @Size(max = 50, message = "Use 50 characters or fewer.")
            String displayName,

            @NotBlank(message = "Choose a username.") @Size(max = 21, message = "Use 20 characters or fewer.")
            String username,

            @Size(max = 150, message = "Use 150 characters or fewer.")
            String bio,

            @Size(max = 200, message = "That link is too long.")
            String link,

            @Size(max = 20, message = "Pick 20 interests at most.")
            List<@Size(max = 30) String> interests,

            @Schema(description = "A photo uploaded through /v1/media/uploads")
            UUID avatarMediaId,

            @Schema(description = "True to go back to no picture")
            Boolean removeAvatar,

            @Schema(
                    description =
                            "The person confirms they are 13 or older. Needed, and must be true, when the profile is first created.")
            Boolean ageConfirmed) {}

    record UsernameCheckResponse(
            String username,
            boolean available,
            @Schema(nullable = true) String reason) {}

    @GetMapping("/me")
    @Operation(operationId = "getMe", summary = "Who is signed in, with their profile if they have one")
    MeResponse me(@Me CurrentUser user) {
        return new MeResponse(
                user.id(),
                user.email(),
                profiles.find(user.id()).map(this::view).orElse(null));
    }

    @PutMapping("/me/profile")
    @Operation(operationId = "saveProfile", summary = "Create the profile, or change it")
    ProfileResponse saveProfile(@Me UUID me, @Valid @RequestBody SaveProfileRequest request) {
        return view(profiles.save(
                me,
                request.username(),
                request.displayName(),
                request.bio(),
                request.link(),
                request.interests(),
                request.avatarMediaId(),
                Boolean.TRUE.equals(request.removeAvatar()),
                Boolean.TRUE.equals(request.ageConfirmed())));
    }

    private ProfileResponse view(Profile profile) {
        return ProfileResponse.of(profile, profiles.avatarUrl(profile));
    }

    @GetMapping("/usernames/{username}")
    @Operation(operationId = "checkUsername", summary = "Is this username free? Checked as the person types.")
    UsernameCheckResponse checkUsername(@Me UUID me, @PathVariable String username) {
        String normalized = Usernames.normalize(username);
        Optional<String> reason = profiles.whyUnavailable(normalized, me);
        return new UsernameCheckResponse(normalized, reason.isEmpty(), reason.orElse(null));
    }
}
