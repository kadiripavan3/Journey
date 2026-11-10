package app.journey.api.journey;

import app.journey.api.auth.Me;
import app.journey.api.journey.InviteLinkService.InviteLinkResponse;
import app.journey.api.journey.InviteLinkService.LinkInvitationResponse;
import app.journey.api.journey.JourneyService.JourneyResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1")
@Tag(name = "Shared journeys")
class InviteLinkController {

    private final InviteLinkService links;

    InviteLinkController(InviteLinkService links) {
        this.links = links;
    }

    @PostMapping("/journeys/{id}/invite-link")
    @Operation(
            operationId = "createInviteLink",
            summary =
                    "Make a one-time link for a friend who isn't on Journey yet. It works once, for one person, for 7 days; making a new one stops the old one.")
    InviteLinkResponse create(@Me UUID me, @PathVariable UUID id) {
        return links.create(id, me);
    }

    @GetMapping("/invites/{token}")
    @Operation(operationId = "getLinkInvitation", summary = "What an invite link invites you to")
    LinkInvitationResponse look(@Me UUID me, @PathVariable String token) {
        return links.look(token, me);
    }

    @PostMapping("/invites/{token}/accept")
    @Operation(
            operationId = "acceptInviteLink",
            summary = "Join the journey an invite link is for. The link is used up.")
    JourneyResponse accept(@Me UUID me, @PathVariable String token) {
        return links.accept(token, me);
    }
}
