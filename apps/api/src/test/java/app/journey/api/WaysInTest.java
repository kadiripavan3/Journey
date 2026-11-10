package app.journey.api;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import app.journey.api.journey.Trending;
import com.jayway.jsonpath.JsonPath;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

/**
 * The ways into a long story and into everything else: the days of a story for "Jump to", photos on its
 * milestones, places in Search, a search inside someone's followers, and Discover narrowed to challenges.
 */
class WaysInTest extends ApiTest {

    @Autowired
    Trending trending;

    /**
     * Adds an entry that happened `daysAgo` days ago, with more fields ("," + JSON members). Returns its id.
     * The moment is worked out from today's date, so it is the same day whatever time the test runs: noon on an
     * earlier day, and half-way through what has passed of today (never in the future).
     */
    private String entryWith(String token, String journeyId, String title, int daysAgo, String more) throws Exception {
        Instant now = Instant.now();
        Instant today = now.truncatedTo(ChronoUnit.DAYS);
        Instant when = daysAgo == 0
                ? today.plusSeconds(ChronoUnit.SECONDS.between(today, now) / 2)
                : today.minus(daysAgo, ChronoUnit.DAYS).plusSeconds(12 * 3600 + title.length());
        String body = mvc.perform(post("/v1/journeys/" + journeyId + "/entries")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"%s\",\"happenedAt\":\"%s\"%s}".formatted(title, when, more)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return JsonPath.read(body, "$.id");
    }

    @Test
    void aStorysDaysComeNewestFirstWithTheirFirstEntryPlaceAndCountAPageAtATime() throws Exception {
        String maya = person("maya");
        String reader = person("reader");
        String stranger = person("stranger");
        String journey = journey(maya, "Southeast Asia by motorbike", "public", 9);
        String hanoi = entryWith(maya, journey, "Old quarter", 9, ",\"placeName\":\"Hanoi, Vietnam\"");
        String noPlace = entryWith(maya, journey, "A", 5, "");
        entryWith(maya, journey, "Lanterns at night", 5, ",\"placeName\":\"Hoi An, Vietnam\"");
        String bromo = entryWith(maya, journey, "Sunrise", 0, ",\"placeName\":\"Mount Bromo, Indonesia\"");

        String first = mvc.perform(
                        get("/v1/journeys/" + journey + "/days?limit=2").header("Authorization", reader))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.items[0].label").value("Day 10"))
                .andExpect(jsonPath("$.items[0].firstEntryId").value(bromo))
                .andExpect(jsonPath("$.items[0].place").value("Mount Bromo, Indonesia"))
                .andExpect(jsonPath("$.items[0].entryCount").value(1))
                // Two entries that day: the day opens at the first of them and is named after the first place.
                .andExpect(jsonPath("$.items[1].label").value("Day 5"))
                .andExpect(jsonPath("$.items[1].firstEntryId").value(noPlace))
                .andExpect(jsonPath("$.items[1].place").value("Hoi An, Vietnam"))
                .andExpect(jsonPath("$.items[1].entryCount").value(2))
                .andReturn()
                .getResponse()
                .getContentAsString();
        String next = JsonPath.read(first, "$.nextCursor");
        mvc.perform(get("/v1/journeys/" + journey + "/days?limit=2&cursor=" + next)
                        .header("Authorization", reader))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].label").value("Day 1"))
                .andExpect(jsonPath("$.items[0].firstEntryId").value(hanoi))
                .andExpect(jsonPath("$.nextCursor").value(nullValue()));
        mvc.perform(get("/v1/journeys/" + journey + "/days?cursor=nonsense").header("Authorization", reader))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("bad_cursor"));

