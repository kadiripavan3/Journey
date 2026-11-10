package app.journey.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

/**
 * Discover and search read the top of their lists through indexes, a piece at a time, and put the pieces
 * together afterwards. These tests hold that to the plain rule each list is meant to follow.
 */
class DiscoverAndSearchTest extends ApiTest {

    /**
     * Discover reads the best of the reader's categories and the best of the rest separately and merges them.
     * The answer must be exactly what sorting every journey by the leaning rule would give.
     */
    @Test
    void discoverGivesTheSameTopTwelveAsSortingEveryJourneyByTheRule() throws Exception {
        String maya = person("maya");
        String runner = person("runner");
        mvc.perform(
                        put("/v1/me/profile")
                                .header("Authorization", runner)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"displayName\":\"runner\",\"username\":\"runner\",\"interests\":[\"running\",\"music\"]}"))
                .andExpect(status().isOk());
        for (int i = 1; i <= 40; i++) {
            journey(maya, "Journey " + i, "public", 9);
        }
        // Forty journeys over five categories, with scores, ages and endings all over the place. Some scores tie.
        jdbc.sql("""
            update journeys j set
              category = (array['travel','fitness','learning','food','life'])[1 + n.n % 5],
              entry_count = case when n.n % 9 = 0 then 2 else 3 + n.n % 4 end,
              trending_score = (n.n * 37 % 11)::float8,
              follower_count = n.n * 13 % 7,
              last_entry_at = now() - make_interval(hours => n.n * 5 % 17),
              created_at = now() - make_interval(days => n.n * 7 % 23, mins => n.n),
              status = case when n.n % 6 = 0 then 'completed' else 'active' end,
              completed_at = case when n.n % 6 = 0 then now() - make_interval(days => n.n) end
            from (select id, (row_number() over (order by title))::int as n from journeys) n
            where n.id = j.id
            """).update();

        String leaning =
                "(case when j.category in ('fitness', 'learning') then %s else %s end)"; // what "running" and "music"
        // pick
        List<String> trending = ids("""
            select j.id::text from journeys j
            where j.entry_count >= 3 and (j.status <> 'completed' or j.completed_at > now() - interval '14 days')
            order by j.trending_score * %s desc, j.follower_count desc, j.last_entry_at desc nulls last, j.id limit 12
            """.formatted(leaning.formatted("1.5", "1")));
        List<String> fresh = ids("""
            select j.id::text from journeys j where j.entry_count >= 3 and j.status <> 'completed'
            order by j.created_at + %s desc, j.created_at desc, j.id limit 12
            """.formatted(leaning.formatted("interval '7 days'", "interval '0'")));
        List<String> completed = ids(
                "select j.id::text from journeys j where j.entry_count >= 3 and j.status = 'completed' order by j.completed_at desc, j.id limit 12");
        assertThat(trending).hasSize(12);
        assertThat(completed).isNotEmpty();

        String discover = mvc.perform(get("/v1/discover").header("Authorization", runner))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        assertThat(JsonPath.<List<String>>read(discover, "$.trending[*].id")).isEqualTo(trending);
        assertThat(JsonPath.<List<String>>read(discover, "$.fresh[*].id")).isEqualTo(fresh);
        assertThat(JsonPath.<List<String>>read(discover, "$.completed[*].id")).isEqualTo(completed);

