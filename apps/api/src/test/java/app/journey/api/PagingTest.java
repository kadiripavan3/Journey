package app.journey.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

/**
 * Lists that people scroll are read "after this row". A row that appears or disappears while someone is
 * between two pages must never show them an item twice or make them miss one. Each test reads the first
 * page, changes the list, and reads on.
 */
class PagingTest extends ApiTest {

    /** Something that changes a list while a reader is between its first and its second page. */
    private interface Change {
        void happen() throws Exception;
    }

    @Test
    void followersAndFollowingKeepTheirPlaceWhenSomeoneFollowsOrLeaves() throws Exception {
        String maya = person("maya");
        List<String> tokens = new ArrayList<>();
        for (String name : new String[] {"ana", "ben", "cleo", "dev", "eli"}) {
            String token = person(name);
            tokens.add(token);
            mvc.perform(put("/v1/profiles/maya/follow").header("Authorization", token))
                    .andExpect(status().isOk());
            mvc.perform(put("/v1/profiles/" + name + "/follow").header("Authorization", maya))
                    .andExpect(status().isOk());
        }
        String fay = person("fay");

        // A new follower arrives at the top, and one already shown leaves: the rest are read once each.
        assertThat(readAll("/v1/profiles/maya/followers", maya, "username", () -> {
                    mvc.perform(put("/v1/profiles/maya/follow").header("Authorization", fay))
                            .andExpect(status().isOk());
                    mvc.perform(delete("/v1/profiles/maya/follow").header("Authorization", tokens.get(4)))
                            .andExpect(status().isOk());
                }))
                .containsExactly("eli", "dev", "cleo", "ben", "ana");
        assertThat(readAll(
                        "/v1/profiles/maya/following",
                        maya,
                        "username",
                        () -> mvc.perform(put("/v1/profiles/fay/follow").header("Authorization", maya))
                                .andExpect(status().isOk())))
                .containsExactly("eli", "dev", "cleo", "ben", "ana");
        // Read again from the start, the lists are as they now are.
        assertThat(readAll("/v1/profiles/maya/followers", maya, "username", () -> {}))
                .containsExactly("fay", "dev", "cleo", "ben", "ana");
    }

    @Test
    void listsOfJourneysKeepTheirPlaceWhenAJourneyIsAdded() throws Exception {
        String maya = person("maya");
        String reader = person("reader");
        List<String> titles = new ArrayList<>();
        for (int i = 1; i <= 5; i++) {
            String journey = journey(maya, "Journey " + i, "public", 9);
            entry(maya, journey, "Start", 0);
            mvc.perform(put("/v1/journeys/" + journey + "/follow").header("Authorization", reader))
                    .andExpect(status().isOk());
            titles.add(0, "Journey " + i); // newest activity first
        }
        int[] added = {0};
        Change another = () -> {
            String journey = journey(maya, "One more " + ++added[0], "public", 9);
            entry(maya, journey, "Start", 0);
            mvc.perform(put("/v1/journeys/" + journey + "/follow").header("Authorization", reader))
                    .andExpect(status().isOk());
        };

        // Each time, a journey appears at the top after the first page was read: what follows is read once each.
        assertThat(readAll("/v1/me/journeys", maya, "title", another)).containsExactlyElementsOf(titles);
        assertThat(readAll("/v1/profiles/maya/journeys", reader, "title", another))
                .startsWith("One more 1")
                .endsWith(titles.toArray(String[]::new))
                .hasSize(6);
        assertThat(readAll("/v1/me/following", reader, "title", another))
                .startsWith("One more 2", "One more 1")
                .endsWith(titles.toArray(String[]::new))
                .hasSize(7);
    }

