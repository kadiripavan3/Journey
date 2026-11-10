package app.journey.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

/**
 * The rules that hold everywhere: who may see a journey, what blocking hides, and that the counts stay
 * right whatever happens. Each test here is a thing that once went wrong.
 */
class RulesTest extends ApiTest {

    @Test
    void aJourneyThatGoesPrivateDisappearsForThePeopleWhoFollowedIt() throws Exception {
        String maya = person("maya");
        String nora = person("nora");
        String journey = journey(maya, "Southeast Asia", "public", 9);
        entry(maya, journey, "Hanoi", 2);
        mvc.perform(put("/v1/journeys/" + journey + "/follow").header("Authorization", nora))
                .andExpect(status().isOk());
        entry(maya, journey, "Hoi An", 0);
        mvc.perform(get("/v1/feed").header("Authorization", nora)).andExpect(jsonPath("$.groups", hasSize(1)));
        mvc.perform(get("/v1/activity").header("Authorization", nora))
                .andExpect(jsonPath("$.items[?(@.kind=='new_entries')]", hasSize(1)));

        mvc.perform(patch("/v1/journeys/" + journey)
                        .header("Authorization", maya)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"visibility\":\"private\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.followerCount").value(0));

        // Nothing of it is left for Nora: not on Home, not in Activity, not in her list, not in the weekly digest.
        mvc.perform(get("/v1/journeys/" + journey).header("Authorization", nora))
                .andExpect(status().isNotFound());
        mvc.perform(get("/v1/feed").header("Authorization", nora))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.groups", hasSize(0)))
                .andExpect(jsonPath("$.followingCount").value(0));
        mvc.perform(get("/v1/activity").header("Authorization", nora))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(0)));
        mvc.perform(get("/v1/me/following").header("Authorization", nora)).andExpect(jsonPath("$.items", hasSize(0)));
        mvc.perform(get("/v1/digest").header("Authorization", nora))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.journeys", hasSize(0)));
        assertThat(jdbc.sql("select count(*) from journey_follows where not author")
                        .query(Integer.class)
                        .single())
                .isZero();

        // Public again: it doesn't quietly come back for someone who followed only the journey.
        mvc.perform(patch("/v1/journeys/" + journey)
                        .header("Authorization", maya)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"visibility\":\"public\"}"))
                .andExpect(status().isOk());
        mvc.perform(get("/v1/journeys/" + journey).header("Authorization", nora))
                .andExpect(jsonPath("$.viewer.isFollowing").value(false));
    }

    @Test
    void aFollowThatPointsAtAJourneyYouCanNoLongerSeeDoesNoHarm() throws Exception {
        String maya = person("maya");
        String nora = person("nora");
        String journey = journey(maya, "Southeast Asia", "public", 9);
        mvc.perform(put("/v1/journeys/" + journey + "/follow").header("Authorization", nora))
                .andExpect(status().isOk());
        entry(maya, journey, "Hoi An", 0);
        // A follow left behind by older data or a script: the journey is private, the follow is still there.
        jdbc.sql("update journeys set visibility = 'private'").update();

        mvc.perform(get("/v1/feed").header("Authorization", nora))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.groups", hasSize(0)));
        mvc.perform(get("/v1/activity").header("Authorization", nora))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(0)));
        mvc.perform(get("/v1/me/following").header("Authorization", nora)).andExpect(jsonPath("$.items", hasSize(0)));
        // Unfollowing still takes the follow away, even though the journey itself can't be shown.
        mvc.perform(delete("/v1/journeys/" + journey + "/follow").header("Authorization", nora))
                .andExpect(status().isNotFound());
        assertThat(jdbc.sql("select count(*) from journey_follows where not author")
                        .query(Integer.class)
                        .single())
                .isZero();
        assertThat(jdbc.sql("select follower_count from journeys")
                        .query(Integer.class)
                        .single())
                .isZero();
    }

    @Test
    void theOwnerHearsWhenAFriendAddsToTheirJourney() throws Exception {
        String nora = person("nora");
        String alex = person("alex");
        String journey = journey(nora, "Iceland ring road", "public", 5);
        entry(nora, journey, "Reykjavik", 3);
        mvc.perform(put("/v1/profiles/nora/follow").header("Authorization", alex))
                .andExpect(status().isOk());
        mvc.perform(put("/v1/journeys/" + journey + "/follow").header("Authorization", alex))
                .andExpect(jsonPath("$.followerCount").value(1));
        mvc.perform(post("/v1/journeys/" + journey + "/members")
                        .header("Authorization", nora)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"alex\"}"))
                .andExpect(status().isOk());
        mvc.perform(post("/v1/journeys/" + journey + "/invitation/accept").header("Authorization", alex))
                .andExpect(status().isOk())
                // A friend who writes in the journey is an author, not a follower.
                .andExpect(jsonPath("$.followerCount").value(0))
                .andExpect(jsonPath("$.viewer.isFollowing").value(false))
                .andExpect(jsonPath("$.viewer.isMember").value(true));
        mvc.perform(get("/v1/feed").header("Authorization", nora)).andExpect(jsonPath("$.groups", hasSize(0)));

        entry(alex, journey, "The lake before breakfast", 0);

        mvc.perform(get("/v1/feed").header("Authorization", nora))
                .andExpect(jsonPath("$.groups", hasSize(1)))
                .andExpect(jsonPath("$.groups[0].newCount").value(1))
                .andExpect(jsonPath("$.groups[0].entries[0].author.username").value("alex"));
        mvc.perform(get("/v1/activity").header("Authorization", nora))
                .andExpect(jsonPath("$.items[?(@.kind=='new_entries')]", hasSize(1)))
                .andExpect(jsonPath("$.items[?(@.kind=='new_entries')].actors[0].username")
                        .value("alex"));
        // Their own entries are never "new" to them, and reading the journey clears it.
        mvc.perform(get("/v1/feed").header("Authorization", alex))
                .andExpect(jsonPath("$.groups[0].newCount").value(1))
                .andExpect(jsonPath("$.groups[0].entries[0].author.username").value("nora"));
        mvc.perform(post("/v1/journeys/" + journey + "/read").header("Authorization", nora))
                .andExpect(status().isNoContent());
        mvc.perform(get("/v1/feed").header("Authorization", nora)).andExpect(jsonPath("$.groups", hasSize(0)));
        // Owners and friends can't "follow" what they write in, and their own journeys aren't in "Following".
        mvc.perform(put("/v1/journeys/" + journey + "/follow").header("Authorization", alex))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("own_journey"));
        mvc.perform(get("/v1/me/following").header("Authorization", nora)).andExpect(jsonPath("$.items", hasSize(0)));
        mvc.perform(get("/v1/me/following").header("Authorization", alex)).andExpect(jsonPath("$.items", hasSize(0)));

        // A friend who leaves a public journey goes back to following it.
        mvc.perform(delete("/v1/journeys/" + journey + "/members/alex").header("Authorization", alex))
                .andExpect(status().isNoContent());
        mvc.perform(get("/v1/journeys/" + journey).header("Authorization", alex))
                .andExpect(jsonPath("$.followerCount").value(1))
                .andExpect(jsonPath("$.viewer.isFollowing").value(true))
                .andExpect(jsonPath("$.viewer.isMember").value(false));
    }

    @Test
    void aFriendRemovedFromAPrivateJourneyNoLongerSeesIt() throws Exception {
        String nora = person("nora");
        String alex = person("alex");
        String journey = journey(nora, "Just us", "private", 5);
        mvc.perform(put("/v1/profiles/nora/follow").header("Authorization", alex))
                .andExpect(status().isOk());
        mvc.perform(post("/v1/journeys/" + journey + "/members")
                        .header("Authorization", nora)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"alex\"}"))
                .andExpect(status().isOk());
        // Invited: Alex can look at the invitation, but the journey itself opens only once they join.
        mvc.perform(get("/v1/me/invitations").header("Authorization", alex)).andExpect(jsonPath("$.items", hasSize(1)));
        mvc.perform(get("/v1/journeys/" + journey).header("Authorization", alex))
                .andExpect(status().isNotFound());
        mvc.perform(post("/v1/journeys/" + journey + "/invitation/accept").header("Authorization", alex))
                .andExpect(status().isOk());
        mvc.perform(get("/v1/journeys/" + journey).header("Authorization", alex))
                .andExpect(status().isOk());
        entry(nora, journey, "Day one", 0);
        mvc.perform(get("/v1/feed").header("Authorization", alex)).andExpect(jsonPath("$.groups", hasSize(1)));

        mvc.perform(delete("/v1/journeys/" + journey + "/members/alex").header("Authorization", nora))
                .andExpect(status().isNoContent());

        mvc.perform(get("/v1/journeys/" + journey).header("Authorization", alex))
                .andExpect(status().isNotFound());
        mvc.perform(get("/v1/feed").header("Authorization", alex))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.groups", hasSize(0)));
        mvc.perform(get("/v1/activity").header("Authorization", alex))
                .andExpect(jsonPath("$.items[?(@.kind=='new_entries')]", hasSize(0)));
        assertThat(jdbc.sql("select count(*) from journey_follows where not author")
                        .query(Integer.class)
                        .single())
                .isZero();
    }

    @Test
    void blockingAlsoHidesWhatTheOtherPersonWroteInAJourneyYouShare() throws Exception {
        String nora = person("nora");
        String alex = person("alex");
        String kai = person("kai");
        String reader = person("reader");
        String journey = journey(nora, "Iceland ring road", "public", 5);
        for (String friend : new String[] {"alex", "kai"}) {
            String token = friend.equals("alex") ? alex : kai;
            mvc.perform(put("/v1/profiles/nora/follow").header("Authorization", token))
                    .andExpect(status().isOk());
            mvc.perform(post("/v1/journeys/" + journey + "/members")
                            .header("Authorization", nora)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"username\":\"%s\"}".formatted(friend)))
                    .andExpect(status().isOk());
            mvc.perform(post("/v1/journeys/" + journey + "/invitation/accept").header("Authorization", token))
                    .andExpect(status().isOk());
        }
        entry(nora, journey, "Reykjavik", 2);
        mvc.perform(post("/v1/journeys/" + journey + "/read").header("Authorization", kai))
                .andExpect(status().isNoContent());
        String alexEntry = entry(alex, journey, "The lake before breakfast", 0);

        mvc.perform(put("/v1/profiles/alex/block").header("Authorization", kai)).andExpect(status().isNoContent());

        // Kai still sees the journey, without Alex's part of it; so does Alex, without Kai's. Everyone else sees all of
        // it.
        mvc.perform(get("/v1/journeys/" + journey + "/entries").header("Authorization", kai))
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].author.username").value("nora"));
        mvc.perform(get("/v1/entries/" + alexEntry).header("Authorization", kai))
                .andExpect(status().isNotFound());
        mvc.perform(get("/v1/feed").header("Authorization", kai)).andExpect(jsonPath("$.groups", hasSize(0)));
        mvc.perform(get("/v1/activity").header("Authorization", kai))
                .andExpect(jsonPath("$.items[?(@.kind=='new_entries')].count").value(1))
                .andExpect(jsonPath("$.items[?(@.kind=='new_entries')].actors[0].username")
                        .value("nora"));
        mvc.perform(put("/v1/entries/" + alexEntry + "/like").header("Authorization", kai))
                .andExpect(status().isNotFound());
        mvc.perform(get("/v1/journeys/" + journey + "/entries").header("Authorization", reader))
                .andExpect(jsonPath("$.items", hasSize(2)));
        String kaiEntry = entry(kai, journey, "Geysir", 0);
        mvc.perform(get("/v1/entries/" + kaiEntry).header("Authorization", alex))
                .andExpect(status().isNotFound());
        mvc.perform(get("/v1/journeys/" + journey + "/entries").header("Authorization", reader))
                .andExpect(jsonPath("$.items", hasSize(3)));
    }

    @Test
    void countsStayRightWhenAnAccountIsDeleted() throws Exception {
        String maya = person("maya");
        String kai = person("kai");
        String nora = person("nora");
        String journey = journey(maya, "Southeast Asia", "public", 9);
        String entry = entry(maya, journey, "Hoi An", 1);
        String other = journey(maya, "Kyoto in autumn", "public", 3);
        // Kai follows Maya and one journey, likes and comments, and writes in the other journey; Nora answers Kai.
        mvc.perform(put("/v1/profiles/maya/follow").header("Authorization", kai))
                .andExpect(status().isOk());
        mvc.perform(put("/v1/journeys/" + journey + "/follow").header("Authorization", kai))
                .andExpect(status().isOk());
        mvc.perform(put("/v1/journeys/" + journey + "/follow").header("Authorization", nora))
                .andExpect(status().isOk());
        mvc.perform(put("/v1/entries/" + entry + "/like").header("Authorization", kai))
                .andExpect(status().isOk());
        mvc.perform(put("/v1/entries/" + entry + "/like").header("Authorization", nora))
                .andExpect(status().isOk());
        String comment = com.jayway.jsonpath.JsonPath.read(
                mvc.perform(post("/v1/entries/" + entry + "/comments")
                                .header("Authorization", kai)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"body\":\"Lovely\"}"))
                        .andExpect(status().isCreated())
                        .andReturn()
                        .getResponse()
                        .getContentAsString(),
                "$.id");
        mvc.perform(post("/v1/entries/" + entry + "/comments")
                        .header("Authorization", nora)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"Agreed\",\"parentId\":\"%s\"}".formatted(comment)))
                .andExpect(status().isCreated());
        mvc.perform(post("/v1/journeys/" + other + "/members")
                        .header("Authorization", maya)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"kai\"}"))
                .andExpect(status().isOk());
        mvc.perform(post("/v1/journeys/" + other + "/invitation/accept").header("Authorization", kai))
                .andExpect(status().isOk());
        entry(kai, other, "Fushimi Inari", 0);
        mvc.perform(get("/v1/journeys/" + journey).header("Authorization", maya))
                .andExpect(jsonPath("$.followerCount").value(2))
                .andExpect(jsonPath("$.entryCount").value(1));
        mvc.perform(get("/v1/journeys/" + other).header("Authorization", maya))
                .andExpect(jsonPath("$.followerCount").value(0))
                .andExpect(jsonPath("$.entryCount").value(1));
        mvc.perform(get("/v1/entries/" + entry).header("Authorization", maya))
                .andExpect(jsonPath("$.likeCount").value(2))
                .andExpect(jsonPath("$.commentCount").value(2));

        mvc.perform(delete("/v1/me").header("Authorization", kai)).andExpect(status().isNoContent());

        // Kai's follow, like, comment (with the answer under it) and entry are gone, and every number says so.
        mvc.perform(get("/v1/journeys/" + journey).header("Authorization", maya))
                .andExpect(jsonPath("$.followerCount").value(1))
                .andExpect(jsonPath("$.entryCount").value(1));
        mvc.perform(get("/v1/journeys/" + other).header("Authorization", maya))
                .andExpect(jsonPath("$.followerCount").value(0))
                .andExpect(jsonPath("$.entryCount").value(0));
        mvc.perform(get("/v1/entries/" + entry).header("Authorization", maya))
                .andExpect(jsonPath("$.likeCount").value(1))
                .andExpect(jsonPath("$.commentCount").value(0));
        // The numbers are the same as counting the rows.
        assertThat(jdbc.sql("""
            select count(*) from journeys j
            where j.follower_count <> (select count(*) from journey_follows f where f.journey_id = j.id and not f.author)
               or j.entry_count <> (select count(*) from entries e where e.journey_id = j.id)
            """).query(Integer.class).single()).isZero();
        assertThat(jdbc.sql("""
            select count(*) from entries e
            where e.like_count <> (select count(*) from entry_likes l where l.entry_id = e.id)
               or e.comment_count <> (select count(*) from comments c where c.entry_id = e.id)
            """).query(Integer.class).single()).isZero();
    }

    @Test
    void someoneWhoHasNotFinishedSigningUpGetsAClearAnswer() throws Exception {
        String maya = person("maya");
        String journey = journey(maya, "Southeast Asia", "public", 9);
        String entry = entry(maya, journey, "Hoi An", 0);
        String half = signIn("half@example.com");

        // They can look around.
        mvc.perform(get("/v1/feed").header("Authorization", half)).andExpect(status().isOk());
        mvc.perform(get("/v1/journeys/" + journey).header("Authorization", half))
                .andExpect(status().isOk());
        // Every change waits for the profile, and says so.
        for (var change : java.util.List.of(
                post("/v1/journeys")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Mine\",\"template\":\"trip\"}"),
                put("/v1/journeys/" + journey + "/follow"),
                put("/v1/entries/" + entry + "/like"),
                post("/v1/entries/" + entry + "/comments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"Hello\"}"),
                put("/v1/profiles/maya/follow"),
                put("/v1/profiles/maya/block"))) {
            mvc.perform(change.header("Authorization", half))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.code").value("profile_required"))
                    .andExpect(jsonPath("$.detail").value("Finish setting up your profile first."));
        }
        // The steps of signing up themselves work: a picture, then the profile. Leaving works too.
        String photo = uploadPhoto(half);
        mvc.perform(put("/v1/me/profile")
                        .header("Authorization", half)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"displayName\":\"Half\",\"username\":\"half\",\"avatarMediaId\":\"%s\"}"
                                .formatted(photo)))
                .andExpect(status().isOk());
        mvc.perform(put("/v1/journeys/" + journey + "/follow").header("Authorization", half))
                .andExpect(status().isOk());
        String gone = signIn("gone@example.com");
        mvc.perform(delete("/v1/me").header("Authorization", gone)).andExpect(status().isNoContent());
    }

    @Test
    void everyFailureHasACodeAndASentenceAPersonCanRead() throws Exception {
        String maya = person("maya");
        mvc.perform(get("/v1/feed"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("signed_out"))
                .andExpect(jsonPath("$.detail").value("Please sign in again."));
        mvc.perform(get("/v1/feed").header("Authorization", "Bearer not-a-token"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("signed_out"));
        mvc.perform(get("/v1/no-such-thing").header("Authorization", maya))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("not_found"))
                .andExpect(jsonPath("$.detail").value("We couldn't find that."));
        mvc.perform(get("/v1/journeys/not-an-id").header("Authorization", maya))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("bad_request"));
        mvc.perform(post("/v1/journeys")
                        .header("Authorization", maya)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{not json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("bad_request"));
        mvc.perform(post("/v1/feed").header("Authorization", maya))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.code").value("method_not_allowed"));
        mvc.perform(post("/v1/journeys")
                        .header("Authorization", maya)
                        .contentType(MediaType.TEXT_PLAIN)
                        .content("hello"))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.code").value("unsupported_format"));
        // An address outside the API is refused without saying what is or isn't there.
        mvc.perform(get("/somewhere-else")).andExpect(status().isUnauthorized());
        mvc.perform(get("/somewhere-else").header("Authorization", maya))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("not_found"));
        mvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("UP")));
    }
}
