package app.journey.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.net.URI;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/**
 * Held content and the reviewer's queue: the automatic check holds a photo, the word filter holds a comment,
 * a report takes a journey out of Discover, and a person decides. Nothing is removed until a reviewer removes it.
 */
class ModerationTest extends ApiTest {

    /** The local stand-in's marker for "flag this one". */
    private static final Color FLAGGED = new Color(255, 0, 255);

    @Test
    void aFlaggedPhotoIsSeenOnlyByItsOwnerUntilAReviewerReleasesIt() throws Exception {
        String maya = person("maya");
        String nora = person("nora");
        String journey = journey(maya, "Southeast Asia", "public", 3);
        String fine = uploadPhoto(maya, new Color(40, 120, 200));
        String flagged = uploadPhoto(maya, FLAGGED);
        String entry = JsonPath.read(
                mvc.perform(post("/v1/journeys/" + journey + "/entries")
                                .header("Authorization", maya)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"title\":\"Hoi An\",\"mediaIds\":[\"%s\",\"%s\"]}".formatted(flagged, fine)))
                        .andExpect(status().isCreated())
                        // The owner sees both, and which one is waiting.
                        .andExpect(jsonPath("$.media", hasSize(2)))
                        .andExpect(jsonPath("$.media[0].held").value(true))
                        .andExpect(jsonPath("$.media[1].held").value(false))
                        .andReturn()
                        .getResponse()
                        .getContentAsString(),
                "$.id");

        // Everyone else sees the entry without it: in the entry, in the journey's summary, as the cover, on the web.
        mvc.perform(get("/v1/entries/" + entry).header("Authorization", nora))
                .andExpect(jsonPath("$.media", hasSize(1)))
                .andExpect(jsonPath("$.media[0].id").value(fine));
        mvc.perform(get("/v1/journeys/" + journey + "/summary").header("Authorization", nora))
                .andExpect(jsonPath("$.photoCount").value(1))
                .andExpect(jsonPath("$.photos", hasSize(1)));
        // The journey's own grid of photos leaves it out for Maya too: there it is simply not there yet.
        mvc.perform(get("/v1/journeys/" + journey + "/summary").header("Authorization", maya))
                .andExpect(jsonPath("$.photoCount").value(1))
                .andExpect(jsonPath("$.latest[0].media", hasSize(2)));
        String coverOfFine = jdbc.sql("select storage_key from media where id = cast(:id as uuid)")
                .param("id", fine)
                .query(String.class)
                .single();
        mvc.perform(get("/v1/journeys/" + journey).header("Authorization", maya))
                .andExpect(jsonPath("$.coverUrl", containsString(coverOfFine)));
        mvc.perform(get("/e/" + entry))
                .andExpect(status().isOk())
                .andExpect(content().string(not(containsString(storageKey(flagged)))));

        // It can't stand for the journey or the person while it waits.
        mvc.perform(patch("/v1/journeys/" + journey)
                        .header("Authorization", maya)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"coverMediaId\":\"%s\"}".formatted(flagged)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("photo_under_review"));
        mvc.perform(put("/v1/me/profile")
                        .header("Authorization", maya)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"displayName\":\"Maya\",\"username\":\"maya\",\"avatarMediaId\":\"%s\"}"
                                .formatted(flagged)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("photo_under_review"));