    @Test
    void homeKeepsItsPlaceWhenAnotherJourneyGetsNews() throws Exception {
        String maya = person("maya");
        String reader = person("reader");
        List<String> journeys = new ArrayList<>();
        for (int i = 1; i <= 6; i++) {
            String journey = journey(maya, "Journey " + i, "public", 9);
            journeys.add(journey);
            mvc.perform(put("/v1/journeys/" + journey + "/follow").header("Authorization", reader))
                    .andExpect(status().isOk());
        }
        for (int i = 0; i < 5; i++) {
            entry(maya, journeys.get(i), "News " + (i + 1), 0);
        }

        String first = mvc.perform(get("/v1/feed").param("limit", "2").header("Authorization", reader))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        List<String> seen = new ArrayList<>(JsonPath.<List<String>>read(first, "$.groups[*].journey.title"));
        entry(maya, journeys.get(5), "Late news", 0); // goes to the top of Home, above what was already read
        String cursor = JsonPath.read(first, "$.nextCursor");
        while (cursor != null) {
            String page = mvc.perform(get("/v1/feed")
                            .param("limit", "2")
                            .param("cursor", cursor)
                            .header("Authorization", reader))
                    .andExpect(status().isOk())
                    .andReturn()
                    .getResponse()
                    .getContentAsString();
            seen.addAll(JsonPath.<List<String>>read(page, "$.groups[*].journey.title"));
            cursor = JsonPath.read(page, "$.nextCursor");
        }
        assertThat(seen).containsExactly("Journey 5", "Journey 4", "Journey 3", "Journey 2", "Journey 1");
    }

    @Test
    void commentsKeepTheirPlaceWhenSomeoneAnswersOrWritesMeanwhile() throws Exception {
        String maya = person("maya");
        String nora = person("nora");
        String entry = entry(maya, journey(maya, "Southeast Asia", "public", 3), "Hoi An", 0);
        List<String> ids = new ArrayList<>();
        for (int i = 1; i <= 5; i++) {
            ids.add(comment(nora, entry, "Comment " + i, null));
        }

        // An answer to the first comment lands before the place the reader has reached; a new comment lands at the end.
        assertThat(readAll("/v1/entries/" + entry + "/comments", nora, "body", () -> {
                    comment(maya, entry, "Answer to 1", ids.get(0));
                    comment(maya, entry, "Comment 6", null);
                }))
                .containsExactly("Comment 1", "Comment 2", "Comment 3", "Comment 4", "Comment 5", "Comment 6");
        // From the start again, the answer sits under its comment.
        assertThat(readAll("/v1/entries/" + entry + "/comments", nora, "body", () -> {}))
                .startsWith("Comment 1", "Answer to 1", "Comment 2");
    }

    @Test
    void aStoryKeepsItsPlaceBothWaysWhenAnEntryIsAddedOrRemoved() throws Exception {
        String maya = person("maya");
        String journey = journey(maya, "Southeast Asia", "public", 20);
        List<String> ids = new ArrayList<>();
        for (int day = 10; day >= 6; day--) {
            ids.add(entry(maya, journey, "Day " + day + " ago", day));
        }
        String path = "/v1/journeys/" + journey + "/entries";

        // A back-dated entry lands at the very start, before the two entries already read.
        assertThat(readAll(path, maya, "title", () -> entry(maya, journey, "Earlier still", 12)))
                .containsExactly("Day 10 ago", "Day 9 ago", "Day 8 ago", "Day 7 ago", "Day 6 ago");

        // Opened in the middle. Before reading on, an entry before the page is deleted, one is added before it
        // and one after it.
        String middle = mvc.perform(get(path)
                        .param("limit", "2")
                        .param("around", ids.get(2))
                        .header("Authorization", maya))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].title", org.hamcrest.Matchers.contains("Day 9 ago", "Day 8 ago")))
                .andReturn()
                .getResponse()
                .getContentAsString();
        mvc.perform(delete("/v1/entries/" + ids.get(0)).header("Authorization", maya))
                .andExpect(status().isNoContent());
        entry(maya, journey, "Day 11 ago", 11);
        entry(maya, journey, "Today", 0);

