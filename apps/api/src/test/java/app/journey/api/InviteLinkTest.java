package app.journey.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

/** The one-time link for a friend who isn't on Journey yet. */
class InviteLinkTest extends ApiTest {

    @Test
    void aLinkLetsOnePersonJoinOnceWithoutFollowingTheOwner() throws Exception {
        String nora = person("nora");
        String alex = person("alex");
        String kai = person("kai");
        String journey = journey(nora, "Just us", "private", 5);
        entry(nora, journey, "Day one", 1);

        // Only the owner makes links.
        mvc.perform(post("/v1/journeys/" + journey + "/invite-link").header("Authorization", alex))
                .andExpect(status().isNotFound()); // a private journey doesn't exist for anyone else
        String token = link(nora, journey);
        assertThat(token).matches("[a-z2-9]{4}(-[a-z2-9]{4}){3}");
        // Only a hash of the link is kept.
        assertThat(jdbc.sql("select token_hash from invite_links")
                        .query(String.class)
                        .single())
                .hasSize(64)
                .doesNotContain(token);

        // The page behind it works without signing in, says what it is and doesn't show the story.
        mvc.perform(get("/i/" + token))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("nora invited you to add to Just us")))
                .andExpect(content().string(containsString("journey://invite/" + token)))
                .andExpect(content().string(containsString("noindex")))
                .andExpect(content().string(not(containsString("Day one"))));

        // In the app the link shows the invitation, even though the journey is private and Alex doesn't follow Nora.
        mvc.perform(get("/v1/journeys/" + journey).header("Authorization", alex))
                .andExpect(status().isNotFound());
        mvc.perform(get("/v1/invites/" + token.toUpperCase()).header("Authorization", alex))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.journey.title").value("Just us"))
                .andExpect(jsonPath("$.invitedBy.username").value("nora"))
                .andExpect(jsonPath("$.journey.viewer.isMember").value(false));
        mvc.perform(post("/v1/invites/" + token + "/accept").header("Authorization", nora))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("thats_you"));

        mvc.perform(post("/v1/invites/" + token + "/accept").header("Authorization", alex))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authors", hasSize(2)))
                .andExpect(jsonPath("$.viewer.isMember").value(true))
                .andExpect(jsonPath("$.viewer.canAddEntry").value(true))
                .andExpect(jsonPath("$.followerCount").value(0));
        entry(alex, journey, "My side of it", 0);
        mvc.perform(get("/v1/journeys/" + journey + "/members").header("Authorization", nora))
                .andExpect(jsonPath("$.members", hasSize(2)))
                .andExpect(jsonPath("$.members[1].status").value("joined"))
                .andExpect(jsonPath("$.spotsLeft").value(2));

        // It worked once. For anyone after that, in the app and on the web, it is gone.
        mvc.perform(post("/v1/invites/" + token + "/accept").header("Authorization", kai))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("invite_gone"));
        mvc.perform(get("/v1/invites/" + token).header("Authorization", kai)).andExpect(status().isNotFound());
        mvc.perform(get("/i/" + token))
                .andExpect(status().isGone())
                .andExpect(content().string(containsString("isn't open any more")));
        mvc.perform(get("/i/never-made")).andExpect(status().isGone());
    }

    @Test
    void aLinkStopsWorkingWhenANewOneIsMadeWhenItRunsOutAndForSomeoneBlocked() throws Exception {
        String nora = person("nora");
        String alex = person("alex");
        String ray = person("ray");
        String journey = journey(nora, "Iceland ring road", "public", 5);

        String first = link(nora, journey);
        String second = link(nora, journey);
        mvc.perform(get("/v1/invites/" + first).header("Authorization", alex)).andExpect(status().isNotFound());
        mvc.perform(get("/v1/invites/" + second).header("Authorization", alex)).andExpect(status().isOk());

        // Someone the owner has blocked can't use a link that reaches them.
        mvc.perform(put("/v1/profiles/ray/block").header("Authorization", nora)).andExpect(status().isNoContent());
        mvc.perform(get("/v1/invites/" + second).header("Authorization", ray)).andExpect(status().isNotFound());
        mvc.perform(post("/v1/invites/" + second + "/accept").header("Authorization", ray))
                .andExpect(status().isNotFound());

        // Seven days and it is over.
        jdbc.sql("update invite_links set expires_at = now() - interval '1 minute'")
                .update();
        mvc.perform(post("/v1/invites/" + second + "/accept").header("Authorization", alex))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("invite_gone"));
        mvc.perform(get("/i/" + second)).andExpect(status().isGone());

        // A completed journey takes nobody new.
        entry(nora, journey, "Home again", 0);
        mvc.perform(post("/v1/journeys/" + journey + "/complete")
                        .header("Authorization", nora)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk());
        mvc.perform(post("/v1/journeys/" + journey + "/invite-link").header("Authorization", nora))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("journey_completed"));
    }

    @Test
    void aLinkCountsAgainstTheThreeFriendsAndTwoPeopleCannotBothUseIt() throws Exception {
        String nora = person("nora");
        String journey = journey(nora, "Iceland ring road", "public", 5);
        for (String friend : List.of("ana", "ben")) {
            String token = person(friend);
            mvc.perform(put("/v1/profiles/nora/follow").header("Authorization", token))
                    .andExpect(status().isOk());
            mvc.perform(post("/v1/journeys/" + journey + "/members")
                            .header("Authorization", nora)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"username\":\"%s\"}".formatted(friend)))
                    .andExpect(status().isOk());
        }
        // One place left, one link, two people opening it at the same moment: one of them joins.
        String token = link(nora, journey);
        String cat = person("cat");
        String dan = person("dan");
        ExecutorService two = Executors.newFixedThreadPool(2);
        try {
            CountDownLatch go = new CountDownLatch(1);
            Callable<Integer> asCat = () -> {
                go.await();
                return mvc.perform(post("/v1/invites/" + token + "/accept").header("Authorization", cat))
                        .andReturn()
                        .getResponse()
                        .getStatus();
            };
            Callable<Integer> asDan = () -> {
                go.await();
                return mvc.perform(post("/v1/invites/" + token + "/accept").header("Authorization", dan))
                        .andReturn()
                        .getResponse()
                        .getStatus();
            };
            var first = two.submit(asCat);
            var second = two.submit(asDan);
            go.countDown();
            assertThat(List.of(first.get(), second.get())).containsExactlyInAnyOrder(200, 404);
        } finally {
            two.shutdownNow();
        }
        mvc.perform(get("/v1/journeys/" + journey + "/members").header("Authorization", nora))
                .andExpect(jsonPath("$.members", hasSize(4)))
                .andExpect(jsonPath("$.spotsLeft").value(0));

        // The journey is full: no new link, and an invitation in the app is refused the same way.
        mvc.perform(post("/v1/journeys/" + journey + "/invite-link").header("Authorization", nora))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("journey_full"));
    }

    @Test
    void aLinkMadeWhileThereWasRoomIsRefusedOnceTheJourneyIsFull() throws Exception {
        String nora = person("nora");
        String journey = journey(nora, "Iceland ring road", "public", 5);
        String token = link(nora, journey);
        for (String friend : List.of("ana", "ben", "cat")) {
            String friendToken = person(friend);
            mvc.perform(put("/v1/profiles/nora/follow").header("Authorization", friendToken))
                    .andExpect(status().isOk());
            mvc.perform(post("/v1/journeys/" + journey + "/members")
                            .header("Authorization", nora)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"username\":\"%s\"}".formatted(friend)))
                    .andExpect(status().isOk());
        }
        String dan = person("dan");
        mvc.perform(post("/v1/invites/" + token + "/accept").header("Authorization", dan))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("journey_full"));
        // The link isn't used up by the refusal: when someone leaves, it works.
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete(
                                "/v1/journeys/" + journey + "/members/cat")
                        .header("Authorization", nora))
                .andExpect(status().isNoContent());
        mvc.perform(post("/v1/invites/" + token + "/accept").header("Authorization", dan))
                .andExpect(status().isOk());
        mvc.perform(get("/v1/journeys/" + journey + "/members").header("Authorization", nora))
                .andExpect(jsonPath("$.spotsLeft").value(0));

        // Someone already asked in the app can use a link too: they take no extra place and simply join.
        String other = journey(nora, "Faroe ferry", "public", 2);
        mvc.perform(post("/v1/journeys/" + other + "/members")
                        .header("Authorization", nora)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"ana\"}"))
                .andExpect(status().isOk());
        String late = link(nora, other);
        mvc.perform(post("/v1/invites/" + late + "/accept").header("Authorization", signIn("ana@example.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.viewer.isMember").value(true));
        mvc.perform(get("/v1/journeys/" + other + "/members").header("Authorization", nora))
                .andExpect(jsonPath("$.members", hasSize(2)))
                .andExpect(jsonPath("$.members[1].status").value("joined"));
    }

    /** Makes the journey's invite link as its owner and returns the token at its end. */
    private String link(String owner, String journey) throws Exception {
        String body = mvc.perform(
                        post("/v1/journeys/" + journey + "/invite-link").header("Authorization", owner))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.expiresAt").isNotEmpty())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String url = JsonPath.read(body, "$.url");
        assertThat(url).contains("/i/");
        return url.substring(url.lastIndexOf('/') + 1);
    }
}
