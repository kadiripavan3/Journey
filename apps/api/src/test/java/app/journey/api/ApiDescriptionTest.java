package app.journey.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Rules that must hold for every route, read from the API's own description (openapi.json) instead of from a
 * list someone has to remember to extend. A route added tomorrow is covered the day it is added.
 */
class ApiDescriptionTest extends ApiTest {

    private static final JsonNode API = new JsonMapper().readTree(read());

    private static String read() {
        try {
            return Files.readString(Path.of("openapi.json"));
        } catch (java.io.IOException e) {
            throw new java.io.UncheckedIOException(e);
        }
    }

    /** Operations that create something and take no clientId, each with the reason that is good enough. */
    private static final Map<String, String> CREATES_WITHOUT_CLIENT_ID = Map.of(
            "POST /v1/reports",
            "a second report of the same thing by the same person is answered by the rule of one open report"
                    + " per person and thing, so sending it twice can't make two");

    @Test
    void everyListThatHandsOutACursorTakesACursorAndALimit() {
        List<String> wrong = new ArrayList<>();
        operations().forEach((name, operation) -> {
            JsonNode answer = schemaOf(operation.path("responses").path("200").path("content"));
            if (answer.path("properties").has("nextCursor")) {
                List<String> parameters = new ArrayList<>();
                operation
                        .path("parameters")
                        .forEach(p -> parameters.add(p.path("name").asString()));
                if (!parameters.contains("cursor") || !parameters.contains("limit")) {
                    wrong.add(name);
                }
            }
        });
        assertThat(wrong)
                .as("lists with a nextCursor but no cursor and limit to ask with")
                .isEmpty();
    }

    @Test
    void everythingThatCreatesTakesAClientIdSoSendingItTwiceMakesItOnce() {
        List<String> wrong = new ArrayList<>();
        operations().forEach((name, operation) -> {
            if (operation.path("responses").has("201")
                    && !schemaOf(operation.path("requestBody").path("content"))
                            .path("properties")
                            .has("clientId")
                    && !CREATES_WITHOUT_CLIENT_ID.containsKey(name)) {
                wrong.add(name);
            }
        });
        assertThat(wrong)
                .as("operations that answer 201 without a clientId (add one, or the reason it needs none)")
                .isEmpty();
        assertThat(operations().keySet())
                .as("the list of exceptions names only real operations")
                .containsAll(CREATES_WITHOUT_CLIENT_ID.keySet());
    }

    /**
     * Who may see what, asked of every route that reads a journey, an entry or a profile. A private journey
     * doesn't exist for a stranger, and nothing of a person exists for someone they have blocked or who has
     * blocked them: each route answers "not found" or with nothing in it.
     */
    @Test
    void everyRouteThatReadsAJourneyAnEntryOrAProfileHidesWhatTheReaderMayNotSee() throws Exception {
        String maya = person("maya");
        String stranger = person("stranger");
        String blockedByMaya = person("unwelcome");
        String blockedMaya = person("avoider");
        String open = journey(maya, "Open to all", "public", 5);
        String secret = journey(maya, "Diary", "private", 5);
        String openEntry = entry(maya, open, "Hoi An", 1);
        String secretEntry = entry(maya, secret, "Just for me", 1);
        for (String entry : new String[] {openEntry, secretEntry}) {
            mvc.perform(post("/v1/entries/" + entry + "/comments")
                            .header("Authorization", maya)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"body\":\"A note to self\"}"))
                    .andExpect(status().isCreated());
        }
        mvc.perform(put("/v1/profiles/maya/follow").header("Authorization", stranger))
                .andExpect(status().isOk());
        mvc.perform(put("/v1/profiles/unwelcome/block").header("Authorization", maya))
                .andExpect(status().isNoContent());
        mvc.perform(put("/v1/profiles/maya/block").header("Authorization", blockedMaya))
                .andExpect(status().isNoContent());

