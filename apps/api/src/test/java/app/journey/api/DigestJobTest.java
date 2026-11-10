package app.journey.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import app.journey.api.digest.DigestJob;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

/** The weekly digest goes out on each person's own Sunday evening, once, and a run cut short is simply continued. */
class DigestJobTest extends ApiTest {

    /** Sunday 15 November 2026, 09:30 UTC: half past six in the evening in Tokyo, half past four at night in New York. */
    static final Instant TOKYO_EVENING = Instant.parse("2026-11-15T09:30:00Z");

    @Autowired
    DigestJob digest;

    @Test
    void itArrivesOnEachPersonsOwnSundayEvening() throws Exception {
        String maya = person("maya");
        String tokyo = person("tokyo");
        String berlin = person("berlin");
        String newYork = person("newyork");
        device(tokyo, "ExponentPushToken[tokyo]", "Asia/Tokyo");
        device(berlin, "ExponentPushToken[berlin]", "Europe/Berlin");
        device(newYork, "ExponentPushToken[ny]", "America/New_York");
        String trip = journey(maya, "Southeast Asia", "public", 20);
        for (String reader : new String[] {tokyo, berlin, newYork}) {
            mvc.perform(put("/v1/journeys/" + trip + "/follow").header("Authorization", reader))
                    .andExpect(status().isOk());
        }
        entry(maya, trip, "Hoi An", 1);

        assertThat(digest.sendDue(TOKYO_EVENING)).isEqualTo(1);
        assertThat(told()).containsExactly("tokyo");
        // Eight hours later it is evening in Berlin; another six, in New York.
        assertThat(digest.sendDue(TOKYO_EVENING.plus(Duration.ofHours(8)))).isEqualTo(1);
        assertThat(digest.sendDue(TOKYO_EVENING.plus(Duration.ofHours(14)))).isEqualTo(1);
        assertThat(told()).containsExactlyInAnyOrder("tokyo", "berlin", "newyork");
        // Nobody gets it twice, however often the job runs that week.
        assertThat(digest.sendDue(TOKYO_EVENING.plus(Duration.ofHours(15)))).isZero();
        assertThat(count("select count(*) from notifications where kind = 'weekly_digest'"))
                .isEqualTo(3);
        // The next Sunday is another week.
        entry(maya, trip, "Hue", 0);
        assertThat(digest.sendDue(TOKYO_EVENING.plus(Duration.ofDays(7)))).isEqualTo(1);
    }

    @Test
    void aRunThatWasCutShortIsContinuedAndAnHourThatWasMissedIsCaughtUp() throws Exception {
        String maya = person("maya");
        String nora = person("nora");
        String kai = person("kai");
        String trip = journey(maya, "Southeast Asia", "public", 20);
        for (String reader : new String[] {nora, kai}) {
            mvc.perform(put("/v1/journeys/" + trip + "/follow").header("Authorization", reader))
                    .andExpect(status().isOk());
        }
        entry(maya, trip, "Hoi An", 1);
        Instant sundayEvening = Instant.parse("2026-11-15T18:05:00Z");
        // The API was stopped (a deploy) after Nora's digest was written and before Kai's.
        jdbc.sql("""
                insert into digest_sent (user_id, week) select id, '2026-W46' from profiles where username = 'nora'
                """).update();

        // The API was down for the rest of the evening. On Monday morning the run is continued: only Kai is left.
        assertThat(digest.sendDue(sundayEvening.plus(Duration.ofHours(14)))).isEqualTo(1);
        assertThat(count("select count(*) from digest_sent where week = '2026-W46'"))
                .isEqualTo(3); // Nora, Kai, and Maya (who had nothing new, and is not asked again)
        // By Monday afternoon the week's digest is no longer sent to anyone.
        jdbc.sql("delete from digest_sent").update();
        assertThat(digest.sendDue(sundayEvening.plus(Duration.ofHours(20)))).isZero();
    }

    private java.util.List<String> told() {
        return jdbc.sql(
                        "select p.username from notifications n join profiles p on p.id = n.user_id where n.kind = 'weekly_digest'")
                .query(String.class)
                .list();
    }

    private int count(String sql) {
        return jdbc.sql(sql).query(Integer.class).single();
    }

    private void device(String token, String pushToken, String zone) throws Exception {
        mvc.perform(put("/v1/me/devices")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"%s\",\"platform\":\"ios\",\"timeZone\":\"%s\"}"
                                .formatted(pushToken, zone)))
                .andExpect(status().isNoContent());
    }
}
