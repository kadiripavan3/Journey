package app.journey.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import app.journey.api.SqlRecorder.Sent;
import com.jayway.jsonpath.JsonPath;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.env.Environment;
import org.springframework.http.MediaType;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * What the screens people open most cost the database. Two things are held here, so a change that makes a
 * screen slower with size fails a test instead of being found out later:
 *
 * <ul>
 *   <li>a screen sends the same number of statements whether it shows one journey or twenty (no statement
 *       per row);
 *   <li>none of those statements has to read all of journeys, entries, comments or profiles: for each, the
 *       database has an index to go by. The plans are looked at with a few thousand people and journeys
 *       in the tables: with a handful of rows the database reads a whole table because that really is
 *       quickest, and a plan would say nothing about how it does with many.
 * </ul>
 */
class QueryCostTest extends ApiTest {

    private static final Set<String> BIG_TABLES = Set.of("journeys", "entries", "comments", "profiles");

    @Autowired
    SqlRecorder recorder;

    @Autowired
    Environment settings;

    @Test
    void aScreenCostsTheSameNumberOfStatementsForOneJourneyAndForTwenty() throws Exception {
        String maya = person("maya");
        String reader = person("reader");
        String first = followedJourney(maya, reader, "Journey 1", 3);

        Map<String, Integer> small = costs(first, reader);
        for (int i = 2; i <= 20; i++) {
            followedJourney(maya, reader, "Journey " + i, 3);
        }
        for (int i = 4; i <= 20; i++) {
            entry(maya, first, "Entry " + i, 0);
        }
        Map<String, Integer> large = costs(first, reader);

        assertThat(large).isEqualTo(small);
        // And they are small numbers: a handful of statements a screen, not dozens.
        assertThat(small.values()).allMatch(statements -> statements <= 13);
    }

    @Test
    void theScreensPeopleOpenMostNeverReadAWholeTable() throws Exception {
        String maya = person("maya");
        String reader = person("reader");
        String journey = followedJourney(maya, reader, "Southeast Asia", 3);
        String entry = entry(maya, journey, "Hoi An", 0);
        mvc.perform(post("/v1/entries/" + entry + "/comments")
                        .header("Authorization", reader)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"Lovely\"}"))
                .andExpect(status().isCreated());
        mvc.perform(put("/v1/entries/" + entry + "/like").header("Authorization", reader))
                .andExpect(status().isOk());
        mvc.perform(put("/v1/profiles/maya/follow").header("Authorization", reader))
                .andExpect(status().isOk());
        String page = mvc.perform(
                        get("/v1/journeys/" + journey + "/entries?limit=2").header("Authorization", reader))
                .andReturn()
                .getResponse()
                .getContentAsString();

        aCrowd();

        Map<String, Sent> statements = new LinkedHashMap<>(); // each different statement once
        for (String token : new String[] {reader, maya}) {
            for (String path : List.of(
                    "/v1/feed",
                    "/v1/activity",
                    "/v1/activity/unseen",
                    "/v1/discover",
                    "/v1/discover?category=travel",
                    "/v1/me/journeys",
                    "/v1/me/following",
                    "/v1/digest",
                    "/v1/journeys/" + journey,
                    "/v1/journeys/" + journey + "/summary",
                    "/v1/journeys/" + journey + "/entries",
                    "/v1/journeys/" + journey + "/entries?around=" + entry,
                    "/v1/journeys/" + journey + "/entries?limit=2&cursor="
                            + JsonPath.<String>read(page, "$.nextCursor"),
                    "/v1/journeys/" + journey + "/map",
                    "/v1/journeys/" + journey + "/recap",
                    "/v1/entries/" + entry,
                    "/v1/entries/" + entry + "/comments",
                    "/v1/profiles/maya",
                    "/v1/profiles/maya/journeys",
                    "/v1/profiles/maya/followers",
                    "/v1/profiles/reader/following")) {
                // Search is left out on purpose: with a few thousand rows the database rightly reads a table
                // rather than a word index, and what bounds a search is written into it (JourneyStore.search).
                statementsOf(path, token).forEach(sent -> statements.putIfAbsent(sent.sql(), sent));
            }
        }
        assertThat(statements).hasSizeGreaterThan(30);

