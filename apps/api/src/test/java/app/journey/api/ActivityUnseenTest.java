package app.journey.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

/**
 * The dot on the tab bar ({@code GET /v1/activity/unseen}) is asked far more often than Activity is opened, so
 * it has an answer of its own that never builds the inbox. These tests hold the two together: after everything
 * that can put a line in the inbox, the dot says exactly what the inbox's count of new lines says.
 */
class ActivityUnseenTest extends ApiTest {

    @Test
    void theDotAgreesWithTheInboxForEveryKindOfLine() throws Exception {
        String maya = person("maya");
        String nora = person("nora");
        String kai = person("kai");
        String trip = journey(maya, "Southeast Asia", "public", 9);
        String hoiAn = entry(maya, trip, "Hoi An", 2);
        dotIs(maya, false);
        dotIs(nora, false);

        // Someone follows you.
        mvc.perform(put("/v1/profiles/maya/follow").header("Authorization", nora))
                .andExpect(status().isOk());
        dotIs(maya, true);
        dotIs(nora, false);
        seen(maya);
        dotIs(maya, false);

        // Someone follows one of your journeys, likes an entry, comments on it.
        mvc.perform(put("/v1/journeys/" + trip + "/follow").header("Authorization", nora))
                .andExpect(status().isOk());
        dotIs(maya, true);
        seen(maya);
        mvc.perform(put("/v1/entries/" + hoiAn + "/like").header("Authorization", nora))
                .andExpect(status().isOk());
        dotIs(maya, true);
        seen(maya);
        String question = comment(nora, hoiAn, "Was it busy?", null);
        dotIs(maya, true);
        seen(maya);
        dotIs(maya, false);

        // A new entry in a journey you follow, and an answer to your comment.
        seen(nora);
        entry(maya, trip, "Mount Bromo", 0);
        dotIs(nora, true);
        seen(nora);
        comment(maya, hoiAn, "Not at all.", question);
        dotIs(nora, true);
        seen(nora);
        dotIs(nora, false);
        // What you did yourself is never news to you.
        dotIs(maya, false);

        // An invitation, and for the owner, the friend's yes.
        mvc.perform(post("/v1/journeys/" + trip + "/members")
                        .header("Authorization", maya)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"nora\"}"))
                .andExpect(status().isOk());
        dotIs(nora, true);
        seen(nora);
        mvc.perform(post("/v1/journeys/" + trip + "/invitation/accept").header("Authorization", nora))
                .andExpect(status().isOk());
        dotIs(maya, true);
        seen(maya);

        // A comment under an entry you wrote in someone else's journey, and that journey being completed.
        String norasEntry = entry(nora, trip, "The night train", 0);
        seen(maya);
        comment(kai, norasEntry, "Sleeper or seat?", null);
        dotIs(nora, true);
        dotIs(maya, true); // it is her journey
        seen(nora);
        seen(maya);
        mvc.perform(post("/v1/journeys/" + trip + "/complete")
                        .header("Authorization", maya)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk());
        dotIs(nora, true);
        dotIs(maya, false);
        dotIs(kai, false);
    }

    @Test
    void aKindThatIsSwitchedOffHeldOrFromSomeoneBlockedDoesNotLightTheDot() throws Exception {
        String maya = person("maya");
        String nora = person("nora");
        String ray = person("ray");
        String entry = entry(maya, journey(maya, "Southeast Asia", "public", 9), "Hoi An", 1);
        String settings = mvc.perform(get("/v1/me/settings").header("Authorization", maya))
                .andReturn()
                .getResponse()
                .getContentAsString();
        mvc.perform(put("/v1/me/settings")
                        .header("Authorization", maya)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(settings.replace("\"notifyLikes\":true", "\"notifyLikes\":false")))
                .andExpect(status().isOk());

        // Likes are switched off: a like changes nothing, a comment still does.
        mvc.perform(put("/v1/entries/" + entry + "/like").header("Authorization", nora))
                .andExpect(status().isOk());
        dotIs(maya, false);
        // A comment the word filter holds is seen by nobody but its author.
        comment(ray, entry, "go die", null);
        assertThat(jdbc.sql("select count(*) from comments where held")
                        .query(Integer.class)
                        .single())
                .isEqualTo(1);
        dotIs(maya, false);
        comment(nora, entry, "Lovely", null);
        dotIs(maya, true);
        seen(maya);

        // Someone she has blocked: what they do no longer reaches her.
        mvc.perform(put("/v1/profiles/ray/follow").header("Authorization", maya))
                .andExpect(status().isOk());
        seen(ray);
        mvc.perform(put("/v1/profiles/ray/block").header("Authorization", maya)).andExpect(status().isNoContent());
        dotIs(ray, false);
        dotIs(maya, false);

        // Someone who hasn't made a profile yet is asked to finish that first, like everywhere else: the tab
        // bar this dot sits on only exists once there is a profile.
        String half = signIn("half@example.com");
        mvc.perform(get("/v1/activity/unseen").header("Authorization", half))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("profile_required"));
        mvc.perform(get("/v1/activity/unseen")).andExpect(status().isUnauthorized());
    }

    /** The dot says this, and the inbox agrees. */
    private void dotIs(String token, boolean lit) throws Exception {
        mvc.perform(get("/v1/activity/unseen").header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unseen").value(lit));
        String inbox = mvc.perform(get("/v1/activity").header("Authorization", token))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        assertThat(JsonPath.<Integer>read(inbox, "$.newCount") > 0)
                .as("the inbox has something new")
                .isEqualTo(lit);
    }

    private void seen(String token) throws Exception {
        mvc.perform(post("/v1/activity/seen").header("Authorization", token)).andExpect(status().isNoContent());
        mvc.perform(get("/v1/activity").header("Authorization", token))
                .andExpect(jsonPath("$.items[?(@.isNew == true)]", hasSize(0)));
    }

    private String comment(String token, String entry, String body, String parent) throws Exception {
        return JsonPath.read(
                mvc.perform(post("/v1/entries/" + entry + "/comments")
                                .header("Authorization", token)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        parent == null
                                                ? "{\"body\":\"%s\"}".formatted(body)
                                                : "{\"body\":\"%s\",\"parentId\":\"%s\"}".formatted(body, parent)))
                        .andExpect(status().isCreated())
                        .andReturn()
                        .getResponse()
                        .getContentAsString(),
                "$.id");
    }
}
