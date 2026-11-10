package app.journey.api;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

class EntryTest extends ApiTest {

  @Test
  void theStoryReadsInTheOrderThingsHappenedNotTheOrderTheyWerePosted() throws Exception {
    String nora = person("nora");
    String id = journey(nora, "Iceland ring road", "public", 9);
    entry(nora, id, "Day four, posted first", 6);
    entry(nora, id, "Day one, posted late", 9);
    entry(nora, id, "Day ten", 0);

    mvc.perform(get("/v1/journeys/" + id + "/entries").header("Authorization", nora))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$", hasSize(3)))
        .andExpect(jsonPath("$[0].title").value("Day one, posted late"))
        .andExpect(jsonPath("$[0].label").value("Day 1"))
        .andExpect(jsonPath("$[1].label").value("Day 4"))
        .andExpect(jsonPath("$[2].label").value("Day 10"))
        .andExpect(jsonPath("$[2].author.username").value("nora"));
    mvc.perform(get("/v1/journeys/" + id).header("Authorization", nora))
        .andExpect(jsonPath("$.entryCount").value(3))
        .andExpect(jsonPath("$.latestNumber").value(10))
        .andExpect(jsonPath("$.progressLabel").value("Day 10"));
  }

  @Test
  void journeysToldInPartsNumberTheirEntriesInOrder() throws Exception {
    String nora = person("nora");
    String id = journey(nora, "Building a cabin", "public", 30);
    mvc.perform(patch("/v1/journeys/" + id).header("Authorization", nora).contentType(MediaType.APPLICATION_JSON).content("{\"labelStyle\":\"part\"}"))
        .andExpect(status().isOk());
    entry(nora, id, "The roof", 2);
    entry(nora, id, "The floor", 20);

    mvc.perform(get("/v1/journeys/" + id + "/entries").header("Authorization", nora))
        .andExpect(jsonPath("$[0].title").value("The floor"))
        .andExpect(jsonPath("$[0].label").value("Part 1"))
        .andExpect(jsonPath("$[1].label").value("Part 2"));
    mvc.perform(get("/v1/journeys/" + id).header("Authorization", nora)).andExpect(jsonPath("$.progressLabel").value("Part 2"));
  }

  @Test
  void anEntryCarriesItsPhotosInOrderAndTheFirstBecomesTheCover() throws Exception {
    String nora = person("nora");
    String id = journey(nora, "Iceland ring road", "public", 2);
    String first = uploadPhoto(nora);
    String second = uploadPhoto(nora);

    mvc.perform(post("/v1/journeys/" + id + "/entries").header("Authorization", nora).contentType(MediaType.APPLICATION_JSON)
            .content("{\"body\":\"Skógafoss in the rain\",\"placeName\":\"Skógar, Iceland\",\"isMilestone\":true,\"mediaIds\":[\"%s\",\"%s\"]}".formatted(second, first)))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.media", hasSize(2)))
        .andExpect(jsonPath("$.media[0].id").value(second))
        .andExpect(jsonPath("$.media[0].kind").value("photo"))
        .andExpect(jsonPath("$.media[0].width").value(8))
        .andExpect(jsonPath("$.media[0].height").value(6))
        .andExpect(jsonPath("$.placeName").value("Skógar, Iceland"))
        .andExpect(jsonPath("$.isMilestone").value(true));

    String cover = com.jayway.jsonpath.JsonPath.read(
        mvc.perform(get("/v1/journeys/" + id).header("Authorization", nora)).andReturn().getResponse().getContentAsString(), "$.coverUrl");
    mvc.perform(get(java.net.URI.create(cover))).andExpect(status().isOk());
  }

