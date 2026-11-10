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

import app.journey.api.digest.DigestService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

/** The public pages behind shared links, and the weekly digest. */
class ShareAndDigestTest extends ApiTest {

    @Autowired
    DigestService digest;

    @Test
    void aSharedLinkOpensForAnyoneButNeverShowsAPrivateJourney() throws Exception {
        String maya = person("maya");
        String open = journey(maya, "Southeast Asia <by> motorbike", "public", 3);
        entry(maya, open, "Floating market at sunrise", 0);
        String link = journey(maya, "Family trip", "unlisted", 3);
        String secret = journey(maya, "Diary", "private", 3);

        mvc.perform(get("/v1/journeys/" + open).header("Authorization", maya))
                .andExpect(jsonPath("$.shareUrl").value("http://localhost/j/" + open));
        mvc.perform(get("/v1/journeys/" + secret).header("Authorization", maya))
                .andExpect(jsonPath("$.shareUrl").isEmpty());

        // No sign-in needed. Titles are escaped, and chats get a title to preview.
        mvc.perform(get("/j/" + open))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML))
                .andExpect(content().string(containsString("Southeast Asia &lt;by&gt; motorbike")))
                .andExpect(content().string(containsString("og:title")))
                .andExpect(content().string(containsString("Floating market at sunrise")))
                .andExpect(content().string(containsString("journey://journey/" + open)))
                .andExpect(content().string(not(containsString("noindex"))));
        // A journey shared only by link opens too, and asks search engines to leave it alone.
        mvc.perform(get("/j/" + link))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("noindex")));
        mvc.perform(get("/j/" + secret))
                .andExpect(status().isNotFound())
                .andExpect(content().string(not(containsString("Diary"))));
        mvc.perform(get("/j/not-a-journey")).andExpect(status().isNotFound());
        mvc.perform(get("/share/page.css")).andExpect(status().isOk());
    }

    @Test
    void theDigestGathersTheWeekAndGoesOnlyToPeopleWithNewsWhoWantIt() throws Exception {
        String maya = person("maya");
        String lea = person("lea");
        String nora = person("nora");
        String quiet = person("quiet");
        String trip = journey(maya, "Southeast Asia", "public", 20);
        String guitar = journey(lea, "30 days of guitar", "public", 20);
        entry(maya, trip, "Older than a week", 12);
        jdbc.sql("update entries set created_at = now() - interval '12 days'").update();
        mvc.perform(put("/v1/journeys/" + trip + "/follow").header("Authorization", nora))
                .andExpect(status().isOk());
        mvc.perform(put("/v1/journeys/" + guitar + "/follow").header("Authorization", nora))
                .andExpect(status().isOk());
        mvc.perform(put("/v1/journeys/" + guitar + "/follow").header("Authorization", quiet))
                .andExpect(status().isOk());

        mvc.perform(get("/v1/digest").header("Authorization", nora))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entryCount").value(0))
                .andExpect(jsonPath("$.moment").isEmpty());
        assertThat(digest.sendAll()).isZero();

        entry(maya, trip, "Hoi An", 2);
        String bromo = entry(maya, trip, "Mount Bromo", 0);
        mvc.perform(put("/v1/entries/" + bromo + "/like").header("Authorization", lea))
                .andExpect(status().isOk());
        entry(lea, guitar, "G chord", 0);
        mvc.perform(post("/v1/journeys/" + guitar + "/complete")
                        .header("Authorization", lea)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk());

        mvc.perform(get("/v1/digest").header("Authorization", nora))
                .andExpect(jsonPath("$.entryCount").value(3))
                .andExpect(jsonPath("$.journeys", hasSize(2)))
                .andExpect(jsonPath("$.journeys[?(@.journey.title=='Southeast Asia')].newCount")
                        .value(2))
                .andExpect(jsonPath("$.moment.title").value("Mount Bromo"))
                .andExpect(jsonPath("$.finished", hasSize(1)))
                .andExpect(jsonPath("$.finished[0].title").value("30 days of guitar"));

        // Nora and the quiet follower have news; the quiet one switched the digest off.
        mvc.perform(
                        put("/v1/me/settings")
                                .header("Authorization", quiet)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"notifyNewEntries\":true,\"notifyCompleted\":true,\"notifyComments\":true,\"notifyFollowers\":true,\"notifyLikes\":true,"
                                                + "\"weeklyDigest\":false,\"digestEmail\":false,\"reminders\":true,\"defaultVisibility\":\"public\"}"))
                .andExpect(status().isOk());
        assertThat(digest.sendAll()).isEqualTo(1);
    }
}
