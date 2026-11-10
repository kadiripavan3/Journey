package app.journey.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import org.junit.jupiter.api.Test;

/** What the database itself has to keep true as tables are added: indexes where deletes need them, and counts that match their rows. */
class DatabaseShapeTest extends ApiTest {

    /**
     * Deleting a row makes the database look in every table that points at it. Without an index on the
     * pointing column that look reads the whole table, once per deleted row. A new table with a
     * "references" column fails here until that column has an index (a partial one over the rows that have a
     * value is fine).
     */
    @Test
    void everyColumnThatPointsAtAnotherTableHasAnIndex() {
        List<String> missing = jdbc.sql("""
            select c.conrelid::regclass || ' (' || (
                     select string_agg(a.attname, ', ' order by k.ord)
                     from unnest(c.conkey) with ordinality k(attnum, ord)
                     join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) || ')'
            from pg_constraint c
            where c.contype = 'f' and c.connamespace = current_schema()::regnamespace
              and not exists (
                select 1 from pg_index i
                where i.indrelid = c.conrelid and i.indisvalid
                  and not exists (
                    select 1 from unnest(c.conkey) k(attnum)
                    where k.attnum <> all (array(
                      select i.indkey[s] from generate_series(0, cardinality(c.conkey) - 1) s)))
                  and (i.indpred is null
                       or pg_get_expr(i.indpred, i.indrelid) ~ '^\\(?[a-z_]+ IS NOT NULL\\)?$'))
            order by 1
            """).query(String.class).list();
        assertThat(missing)
                .as("columns that reference another table and have no index to find their rows by")
                .isEmpty();
    }

    @Test
    void aProfilesFollowerNumbersAreKeptByTheDatabaseWhateverHappens() throws Exception {
        String maya = person("maya");
        String nora = person("nora");
        String kai = person("kai");
        String ray = person("ray");
        for (String follower : new String[] {nora, kai, ray}) {
            mvc.perform(put("/v1/profiles/maya/follow").header("Authorization", follower))
                    .andExpect(status().isOk());
        }
        mvc.perform(put("/v1/profiles/nora/follow").header("Authorization", maya))
                .andExpect(status().isOk());
        mvc.perform(put("/v1/profiles/nora/follow").header("Authorization", maya))
                .andExpect(status().isOk()); // twice changes nothing
        mvc.perform(get("/v1/profiles/maya").header("Authorization", nora))
                .andExpect(jsonPath("$.followerCount").value(3))
                .andExpect(jsonPath("$.followingCount").value(1));
        countsMatchRows();

        // Unfollowing, blocking (which undoes follows both ways) and deleting an account all move the numbers.
        mvc.perform(delete("/v1/profiles/maya/follow").header("Authorization", kai))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.followerCount").value(2));
        mvc.perform(put("/v1/profiles/nora/block").header("Authorization", maya))
                .andExpect(status().isNoContent());
        mvc.perform(get("/v1/profiles/maya").header("Authorization", kai))
                .andExpect(jsonPath("$.followerCount").value(1))
                .andExpect(jsonPath("$.followingCount").value(0));
        countsMatchRows();
        mvc.perform(delete("/v1/me").header("Authorization", ray)).andExpect(status().isNoContent());
        mvc.perform(get("/v1/profiles/maya").header("Authorization", kai))
                .andExpect(jsonPath("$.followerCount").value(0));
        countsMatchRows();
        // Search orders people by the kept number.
        mvc.perform(put("/v1/profiles/kai/follow").header("Authorization", maya))
                .andExpect(status().isOk());
        mvc.perform(get("/v1/search").param("q", "a").header("Authorization", kai))
                .andExpect(status().isOk());
        mvc.perform(get("/v1/search").param("q", "ka").header("Authorization", maya))
                .andExpect(jsonPath("$.people[0].username").value("kai"));
        countsMatchRows();
    }

    @Test
    void aNewEntryChangesItsJourneysRowOnceAndLeavesRoomForIt() throws Exception {
        String maya = person("maya");
        String journey = journey(maya, "Southeast Asia", "public", 9);
        jdbc.sql("update journeys set updated_at = now() - interval '1 day'").update();
        java.sql.Timestamp before = jdbc.sql("select updated_at from journeys")
                .query(java.sql.Timestamp.class)
                .single();

        entry(maya, journey, "Hoi An", 0);

        // The count moved (the database did that); a journey that isn't paused has nothing to wake, so the
        // API didn't write the row a second time.
        assertThat(jdbc.sql("select entry_count from journeys")
                        .query(Integer.class)
                        .single())
                .isEqualTo(1);
        assertThat(jdbc.sql("select updated_at from journeys")
                        .query(java.sql.Timestamp.class)
                        .single())
                .isEqualTo(before);
        // Pages of the two tables whose rows change in place keep room for the changed row.
        assertThat(jdbc.sql(
                                "select relname || ' ' || array_to_string(reloptions, ',') from pg_class where relname in ('journeys', 'entries') and relnamespace = current_schema()::regnamespace order by relname")
                        .query(String.class)
                        .list())
                .containsExactly("entries fillfactor=90", "journeys fillfactor=85");
    }

    @Test
    void aReplyIsNeverListedBeforeTheCommentItAnswersWhoeverWroteItToTheDatabase() throws Exception {
        String maya = person("maya");
        String entry = entry(maya, journey(maya, "Southeast Asia", "public", 9), "Hoi An", 0);
        // Written straight to the table, as the sample data does, with the very same moment on both.
        jdbc.sql("""
            with first as (
              insert into comments (entry_id, author_id, body, created_at)
              select e.id, e.author_id, 'First', now() from entries e returning id, entry_id, author_id, created_at)
            insert into comments (entry_id, author_id, parent_id, body, created_at)
            select entry_id, author_id, id, 'Answer', created_at from first
            """).update();

        mvc.perform(get("/v1/entries/" + entry + "/comments").header("Authorization", maya))
                .andExpect(jsonPath("$.items[*].body", org.hamcrest.Matchers.contains("First", "Answer")));
        assertThat(jdbc.sql("select count(*) from comments c where c.thread_id <> coalesce(c.parent_id, c.id)")
                        .query(Integer.class)
                        .single())
                .isZero();
    }

    private void countsMatchRows() {
        assertThat(jdbc.sql("""
            select count(*) from profiles p
            where p.follower_count <> (select count(*) from profile_follows f where f.followee_id = p.id)
               or p.following_count <> (select count(*) from profile_follows f where f.follower_id = p.id)
            """).query(Integer.class).single())
                .as("profiles whose follower numbers differ from their rows")
                .isZero();
    }
}
