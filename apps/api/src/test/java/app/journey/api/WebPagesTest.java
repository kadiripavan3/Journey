package app.journey.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.endsWith;
import static org.hamcrest.Matchers.not;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

/**
 * The web pages next to the journey's own: one entry, one person, the legal pages and the request to delete
 * an account. Anyone can open them without signing in.
 */
class WebPagesTest extends ApiTest {

    @Test
    void anEntryHasItsOwnPageAndFollowsItsJourneysVisibility() throws Exception {
        String maya = person("maya");
        String nora = person("nora");
        String open = journey(maya, "Southeast Asia", "public", 3);
        String photo = uploadPhoto(maya);
        String entry = JsonPath.read(
                mvc.perform(post("/v1/journeys/" + open + "/entries")
                                .header("Authorization", maya)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"title\":\"Floating <market>\",\"body\":\"Coffee on a boat.\",\"mediaIds\":[\"%s\"]}"
                                                .formatted(photo)))
                        .andReturn()
                        .getResponse()
                        .getContentAsString(),
                "$.id");
        String byLink = entry(maya, journey(maya, "Family trip", "unlisted", 3), "Arrived", 0);
        String secret = entry(maya, journey(maya, "Diary", "private", 3), "Dear diary", 0);

        mvc.perform(get("/e/" + entry))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML))
                .andExpect(content().string(containsString("Floating &lt;market&gt;")))
                .andExpect(content().string(containsString("Coffee on a boat.")))
                .andExpect(content().string(containsString("og:image")))
                .andExpect(content().string(containsString("journey://entry/" + entry)))
                .andExpect(content().string(containsString("/j/" + open)))
                .andExpect(content().string(not(containsString("noindex"))));
        mvc.perform(get("/e/" + byLink))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("noindex")));
        mvc.perform(get("/e/" + secret))
                .andExpect(status().isNotFound())
                .andExpect(content().string(not(containsString("Dear diary"))));
        mvc.perform(get("/e/not-an-entry")).andExpect(status().isNotFound());

        // The app asks the API for the link to share; a private journey's entry has none.
        mvc.perform(get("/v1/entries/" + entry + "/share-link").header("Authorization", nora))
                .andExpect(jsonPath("$.url", endsWith("/e/" + entry)))
                .andExpect(jsonPath("$.text").value("Floating <market> · Southeast Asia"));
        mvc.perform(get("/v1/entries/" + secret + "/share-link").header("Authorization", maya))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("not_shareable"));
        mvc.perform(get("/v1/entries/" + secret + "/share-link").header("Authorization", nora))
                .andExpect(status().isNotFound());
    }

    @Test
    void aPersonHasAFollowMyJourneyPageWithTheirPublicJourneysOnly() throws Exception {
        String maya = person("maya");
        String open = journey(maya, "Southeast Asia", "public", 3);
        journey(maya, "Family trip", "unlisted", 3);
        journey(maya, "Diary", "private", 3);

        mvc.perform(get("/u/MAYA"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("Follow maya in the app")))
                .andExpect(content().string(containsString("Southeast Asia")))
                .andExpect(content().string(containsString("/j/" + open)))
                .andExpect(content().string(containsString("journey://profile/maya")))
                .andExpect(content().string(not(containsString("Family trip"))))
                .andExpect(content().string(not(containsString("Diary"))));
        mvc.perform(get("/u/nobody")).andExpect(status().isNotFound());
        mvc.perform(get("/v1/me/share-link").header("Authorization", maya))
                .andExpect(jsonPath("$.url", endsWith("/u/maya")));
        mvc.perform(get("/v1/me/share-link").header("Authorization", signIn("half@example.com")))
                .andExpect(status().isConflict());
    }

    @Test
    void theLegalPagesAreThereAndSayTheyAreDrafts() throws Exception {
        for (String page : new String[] {"/terms", "/privacy", "/guidelines", "/contact"}) {
            mvc.perform(get(page))
                    .andExpect(status().isOk())
                    .andExpect(content().string(containsString("This is a draft")))
                    .andExpect(content().string(containsString("href=\"/delete-account\"")));
        }
        mvc.perform(get("/terms")).andExpect(content().string(containsString("13 or older")));
        mvc.perform(get("/contact"))
                .andExpect(content().string(containsString("The address is added here before launch.")));
        // The files that make links open the app don't exist until the app's ids are set.
        mvc.perform(get("/.well-known/apple-app-site-association")).andExpect(status().isNotFound());
        mvc.perform(get("/.well-known/assetlinks.json")).andExpect(status().isNotFound());
    }

    @Test
    void aRequestToDeleteAnAccountMadeOnTheWebWaitsForAReviewer() throws Exception {
        mvc.perform(get("/delete-account"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("Ask to delete my account")));
        mvc.perform(post("/delete-account").param("email", "not an address"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("Enter the email address you signed up with.")))
                .andExpect(content().string(containsString("not an address")));

        mvc.perform(post("/delete-account")
                        .param("email", "nora@example.com")
                        .param("username", "@nora.lind")
                        .param("note", "I lost my phone <b>"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("We have your request")));
        // Asking again changes nothing while the first request is open.
        mvc.perform(post("/delete-account").param("email", "NORA@example.com")).andExpect(status().isOk());
        assertThat(jdbc.sql("select count(*) from deletion_requests")
                        .query(Integer.class)
                        .single())
                .isEqualTo(1);

        mvc.perform(get("/admin").with(httpBasic("ada", "review")))
                .andExpect(content().string(containsString("nora@example.com · @nora.lind")))
                .andExpect(content().string(containsString("I lost my phone &lt;b&gt;")));
        String id = jdbc.sql("select id::text from deletion_requests")
                .query(String.class)
                .single();
        mvc.perform(post("/admin/deletion-requests/" + id + "/done")
                        .with(httpBasic("ada", "review"))
                        .with(csrf()))
                .andExpect(redirectedUrl("/admin"));
        assertThat(jdbc.sql("select status || ' by ' || done_by from deletion_requests")
                        .query(String.class)
                        .single())
                .isEqualTo("done by ada");
        mvc.perform(get("/admin").with(httpBasic("ada", "review")))
                .andExpect(content().string(containsString("No requests are waiting.")))
                .andExpect(content().string(containsString("ada handled a deletion request")));
    }
}
