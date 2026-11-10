package app.journey.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** One person can't call the API without end. */
@TestPropertySource(
        properties = {
            "journey.rate-limit.enabled=true",
            "journey.rate-limit.writes-per-minute=6",
            "journey.rate-limit.reads-per-minute=8",
            "journey.rate-limit.sign-ins-per-minute=50"
        })
class RateLimitTest extends ApiTest {

    private static final int WRITES = 6;
    private static final int READS = 8;

    /**
     * An allowance is full to start with and tops up evenly as time passes, so how many calls get through
     * before "slow down" depends a little on how long the test took. It is never fewer than the allowance and
     * never more than the allowance plus what the clock gave back, and that is what is checked: the test
     * gives the same answer on a fast machine and a slow one.
     */
    @Test
    void goingTooFastGetsAClearAnswerAndOnlySlowsThatPersonDown() throws Exception {
        long started = System.nanoTime();
        String maya = person("maya"); // one write
        String nora = person("nora");
        String journey = journey(maya, "Southeast Asia", "public", 3); // two
        for (int i = 0; i < 4; i++) {
            mvc.perform(put("/v1/journeys/" + journey + "/follow").header("Authorization", nora))
                    .andExpect(status().isOk());
        }

        // Maya keeps going until she is told to slow down.
        MockHttpServletResponse refused = null;
        int written = 2;
        while (refused == null) {
            MockHttpServletResponse answer = send(put("/v1/profiles/nora/follow"), maya);
            if (answer.getStatus() == 429) {
                refused = answer;
            } else {
                assertThat(answer.getStatus()).isEqualTo(200);
                written++;
            }
            assertThat(written).as("writes let through").isLessThanOrEqualTo(WRITES + toppedUp(started, WRITES));
        }
        assertThat(written).isGreaterThanOrEqualTo(WRITES);
        assertThat(refused.getHeader("Retry-After")).isNotNull();
        assertThat(JsonPath.<String>read(refused.getContentAsString(), "$.code"))
                .isEqualTo("slow_down");
        assertThat(JsonPath.<String>read(refused.getContentAsString(), "$.detail"))
                .isEqualTo("That's a lot at once. Wait a minute and try again.");

        // Nora isn't affected by Maya's hurry: she has used five of her own six.
        assertThat(send(put("/v1/journeys/" + journey + "/follow"), nora).getStatus())
                .isEqualTo(200);
        // Reading has its own, larger allowance, which Maya hasn't touched.
        long reading = System.nanoTime();
        int read = 0;
        while (send(get("/v1/feed"), maya).getStatus() == 200) {
            read++;
            assertThat(read).as("reads let through").isLessThanOrEqualTo(READS + toppedUp(reading, READS));
        }
        assertThat(read).isGreaterThanOrEqualTo(READS);
    }

    /** How many calls the clock has given back since a moment, at most, for an allowance of this many a minute. */
    private static int toppedUp(long since, int perMinute) {
        double minutes = (System.nanoTime() - since) / 60e9;
        return (int) Math.ceil(minutes * perMinute) + 1;
    }

    private MockHttpServletResponse send(MockHttpServletRequestBuilder request, String token) throws Exception {
        return mvc.perform(request.header("Authorization", token)).andReturn().getResponse();
    }
}
