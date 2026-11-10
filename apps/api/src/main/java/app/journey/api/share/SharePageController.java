package app.journey.api.share;

import app.journey.api.common.ApiProblem;
import app.journey.api.entry.EntryService;
import app.journey.api.journey.JourneyService;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.ResponseStatus;

/**
 * The public web pages behind shared links: a journey, read-only, for people who don't have the app.
 * Anyone can open them without signing in, so they only ever show public and unlisted journeys.
 * Chats show a rich preview from the page's title, description and cover.
 */
@Controller
class SharePageController {

    /** Stands for "nobody": a viewer who follows nothing, owns nothing and is blocked by nobody. */
    private static final UUID ANYONE = new UUID(0, 0);

    private final JourneyService journeys;
    private final EntryService entries;

    SharePageController(JourneyService journeys, EntryService entries) {
        this.journeys = journeys;
        this.entries = entries;
    }

    /** The page shows the start of a long story; the rest is in the app. */
    private static final int PAGE = 60;

    @GetMapping("/j/{id}")
    String journey(@PathVariable UUID id, Model model) {
        var journey = journeys.view(journeys.require(id, ANYONE), ANYONE);
        model.addAttribute("journey", journey);
        var story = entries.timeline(id, ANYONE, null, PAGE, null);
        model.addAttribute("entries", story.items());
        model.addAttribute("more", story.total() - story.items().size());
        model.addAttribute("appLink", "journey://journey/" + id);
        return "share/journey";
    }

    /** A private or missing journey, or a link that isn't a journey id, gets the same friendly page. */
    @ExceptionHandler({
        ApiProblem.class,
        IllegalArgumentException.class,
        org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class
    })
    @ResponseStatus(HttpStatus.NOT_FOUND)
    String notFound() {
        return "share/missing";
    }
}
