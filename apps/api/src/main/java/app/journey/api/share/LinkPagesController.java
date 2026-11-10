package app.journey.api.share;

import app.journey.api.common.ApiProblem;
import app.journey.api.common.PageRequest;
import app.journey.api.entry.EntryService;
import app.journey.api.journey.InviteLinkService;
import app.journey.api.journey.JourneyService;
import app.journey.api.people.PeopleService;
import io.swagger.v3.oas.annotations.Hidden;
import jakarta.servlet.http.HttpServletResponse;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.ResponseStatus;

/**
 * More public web pages behind shared links, next to the journey's own ({@link SharePageController}): one
 * entry, one person ("Follow my journey", for a social bio), and an invitation by one-time link. Anyone can
 * open them without signing in, so they show only what anyone may see.
 */
@Controller
@Hidden
class LinkPagesController {

    /** Stands for "nobody": a viewer who follows nothing, owns nothing and is blocked by nobody. */
    private static final UUID ANYONE = new UUID(0, 0);

    private final JourneyService journeys;
    private final EntryService entries;
    private final PeopleService people;
    private final InviteLinkService invites;

    LinkPagesController(
            JourneyService journeys, EntryService entries, PeopleService people, InviteLinkService invites) {
        this.journeys = journeys;
        this.entries = entries;
        this.people = people;
        this.invites = invites;
    }

    /** One entry of a public or unlisted journey. */
    @GetMapping("/e/{id}")
    String entry(@PathVariable UUID id, Model model) {
        var entry = entries.get(id, ANYONE);
        model.addAttribute("entry", entry);
        model.addAttribute("journey", journeys.view(journeys.require(entry.journeyId(), ANYONE), ANYONE));
        model.addAttribute("appLink", "journey://entry/" + id);
        return "share/entry";
    }

    /** A person and their public journeys: the page behind "Follow my journey". */
    @GetMapping("/u/{username}")
    String person(@PathVariable String username, Model model) {
        var person = people.profile(username, ANYONE);
        model.addAttribute("person", person);
        model.addAttribute(
                "journeys",
                journeys.publicBy(person.username(), ANYONE, new PageRequest(0, 30))
                        .items());
        model.addAttribute("appLink", "journey://profile/" + person.username());
        return "share/person";
    }

    /** An invitation by one-time link. A link that was used, ran out or never existed gets a page that says so. */
    @GetMapping("/i/{token}")
    String invitation(@PathVariable String token, Model model, HttpServletResponse response) {
        var preview = invites.preview(token);
        if (preview.isEmpty()) {
            response.setStatus(HttpServletResponse.SC_GONE);
            return "share/invite-gone";
        }
        model.addAttribute("invite", preview.get());
        model.addAttribute("appLink", "journey://invite/" + preview.get().token());
        return "share/invite";
    }

    /** Something private, missing or mistyped gets the same friendly page. */
    @ExceptionHandler({
        ApiProblem.class,
        IllegalArgumentException.class,
        org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class
    })
    @ResponseStatus(HttpStatus.NOT_FOUND)
    String notFound() {
        return "share/unavailable";
    }
}
