package app.journey.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import app.journey.api.entry.LocationPrecision;
import app.journey.api.entry.Place;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

/** Where entries happened: what is kept, what other people get to see, the map, and one person's part of a shared story. */
class PlacesTest extends ApiTest {

    private String entryAt(String token, String journey, String title, int daysAgo, String place) throws Exception {
        String body = mvc.perform(post("/v1/journeys/" + journey + "/entries")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"%s\",\"happenedAt\":\"%s\"%s}"
                                .formatted(
                                        title,
                                        java.time.Instant.now()
                                                .minus(daysAgo, java.time.temporal.ChronoUnit.DAYS)
                                                .minusSeconds(60),
                                        place)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return JsonPath.read(body, "$.id");
    }

    @Test
    void aPlaceIsShownAtCityLevelToEveryoneButItsAuthorUnlessTheyChoseTheExactSpot() throws Exception {
        String maya = person("maya");
        String reader = person("reader");
        String journey = journey(maya, "Southeast Asia", "public", 9);
        // Hoi An's old town, to the metre.
        String city = entryAt(
                maya, journey, "Lanterns", 2, ",\"placeName\":\"Hoi An, Vietnam\",\"lat\":15.87712,\"lng\":108.32844");
        String exact = entryAt(
                maya,
                journey,
                "The noodle stall",
                1,
                ",\"placeName\":\"Hoi An, Vietnam\",\"lat\":15.87712,\"lng\":108.32844,\"locationPrecision\":\"exact\"");
        String named = entryAt(maya, journey, "Somewhere", 0, ",\"placeName\":\"On the road\"");

        // Maya gets back exactly what she saved; a point without a say is city level.
        mvc.perform(get("/v1/entries/" + city).header("Authorization", maya))
                .andExpect(jsonPath("$.lat").value(15.87712))
                .andExpect(jsonPath("$.lng").value(108.32844))
                .andExpect(jsonPath("$.locationPrecision").value("city"));
        // A reader gets the middle of the ten-kilometre square it is in, from which the spot can't be worked out.
        mvc.perform(get("/v1/entries/" + city).header("Authorization", reader))
                .andExpect(jsonPath("$.placeName").value("Hoi An, Vietnam"))
                .andExpect(jsonPath("$.lat").value(15.85))
                .andExpect(jsonPath("$.lng").value(108.35))
                .andExpect(jsonPath("$.locationPrecision").value("city"));
        mvc.perform(get("/v1/entries/" + exact).header("Authorization", reader))
                .andExpect(jsonPath("$.lat").value(15.87712))
                .andExpect(jsonPath("$.locationPrecision").value("exact"));
        mvc.perform(get("/v1/entries/" + named).header("Authorization", reader))
                .andExpect(jsonPath("$.placeName").value("On the road"))
                .andExpect(jsonPath("$.lat").value(nullValue()))
                .andExpect(jsonPath("$.locationPrecision").value("none"));
        // The same holds in lists.
        mvc.perform(get("/v1/journeys/" + journey + "/entries").header("Authorization", reader))
                .andExpect(jsonPath("$.items[0].lat").value(15.85))
                .andExpect(jsonPath("$.items[1].lat").value(15.87712));

        // Changing the entry can take the point away again.
        mvc.perform(put("/v1/entries/" + exact)
                        .header("Authorization", maya)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"The noodle stall\",\"placeName\":\"Hoi An, Vietnam\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lat").value(nullValue()))
                .andExpect(jsonPath("$.locationPrecision").value("none"));
    }

