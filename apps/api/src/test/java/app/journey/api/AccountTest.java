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

/** Settings, blocking, reporting, deleting an account, search, and a journey's recap. */
class AccountTest extends ApiTest {

  @Test
  void settingsStartWithCarefulDefaultsAndCanBeChanged() throws Exception {
    String nora = person("nora");
    mvc.perform(get("/v1/me/settings").header("Authorization", nora))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.notifyNewEntries").value(true))
        .andExpect(jsonPath("$.digestEmail").value(false))
        .andExpect(jsonPath("$.defaultVisibility").value("public"));

    String changed = "{\"notifyNewEntries\":true,\"notifyCompleted\":true,\"notifyComments\":true,\"notifyFollowers\":true,\"notifyLikes\":false,"
        + "\"weeklyDigest\":true,\"digestEmail\":true,\"reminders\":false,\"defaultVisibility\":\"private\"}";
    mvc.perform(put("/v1/me/settings").header("Authorization", nora).contentType(MediaType.APPLICATION_JSON).content(changed))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.notifyLikes").value(false))
        .andExpect(jsonPath("$.defaultVisibility").value("private"));
    mvc.perform(get("/v1/me/settings").header("Authorization", nora)).andExpect(jsonPath("$.digestEmail").value(true));
    mvc.perform(put("/v1/me/settings").header("Authorization", nora).contentType(MediaType.APPLICATION_JSON)
            .content(changed.replace("private", "friends")))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("invalid_visibility"));
  }

  @Test
  void blockingHidesTwoPeopleFromEachOtherAndUndoesTheirFollows() throws Exception {
    String nora = person("nora");
    String ray = person("ray");
    String kai = person("kai");
    String mine = journey(nora, "Iceland ring road", "public", 5);
    String entry = entry(nora, mine, "Skogafoss", 0);
    String his = journey(ray, "Deals deals deals", "public", 5);
    entry(ray, his, "One", 2);
    entry(ray, his, "Two", 1);
    entry(ray, his, "Three", 0);
    mvc.perform(put("/v1/journeys/" + mine + "/follow").header("Authorization", ray)).andExpect(status().isOk());
    mvc.perform(put("/v1/profiles/nora/follow").header("Authorization", ray)).andExpect(status().isOk());
    mvc.perform(post("/v1/entries/" + entry + "/comments").header("Authorization", ray).contentType(MediaType.APPLICATION_JSON)
        .content("{\"body\":\"Buy now\"}")).andExpect(status().isCreated());
    mvc.perform(post("/v1/entries/" + entry + "/comments").header("Authorization", kai).contentType(MediaType.APPLICATION_JSON)
        .content("{\"body\":\"Lovely\"}")).andExpect(status().isCreated());

    mvc.perform(put("/v1/profiles/ray/block").header("Authorization", nora)).andExpect(status().isNoContent());
    mvc.perform(put("/v1/profiles/nora/block").header("Authorization", nora)).andExpect(status().isBadRequest());

    // Ray no longer sees anything of Nora's, and no longer follows her or her journey.
    mvc.perform(get("/v1/journeys/" + mine).header("Authorization", ray)).andExpect(status().isNotFound());
    mvc.perform(get("/v1/entries/" + entry).header("Authorization", ray)).andExpect(status().isNotFound());
    mvc.perform(get("/v1/profiles/nora").header("Authorization", ray)).andExpect(status().isNotFound());
    mvc.perform(get("/v1/me/following").header("Authorization", ray)).andExpect(jsonPath("$", hasSize(0)));
    mvc.perform(get("/v1/journeys/" + mine).header("Authorization", kai)).andExpect(jsonPath("$.followerCount").value(0));
    // Nora doesn't see Ray's journeys or comments, and nothing of his reaches her Activity.
    mvc.perform(get("/v1/journeys/" + his).header("Authorization", nora)).andExpect(status().isNotFound());
    mvc.perform(get("/v1/discover").header("Authorization", nora)).andExpect(jsonPath("$.trending", hasSize(0)));
    mvc.perform(get("/v1/discover").header("Authorization", kai)).andExpect(jsonPath("$.trending", hasSize(1)));
    mvc.perform(get("/v1/entries/" + entry + "/comments").header("Authorization", nora))
        .andExpect(jsonPath("$", hasSize(1)))
        .andExpect(jsonPath("$[0].body").value("Lovely"));
    mvc.perform(get("/v1/activity").header("Authorization", nora))
        .andExpect(jsonPath("$.items", hasSize(1)))
        .andExpect(jsonPath("$.items[0].actors[0].username").value("kai"));
    mvc.perform(get("/v1/search").param("q", "deals").header("Authorization", nora)).andExpect(jsonPath("$.journeys", hasSize(0)));
    mvc.perform(get("/v1/search").param("q", "ray").header("Authorization", nora)).andExpect(jsonPath("$.people", hasSize(0)));
    // Nora can still open his profile to unblock him, but can't follow him while he is blocked.
    mvc.perform(get("/v1/profiles/ray").header("Authorization", nora)).andExpect(jsonPath("$.viewer.hasBlocked").value(true));
    mvc.perform(put("/v1/profiles/ray/follow").header("Authorization", nora)).andExpect(status().isBadRequest());

    mvc.perform(get("/v1/me/blocks").header("Authorization", nora))
        .andExpect(jsonPath("$", hasSize(1)))
        .andExpect(jsonPath("$[0].username").value("ray"));
    mvc.perform(delete("/v1/profiles/ray/block").header("Authorization", nora)).andExpect(status().isNoContent());
    mvc.perform(get("/v1/me/blocks").header("Authorization", nora)).andExpect(jsonPath("$", hasSize(0)));
    mvc.perform(get("/v1/journeys/" + mine).header("Authorization", ray)).andExpect(status().isOk());
  }

  @Test
  void aReportIsStoredAndNeedsAKnownReason() throws Exception {
    String nora = person("nora");
    String maya = person("maya");
    String entry = entry(maya, journey(maya, "Trip", "public", 3), "Hoi An", 0);

    mvc.perform(post("/v1/reports").header("Authorization", nora).contentType(MediaType.APPLICATION_JSON)
            .content("{\"targetType\":\"entry\",\"targetId\":\"%s\",\"reason\":\"spam\"}".formatted(entry)))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.id").isNotEmpty());
    mvc.perform(post("/v1/reports").header("Authorization", nora).contentType(MediaType.APPLICATION_JSON)
            .content("{\"targetType\":\"entry\",\"targetId\":\"%s\",\"reason\":\"boring\"}".formatted(entry)))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("invalid_reason"));
    org.assertj.core.api.Assertions.assertThat(jdbc.sql("select count(*) from reports where status = 'open'").query(Integer.class).single()).isEqualTo(1);
  }

  @Test
  void deletingAnAccountRemovesEverythingAndFreesTheEmailAndUsername() throws Exception {
    String nora = person("nora");
    String maya = person("maya");
    String photo = uploadPhoto(nora);
    String mine = journey(nora, "Iceland ring road", "public", 5);
    mvc.perform(post("/v1/journeys/" + mine + "/entries").header("Authorization", nora).contentType(MediaType.APPLICATION_JSON)
        .content("{\"title\":\"Skogafoss\",\"mediaIds\":[\"%s\"]}".formatted(photo))).andExpect(status().isCreated());
    String theirs = journey(maya, "Southeast Asia", "public", 9);
    String entry = entry(maya, theirs, "Hoi An", 0);
    mvc.perform(put("/v1/journeys/" + theirs + "/follow").header("Authorization", nora)).andExpect(status().isOk());
    mvc.perform(put("/v1/entries/" + entry + "/like").header("Authorization", nora)).andExpect(status().isOk());
    mvc.perform(put("/v1/journeys/" + mine + "/follow").header("Authorization", maya)).andExpect(status().isOk());

    mvc.perform(delete("/v1/me").header("Authorization", nora)).andExpect(status().isNoContent());

    mvc.perform(get("/v1/journeys/" + mine).header("Authorization", maya)).andExpect(status().isNotFound());
    mvc.perform(get("/v1/profiles/nora").header("Authorization", maya)).andExpect(status().isNotFound());
    mvc.perform(get("/v1/journeys/" + theirs).header("Authorization", maya)).andExpect(jsonPath("$.followerCount").value(0));
    mvc.perform(get("/v1/me/following").header("Authorization", maya)).andExpect(jsonPath("$", hasSize(0)));
    org.assertj.core.api.Assertions.assertThat(jdbc.sql("select count(*) from media").query(Integer.class).single()).isZero();
    org.assertj.core.api.Assertions.assertThat(jdbc.sql("select count(*) from entry_likes").query(Integer.class).single()).isZero();
    // The old token still says who it was, but there is no profile behind it; the email and username are free again.
    mvc.perform(get("/v1/me").header("Authorization", nora)).andExpect(jsonPath("$.profile").isEmpty());
    person("nora");
  }

  @Test
  void searchFindsPublicJourneysByTitleTagOrCreatorAndPeopleByName() throws Exception {
    String maya = person("maya");
    String nora = person("nora");
    journey(maya, "Southeast Asia by motorbike", "public", 9);
    journey(maya, "Asia diary", "private", 9);
    mvc.perform(post("/v1/journeys").header("Authorization", nora).contentType(MediaType.APPLICATION_JSON)
        .content("{\"title\":\"Iceland ring road\",\"template\":\"trip\",\"startDate\":\"%s\",\"visibility\":\"public\",\"tags\":[\"roadtrip\",\"vanlife\"]}"
            .formatted(java.time.LocalDate.now(java.time.ZoneOffset.UTC)))).andExpect(status().isCreated());

    mvc.perform(get("/v1/search").param("q", "asia").header("Authorization", nora))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.journeys", hasSize(1)))
        .andExpect(jsonPath("$.journeys[0].title").value("Southeast Asia by motorbike"));
    mvc.perform(get("/v1/search").param("q", "#vanlife").header("Authorization", maya))
        .andExpect(jsonPath("$.query").value("vanlife"))
        .andExpect(jsonPath("$.journeys[0].title").value("Iceland ring road"));
    mvc.perform(get("/v1/search").param("q", "@may").header("Authorization", nora))
        .andExpect(jsonPath("$.people", hasSize(1)))
        .andExpect(jsonPath("$.people[0].username").value("maya"))
        .andExpect(jsonPath("$.journeys", hasSize(1)));
    mvc.perform(get("/v1/search").param("q", "%").header("Authorization", nora))
        .andExpect(jsonPath("$.journeys", hasSize(0)))
        .andExpect(jsonPath("$.people", hasSize(0)));
    mvc.perform(get("/v1/search").param("q", "__").header("Authorization", nora)).andExpect(jsonPath("$.journeys", hasSize(0)));
  }

  @Test
  void aRecapAddsUpTheJourney() throws Exception {
    String nora = person("nora");
    String journey = journey(nora, "Mallorca by kayak", "public", 8);
    String photo = uploadPhoto(nora);
    mvc.perform(post("/v1/journeys/" + journey + "/entries").header("Authorization", nora).contentType(MediaType.APPLICATION_JSON)
        .content("{\"title\":\"Cala Deia\",\"placeName\":\"Deia\",\"isMilestone\":true,\"mediaIds\":[\"%s\"]}".formatted(photo))).andExpect(status().isCreated());
    entry(nora, journey, "Day two", 6);

    mvc.perform(post("/v1/journeys/" + journey + "/complete").header("Authorization", nora).contentType(MediaType.APPLICATION_JSON)
        .content("{\"closingNote\":\"Nine days of coves.\"}")).andExpect(status().isOk());
    mvc.perform(get("/v1/journeys/" + journey + "/recap").header("Authorization", nora))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.journey.status").value("completed"))
        .andExpect(jsonPath("$.journey.closingNote").value("Nine days of coves."))
        .andExpect(jsonPath("$.dayCount").value(9))
        .andExpect(jsonPath("$.entryCount").value(2))
        .andExpect(jsonPath("$.placeCount").value(1))
        .andExpect(jsonPath("$.photoCount").value(1))
        .andExpect(jsonPath("$.momentUrls", hasSize(1)));
  }
}
