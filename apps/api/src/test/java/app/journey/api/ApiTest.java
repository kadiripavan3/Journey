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

  @Autowired protected MockMvc mvc;
  @Autowired protected JdbcClient jdbc;

  @BeforeEach
  void emptyDatabase() {
    jdbc.sql("truncate table entry_media, entries, journey_follows, journeys, media, profiles, local_users cascade").update();
  }

  /** Signs in with the test code and returns "Bearer <token>". */
  protected String signIn(String email) throws Exception {
    String body =
        mvc.perform(
                post("/local-auth/token")
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
    mvc.perform(
            put("/v1/me/profile")
                .header("Authorization", token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"displayName\":\"%s\",\"username\":\"%s\"}".formatted(username, username)))
        .andExpect(status().isOk());
    return token;
  }

  /** Uploads a small photo the way the app does: ask for a target, send the bytes there. Returns the media id. */
  protected String uploadPhoto(String token) throws Exception {
    String target =
        mvc.perform(
                post("/v1/media/uploads")
                    .header("Authorization", token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"kind\":\"photo\",\"contentType\":\"image/jpeg\"}"))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    java.io.ByteArrayOutputStream jpeg = new java.io.ByteArrayOutputStream();
    javax.imageio.ImageIO.write(new java.awt.image.BufferedImage(8, 6, java.awt.image.BufferedImage.TYPE_INT_RGB), "jpg", jpeg);
    mvc.perform(put(java.net.URI.create(JsonPath.<String>read(target, "$.uploadUrl"))).contentType(MediaType.IMAGE_JPEG).content(jpeg.toByteArray()))
        .andExpect(status().isNoContent());
    return JsonPath.read(target, "$.mediaId");
  }

  /** Creates a public trip that started `daysAgo` days ago. Returns its id. */
  protected String journey(String token, String title, String visibility, int daysAgo) throws Exception {
    String body =
        mvc.perform(
                post("/v1/journeys")
                    .header("Authorization", token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        "{\"title\":\"%s\",\"template\":\"trip\",\"startDate\":\"%s\",\"visibility\":\"%s\"}"
                            .formatted(title, java.time.LocalDate.now(java.time.ZoneOffset.UTC).minusDays(daysAgo), visibility)))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return JsonPath.read(body, "$.id");
  }

  /** Adds a text entry dated `daysAgo` days ago. Returns its id. */
  protected String entry(String token, String journeyId, String title, int daysAgo) throws Exception {
    String body =
        mvc.perform(
                post("/v1/journeys/" + journeyId + "/entries")
                    .header("Authorization", token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        "{\"title\":\"%s\",\"happenedAt\":\"%s\"}"
                            .formatted(title, java.time.Instant.now().minus(daysAgo, java.time.temporal.ChronoUnit.DAYS).minusSeconds(60))))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return JsonPath.read(body, "$.id");
  }
}
