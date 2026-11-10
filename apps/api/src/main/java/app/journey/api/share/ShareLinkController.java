package app.journey.api.share;

import app.journey.api.auth.Me;
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

    private final ShareLinks links;

    ShareLinkController(ShareLinks links) {
        this.links = links;
    }

    @GetMapping("/entries/{id}/share-link")
    @Operation(
            operationId = "getEntryShareLink",
            summary = "The link to share one entry. A private journey's entries have none.")
    ShareLinkResponse entry(@Me UUID me, @PathVariable UUID id) {
        return answer(links.toEntry(id, me));
    }

    @GetMapping("/me/share-link")
    @Operation(
            operationId = "getMyShareLink",
            summary = "Your 'Follow my journey' link: a page with your public journeys, for a social bio")
    ShareLinkResponse mine(@Me UUID me) {
        return answer(links.toMe(me));
    }

    private static ShareLinkResponse answer(ShareLinks.Link link) {
        return new ShareLinkResponse(link.url(), link.text());
    }
}
