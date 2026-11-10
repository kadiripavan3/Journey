package app.journey.api.journey;

import app.journey.api.auth.CurrentUser;
import app.journey.api.journey.JourneyService.JourneyResponse;
import app.journey.api.journey.MemberService.InvitationResponse;
import app.journey.api.journey.MemberService.MembersResponse;
import app.journey.api.profile.PersonResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1")
@Tag(name = "Shared journeys")
class MemberController {

  record InviteRequest(@NotBlank(message = "Choose someone to invite.") String username) {}

  private final MemberService members;

  MemberController(MemberService members) {
    this.members = members;
  }

  @GetMapping("/journeys/{id}/members")
  @Operation(operationId = "getMembers", summary = "Who writes in a journey, and how many more friends can be invited")
  MembersResponse members(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
    return members.members(id, me(jwt));
  }

  @GetMapping("/journeys/{id}/invitable")
  @Operation(operationId = "getInvitable", summary = "The owner's followers who can still be invited")
  List<PersonResponse> invitable(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
    return members.invitable(id, me(jwt));
  }

  @PostMapping("/journeys/{id}/members")
  @Operation(operationId = "inviteMember", summary = "Invite a follower to add entries to the journey. They join only if they accept.")
  MembersResponse invite(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody InviteRequest request) {
    return members.invite(id, me(jwt), request.username());
  }

  @DeleteMapping("/journeys/{id}/members/{username}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Operation(operationId = "removeMember", summary = "The owner removes someone or takes an invitation back; a friend leaves or declines. Entries stay.")
  void remove(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @PathVariable String username) {
    members.remove(id, me(jwt), username);
  }

  @GetMapping("/me/invitations")
  @Operation(operationId = "getInvitations", summary = "Invitations to shared journeys that are waiting for your answer")
  List<InvitationResponse> invitations(@AuthenticationPrincipal Jwt jwt) {
    return members.invitations(me(jwt));
  }

  @PostMapping("/journeys/{id}/invitation/accept")
  @Operation(operationId = "acceptInvitation", summary = "Join a shared journey you were invited to")
  JourneyResponse accept(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
    return members.accept(id, me(jwt));
  }

  private static UUID me(Jwt jwt) {
    return CurrentUser.from(jwt).id();
  }
}