        // A private journey's days are nobody else's to see.
        String diary = journey(maya, "Diary", "private", 2);
        entry(maya, diary, "Dear diary", 0);
        mvc.perform(get("/v1/journeys/" + diary + "/days").header("Authorization", stranger))
                .andExpect(status().isNotFound());
        mvc.perform(get("/v1/journeys/" + diary + "/days").header("Authorization", maya))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(1)));
    }

    @Test
    void aMilestoneCarriesASmallPictureWhenItsEntryHasAPhoto() throws Exception {
        String maya = person("maya");
        String journey = journey(maya, "Iceland ring road", "public", 4);
        String photo = uploadPhoto(maya);
        entryWith(maya, journey, "Skogafoss", 2, ",\"isMilestone\":true,\"mediaIds\":[\"%s\"]".formatted(photo));
        entryWith(maya, journey, "Halfway", 1, ",\"isMilestone\":true");

        mvc.perform(get("/v1/journeys/" + journey + "/summary").header("Authorization", maya))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.milestones", hasSize(2)))
                .andExpect(jsonPath("$.milestones[0].title").value("Skogafoss"))
                .andExpect(jsonPath("$.milestones[0].thumbUrl").isNotEmpty())
                .andExpect(jsonPath("$.milestones[1].thumbUrl").value(nullValue()));
    }

    @Test
    void searchNamesThePlacesThatMatchAndInHowManyJourneys() throws Exception {
        String maya = person("maya");
        String kai = person("kai");
        String reader = person("reader");
        String inca = journey(maya, "Four days on the Inca Trail", "public", 5);
        String budget = journey(kai, "South America on a budget", "public", 5);
        String secret = journey(kai, "A quiet week", "private", 5);
        entryWith(maya, inca, "Arrival", 4, ",\"placeName\":\"Cusco, Peru\"");
        entryWith(maya, inca, "Market", 3, ",\"placeName\":\"Cusco, Peru\"");
        entryWith(kai, budget, "Altitude", 2, ",\"placeName\":\"cusco, peru\"");
        entryWith(kai, budget, "Salt flats", 1, ",\"placeName\":\"Uyuni, Bolivia\"");
        entryWith(kai, secret, "Hidden", 1, ",\"placeName\":\"Cusco, Peru\"");

        mvc.perform(get("/v1/search?q=cusco").header("Authorization", reader))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.places", hasSize(1)))
                .andExpect(jsonPath("$.places[0].name").value("Cusco, Peru"))
                // Two journeys, however many entries, and never a private one.
                .andExpect(jsonPath("$.places[0].journeyCount").value(2))
                .andExpect(jsonPath("$.journeys", hasSize(2)));
        // Two letters are too few to look through every place.
        mvc.perform(get("/v1/search?q=cu").header("Authorization", reader))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.places", hasSize(0)));
        // Someone the reader blocked doesn't count towards a place.
        mvc.perform(put("/v1/profiles/kai/block").header("Authorization", reader))
                .andExpect(status().isNoContent());
        mvc.perform(get("/v1/search?q=cusco").header("Authorization", reader))
                .andExpect(jsonPath("$.places[0].journeyCount").value(1));
    }

    @Test
    void someonesFollowersCanBeSearchedByNameOrUsername() throws Exception {
        String nora = person("nora");
        for (String name : new String[] {"maya", "theo", "mayflower"}) {
            mvc.perform(put("/v1/profiles/nora/follow").header("Authorization", person(name)))
                    .andExpect(status().isOk());
        }
        mvc.perform(get("/v1/profiles/nora/followers").header("Authorization", nora))
                .andExpect(jsonPath("$.items", hasSize(3)));
        mvc.perform(get("/v1/profiles/nora/followers?q=MAY").header("Authorization", nora))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(2)));
        mvc.perform(get("/v1/profiles/nora/followers?q=@theo").header("Authorization", nora))
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].username").value("theo"));
        // The letters are matched as they are: a percent sign finds nobody rather than everybody.
        mvc.perform(get("/v1/profiles/nora/followers?q=%25").header("Authorization", nora))
                .andExpect(jsonPath("$.items", hasSize(0)));
        mvc.perform(put("/v1/profiles/maya/follow").header("Authorization", nora))
                .andExpect(status().isOk());
        mvc.perform(get("/v1/profiles/nora/following?q=ma").header("Authorization", nora))
                .andExpect(jsonPath("$.items", hasSize(1)));
    }

    @Test
    void discoverCanShowOnlyChallengesAndSaysHowManyThereAre() throws Exception {
        String maya = person("maya");
        String reader = person("reader");
        String trip = journey(maya, "Iceland ring road", "public", 9);
        String guitar = challenge(maya, "30 days of guitar");
        String done = challenge(maya, "30 days of sketching");
        for (String journey : new String[] {trip, guitar, done}) {
            for (int day = 3; day >= 1; day--) {
                entry(maya, journey, "Entry " + day, day);
            }
        }
        mvc.perform(post("/v1/journeys/" + done + "/complete")
                        .header("Authorization", maya)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk());

        // The numbers are counted by the hourly job, not when the page opens.
        trending.count();

        // Plain Discover has everything and counts nothing.
        mvc.perform(get("/v1/discover").header("Authorization", reader))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fresh", hasSize(2)))
                .andExpect(jsonPath("$.counts").value(nullValue()));
        mvc.perform(get("/v1/discover?challenges=true").header("Authorization", reader))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fresh", hasSize(1)))
                .andExpect(jsonPath("$.fresh[0].id").value(guitar))
                .andExpect(jsonPath("$.completed", hasSize(1)))
                .andExpect(jsonPath("$.completed[0].id").value(done))
                .andExpect(jsonPath("$.counts.inProgress").value(1))
                .andExpect(jsonPath("$.counts.finishedThisMonth").value(1));
        mvc.perform(get("/v1/discover?days=100").header("Authorization", reader))
                .andExpect(jsonPath("$.fresh", hasSize(0)))
                .andExpect(jsonPath("$.counts.inProgress").value(0));
        // A category's page counts too.
        mvc.perform(get("/v1/discover?category=travel").header("Authorization", reader))
                .andExpect(jsonPath("$.fresh", hasSize(1)))
                .andExpect(jsonPath("$.counts.inProgress").value(1))
                .andExpect(jsonPath("$.counts.finishedThisMonth").value(0));
    }

    private String challenge(String token, String title) throws Exception {
        String body = mvc.perform(post("/v1/journeys")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                                "{\"title\":\"%s\",\"template\":\"challenge30\",\"startDate\":\"%s\",\"visibility\":\"public\"}"
                                        .formatted(
                                                title,
                                                java.time.LocalDate.now(java.time.ZoneOffset.UTC)
                                                        .minusDays(9))))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return JsonPath.read(body, "$.id");
    }
}
