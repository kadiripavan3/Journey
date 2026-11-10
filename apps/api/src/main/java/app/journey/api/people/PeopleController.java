package app.journey.api.people;

import app.journey.api.auth.Me;
import app.journey.api.common.Keyset;
import app.journey.api.common.Page;
import app.journey.api.people.PeopleService.ListedPersonResponse;
import app.journey.api.people.PeopleService.PublicProfileResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.UUID;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/profiles/{username}")
@Tag(name = "People")
class PeopleController {

    private final PeopleService people;

    PeopleController(PeopleService people) {
        this.people = people;
    }

    @GetMapping
    @Operation(operationId = "getProfile", summary = "Someone's profile, with their counts and whether you follow them")
    PublicProfileResponse profile(@Me UUID me, @PathVariable String username) {
        return people.profile(username, me);
    }

    @PutMapping("/follow")
    @Operation(
            operationId = "followProfile",
            summary = "Follow a person. Their future public journeys are followed for you.")
    PublicProfileResponse follow(@Me UUID me, @PathVariable String username) {
        return people.follow(username, me);
    }

    @DeleteMapping("/follow")
    @Operation(
            operationId = "unfollowProfile",
            summary = "Stop following a person. Journeys you already follow stay followed.")
    PublicProfileResponse unfollow(@Me UUID me, @PathVariable String username) {
        return people.unfollow(username, me);
    }

    @GetMapping("/followers")
    @Operation(operationId = "getFollowers", summary = "The people who follow someone, newest first")
    Page<ListedPersonResponse> followers(
            @Me UUID me,
            @PathVariable String username,
            @Parameter(description = "Only people whose name or username holds these letters")
                    @RequestParam(required = false)
                    String q,
            @RequestParam(required = false) String cursor,
            @RequestParam(required = false) Integer limit) {
        return people.listed(username, true, me, q, Keyset.of(cursor, limit, 30));
    }

    @GetMapping("/following")
    @Operation(operationId = "getFollowing", summary = "The people someone follows, newest first")
    Page<ListedPersonResponse> following(
            @Me UUID me,
            @PathVariable String username,
            @Parameter(description = "Only people whose name or username holds these letters")
                    @RequestParam(required = false)
                    String q,
            @RequestParam(required = false) String cursor,
            @RequestParam(required = false) Integer limit) {
        return people.listed(username, false, me, q, Keyset.of(cursor, limit, 30));
    }
}
