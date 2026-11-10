package app.journey.api.share;

import app.journey.api.common.ApiProblem;
import app.journey.api.common.PublicUrls;
import app.journey.api.entry.EntryService;
import app.journey.api.journey.JourneyService;
import app.journey.api.journey.Visibility;
import app.journey.api.profile.ProfileService;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The links people share, and what may have one. A journey's own link comes with the journey
 * ({@code shareUrl}); an invitation's with the invitation.
 */
@Service
public class ShareLinks {

    /** A web page anyone can open, and a line to send along with it. */
    public record Link(String url, String text) {}

    private final EntryService entries;
    private final JourneyService journeys;
    private final ProfileService profiles;
    private final PublicUrls urls;

    ShareLinks(EntryService entries, JourneyService journeys, ProfileService profiles, PublicUrls urls) {
        this.entries = entries;
        this.journeys = journeys;
        this.profiles = profiles;
        this.urls = urls;
    }

    /** One entry's link. The page behind it shows only public and unlisted journeys, so a private one has none. */
    @Transactional(readOnly = true)
    public Link toEntry(UUID entryId, UUID me) {
        var entry = entries.get(entryId, me);
        var journey = journeys.require(entry.journeyId(), me);
        if (journey.visibility() == Visibility.PRIVATE) {
            throw ApiProblem.badRequest(
                    "not_shareable", "This entry is in a private journey, so there is no link to share.");
        }
        String headline = entry.title().isEmpty() ? entry.label() : entry.title();
        return new Link(urls.to("/e/" + entryId), "%s · %s".formatted(headline, journey.title()));
    }

    /** "Follow my journey": the page with a person's public journeys, for a social bio. */
    @Transactional(readOnly = true)
    public Link toMe(UUID me) {
        var profile = profiles.find(me)
                .orElseThrow(() -> ApiProblem.conflict("profile_required", "Finish setting up your profile first."));
        return new Link(urls.to("/u/" + profile.username()), "Follow %s on Journey".formatted(profile.displayName()));
    }
}
