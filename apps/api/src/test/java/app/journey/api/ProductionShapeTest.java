package app.journey.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/**
 * The database the way it is in production: the API's tables in a schema of their own (on Supabase,
 * everything in "public" is served to anyone with the project's public key), named in one setting. Every
 * migration is run into an empty schema, and the API then works in it: sign-up, a journey, an entry, search.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles({"local", "test"})
class ProductionShapeTest {

    private static final String SCHEMA = "journey_shape";

    @DynamicPropertySource
    static void aSchemaOfItsOwn(DynamicPropertyRegistry settings) throws Exception {
        String url =
                System.getenv().getOrDefault("JOURNEY_TEST_DB_URL", "jdbc:postgresql://localhost:5432/journey_test");
        try (Connection db = DriverManager.getConnection(url, "journey", "journey");
                Statement sql = db.createStatement()) {
            sql.execute("drop schema if exists " + SCHEMA + " cascade"); // every run starts from nothing
        }
        // Exactly what JOURNEY_DB_SCHEMA=journey_shape does to the settings in application.properties.
        settings.add("spring.flyway.default-schema", () -> SCHEMA);
        settings.add("spring.flyway.schemas", () -> SCHEMA);
        settings.add(
                "spring.datasource.hikari.connection-init-sql",
                () -> "set search_path to \"" + SCHEMA + "\", extensions, public");
    }

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcClient jdbc;

    @Test
    void everyMigrationRunsIntoASchemaOfItsOwnAndTheApiWorksThere() throws Exception {
        // All of the API's tables are in its own schema, and none of them leaked into "public" on the way.
        assertThat(jdbc.sql("select count(*) from information_schema.tables where table_schema = :schema")
                        .param("schema", SCHEMA)
                        .query(Integer.class)
                        .single())
                .isGreaterThan(25);
        assertThat(jdbc.sql("select current_schema()").query(String.class).single())
                .isEqualTo(SCHEMA);

        String token = "Bearer "
                + JsonPath.<String>read(
                        mvc.perform(post("/local-auth/token")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"email\":\"shape@example.com\",\"code\":\"123456\"}"))
                                .andExpect(status().isOk())
                                .andReturn()
                                .getResponse()
                                .getContentAsString(),
                        "$.accessToken");
        mvc.perform(put("/v1/me/profile")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ageConfirmed\":true,\"displayName\":\"Shape\",\"username\":\"shape\"}"))
                .andExpect(status().isOk());
        String journey = JsonPath.read(
                mvc.perform(post("/v1/journeys")
                                .header("Authorization", token)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"title\":\"Iceland ring road\",\"template\":\"trip\",\"startDate\":\"%s\",\"visibility\":\"public\"}"
                                                .formatted(java.time.LocalDate.now(java.time.ZoneOffset.UTC))))
                        .andExpect(status().isCreated())
                        .andReturn()
                        .getResponse()
                        .getContentAsString(),
                "$.id");
        mvc.perform(post("/v1/journeys/" + journey + "/entries")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Skogafoss\"}"))
                .andExpect(status().isCreated());
        // The counters (triggers) and the search (the pg_trgm extension) work from inside the schema.
        mvc.perform(get("/v1/journeys/" + journey).header("Authorization", token))
                .andExpect(jsonPath("$.entryCount").value(1));
        mvc.perform(get("/v1/search").param("q", "icelan").header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.journeys[0].title").value("Iceland ring road"));
        assertThat(jdbc.sql("select count(*) from " + SCHEMA + ".journeys")
                        .query(Integer.class)
                        .single())
                .isEqualTo(1);
    }
}
