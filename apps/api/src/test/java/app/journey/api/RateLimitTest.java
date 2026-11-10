package app.journey.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.test.context.TestPropertySource;

/** One person can't call the API without end. */
@TestPropertySource(properties = {
  "journey.rate-limit.enabled=true",
  "journey.rate-limit.writes-per-minute=6",
  "journey.rate-limit.reads-per-minute=8",
  "journey.rate-limit.sign-ins-per-minute=50"
})
class RateLimitTest extends ApiTest {

  @Test
  void goingTooFastGetsAClearAnswerAndOnlySlowsThatPersonDown() throws Exception {
    String maya = person("maya"); // one write
    String nora = person("nora");
    String journey = journey(maya, "Southeast Asia", "public", 3); // two
    for (int i = 0; i < 4; i++) {
      mvc.perform(put("/v1/journeys/" + journey + "/follow").header("Authorization", nora)).andExpect(status().isOk());
    }
    for (int i = 0; i < 4; i++) {
      mvc.perform(put("/v1/profiles/nora/follow").header("Authorization", maya)).andExpect(status().isOk()); // maya: six
    }
    mvc.perform(put("/v1/profiles/nora/follow").header("Authorization", maya))
        .andExpect(status().isTooManyRequests())
        .andExpect(header().exists("Retry-After"))
        .andExpect(jsonPath("$.code").value("slow_down"))
        .andExpect(jsonPath("$.detail").value("That's a lot at once. Wait a minute and try again."));
    // Reading has its own, larger allowance, and Nora isn't affected by Maya's hurry.
    mvc.perform(get("/v1/feed").header("Authorization", maya)).andExpect(status().isOk());
    mvc.perform(put("/v1/journeys/" + journey + "/follow").header("Authorization", nora)).andExpect(status().isOk());
    for (int i = 0; i < 7; i++) {
      mvc.perform(get("/v1/feed").header("Authorization", maya)).andExpect(status().isOk());
    }
    mvc.perform(get("/v1/feed").header("Authorization", maya)).andExpect(status().isTooManyRequests());
  }
}
