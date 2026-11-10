package app.journey.api.share;

import app.journey.api.auth.Me;
import app.journey.api.common.ApiProblem;
import app.journey.api.common.PublicUrls;
import app.journey.api.entry.EntryService;
import app.journey.api.journey.JourneyService;
import app.journey.api.journey.Visibility;
import app.journey.api.profile.ProfileService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The links people share. The API hands them out, so the app never has to know how a web address is built.
 * (A journey's own link comes with the journey, as {@code shareUrl}.)
 */
@RestController
@RequestMapping("/v1")
@Tag(name = "Sharing")
class ShareLinkController {

    record ShareLinkResponse(
            @Schema(description = "A web page anyone can open, with or without the app")
            String url,

            @Schema(description = "A line to send along with the link")
            String text) {}

    private final EntryService entries;
    private final JourneyService journeys;
    private final ProfileService profiles;
    private final PublicUrls urls;

    ShareLinkController(EntryService entries, JourneyService journeys, ProfileService profiles, PublicUrls urls) {
        this.entries = entries;
        this.journeys = journeys;
        this.profiles = profiles;
        this.urls = urls;
    }

    @GetMapping("/entries/{id}/share-link")
    @Operation(
            operationId = "getEntryShareLink",
            summary = "The link to share one entry. A private journey's entries have none.")
    ShareLinkResponse entry(@Me UUID me, @PathVariable UUID id) {
        var entry = entries.get(id, me);
        var journey = journeys.require(entry.journeyId(), me);
        if (journey.visibility() == Visibility.PRIVATE) {
            throw ApiProblem.badRequest(
                    "not_shareable", "This entry is in a private journey, so there is no link to share.");
        }
        String headline = entry.title().isEmpty() ? entry.label() : entry.title();
        return new ShareLinkResponse(urls.to("/e/" + id), "%s · %s".formatted(headline, journey.title()));
    }

    @GetMapping("/me/share-link")
    @Operation(
            operationId = "getMyShareLink",
            summary = "Your 'Follow my journey' link: a page with your public journeys, for a social bio")
    ShareLinkResponse mine(@Me UUID me) {
        var profile = profiles.find(me)
                .orElseThrow(() -> ApiProblem.conflict("profile_required", "Finish setting up your profile first."));
        return new ShareLinkResponse(
                urls.to("/u/" + profile.username()), "Follow %s on Journey".formatted(profile.displayName()));
    }
}