        // The owner can ask for a second look; nobody else can.
        mvc.perform(post("/v1/media/" + flagged + "/second-look").header("Authorization", nora))
                .andExpect(status().isNotFound());
        mvc.perform(post("/v1/media/" + flagged + "/second-look").header("Authorization", maya))
                .andExpect(status().isNoContent());
        mvc.perform(post("/v1/media/" + fine + "/second-look").header("Authorization", maya))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("not_held"));

        // The reviewer's page needs the reviewers' password, and its buttons the page's own token.
        mvc.perform(get("/admin")).andExpect(status().isUnauthorized());
        mvc.perform(get("/admin").with(httpBasic("ada", "wrong"))).andExpect(status().isUnauthorized());
        mvc.perform(get("/admin").with(httpBasic("", "review"))).andExpect(status().isUnauthorized());
        mvc.perform(get("/admin").with(httpBasic("ada", "review")))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("Asked for a second look")))
                .andExpect(content().string(containsString("Uploaded by @maya")))
                .andExpect(content().string(containsString(storageKey(flagged))));
        mvc.perform(post("/admin/photos/" + flagged + "/release").with(httpBasic("ada", "review")))
                .andExpect(status().isForbidden());

        mvc.perform(reviewer(post("/admin/photos/" + flagged + "/release"))).andExpect(redirectedUrl("/admin"));

        mvc.perform(get("/v1/entries/" + entry).header("Authorization", nora))
                .andExpect(jsonPath("$.media", hasSize(2)))
                .andExpect(jsonPath("$.media[0].held").value(false));
        assertThat(jdbc.sql("select reviewer || ' ' || action from review_log")
                        .query(String.class)
                        .list())
                .containsExactly("ada released a photo");

        // A photo the reviewer removes is gone for its owner too.
        String second = uploadPhoto(maya, FLAGGED);
        String other = JsonPath.read(
                mvc.perform(post("/v1/journeys/" + journey + "/entries")
                                .header("Authorization", maya)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"title\":\"Hue\",\"mediaIds\":[\"%s\"]}".formatted(second)))
                        .andReturn()
                        .getResponse()
                        .getContentAsString(),
                "$.id");
        mvc.perform(reviewer(post("/admin/photos/" + second + "/remove"))).andExpect(redirectedUrl("/admin"));
        mvc.perform(get("/v1/entries/" + other).header("Authorization", maya))
                .andExpect(jsonPath("$.media", hasSize(0)));
        assertThat(jdbc.sql("select count(*) from media where held")
                        .query(Integer.class)
                        .single())
                .isZero();
        mvc.perform(get("/media/" + storageKey(fine))).andExpect(status().isOk());
    }

    @Test
    void aCommentTheWordFilterCatchesIsSeenOnlyByItsAuthorUntilReviewed() throws Exception {
        String maya = person("maya");
        String nora = person("nora");
        String kai = person("kai");
        String entry = entry(maya, journey(maya, "Southeast Asia", "public", 3), "Hoi An", 0);

        String held = JsonPath.read(
                mvc.perform(comment(nora, entry, "You absolute B.I.T.C.H"))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.held").value(true))
                        .andReturn()
                        .getResponse()
                        .getContentAsString(),
                "$.id");
        mvc.perform(comment(kai, entry, "What a damn fine view"))
                .andExpect(jsonPath("$.held").value(false));

        // Nora sees her own comment marked; Maya and Kai don't see it, don't count it and don't hear about it.
        mvc.perform(get("/v1/entries/" + entry + "/comments").header("Authorization", nora))
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.items[0].held").value(true));
        mvc.perform(get("/v1/entries/" + entry + "/comments").header("Authorization", maya))
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].author.username").value("kai"));
        mvc.perform(get("/v1/entries/" + entry).header("Authorization", maya))
                .andExpect(jsonPath("$.commentCount").value(1));
        mvc.perform(get("/v1/activity").header("Authorization", maya))
                .andExpect(jsonPath("$.items[?(@.kind=='comment')]", hasSize(1)));
        // Nobody can answer what they can't see.
        mvc.perform(post("/v1/entries/" + entry + "/comments")
                        .header("Authorization", kai)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"Hey\",\"parentId\":\"%s\"}".formatted(held)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("comment_gone"));

        mvc.perform(get("/admin").with(httpBasic("ada", "review")))
                .andExpect(content().string(containsString("You absolute B.I.T.C.H")))
                .andExpect(content().string(containsString("By @nora, on Southeast Asia")));
        mvc.perform(reviewer(post("/admin/comments/" + held + "/release"))).andExpect(redirectedUrl("/admin"));

        mvc.perform(get("/v1/entries/" + entry + "/comments").header("Authorization", maya))
                .andExpect(jsonPath("$.items", hasSize(2)));
        mvc.perform(get("/v1/entries/" + entry).header("Authorization", maya))
                .andExpect(jsonPath("$.commentCount").value(2));

        // One the reviewer removes is gone, and was never counted.
        String worse = JsonPath.read(
                mvc.perform(comment(nora, entry, "kys"))
                        .andReturn()
                        .getResponse()
                        .getContentAsString(),
                "$.id");
        mvc.perform(reviewer(post("/admin/comments/" + worse + "/remove"))).andExpect(redirectedUrl("/admin"));
        mvc.perform(get("/v1/entries/" + entry + "/comments").header("Authorization", nora))
                .andExpect(jsonPath("$.items", hasSize(2)));
        mvc.perform(get("/v1/entries/" + entry).header("Authorization", maya))
                .andExpect(jsonPath("$.commentCount").value(2));
        assertThat(jdbc.sql(
                                "select count(*) from entries e where e.comment_count <> (select count(*) from comments c where c.entry_id = e.id and not c.held)")
                        .query(Integer.class)
                        .single())
                .isZero();
    }

    @Test
    void aReportedJourneyLeavesDiscoverAndSearchUntilAReviewerHasLooked() throws Exception {
        String maya = person("maya");
        String nora = person("nora");
        String kai = person("kai");
        String journey = journey(maya, "Southeast Asia", "public", 5);
        entry(maya, journey, "Hanoi", 3);
        entry(maya, journey, "Hue", 2);
        String hoiAn = entry(maya, journey, "Hoi An", 1);
        mvc.perform(get("/v1/discover").header("Authorization", nora)).andExpect(jsonPath("$.trending", hasSize(1)));

        mvc.perform(report(kai, "entry", hoiAn, "spam")).andExpect(status().isCreated());
        mvc.perform(report(nora, "entry", hoiAn, "other")).andExpect(status().isCreated());

        // Out of the places that recommend it; still there for anyone who has the link or follows it.
        mvc.perform(get("/v1/discover").header("Authorization", nora)).andExpect(jsonPath("$.trending", hasSize(0)));
        mvc.perform(get("/v1/search").param("q", "asia").header("Authorization", nora))
                .andExpect(jsonPath("$.journeys", hasSize(0)));
        mvc.perform(get("/v1/journeys/suggested").header("Authorization", nora)).andExpect(jsonPath("$", hasSize(0)));
        mvc.perform(get("/v1/journeys/" + journey).header("Authorization", nora))
                .andExpect(status().isOk());
        mvc.perform(get("/j/" + journey)).andExpect(status().isOk());

        mvc.perform(get("/admin").with(httpBasic("ada", "review")))
                .andExpect(content().string(containsString("Hoi An")))
                .andExpect(content().string(containsString("Reported by @kai.")))
                .andExpect(content().string(containsString("Remove the entry")));
        String first = jdbc.sql("select id::text from reports order by created_at limit 1")
                .query(String.class)
                .single();
        // Nothing wrong with it: both reports about the entry are answered at once, and the journey is back.
        mvc.perform(reviewer(post("/admin/reports/" + first + "/dismiss"))).andExpect(redirectedUrl("/admin"));
        assertThat(jdbc.sql(
                                "select count(*) from reports where status = 'reviewed' and outcome = 'dismissed' and reviewed_by = 'ada'")
                        .query(Integer.class)
                        .single())
                .isEqualTo(2);
        mvc.perform(get("/v1/discover").header("Authorization", nora)).andExpect(jsonPath("$.trending", hasSize(1)));
        mvc.perform(reviewer(post("/admin/reports/" + first + "/dismiss"))).andExpect(status().isNotFound());

        // This time it does break the rules: the reviewer removes the entry, and the journey's count follows.
        mvc.perform(report(kai, "entry", hoiAn, "nudity")).andExpect(status().isCreated());
        String again = jdbc.sql("select id::text from reports where status = 'open'")
                .query(String.class)
                .single();
        mvc.perform(reviewer(post("/admin/reports/" + again + "/remove"))).andExpect(redirectedUrl("/admin"));
        mvc.perform(get("/v1/entries/" + hoiAn).header("Authorization", maya)).andExpect(status().isNotFound());
        mvc.perform(get("/v1/journeys/" + journey).header("Authorization", maya))
                .andExpect(jsonPath("$.entryCount").value(2));

        // A report about a person can be closed, but a person is never removed from the queue.
        mvc.perform(report(kai, "profile", idOf("maya"), "impersonation")).andExpect(status().isCreated());
        String aboutMaya = jdbc.sql("select id::text from reports where status = 'open'")
                .query(String.class)
                .single();
        mvc.perform(get("/admin").with(httpBasic("ada", "review")))
                .andExpect(content().string(not(containsString("Remove the profile"))));
        mvc.perform(reviewer(post("/admin/reports/" + aboutMaya + "/remove"))).andExpect(status().isBadRequest());
        mvc.perform(get("/v1/profiles/maya").header("Authorization", nora)).andExpect(status().isOk());
        assertThat(jdbc.sql("select action from review_log order by created_at")
                        .query(String.class)
                        .list())
                .containsExactly("dismissed a report", "removed reported content");
    }

    @Test
    void aNewProfileNeedsThePersonToConfirmTheyAreThirteenOrOlder() throws Exception {
        String token = signIn("nora@example.com");
        String profile = "{\"displayName\":\"Nora\",\"username\":\"nora\"%s}";
        mvc.perform(put("/v1/me/profile")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(profile.formatted("")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("age_required"))
                .andExpect(jsonPath("$.detail")
                        .value("Journey is for people aged 13 and over. Confirm your age to continue."));
        mvc.perform(put("/v1/me/profile")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(profile.formatted(",\"ageConfirmed\":false")))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/v1/me").header("Authorization", token))
                .andExpect(jsonPath("$.profile").value(nullValue()));

        mvc.perform(put("/v1/me/profile")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(profile.formatted(",\"ageConfirmed\":true")))
                .andExpect(status().isOk());
        // It is asked once. Changing the profile later doesn't ask again, and the moment it was given is kept.
        mvc.perform(put("/v1/me/profile")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(profile.formatted(",\"bio\":\"Slow travel\"")))
                .andExpect(status().isOk());
        assertThat(jdbc.sql("select age_confirmed_at is not null from profiles")
                        .query(Boolean.class)
                        .single())
                .isTrue();
    }

    @Test
    void theReviewersPasswordCannotBeGuessedByTrying() throws Exception {
        // Ten wrong passwords from one address, and that address waits, even with the right one.
        for (int i = 0; i < 10; i++) {
            mvc.perform(get("/admin").with(httpBasic("ada", "guess" + i)).with(from("203.0.113.9")))
                    .andExpect(status().isUnauthorized());
        }
        mvc.perform(get("/admin").with(httpBasic("ada", "review")).with(from("203.0.113.9")))
                .andExpect(status().isUnauthorized());
        // Everyone else is let in as before.
        mvc.perform(get("/admin").with(httpBasic("ada", "review")).with(from("198.51.100.4")))
                .andExpect(status().isOk());
        // A few slips don't lock anyone out, and getting it right clears them.
        for (int i = 0; i < 3; i++) {
            mvc.perform(get("/admin").with(httpBasic("ada", "oops")).with(from("198.51.100.7")))
                    .andExpect(status().isUnauthorized());
        }
        mvc.perform(get("/admin").with(httpBasic("ada", "review")).with(from("198.51.100.7")))
                .andExpect(status().isOk());
    }

    private static RequestPostProcessor from(String address) {
        return request -> {
            request.setRemoteAddr(address);
            return request;
        };
    }

    private MockHttpServletRequestBuilder reviewer(MockHttpServletRequestBuilder request) {
        return request.with(httpBasic("ada", "review")).with(csrf());
    }

    private MockHttpServletRequestBuilder comment(String token, String entry, String body) {
        return post("/v1/entries/" + entry + "/comments")
                .header("Authorization", token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"body\":\"%s\"}".formatted(body));
    }

    private MockHttpServletRequestBuilder report(String token, String type, String id, String reason) {
        return post("/v1/reports")
                .header("Authorization", token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"targetType\":\"%s\",\"targetId\":\"%s\",\"reason\":\"%s\"}".formatted(type, id, reason));
    }

    private String idOf(String username) {
        return jdbc.sql("select id::text from profiles where username = :u")
                .param("u", username)
                .query(String.class)
                .single();
    }

    private String storageKey(String mediaId) {
        return jdbc.sql("select storage_key from media where id = cast(:id as uuid)")
                .param("id", mediaId)
                .query(String.class)
                .single();
    }

    /** Uploads a photo of one solid colour the way the app does. Returns the media id. */
    private String uploadPhoto(String token, Color colour) throws Exception {
        String target = mvc.perform(post("/v1/media/uploads")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kind\":\"photo\",\"contentType\":\"image/jpeg\"}"))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        BufferedImage image = new BufferedImage(400, 300, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = image.createGraphics();
        g.setColor(colour);
        g.fillRect(0, 0, 400, 300);
        g.dispose();
        ByteArrayOutputStream jpeg = new ByteArrayOutputStream();
        ImageIO.write(image, "jpg", jpeg);
        mvc.perform(put(URI.create(JsonPath.<String>read(target, "$.uploadUrl")))
                        .contentType(MediaType.IMAGE_JPEG)
                        .content(jpeg.toByteArray()))
                .andExpect(status().isNoContent());
        String id = JsonPath.read(target, "$.mediaId");
        mvc.perform(post("/v1/media/uploads/" + id + "/complete").header("Authorization", token))
                .andExpect(status().isNoContent());
        return id;
    }
}
