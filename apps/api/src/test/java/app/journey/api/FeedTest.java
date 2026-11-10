package app.journey.api;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;

class FeedTest extends ApiTest {

    @Test
    void homeShowsWhatIsNewSinceYourLastVisitGroupedPerJourney() throws Exception {
        String maya = person("maya");
        String lea = person("lea");
        String reader = person("reader");
        String trip = journey(maya, "Southeast Asia by motorbike", "public", 5);
        String guitar = journey(lea, "30 days of guitar", "public", 5);
        String unfollowed = journey(lea, "Something else", "public", 5);
        entry(maya, trip, "Before you followed", 4);

        mvc.perform(put("/v1/journeys/" + trip + "/follow").header("Authorization", reader))
                .andExpect(status().isOk());
        mvc.perform(put("/v1/journeys/" + guitar + "/follow").header("Authorization", reader))
                .andExpect(status().isOk());
        // Following a journey puts its latest entry on your Home; a journey with no entries adds nothing yet.
        mvc.perform(get("/v1/feed").header("Authorization", reader))
                .andExpect(jsonPath("$.groups", hasSize(1)))
                .andExpect(jsonPath("$.groups[0].newCount").value(1))
                .andExpect(jsonPath("$.groups[0].entries[0].title").value("Before you followed"))
                .andExpect(jsonPath("$.groups[0].journey.viewer.lastReadAt").isNotEmpty())
                .andExpect(jsonPath("$.followingCount").value(2));
        mvc.perform(post("/v1/journeys/" + trip + "/read").header("Authorization", reader))
                .andExpect(status().isNoContent());
        mvc.perform(get("/v1/feed").header("Authorization", reader)).andExpect(jsonPath("$.groups", hasSize(0)));

        entry(maya, trip, "Hoi An", 2);
        entry(maya, trip, "Mount Bromo", 0);
        entry(lea, guitar, "G chord", 0);
        entry(lea, unfollowed, "Not for you", 0);

        mvc.perform(get("/v1/feed").header("Authorization", reader))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.groups", hasSize(2)))
                .andExpect(jsonPath("$.groups[0].journey.title").value("30 days of guitar"))
                .andExpect(jsonPath("$.groups[0].newCount").value(1))
                .andExpect(jsonPath("$.groups[1].journey.title").value("Southeast Asia by motorbike"))
                .andExpect(jsonPath("$.groups[1].newCount").value(2))
                .andExpect(jsonPath("$.groups[1].entries[0].title").value("Mount Bromo"))
                .andExpect(jsonPath("$.groups[1].entries[0].journeyTitle").value("Southeast Asia by motorbike"));

        // Reading a journey catches you up on it.
        mvc.perform(post("/v1/journeys/" + trip + "/read").header("Authorization", reader))
                .andExpect(status().isNoContent());
        mvc.perform(get("/v1/feed").header("Authorization", reader))
                .andExpect(jsonPath("$.groups", hasSize(1)))
                .andExpect(jsonPath("$.groups[0].journey.title").value("30 days of guitar"));
    }
}