        assertThat(readOn(path, maya, JsonPath.read(middle, "$.prevCursor"), "prevCursor"))
                .containsExactly("Earlier still", "Day 11 ago");
        assertThat(readOn(path, maya, JsonPath.read(middle, "$.nextCursor"), "nextCursor"))
                .containsExactly("Day 7 ago", "Day 6 ago", "Today");
        mvc.perform(get(path).header("Authorization", maya))
                .andExpect(jsonPath("$.total").value(7));
    }

    /** Reads on from a page of a story in one direction, two entries at a time, and returns the titles in story order. */
    private List<String> readOn(String path, String token, String cursor, String direction) throws Exception {
        List<String> titles = new ArrayList<>();
        while (cursor != null) {
            String page = mvc.perform(get(path)
                            .param("limit", "2")
                            .param("cursor", cursor)
                            .header("Authorization", token))
                    .andExpect(status().isOk())
                    .andReturn()
                    .getResponse()
                    .getContentAsString();
            List<String> items = JsonPath.read(page, "$.items[*].title");
            titles.addAll(direction.equals("prevCursor") ? 0 : titles.size(), items);
            cursor = JsonPath.read(page, "$." + direction);
        }
        return titles;
    }

    @Test
    void aCursorNobodyHandedOutIsRefusedPolitelyOnEveryList() throws Exception {
        String maya = person("maya");
        String journey = journey(maya, "Southeast Asia", "public", 3);
        String entry = entry(maya, journey, "Hoi An", 0);
        String fromAnotherList = JsonPath.read(
                mvc.perform(get("/v1/journeys/" + journey + "/entries")
                                .param("limit", "1")
                                .param("around", entry)
                                .header("Authorization", maya))
                        .andReturn()
                        .getResponse()
                        .getContentAsString(),
                "$.items[0].id"); // an id is not a cursor
        String oldStyle = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString("o20".getBytes());
        for (String path : new String[] {
            "/v1/me/journeys",
            "/v1/me/following",
            "/v1/profiles/maya/journeys",
            "/v1/profiles/maya/followers",
            "/v1/profiles/maya/following",
            "/v1/feed",
            "/v1/journeys/" + journey + "/entries",
            "/v1/entries/" + entry + "/comments"
        }) {
            for (String cursor : new String[] {"nonsense", fromAnotherList, oldStyle, "ay1ub3QtYS10aW1lfHg"}) {
                mvc.perform(get(path).param("cursor", cursor).header("Authorization", maya))
                        .andExpect(status().isBadRequest())
                        .andExpect(jsonPath("$.code").value("bad_cursor"))
                        .andExpect(jsonPath("$.detail").value("That list has changed. Pull to refresh."));
            }
        }
    }

    /** Reads a list two at a time from the start, lets the change happen after the first page, and returns one field of every item read. */
    private List<String> readAll(String path, String token, String field, Change afterFirstPage) throws Exception {
        List<String> seen = new ArrayList<>();
        String cursor = null;
        boolean first = true;
        do {
            var request = get(path).param("limit", "2").header("Authorization", token);
            String page = mvc.perform(cursor == null ? request : request.param("cursor", cursor))
                    .andExpect(status().isOk())
                    .andReturn()
                    .getResponse()
                    .getContentAsString();
            List<String> items = JsonPath.read(page, "$.items[*]." + field);
            assertThat(items.size()).isLessThanOrEqualTo(2);
            seen.addAll(items);
            cursor = JsonPath.read(page, "$.nextCursor");
            if (first) {
                afterFirstPage.happen();
                first = false;
            }
        } while (cursor != null);
        return seen;
    }

    private String comment(String token, String entry, String body, String parent) throws Exception {
        return JsonPath.read(
                mvc.perform(post("/v1/entries/" + entry + "/comments")
                                .header("Authorization", token)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        parent == null
                                                ? "{\"body\":\"%s\"}".formatted(body)
                                                : "{\"body\":\"%s\",\"parentId\":\"%s\"}".formatted(body, parent)))
                        .andExpect(status().isCreated())
                        .andReturn()
                        .getResponse()
                        .getContentAsString(),
                "$.id");
    }
}
