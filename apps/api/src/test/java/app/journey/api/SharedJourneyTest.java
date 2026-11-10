package app.journey.api;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** Shared journeys: inviting, accepting, writing together, leaving and removing. */
class SharedJourneyTest extends ApiTest {

  @Test
  void aFriendJoinsOnlyByAcceptingAndThenWritesInTheJourney() throws Exception {
    String nora = person("nora");
    String alex = person("alex");
    String reader = person("reader");
    String journey = journey(nora, "Iceland ring road", "public", 5);
    entry(nora, journey, "Reykjavik", 3);

    // Only someone who follows you can be invited.
    mvc.perform(invite(nora, journey, "alex")).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("not_a_follower"));
    mvc.perform(put("/v1/profiles/nora/follow").header("Authorization", alex)).andExpect(status().isOk());
    mvc.perform(get("/v1/journeys/" + journey + "/invitable").header("Authorization", nora))
        .andExpect(jsonPath("$", hasSize(1)))
        .andExpect(jsonPath("$[0].username").value("alex"));
    mvc.perform(invite(alex, journey, "reader")).andExpect(status().isForbidden());
    mvc.perform(invite(nora, journey, "alex"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.members", hasSize(2)))
        .andExpect(jsonPath("$.members[1].status").value("invited"))
        .andExpect(jsonPath("$.spotsLeft").value(2));
    mvc.perform(invite(nora, journey, "alex")).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("already_invited"));

    // Invited is not joined: Alex can't write yet, and other people don't see the invitation.
    mvc.perform(post("/v1/journeys/" + journey + "/entries").header("Authorization", alex).contentType(MediaType.APPLICATION_JSON)
        .content("{\"title\":\"Too early\"}")).andExpect(status().isForbidden());
    mvc.perform(get("/v1/journeys/" + journey + "/members").header("Authorization", reader))
        .andExpect(jsonPath("$.members", hasSize(1)))
        .andExpect(jsonPath("$.viewerRole").value("none"));
    mvc.perform(get("/v1/me/invitations").header("Authorization", alex))
        .andExpect(jsonPath("$", hasSize(1)))
        .andExpect(jsonPath("$[0].journey.title").value("Iceland ring road"))
        .andExpect(jsonPath("$[0].invitedBy.username").value("nora"));
    mvc.perform(get("/v1/activity").header("Authorization", alex)).andExpect(jsonPath("$.items[0].kind").value("invitation"));

    mvc.perform(post("/v1/journeys/" + journey + "/invitation/accept").header("Authorization", alex))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.authors", hasSize(2)))
        .andExpect(jsonPath("$.authors[1].username").value("alex"))
        .andExpect(jsonPath("$.viewer.isMember").value(true))
        .andExpect(jsonPath("$.viewer.isFollowing").value(true))
        .andExpect(jsonPath("$.viewer.canAddEntry").value(true));
    mvc.perform(post("/v1/journeys/" + journey + "/invitation/accept").header("Authorization", alex)).andExpect(status().isNotFound());
    mvc.perform(get("/v1/me/invitations").header("Authorization", alex)).andExpect(jsonPath("$", hasSize(0)));
    mvc.perform(get("/v1/activity").header("Authorization", nora)).andExpect(jsonPath("$.items[?(@.kind=='friend_joined')]", hasSize(1)));

    String alexEntry = entry(alex, journey, "The lake before breakfast", 0);
    mvc.perform(get("/v1/journeys/" + journey + "/entries").header("Authorization", reader))
        .andExpect(jsonPath("$", hasSize(2)))
        .andExpect(jsonPath("$[1].author.username").value("alex"));
    // It is on both profiles and in both people's own lists; a friend changes only their own entries, never the journey.
    mvc.perform(get("/v1/profiles/alex/journeys").header("Authorization", reader)).andExpect(jsonPath("$[0].title").value("Iceland ring road"));
    mvc.perform(get("/v1/me/journeys").header("Authorization", alex)).andExpect(jsonPath("$", hasSize(1)));
    mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch("/v1/journeys/" + journey).header("Authorization", alex)
        .contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"Mine now\"}")).andExpect(status().isForbidden());
    mvc.perform(get("/v1/journeys/" + journey + "/members").header("Authorization", nora))
        .andExpect(jsonPath("$.members[1].entryCount").value(1))
        .andExpect(jsonPath("$.members[1].status").value("joined"));

    // Leaving keeps the entry; the person can no longer add more.
    mvc.perform(delete("/v1/journeys/" + journey + "/members/alex").header("Authorization", alex)).andExpect(status().isNoContent());
    mvc.perform(get("/v1/entries/" + alexEntry).header("Authorization", reader)).andExpect(status().isOk());
    mvc.perform(get("/v1/journeys/" + journey).header("Authorization", alex))
        .andExpect(jsonPath("$.authors", hasSize(1)))
        .andExpect(jsonPath("$.viewer.canAddEntry").value(false));
  }

  @Test
  void aJourneyHasUpToFourAuthorsAndTheOwnerCanRemoveOrCancel() throws Exception {
    String nora = person("nora");
    String journey = journey(nora, "Iceland ring road", "private", 5);
    for (String name : new String[] {"a.one", "b.two", "c.three", "d.four"}) {
      String token = person(name);
      mvc.perform(put("/v1/profiles/nora/follow").header("Authorization", token)).andExpect(status().isOk());
    }
    mvc.perform(invite(nora, journey, "a.one")).andExpect(status().isOk());
    mvc.perform(invite(nora, journey, "b.two")).andExpect(status().isOk());
    mvc.perform(invite(nora, journey, "c.three")).andExpect(jsonPath("$.spotsLeft").value(0));
    mvc.perform(invite(nora, journey, "d.four")).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("journey_full"));

    // Someone invited to a private journey sees the invitation and, once joined, the journey; nobody else does.
    String one = signIn("a.one@example.com");
    String four = signIn("d.four@example.com");
    mvc.perform(get("/v1/me/invitations").header("Authorization", one)).andExpect(jsonPath("$[0].journey.visibility").value("private"));
    mvc.perform(get("/v1/journeys/" + journey).header("Authorization", one)).andExpect(status().isNotFound());
    mvc.perform(post("/v1/journeys/" + journey + "/invitation/accept").header("Authorization", one)).andExpect(status().isOk());
    mvc.perform(get("/v1/journeys/" + journey).header("Authorization", one)).andExpect(status().isOk());
    mvc.perform(get("/v1/journeys/" + journey).header("Authorization", four)).andExpect(status().isNotFound());

    // The owner takes one invitation back and removes a friend; a friend can't remove anyone else.
    mvc.perform(delete("/v1/journeys/" + journey + "/members/b.two").header("Authorization", one)).andExpect(status().isForbidden());
    mvc.perform(delete("/v1/journeys/" + journey + "/members/b.two").header("Authorization", nora)).andExpect(status().isNoContent());
    mvc.perform(delete("/v1/journeys/" + journey + "/members/a.one").header("Authorization", nora)).andExpect(status().isNoContent());
    mvc.perform(get("/v1/journeys/" + journey).header("Authorization", one)).andExpect(status().isNotFound());
    mvc.perform(get("/v1/journeys/" + journey + "/members").header("Authorization", nora))
        .andExpect(jsonPath("$.members", hasSize(2)))
        .andExpect(jsonPath("$.spotsLeft").value(2));
  }

  private MockHttpServletRequestBuilder invite(String token, String journeyId, String username) {
    return post("/v1/journeys/" + journeyId + "/members").header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
        .content("{\"username\":\"%s\"}".formatted(username));
  }
}