    @Test
    void aPointThatIsNotOnTheMapOrHasNoNameIsRefused() throws Exception {
        String maya = person("maya");
        String journey = journey(maya, "Southeast Asia", "public", 9);
        for (String place : new String[] {
            ",\"placeName\":\"Nowhere\",\"lat\":95,\"lng\":10",
            ",\"placeName\":\"Nowhere\",\"lat\":10,\"lng\":181",
            ",\"placeName\":\"Half\",\"lat\":10"
        }) {
            mvc.perform(post("/v1/journeys/" + journey + "/entries")
                            .header("Authorization", maya)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"title\":\"x\"" + place + "}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("invalid_place"));
        }
        mvc.perform(post("/v1/journeys/" + journey + "/entries")
                        .header("Authorization", maya)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"x\",\"lat\":10,\"lng\":10}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("place_needs_name"));
        mvc.perform(
                        post("/v1/journeys/" + journey + "/entries")
                                .header("Authorization", maya)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"title\":\"x\",\"placeName\":\"Here\",\"lat\":10,\"lng\":10,\"locationPrecision\":\"street\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("invalid_precision"));
    }

    @Test
    void cityLevelPointsLandInTheMiddleOfTheirSquare() {
        // Everything inside one square comes out as the same point, and never more than half a square away.
        assertThat(Place.of("A", 15.801, 108.301, null).shownTo(false))
                .isEqualTo(Place.of("A", 15.899, 108.399, null).shownTo(false));
        for (double value : new double[] {-33.92, -0.01, 0.0, 0.04, 64.1466, 89.99, -179.96}) {
            double shown = Place.of("A", Math.max(-90, Math.min(90, value)), value, null)
                    .shownTo(false)
                    .lng();
            assertThat(Math.abs(shown - value)).isLessThanOrEqualTo(0.0501);
        }
        Place own = Place.of("A", 15.87712, 108.32844, LocationPrecision.CITY);
        assertThat(own.shownTo(true)).isEqualTo(own);
        assertThat(Place.of("A", 1.0, 2.0, LocationPrecision.EXACT)
                        .shownTo(false)
                        .lat())
                .isEqualTo(1.0);
        assertThat(Place.of("  ", null, null, LocationPrecision.EXACT)).isEqualTo(Place.NONE);
    }

    @Test
    void theMapShowsTheEntriesThatHaveAPlaceInStoryOrder() throws Exception {
        String maya = person("maya");
        String reader = person("reader");
        String journey = journey(maya, "Southeast Asia", "public", 20);
        String photo = uploadPhoto(maya);
        entryAt(maya, journey, "Hue", 5, ",\"placeName\":\"Hue, Vietnam\",\"lat\":16.4637,\"lng\":107.5909");
        entryAt(maya, journey, "Hanoi", 12, ",\"placeName\":\"Hanoi, Vietnam\",\"lat\":21.0278,\"lng\":105.8342");
        entryAt(maya, journey, "A day of rain", 8, "");
        entryAt(
                maya,
                journey,
                "Hanoi again",
                3,
                ",\"placeName\":\"hanoi, vietnam\",\"lat\":21.03,\"lng\":105.85,\"isMilestone\":true,\"mediaIds\":[\"%s\"]"
                        .formatted(photo));

        mvc.perform(get("/v1/journeys/" + journey + "/map").header("Authorization", reader))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pins[*].title", contains("Hanoi", "Hue", "Hanoi again")))
                .andExpect(jsonPath("$.pins[0].label").value("Day 9"))
                .andExpect(jsonPath("$.pins[0].lat").value(21.05))
                .andExpect(jsonPath("$.pins[0].thumbUrl").value(nullValue()))
                .andExpect(jsonPath("$.pins[2].isMilestone").value(true))
                .andExpect(jsonPath("$.pins[2].thumbUrl").isNotEmpty())
                .andExpect(jsonPath("$.pinCount").value(3))
                .andExpect(jsonPath("$.placeCount").value(2))
                .andExpect(jsonPath("$.capped").value(false));
        mvc.perform(get("/v1/journeys/" + journey + "/map").header("Authorization", maya))
                .andExpect(jsonPath("$.pins[0].lat").value(21.0278));

        // A journey nobody may see has no map either, and an empty one has an empty map.
        String secret = journey(maya, "Diary", "private", 3);
        mvc.perform(get("/v1/journeys/" + secret + "/map").header("Authorization", reader))
                .andExpect(status().isNotFound());
        mvc.perform(get("/v1/journeys/" + secret + "/map").header("Authorization", maya))
                .andExpect(jsonPath("$.pins", hasSize(0)))
                .andExpect(jsonPath("$.pinCount").value(0));
    }

    @Test
    void aSharedStoryCanBeReadOnePersonAtATime() throws Exception {
        String nora = person("nora");
        String alex = person("alex");
        String reader = person("reader");
        String journey = journey(nora, "Iceland ring road", "public", 9);
        mvc.perform(put("/v1/profiles/nora/follow").header("Authorization", alex))
                .andExpect(status().isOk());
        mvc.perform(post("/v1/journeys/" + journey + "/members")
                        .header("Authorization", nora)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"alex\"}"))
                .andExpect(status().isOk());
        mvc.perform(post("/v1/journeys/" + journey + "/invitation/accept").header("Authorization", alex))
                .andExpect(status().isOk());
        entry(nora, journey, "Reykjavik", 6);
        entry(alex, journey, "The lake before breakfast", 5);
        entry(nora, journey, "Fog on the pass", 4);
        String last = entry(alex, journey, "Whales", 3);
        entry(nora, journey, "Home", 1);

        mvc.perform(get("/v1/journeys/" + journey + "/entries").header("Authorization", reader))
                .andExpect(jsonPath("$.total").value(5));
        mvc.perform(get("/v1/journeys/" + journey + "/entries")
                        .param("author", "alex")
                        .header("Authorization", reader))
                .andExpect(jsonPath("$.items[*].title", contains("The lake before breakfast", "Whales")))
                .andExpect(jsonPath("$.total").value(2))
                // Each entry keeps its place in the whole story.
                .andExpect(jsonPath("$.items[*].position", contains(2, 4)));
        // Pages and "around" work inside one person's part too.
        mvc.perform(get("/v1/journeys/" + journey + "/entries")
                        .param("author", "alex")
                        .param("limit", "1")
                        .param("around", last)
                        .header("Authorization", reader))
                .andExpect(jsonPath("$.items[*].title", contains("Whales")))
                .andExpect(jsonPath("$.prevCursor").isNotEmpty())
                .andExpect(jsonPath("$.nextCursor").value(nullValue()));
        mvc.perform(get("/v1/journeys/" + journey + "/entries")
                        .param("author", "nobody")
                        .header("Authorization", reader))
                .andExpect(status().isNotFound());
        // Someone who writes nothing in it simply has an empty part.
        mvc.perform(get("/v1/journeys/" + journey + "/entries")
                        .param("author", "reader")
                        .header("Authorization", reader))
                .andExpect(jsonPath("$.items", hasSize(0)))
                .andExpect(jsonPath("$.total").value(0));
    }

    @Test
    void theWebPreviewFindsPlacesInTheBundledList() throws Exception {
        String maya = person("maya");
        mvc.perform(get("/v1/local/places").param("q", "hano").header("Authorization", maya))
                .andExpect(jsonPath("$[0].name").value("Hanoi, Vietnam"))
                .andExpect(jsonPath("$[0].lat").value(21.0278));
        // Without the accents, and anywhere in the name.
        mvc.perform(get("/v1/local/places").param("q", "goreme").header("Authorization", maya))
                .andExpect(jsonPath("$[0].name").value("Göreme, Turkey"));
        mvc.perform(get("/v1/local/places").param("q", "portugal").header("Authorization", maya))
                .andExpect(jsonPath("$", hasSize(4)));
        mvc.perform(get("/v1/local/places").param("q", "h").header("Authorization", maya))
                .andExpect(jsonPath("$", hasSize(0)));
        mvc.perform(get("/v1/local/places").param("q", "hanoi")).andExpect(status().isUnauthorized());
    }

    @Test
    void searchFindsAJourneyByThePlacesOfItsEntries() throws Exception {
        String maya = person("maya");
        String reader = person("reader");
        String asia = journey(maya, "Six weeks on a motorbike", "public", 9);
        entryAt(maya, asia, "Lanterns", 2, ",\"placeName\":\"Hoi An, Vietnam\",\"lat\":15.88,\"lng\":108.33");
        String secret = journey(maya, "Diary", "private", 9);
        entryAt(maya, secret, "Quiet day", 1, ",\"placeName\":\"Hoi An, Vietnam\"");
        journey(maya, "Learning the ukulele", "public", 3);

        // Neither the title nor the tags say Vietnam; the entry's place does. A private journey stays out.
        mvc.perform(get("/v1/search").param("q", "hoi an").header("Authorization", reader))
                .andExpect(jsonPath("$.journeys", hasSize(1)))
                .andExpect(jsonPath("$.journeys[0].title").value("Six weeks on a motorbike"));
        mvc.perform(get("/v1/search").param("q", "vietnam").header("Authorization", reader))
                .andExpect(jsonPath("$.journeys", hasSize(1)));
        mvc.perform(get("/v1/search").param("q", "bolivia").header("Authorization", reader))
                .andExpect(jsonPath("$.journeys", hasSize(0)));
    }
}