        List<String> leaks = new ArrayList<>();
        int checked = 0;
        for (Map.Entry<String, JsonNode> operation : operations().entrySet()) {
            String[] name = operation.getKey().split(" ");
            String template = name[1];
            boolean aboutJourney = template.startsWith("/v1/journeys/{");
            boolean aboutEntry = template.startsWith("/v1/entries/{");
            boolean aboutProfile = template.startsWith("/v1/profiles/{");
            if (!name[0].equals("GET") || !(aboutJourney || aboutEntry || aboutProfile)) {
                continue;
            }
            checked++;
            String shown = fill(template, aboutJourney ? open : aboutEntry ? openEntry : "maya");
            String hidden = fill(template, aboutJourney ? secret : aboutEntry ? secretEntry : "maya");
            // The route is filled in correctly: the owner, and a stranger where it is public, get an answer.
            assertThat(ask(shown, maya).getStatus())
                    .as("GET " + shown + " as its owner")
                    .isEqualTo(200);
            if (!template.endsWith("/invitable")) { // the one read that is the owner's alone
                assertThat(ask(shown, stranger).getStatus())
                        .as("GET " + shown + " as anyone")
                        .isEqualTo(200);
            }
            if (!aboutProfile && shows(ask(hidden, stranger))) {
                leaks.add("a stranger reads a private journey through GET " + template);
            }
            if (shows(ask(shown, blockedByMaya)) && !aboutProfile) {
                leaks.add("someone the owner blocked reads GET " + template);
            }
            // The one place blocking is one-sided on purpose: you can still open the profile of someone you
            // blocked, to unblock them. Everything else of theirs is gone for you too.
            boolean theProfileItself = template.equals("/v1/profiles/{username}");
            if (shows(ask(shown, blockedMaya)) && !theProfileItself) {
                leaks.add("someone who blocked the owner still reads GET " + template);
            }
            if (aboutProfile && ask(shown, blockedByMaya).getStatus() != 404) {
                leaks.add("someone the person blocked reads GET " + template);
            }
        }
        assertThat(leaks).isEmpty();
        assertThat(checked).as("routes about a journey, an entry or a profile").isGreaterThan(10);
    }

    /** True when the answer gives something away: it isn't "not found", and it isn't an empty list either. */
    private static boolean shows(MockHttpServletResponse answer) throws Exception {
        if (answer.getStatus() == 404) {
            return false;
        }
        JsonNode body = new JsonMapper().readTree(answer.getContentAsString());
        JsonNode items = body.isArray() ? body : body.path("items");
        return !(answer.getStatus() == 200 && items.isArray() && items.isEmpty());
    }

    private MockHttpServletResponse ask(String path, String token) throws Exception {
        return mvc.perform(get(path).header("Authorization", token)).andReturn().getResponse();
    }

    /** Puts the id (or username) the route is about into its first placeholder. A route with more is new to this test. */
    private static String fill(String template, String value) {
        String path = template.replaceFirst("\\{[A-Za-z]+}", value);
        assertThat(path)
                .as("this test doesn't know what to put into the second placeholder of " + template)
                .doesNotContain("{");
        return path;
    }

    /** Every operation of the API, by "METHOD /path". */
    private static Map<String, JsonNode> operations() {
        Map<String, JsonNode> all = new TreeMap<>();
        API.path("paths")
                .properties()
                .forEach(path -> path.getValue()
                        .properties()
                        .forEach(method -> all.put(
                                method.getKey().toUpperCase(java.util.Locale.ROOT) + " " + path.getKey(),
                                method.getValue())));
        return all;
    }

    /** The schema behind a request or an answer, whatever content type it is listed under. */
    private static JsonNode schemaOf(JsonNode content) {
        for (Map.Entry<String, JsonNode> byType : content.properties()) {
            JsonNode ref = byType.getValue().path("schema").path("$ref");
            if (ref.isString()) {
                String name = ref.asString();
                return API.path("components").path("schemas").path(name.substring(name.lastIndexOf('/') + 1));
            }
        }
        return content.path("no schema");
    }
}
