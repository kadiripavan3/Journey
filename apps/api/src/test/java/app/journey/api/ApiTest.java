package app.journey.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/** Base for API tests: the whole application, a real database, emptied before each test. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles({"local", "test"})
public abstract class ApiTest {

    @Autowired
    protected MockMvc mvc;

    @Autowired
    protected JdbcClient jdbc;

    @BeforeEach
    void emptyDatabase() {
        jdbc.sql(
                        "truncate table entry_media, entries, journey_follows, journeys, media, profiles, local_users, job_runs, rate_limits, review_log, deletion_requests, push_tickets, media_orphan_checks, removed_files, deleted_accounts, banned_sign_ins, apple_sign_ins, announcements cascade")
                .update();
    }

    /** Signs in with the test code and returns "Bearer <token>". */
    protected String signIn(String email) throws Exception {
        String body = mvc.perform(post("/local-auth/token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"code\":\"123456\"}".formatted(email)))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return "Bearer " + JsonPath.<String>read(body, "$.accessToken");
    }

    /** Signs in and creates a profile. Returns "Bearer <token>". */
    protected String person(String username) throws Exception {
        String token = signIn(username + "@example.com");
        mvc.perform(put("/v1/me/profile")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ageConfirmed\":true,\"displayName\":\"%s\",\"username\":\"%s\"}"
                                .formatted(username, username)))
                .andExpect(status().isOk());
        return token;
    }

    /** Uploads a small photo the way the app does: ask for a target, send the bytes there, say it is done. Returns the media id. */
    protected String uploadPhoto(String token) throws Exception {
        return upload(
                token,
                "image/jpeg",
                jpeg(new java.awt.image.BufferedImage(8, 6, java.awt.image.BufferedImage.TYPE_INT_RGB)));
    }

    /** Uploads these bytes as a photo and says it is done, expecting that to work. Returns the media id. */
    protected String upload(String token, String contentType, byte[] bytes) throws Exception {
        String target = startPhoto(token, contentType);
        send(target, contentType, bytes);
        String id = JsonPath.read(target, "$.mediaId");
        mvc.perform(post("/v1/media/uploads/" + id + "/complete").header("Authorization", token))
                .andExpect(status().isNoContent());
        return id;
    }

    /** Asks for somewhere to send a photo. Returns the API's answer (mediaId, uploadUrl, …) as JSON. */
    protected String startPhoto(String token, String contentType) throws Exception {
        return mvc.perform(post("/v1/media/uploads")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kind\":\"photo\",\"contentType\":\"%s\"}".formatted(contentType)))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
    }

    /** Sends a file to where the API said to send it. */
    protected void send(String target, String contentType, byte[] bytes) throws Exception {
        mvc.perform(put(java.net.URI.create(JsonPath.<String>read(target, "$.uploadUrl")))
                        .contentType(MediaType.valueOf(contentType))
                        .content(bytes))
                .andExpect(status().isNoContent());
    }

    protected static byte[] jpeg(java.awt.image.BufferedImage image) throws java.io.IOException {
        java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(image, "jpg", bytes);
        return bytes.toByteArray();
    }

    /** Creates a public trip that started `daysAgo` days ago. Returns its id. */
    protected String journey(String token, String title, String visibility, int daysAgo) throws Exception {
        String body = mvc.perform(post("/v1/journeys")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"%s\",\"template\":\"trip\",\"startDate\":\"%s\",\"visibility\":\"%s\"}"
                                .formatted(
                                        title,
                                        java.time.LocalDate.now(java.time.ZoneOffset.UTC)
                                                .minusDays(daysAgo),
                                        visibility)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return JsonPath.read(body, "$.id");
    }

    /** Adds a text entry dated `daysAgo` days ago. Returns its id. */
    protected String entry(String token, String journeyId, String title, int daysAgo) throws Exception {
        String body = mvc.perform(post("/v1/journeys/" + journeyId + "/entries")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"%s\",\"happenedAt\":\"%s\"}"
                                .formatted(
                                        title,
                                        java.time.Instant.now()
                                                .minus(daysAgo, java.time.temporal.ChronoUnit.DAYS)
                                                .minusSeconds(60))))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return JsonPath.read(body, "$.id");
    }
}
