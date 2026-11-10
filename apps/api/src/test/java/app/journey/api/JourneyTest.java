package app.journey.api;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

class JourneyTest extends ApiTest {

  @Test
  void startingAJourneyFillsInTheTemplatesDefaults() throws Exception {
    String nora = person("nora");

    mvc.perform(
            post("/v1/journeys").header("Authorization", nora).contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\" 30 days of guitar \",\"template\":\"challenge30\",\"startDate\":\"%s\",\"visibility\":\"public\",\"tags\":[\"#Learn Guitar\",\"30days\"]}".formatted(LocalDate.now())))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.title").value("30 days of guitar"))
        .andExpect(jsonPath("$.category").value("fitness"))
        .andExpect(jsonPath("$.labelStyle").value("day"))
        .andExpect(jsonPath("$.targetDays").value(30))
        .andExpect(jsonPath("$.tags[0]").value("learnguitar"))
        .andExpect(jsonPath("$.status").value("active"))
        .andExpect(jsonPath("$.progressLabel").value("Not started"))
        .andExpect(jsonPath("$.owner.username").value("nora"))
        .andExpect(jsonPath("$.viewer.isOwner").value(true))
        .andExpect(jsonPath("$.viewer.canAddEntry").value(true));
  }

  @Test
  void aJourneyNeedsATitleAndAKnownTemplate() throws Exception {
    String nora = person("nora");

    mvc.perform(post("/v1/journeys").header("Authorization", nora).contentType(MediaType.APPLICATION_JSON)
            .content("{\"title\":\"\",\"template\":\"trip\",\"startDate\":\"2026-01-01\",\"visibility\":\"public\"}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.fields.title").value("Give your journey a title."));
    mvc.perform(post("/v1/journeys").header("Authorization", nora).contentType(MediaType.APPLICATION_JSON)
            .content("{\"title\":\"X\",\"template\":\"cruise\",\"startDate\":\"%s\",\"visibility\":\"public\"}".formatted(LocalDate.now())))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("unknown_template"));
  }

  @Test
  void aPrivateJourneyLooksLikeItDoesNotExistToAnyoneElse() throws Exception {
    String nora = person("nora");
    String other = person("other");
    String secret = journey(nora, "My journal", "private", 0);
    String unlisted = journey(nora, "For the family", "unlisted", 0);

    mvc.perform(get("/v1/journeys/" + secret).header("Authorization", nora)).andExpect(status().isOk());
    mvc.perform(get("/v1/journeys/" + secret).header("Authorization", other))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("journey_not_found"));
    mvc.perform(put("/v1/journeys/" + secret + "/follow").header("Authorization", other)).andExpect(status().isNotFound());
    // Unlisted: anyone with the link can read it, but it is on no list.
    mvc.perform(get("/v1/journeys/" + unlisted).header("Authorization", other)).andExpect(status().isOk());
    mvc.perform(get("/v1/profiles/nora/journeys").header("Authorization", other)).andExpect(jsonPath("$.items", hasSize(0)));
    mvc.perform(get("/v1/me/journeys").header("Authorization", nora)).andExpect(jsonPath("$.items", hasSize(2)));
  }

  @Test
  void onlyTheOwnerChangesOrDeletesAJourney() throws Exception {
    String nora = person("nora");
    String other = person("other");
    String id = journey(nora, "Iceland ring road", "public", 3);

    mvc.perform(patch("/v1/journeys/" + id).header("Authorization", other).contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"Mine now\"}"))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("not_yours"));
    mvc.perform(delete("/v1/journeys/" + id).header("Authorization", other)).andExpect(status().isForbidden());

    mvc.perform(patch("/v1/journeys/" + id).header("Authorization", nora).contentType(MediaType.APPLICATION_JSON)
            .content("{\"description\":\"1,300 km in a rented van.\",\"visibility\":\"unlisted\",\"status\":\"paused\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.title").value("Iceland ring road"))
        .andExpect(jsonPath("$.description").value("1,300 km in a rented van."))
        .andExpect(jsonPath("$.visibility").value("unlisted"))
        .andExpect(jsonPath("$.status").value("paused"));

    mvc.perform(delete("/v1/journeys/" + id).header("Authorization", nora)).andExpect(status().isNoContent());
    mvc.perform(get("/v1/journeys/" + id).header("Authorization", nora)).andExpect(status().isNotFound());
  }

  @Test
  void followingCountsOncePerPersonAndNeverYourOwnJourney() throws Exception {
    String nora = person("nora");
    String other = person("other");
    String id = journey(nora, "Iceland ring road", "public", 3);

    mvc.perform(put("/v1/journeys/" + id + "/follow").header("Authorization", other))
        .andExpect(jsonPath("$.followerCount").value(1))
        .andExpect(jsonPath("$.viewer.isFollowing").value(true));
    mvc.perform(put("/v1/journeys/" + id + "/follow").header("Authorization", other)).andExpect(jsonPath("$.followerCount").value(1));
    mvc.perform(get("/v1/me/following").header("Authorization", other)).andExpect(jsonPath("$.items", hasSize(1)));
    mvc.perform(put("/v1/journeys/" + id + "/follow").header("Authorization", nora))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("own_journey"));
    mvc.perform(delete("/v1/journeys/" + id + "/follow").header("Authorization", other))
        .andExpect(jsonPath("$.followerCount").value(0))
        .andExpect(jsonPath("$.viewer.isFollowing").value(false));
  }

  @Test
  void completingNeedsAnEntryAndClosesTheJourney() throws Exception {
    String nora = person("nora");
    String id = journey(nora, "Mallorca by kayak", "public", 9);

    mvc.perform(post("/v1/journeys/" + id + "/complete").header("Authorization", nora).contentType(MediaType.APPLICATION_JSON).content("{}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("no_entries"));

    entry(nora, id, "Last cove", 0);
    mvc.perform(post("/v1/journeys/" + id + "/complete").header("Authorization", nora).contentType(MediaType.APPLICATION_JSON)
            .content("{\"closingNote\":\"Nine days of coves and caves.\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("completed"))
        .andExpect(jsonPath("$.closingNote").value("Nine days of coves and caves."))
        .andExpect(jsonPath("$.viewer.canAddEntry").value(false));
    mvc.perform(post("/v1/journeys/" + id + "/entries").header("Authorization", nora).contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"One more\"}"))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("cannot_add_entry"));
  }

  @Test
  void discoverShowsOnlyPublicJourneysWithEnoughEntries() throws Exception {
    String nora = person("nora");
    String reader = person("reader");
    String full = journey(nora, "Iceland ring road", "public", 5);
    String thin = journey(nora, "Just started", "public", 1);
    String hidden = journey(nora, "For the family", "unlisted", 5);
    for (String id : new String[] {full, hidden}) {
      entry(nora, id, "One", 3);
      entry(nora, id, "Two", 2);
      entry(nora, id, "Three", 1);
    }
    entry(nora, thin, "Only one", 0);

    mvc.perform(get("/v1/discover").header("Authorization", reader))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.trending", hasSize(1)))
        .andExpect(jsonPath("$.trending[0].title").value("Iceland ring road"))
        .andExpect(jsonPath("$.completed", hasSize(0)));
    mvc.perform(get("/v1/discover?category=fitness").header("Authorization", reader)).andExpect(jsonPath("$.trending", hasSize(0)));
    // Suggestions are looser (one entry is enough) but never your own or ones you follow.
    mvc.perform(get("/v1/journeys/suggested").header("Authorization", reader)).andExpect(jsonPath("$", hasSize(2)));
    mvc.perform(get("/v1/journeys/suggested").header("Authorization", nora)).andExpect(jsonPath("$", hasSize(0)));
    mvc.perform(put("/v1/journeys/" + full + "/follow").header("Authorization", reader)).andExpect(status().isOk());
    mvc.perform(get("/v1/journeys/suggested").header("Authorization", reader)).andExpect(jsonPath("$", hasSize(1)));
  }
}
