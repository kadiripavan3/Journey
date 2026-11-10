package app.journey.api.journey;

import app.journey.api.auth.Me;
import app.journey.api.common.Page;
import app.journey.api.common.PageRequest;
import app.journey.api.journey.JourneyService.JourneyResponse;
import app.journey.api.journey.MemberService.InvitationResponse;
import app.journey.api.journey.MemberService.MembersResponse;
import app.journey.api.profile.PersonResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1")
@Tag(name = "Shared journeys")
class MemberController {

    record InviteRequest(
            @NotBlank(message = "Choose someone to invite.") String username) {}

    private final MemberService members;

    MemberController(MemberService members) {
        this.members = members;
    }

    @GetMapping("/journeys/{id}/members")
    @Operation(
            operationId = "getMembers",
            summary = "Who writes in a journey, and how many more friends can be invited")
    MembersResponse members(@Me UUID me, @PathVariable UUID id) {
        return members.members(id, me);
    }

    @GetMapping("/journeys/{id}/invitable")
    @Operation(operationId = "getInvitable", summary = "The owner's followers who can still be invited")
    Page<PersonResponse> invitable(
            @Me UUID me,
            @PathVariable UUID id,
            @RequestParam(required = false) String cursor,
            @RequestParam(required = false) Integer limit) {
        return members.invitable(id, me, PageRequest.of(cursor, limit, 30));
    }

    @PostMapping("/journeys/{id}/members")
    @Operation(
            operationId = "inviteMember",
            summary = "Invite a follower to add entries to the journey. They join only if they accept.")
    MembersResponse invite(@Me UUID me, @PathVariable UUID id, @Valid @RequestBody InviteRequest request) {
        return members.invite(id, me, request.username());
    }

    @DeleteMapping("/journeys/{id}/members/{username}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(
            operationId = "removeMember",
            summary =
                    "The owner removes someone or takes an invitation back; a friend leaves or declines. Entries stay.")
    void remove(@Me UUID me, @PathVariable UUID id, @PathVariable String username) {
        members.remove(id, me, username);
    }

    @GetMapping("/me/invitations")
    @Operation(
            operationId = "getInvitations",
            summary = "Invitations to shared journeys that are waiting for your answer")
    Page<InvitationResponse> invitations(
            @Me UUID me, @RequestParam(required = false) String cursor, @RequestParam(required = false) Integer limit) {
        return members.invitations(me, PageRequest.of(cursor, limit, 30));
    }

    @PostMapping("/journeys/{id}/invitation/accept")
    @Operation(operationId = "acceptInvitation", summary = "Join a shared journey you were invited to")
    JourneyResponse accept(@Me UUID me, @PathVariable UUID id) {
        return members.accept(id, me);
    }
}