        List<String> wholeTableReads = new ArrayList<>();
        try (Connection plans = planner()) {
            for (Sent sent : statements.values()) {
                if (sent.sql().stripLeading().toLowerCase(java.util.Locale.ROOT).matches("(?s)^(select|with)\\b.*")) {
                    tablesReadWhole(plans, sent.filledIn()).stream()
                            .filter(BIG_TABLES::contains)
                            .forEach(table -> wholeTableReads.add(
                                    table + " <- " + sent.sql().replaceAll("\\s+", " ")));
                }
            }
        }
        assertThat(wholeTableReads)
                .as("statements that can only be answered by reading a whole table")
                .isEmpty();
    }

    /** A public journey with entries that the reader followed before they were written, so they are news to them. */
    private String followedJourney(String owner, String reader, String title, int entries) throws Exception {
        String journey = journey(owner, title, "public", 9);
        mvc.perform(put("/v1/journeys/" + journey + "/follow").header("Authorization", reader))
                .andExpect(status().isOk());
        for (int i = 1; i <= entries; i++) {
            entry(owner, journey, "Entry " + i, 0);
        }
        return journey;
    }

    /**
     * Enough other people, journeys, entries and comments that the database plans the way it will with real
     * data: with a handful of rows it reads a whole table because that really is quickest, and the test would
     * say nothing. The rows are written straight to the tables, and the database is told to count them.
     */
    private void aCrowd() {
        jdbc.sql("alter table entries disable trigger user").update();
        try {
            jdbc.sql("""
                insert into profiles (id, username, display_name)
                select gen_random_uuid(), 'crowd' || g, 'Crowd ' || g from generate_series(1, 2000) g
                """).update();
            jdbc.sql("""
                insert into journeys (owner_id, title, category, template, label_style, visibility, start_date, entry_count, last_entry_at)
                select p.id, 'Crowd journey ' || g, 'travel', 'trip', 'day', 'public', current_date - 30, 10, now()
                from generate_series(1, 2) g, profiles p where p.username like 'crowd%'
                """).update();
            jdbc.sql("""
                insert into journey_follows (user_id, journey_id, author, auto)
                select j.owner_id, j.id, true, true from journeys j where j.title like 'Crowd journey%'
                """).update();
            jdbc.sql("""
                insert into entries (journey_id, author_id, happened_at, happened_on, title)
                select j.id, j.owner_id, now() - make_interval(days => g), current_date - g, 'Crowd entry ' || g
                from generate_series(1, 10) g, journeys j where j.title like 'Crowd journey%'
                """).update();
            jdbc.sql("""
                insert into comments (entry_id, author_id, body)
                select e.id, e.author_id, 'Crowd comment' from entries e where e.title = 'Crowd entry 1'
                """).update();
            jdbc.sql("""
                insert into comments (entry_id, author_id, parent_id, body)
                select c.entry_id, c.author_id, c.id, 'Crowd answer' from comments c where c.body = 'Crowd comment'
                """).update();
            jdbc.sql("""
                insert into profile_follows (follower_id, followee_id)
                select a.id, b.id from profiles a join profiles b on b.username = 'crowd' || (substr(a.username, 6)::int % 2000 + 1)
                where a.username like 'crowd%' and a.id <> b.id
                """).update();
        } finally {
            jdbc.sql("alter table entries enable trigger user").update();
        }
        for (String table : List.of(
                "profiles",
                "journeys",
                "entries",
                "comments",
                "journey_follows",
                "profile_follows",
                "entry_media",
                "media")) {
            jdbc.sql("analyze " + table).update();
        }
    }

    /** How many statements each of the main screens sends for this reader. */
    private Map<String, Integer> costs(String journey, String reader) throws Exception {
        Map<String, Integer> costs = new LinkedHashMap<>();
        for (String path : List.of(
                "/v1/feed",
                "/v1/activity",
                "/v1/activity/unseen",
                "/v1/discover",
                "/v1/me/following",
                "/v1/journeys/" + journey,
                "/v1/journeys/" + journey + "/summary",
                "/v1/journeys/" + journey + "/entries",
                "/v1/journeys/" + journey + "/map")) {
            costs.put(path, statementsOf(path, reader).size());
        }
        return costs;
    }

    /** The SQL statements one request sends. */
    private List<Sent> statementsOf(String path, String token) throws Exception {
        recorder.start();
        try {
            mvc.perform(get(path).header("Authorization", token)).andExpect(status().isOk());
        } finally {
            List<Sent> sent = recorder.stop();
            if (!sent.isEmpty()) {
                return sent;
            }
        }
        throw new AssertionError("GET " + path + " sent no statement at all: is the recorder in place?");
    }

    /** The tables this statement reads whole, by the plan the database makes for it with these very values. */
    private List<String> tablesReadWhole(Connection plans, String sql) {
        try (Statement statement = plans.createStatement();
                ResultSet plan = statement.executeQuery("explain (format json) " + sql)) {
            plan.next();
            List<String> tables = new ArrayList<>();
            collect(new JsonMapper().readTree(plan.getString(1)), tables);
            return tables;
        } catch (java.sql.SQLException failed) {
            throw new AssertionError("No plan (" + failed.getMessage() + ") for: " + sql, failed);
        }
    }

    /** A connection of the test's own for asking about plans, set up like the API's. */
    private Connection planner() throws java.sql.SQLException {
        String url = settings.getRequiredProperty("spring.datasource.url");
        Connection connection = DriverManager.getConnection(
                url + (url.contains("?") ? "&" : "?") + "preferQueryMode=simple",
                settings.getRequiredProperty("spring.datasource.username"),
                settings.getRequiredProperty("spring.datasource.password"));
        try (Statement statement = connection.createStatement()) {
            statement.execute("set jit = off");
        }
        return connection;
    }

    /**
     * Notes every big table a plan reads whole: from end to end, or through an index it has nothing to look up
     * in (which is the same amount of reading). Discover's lists are the exception on purpose: they walk
     * their index from the top and stop after a dozen rows.
     */
    private static void collect(JsonNode node, List<String> tables) {
        if (node.isObject()) {
            String kind = node.path("Node Type").asString("");
            String table = node.path("Relation Name").asString("");
            String index = node.path("Index Name").asString("");
            boolean wholeIndex = kind.contains("Index") && !node.has("Index Cond") && !READ_IN_ORDER.contains(index);
            if (kind.equals("Seq Scan") || wholeIndex) {
                tables.add(table.isEmpty() ? tableOf(index) : table);
            }
            node.properties().forEach(child -> collect(child.getValue(), tables));
        } else if (node.isArray()) {
            node.forEach(child -> collect(child, tables));
        }
    }

    /** Indexes that hold a list in the order it is shown, read from the top until the page is full. */
    private static final Set<String> READ_IN_ORDER =
            Set.of("journeys_trending", "journeys_newest", "journeys_completed");

    /** The table an index belongs to, as far as its name says (the indexes here are named after their table). */
    private static String tableOf(String index) {
        return BIG_TABLES.stream().filter(index::startsWith).findFirst().orElse(index);
    }
}