        // One category only: the leaning has nothing to choose between, and nothing else shows.
        String fitness = mvc.perform(
                        get("/v1/discover").param("category", "fitness").header("Authorization", runner))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        assertThat(JsonPath.<List<String>>read(fitness, "$.trending[*].id")).isEqualTo(ids("""
                    select j.id::text from journeys j
                    where j.entry_count >= 3 and j.category = 'fitness'
                      and (j.status <> 'completed' or j.completed_at > now() - interval '14 days')
                    order by j.trending_score desc, j.follower_count desc, j.last_entry_at desc nulls last, j.id limit 12
                    """));
        assertThat(JsonPath.<List<String>>read(fitness, "$.fresh[*].category")).containsOnly("fitness");
        // Someone who picked nothing gets the plain order.
        String plain = mvc.perform(get("/v1/discover").header("Authorization", maya))
                .andReturn()
                .getResponse()
                .getContentAsString();
        assertThat(JsonPath.<List<String>>read(plain, "$.trending[*].id")).isEqualTo(ids("""
                    select j.id::text from journeys j
                    where j.entry_count >= 3 and (j.status <> 'completed' or j.completed_at > now() - interval '14 days')
                    order by j.trending_score desc, j.follower_count desc, j.last_entry_at desc nulls last, j.id limit 12
                    """));
    }

    @Test
    void searchFindsAJourneyEachWayItCanMatchAndRanksTheMostFollowedFirst() throws Exception {
        String maya = person("maya");
        String lea = person("lea");
        String reader = person("reader");
        String byTitle = journey(maya, "Six weeks on a motorbike", "public", 9);
        String byTag = tagged(lea, "Across the fjords", "#Road Trip", "Slow days");
        String byDescription = tagged(lea, "North", "norway", "A motorbike, a tent and too much rain");
        journey(lea, "Learning the ukulele", "public", 3);
        mvc.perform(put("/v1/journeys/" + byDescription + "/follow").header("Authorization", reader))
                .andExpect(status().isOk());

        // The title and a description both say "motorbike"; the one with a follower comes first.
        mvc.perform(get("/v1/search").param("q", "motorbike").header("Authorization", reader))
                .andExpect(jsonPath("$.journeys[*].id", org.hamcrest.Matchers.contains(byDescription, byTitle)));
        // A tag is found whole, the way it was saved, however it is typed. Part of a tag is not a match.
        for (String typed : new String[] {"#roadtrip", "Road Trip", "ROADTRIP"}) {
            mvc.perform(get("/v1/search").param("q", typed).header("Authorization", reader))
                    .andExpect(jsonPath("$.journeys[*].id", org.hamcrest.Matchers.contains(byTag)));
        }
        mvc.perform(get("/v1/search").param("q", "roadtr").header("Authorization", reader))
                .andExpect(jsonPath("$.journeys", hasSize(0)));
        // The creator's name finds their journeys; a journey is listed once however many ways it matches.
        mvc.perform(get("/v1/search").param("q", "lea").header("Authorization", reader))
                .andExpect(jsonPath("$.journeys", hasSize(3)))
                .andExpect(jsonPath("$.people[*].username", org.hamcrest.Matchers.contains("lea")));
        // Two letters are too few for an index: titles, names and tags are still looked at, long texts are not.
        mvc.perform(get("/v1/search").param("q", "uk").header("Authorization", reader))
                .andExpect(jsonPath("$.journeys[*].title", org.hamcrest.Matchers.contains("Learning the ukulele")));
        mvc.perform(get("/v1/search").param("q", "te").header("Authorization", reader))
                .andExpect(jsonPath("$.journeys", hasSize(0))); // only "a tent" in a description says "te"
        mvc.perform(get("/v1/search").param("q", "tent").header("Authorization", reader))
                .andExpect(jsonPath("$.journeys[*].id", org.hamcrest.Matchers.contains(byDescription)));
        // What the words mean to the database (%, _, \\) means nothing here.
        for (String odd : new String[] {"100%", "a_b", "back\\slash", "'; drop table journeys; --"}) {
            mvc.perform(get("/v1/search").param("q", odd).header("Authorization", reader))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.journeys", hasSize(0)));
        }
    }

    private List<String> ids(String sql) {
        return jdbc.sql(sql).query(String.class).list();
    }

    private String tagged(String token, String title, String tag, String description) throws Exception {
        return JsonPath.read(
                mvc.perform(post("/v1/journeys")
                                .header("Authorization", token)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"title\":\"%s\",\"description\":\"%s\",\"template\":\"trip\",\"startDate\":\"%s\",\"visibility\":\"public\",\"tags\":[\"%s\"]}"
                                                .formatted(
                                                        title,
                                                        description,
                                                        java.time.LocalDate.now(java.time.ZoneOffset.UTC),
                                                        tag)))
                        .andExpect(status().isCreated())
                        .andReturn()
                        .getResponse()
                        .getContentAsString(),
                "$.id");
    }
}
