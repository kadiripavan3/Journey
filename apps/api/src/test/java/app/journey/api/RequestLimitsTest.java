package app.journey.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.awt.image.BufferedImage;
import java.util.Random;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;

/**
 * What the API takes from anyone who knocks: nothing big, every request with an id to find it by, and wrong
 * passwords counted by the address the proxy vouches for, not the one the caller writes.
 */
@TestPropertySource(properties = "journey.client-address-header=Fly-Client-IP")
class RequestLimitsTest extends ApiTest {

    @Test
    void aBodyThatIsFarTooBigIsRefusedBeforeAnythingReadsIt() throws Exception {
        String nora = person("nora");
        String journey = journey(nora, "Iceland ring road", "public", 3);
        String huge = "{\"title\":\"" + "x".repeat(70_000) + "\"}";
        mvc.perform(post("/v1/journeys/" + journey + "/entries")
                        .header("Authorization", nora)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(huge))
                .andExpect(status().isContentTooLarge())
                .andExpect(jsonPath("$.code").value("too_large"));
        // Also where nobody is signed in: the video service's webhook reads nothing it wasn't promised to be small.
        mvc.perform(post("/webhooks/mux")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(huge))
                .andExpect(status().isContentTooLarge());
        mvc.perform(post("/delete-account")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .content("email=a%40example.com&note=" + "y".repeat(70_000)))
                .andExpect(status().isContentTooLarge());
        // A photo is not a request body in that sense: files have their own ceiling (15 MB), where they are sent.
        BufferedImage noisy = new BufferedImage(900, 900, BufferedImage.TYPE_INT_RGB);
        Random random = new Random(7);
        for (int x = 0; x < 900; x++) {
            for (int y = 0; y < 900; y++) {
                noisy.setRGB(x, y, random.nextInt(0xffffff));
            }
        }
        byte[] photo = jpeg(noisy);
        assertThat(photo.length).isGreaterThan(64 * 1024);
        upload(nora, "image/jpeg", photo);
    }

    @Test
    void everyAnswerCarriesAnIdThatIsAlsoOnTheLogLines() throws Exception {
        mvc.perform(get("/actuator/health")).andExpect(header().exists("X-Request-Id"));
        // Behind the proxy, its id is used, so the proxy's log and the API's log line up.
        mvc.perform(get("/v1/feed").header("Fly-Request-Id", "01JABCDEFGHJKMNPQRSTVWXYZ0-fra"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string("X-Request-Id", "01JABCDEFGHJKMNPQRSTVWXYZ0-fra"));
        // Something that isn't an id is not echoed back.
        mvc.perform(get("/v1/feed").header("Fly-Request-Id", "<script>"))
                .andExpect(header().string("X-Request-Id", org.hamcrest.Matchers.not("<script>")));
    }

    @Test
    void wrongPasswordsAreCountedByTheAddressTheProxyGivesNotTheOneTheCallerWrites() throws Exception {
        // Ten guesses, each claiming to come from somewhere else. The proxy says they all come from one place.
        for (int i = 0; i < 10; i++) {
            mvc.perform(get("/admin")
                            .with(httpBasic("ada", "guess" + i))
                            .header("X-Forwarded-For", "10.0.0." + i)
                            .header("Fly-Client-IP", "203.0.113.50"))
                    .andExpect(status().isUnauthorized());
        }
        mvc.perform(get("/admin")
                        .with(httpBasic("ada", "review"))
                        .header("X-Forwarded-For", "10.9.9.9")
                        .header("Fly-Client-IP", "203.0.113.50"))
                .andExpect(status().isUnauthorized());
        // A reviewer somewhere else is let in as before.
        mvc.perform(get("/admin").with(httpBasic("ada", "review")).header("Fly-Client-IP", "198.51.100.20"))
                .andExpect(status().isOk());
    }
}