  @Test
  void anEntryNeedsSomethingInItAndASensibleDate() throws Exception {
    String nora = person("nora");
    String id = journey(nora, "Iceland ring road", "public", 2);

    mvc.perform(post("/v1/journeys/" + id + "/entries").header("Authorization", nora).contentType(MediaType.APPLICATION_JSON).content("{\"body\":\"  \"}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.detail").value("Add a photo or a few words."));
    mvc.perform(post("/v1/journeys/" + id + "/entries").header("Authorization", nora).contentType(MediaType.APPLICATION_JSON)
            .content("{\"title\":\"Too early\",\"happenedAt\":\"%s\"}".formatted(Instant.now().minus(10, ChronoUnit.DAYS))))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("before_start"));
    mvc.perform(post("/v1/journeys/" + id + "/entries").header("Authorization", nora).contentType(MediaType.APPLICATION_JSON)
            .content("{\"title\":\"Too late\",\"happenedAt\":\"%s\"}".formatted(Instant.now().plus(3, ChronoUnit.DAYS))))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("in_the_future"));
  }

  @Test
  void onlyTheOwnerAddsEntriesAndPhotosMustBeYourOwn() throws Exception {
    String nora = person("nora");
    String other = person("other");
    String id = journey(nora, "Iceland ring road", "public", 2);
    String othersPhoto = uploadPhoto(other);

    mvc.perform(post("/v1/journeys/" + id + "/entries").header("Authorization", other).contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"Hello\"}"))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("cannot_add_entry"));
    mvc.perform(post("/v1/journeys/" + id + "/entries").header("Authorization", nora).contentType(MediaType.APPLICATION_JSON)
            .content("{\"mediaIds\":[\"%s\"]}".formatted(othersPhoto)))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("unknown_media"));
  }

  @Test
  void changingAnEntryMarksItEditedAndDeletingFixesTheCount() throws Exception {
    String nora = person("nora");
    String other = person("other");
    String id = journey(nora, "Iceland ring road", "public", 2);
    String entry = entry(nora, id, "Skogafoss", 1);
    entry(nora, id, "Vik", 0);

    mvc.perform(put("/v1/entries/" + entry).header("Authorization", other).contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"Hacked\"}"))
        .andExpect(status().isForbidden());
    mvc.perform(put("/v1/entries/" + entry).header("Authorization", nora).contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"Skógafoss in the rain\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.title").value("Skógafoss in the rain"))
        .andExpect(jsonPath("$.label").value("Day 2"))
        .andExpect(jsonPath("$.edited").value(true));

    mvc.perform(delete("/v1/entries/" + entry).header("Authorization", other)).andExpect(status().isForbidden());
    mvc.perform(delete("/v1/entries/" + entry).header("Authorization", nora)).andExpect(status().isNoContent());
    mvc.perform(get("/v1/journeys/" + id).header("Authorization", nora)).andExpect(jsonPath("$.entryCount").value(1));
    mvc.perform(get("/v1/entries/" + entry).header("Authorization", nora)).andExpect(status().isNotFound());
  }

  @Test
  void aNewEntryWakesAPausedJourney() throws Exception {
    String nora = person("nora");
    String id = journey(nora, "Building a cabin", "public", 40);
    mvc.perform(patch("/v1/journeys/" + id).header("Authorization", nora).contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"paused\"}"))
        .andExpect(jsonPath("$.status").value("paused"));

    entry(nora, id, "The roof is on", 0);

    mvc.perform(get("/v1/journeys/" + id).header("Authorization", nora)).andExpect(jsonPath("$.status").value("active"));
  }

  @Test
  void entriesOfAPrivateJourneyAreHiddenFromOthers() throws Exception {
    String nora = person("nora");
    String other = person("other");
    String id = journey(nora, "My journal", "private", 1);
    String entry = entry(nora, id, "Dear diary", 0);

    mvc.perform(get("/v1/journeys/" + id + "/entries").header("Authorization", other)).andExpect(status().isNotFound());
    mvc.perform(get("/v1/entries/" + entry).header("Authorization", other))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("entry_not_found"));
  }
}
