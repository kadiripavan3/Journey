package app.journey.api.search;

import app.journey.api.auth.Me;
import app.journey.api.journey.JourneyService;
import app.journey.api.journey.JourneyService.JourneyResponse;
import app.journey.api.people.PeopleService;
import app.journey.api.people.PeopleService.ListedPersonResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Search across public journeys (title, description, tags, creator) and people (name, username). */
@RestController
@RequestMapping("/v1/search")
@Tag(name = "Search")
class SearchController {

    static final int LIMIT = 30;

    record SearchResponse(
            String query,

            @Schema(description = "The best matches, most followed first; at most 30")
            List<JourneyResponse> journeys,

            @Schema(description = "The best matches, most followed first; at most 30")
            List<ListedPersonResponse> people) {}

    private final JourneyService journeys;
    private final PeopleService people;

    SearchController(JourneyService journeys, PeopleService people) {
        this.journeys = journeys;
        this.people = people;
    }

    @GetMapping
    @Operation(operationId = "search", summary = "Find public journeys and people. A leading # or @ is ignored.")
    SearchResponse search(@Me UUID me, @RequestParam("q") String q) {
        String words = q.trim().replaceFirst("^[#@]", "");
        if (words.length() < 2) {
            return new SearchResponse(words, List.of(), List.of());
        }
        // The person's words are matched as they are: % and _ mean themselves, not "anything".
        String pattern = "%" + words.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        return new SearchResponse(words, journeys.search(pattern, me, LIMIT), people.search(pattern, me, LIMIT));
    }
}
