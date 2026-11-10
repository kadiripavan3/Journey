package app.journey.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import app.journey.api.digest.DigestJob;
import app.journey.api.journey.AutoPause;
import app.journey.api.journey.Trending;
import app.journey.api.notify.EmailOutbox;
import app.journey.api.notify.EmailSender.Email;
import app.journey.api.notify.LoggingEmailSender;
import app.journey.api.notify.LoggingPushSender;
import app.journey.api.notify.PushDelivery;
import app.journey.api.notify.PushMessage;
import app.journey.api.notify.Reminders;
import com.jayway.jsonpath.JsonPath;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

/** The jobs that run by themselves: reminders, pausing quiet journeys, trending, and sending the weekly digest. */
class UpkeepTest extends ApiTest {

    @Autowired
    Reminders reminders;

    @Autowired
    AutoPause autoPause;

    @Autowired
    Trending trending;

    /** Six thirty on a Sunday evening, for people whose phone is on UTC (and for people with no phone on record). */
    static final Instant SUNDAY_EVENING = Instant.parse("2026-11-15T18:30:00Z");

    @Autowired
    DigestJob digest;

    @Autowired
    EmailOutbox emails;

    @Autowired
    PushDelivery delivery;

    @Autowired
    LoggingPushSender phone;

    @Autowired
    LoggingEmailSender inbox;

    @BeforeEach
    void nothingSentYet() {
        phone.clear();
        inbox.clear();
    }

    @Test
    void aChallengeIsNudgedOnceADayAtThePersonsOwnEveningAndOnlyIfTheyAskedForIt() throws Exception {
        String nora = person("nora");
        device(nora, "ExponentPushToken[nora]", "Asia/Tokyo");
        String challenge = challenge(nora, "30 days of guitar", 3);
        Instant tokyoEveningBefore = LocalDate.now(ZoneId.of("Asia/Tokyo"))
                .atTime(19, 5)
                .atZone(ZoneId.of("Asia/Tokyo"))
                .toInstant();
        // Reminders are off until someone asks for them.
        assertThat(reminders.remindAt(tokyoEveningBefore)).isZero();
        wantsReminders(nora);
        entry(nora, challenge, "First chord", 2);
        // Seven in the evening in Tokyo is ten in the morning in UTC.
        Instant tokyoEvening = LocalDate.now(ZoneId.of("Asia/Tokyo"))
                .atTime(19, 5)
                .atZone(ZoneId.of("Asia/Tokyo"))
                .toInstant();

        assertThat(reminders.remindAt(tokyoEvening.minusSeconds(2 * 3600))).isZero(); // five o'clock: not yet
        assertThat(reminders.remindAt(tokyoEvening)).isEqualTo(1);
        assertThat(reminders.remindAt(tokyoEvening)).isZero(); // never twice in a day

        delivery.deliverDue();
        assertThat(phone.sent()).hasSize(1);
        PushMessage nudge = phone.sent().get(0);
        assertThat(nudge.title()).isEqualTo("30 days of guitar");
        assertThat(nudge.body()).isEqualTo("Day 4 of 30 is waiting. A quick check-in keeps it going.");
        assertThat(nudge.url()).isEqualTo("/journey/" + challenge + "/add");
    }

    @Test
    void remindersLeaveAloneWhoeverCheckedInSwitchedThemOffOrPaused() throws Exception {
        String done = person("done");
        String off = person("off");
        String paused = person("paused");
        String later = person("later");
        for (String token : new String[] {done, off, paused, later}) {
            device(token, "ExponentPushToken[" + token.substring(token.length() - 6) + "]", "UTC");
            wantsReminders(token);
        }
        Instant evening = LocalDate.now(ZoneOffset.UTC).atTime(19, 0).toInstant(ZoneOffset.UTC);
        entry(done, challenge(done, "Checked in today", 3), "Today's check-in", 0);
        challenge(off, "Reminders off", 3);
        String settings = mvc.perform(get("/v1/me/settings").header("Authorization", off))
                .andReturn()
                .getResponse()
                .getContentAsString();
        mvc.perform(put("/v1/me/settings")
                        .header("Authorization", off)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(settings.replace("\"reminders\":true", "\"reminders\":false")))
                .andExpect(status().isOk());
        String quiet = challenge(paused, "Paused", 3);
        mvc.perform(patch("/v1/journeys/" + quiet)
                        .header("Authorization", paused)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"paused\"}"))
                .andExpect(status().isOk());
        // Someone who asked for their reminders at nine in the evening is not reminded at seven.
        challenge(later, "At nine", 3);
        mvc.perform(put("/v1/me/settings")
                        .header("Authorization", later)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(settings.replace("\"reminderHour\":19", "\"reminderHour\":21")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reminderHour").value(21));
        mvc.perform(put("/v1/me/settings")
                        .header("Authorization", later)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(settings.replace("\"reminderHour\":19", "\"reminderHour\":24")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("invalid_reminder_hour"));

        assertThat(reminders.remindAt(evening)).isZero();
        assertThat(reminders.remindAt(evening.plusSeconds(2 * 3600))).isEqualTo(1);
    }

    @Test
    void aJourneyWithoutADayCountIsNudgedAfterThreeQuietDaysAndThenLeftAlone() throws Exception {
        String nora = person("nora");
        device(nora, "ExponentPushToken[nora]", "UTC");
        wantsReminders(nora);
        String trip = journey(nora, "Iceland ring road", "public", 9);
        entry(nora, trip, "Reykjavik", 3);
        Instant evening = LocalDate.now(ZoneOffset.UTC).atTime(19, 0).toInstant(ZoneOffset.UTC);

        assertThat(reminders.remindAt(evening)).isEqualTo(1);
        delivery.deliverDue();
        assertThat(phone.sent().get(0).body())
                .isEqualTo("It's been 3 days since your last update. Add an entry when you're ready.");
        // The day after (four quiet days) there is nothing to say.
        jdbc.sql("delete from notifications").update();
        assertThat(reminders.remindAt(evening.plusSeconds(24 * 3600))).isZero();
    }

    @Test
    void aJourneyPausesByItselfAfterThirtyQuietDaysAndOneEntryBringsItBack() throws Exception {
        String nora = person("nora");
        String reader = person("reader");
        device(nora, "ExponentPushToken[nora]", "UTC");
        String quiet = journey(nora, "Building a tiny cabin", "public", 60);
        String lively = journey(nora, "Iceland ring road", "public", 60);
        entry(nora, quiet, "The roof is on. Mostly.", 40);
        entry(nora, lively, "Reykjavik", 1);
        jdbc.sql("update journeys set last_entry_at = now() - interval '31 days' where title = 'Building a tiny cabin'")
                .update();

        assertThat(autoPause.pauseQuietJourneys()).isEqualTo(1);
        assertThat(autoPause.pauseQuietJourneys()).isZero();

        mvc.perform(get("/v1/journeys/" + quiet).header("Authorization", reader))
                .andExpect(jsonPath("$.status").value("paused"))
                .andExpect(jsonPath("$.pausedAutomatically").value(true));
        mvc.perform(get("/v1/journeys/" + lively).header("Authorization", reader))
                .andExpect(jsonPath("$.status").value("active"))
                .andExpect(jsonPath("$.pausedAutomatically").value(false));
        // The owner hears about it, once, in kind words.
        delivery.deliverDue();
        assertThat(phone.sent()).hasSize(1);
        assertThat(phone.sent().get(0).title()).isEqualTo("Building a tiny cabin");
        assertThat(phone.sent().get(0).body()).startsWith("Paused after 30 quiet days.");
        assertThat(phone.sent().get(0).url()).isEqualTo("/journey/" + quiet);

        // An entry wakes it. Pausing it by hand later is not "by itself".
        entry(nora, quiet, "Gutters", 0);
        mvc.perform(get("/v1/journeys/" + quiet).header("Authorization", reader))
                .andExpect(jsonPath("$.status").value("active"))
                .andExpect(jsonPath("$.pausedAutomatically").value(false));
        mvc.perform(patch("/v1/journeys/" + quiet)
                        .header("Authorization", nora)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"paused\"}"))
                .andExpect(jsonPath("$.status").value("paused"))
                .andExpect(jsonPath("$.pausedAutomatically").value(false));
    }

    @Test
    void trendingFollowsWhatIsHappeningNowNotOnlyWhoIsBiggest() throws Exception {
        String maya = person("maya");
        String lea = person("lea");
        String nora = person("nora");
        String kai = person("kai");
        String big = journey(maya, "Big but quiet", "public", 60);
        String busy = journey(lea, "Small but busy", "public", 20);
        for (int day = 5; day >= 3; day--) {
            entry(maya, big, "Old " + day, day);
            entry(lea, busy, "New " + day, day);
        }
        // The big one got its entries long ago and has many followers; the small one is alive this week.
        jdbc.sql(
                        "update entries e set created_at = now() - interval '30 days' from journeys j where j.id = e.journey_id and j.title = 'Big but quiet'")
                .update();
        jdbc.sql("update journeys set follower_count = 500 where title = 'Big but quiet'")
                .update();
        mvc.perform(put("/v1/journeys/" + busy + "/follow").header("Authorization", nora))
                .andExpect(status().isOk());
        mvc.perform(put("/v1/journeys/" + busy + "/follow").header("Authorization", kai))
                .andExpect(status().isOk());

        // Before the job has run, the most followed lead.
        mvc.perform(get("/v1/discover").header("Authorization", nora))
                .andExpect(jsonPath("$.trending[0].title").value("Big but quiet"));
        assertThat(trending.rescore()).isEqualTo(2);
        mvc.perform(get("/v1/discover").header("Authorization", nora))
                .andExpect(jsonPath("$.trending[0].title").value("Small but busy"))
                .andExpect(jsonPath("$.trending[1].title").value("Big but quiet"));
        assertThat(trending.rescore()).isZero(); // nothing changed, nothing rewritten

        // A paused journey counts for half.
        mvc.perform(patch("/v1/journeys/" + busy)
                        .header("Authorization", lea)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"paused\"}"))
                .andExpect(status().isOk());
        double before = score("Small but busy");
        trending.rescore();
        assertThat(score("Small but busy")).isCloseTo(before / 2, org.assertj.core.data.Offset.offset(0.001));
    }

    @Test
    void discoverLeansTowardsTheInterestsAPersonPickedWithoutHidingTheRest() throws Exception {
        String maya = person("maya");
        String lea = person("lea");
        String anyone = person("anyone");
        String runner = person("runner");
        mvc.perform(put("/v1/me/profile")
                        .header("Authorization", runner)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"displayName\":\"runner\",\"username\":\"runner\",\"interests\":[\"running\"]}"))
                .andExpect(status().isOk());
        String trip = journey(maya, "Iceland ring road", "public", 9);
        String runs = challenge(lea, "30 days of running", 9);
        for (int day = 3; day >= 1; day--) {
            entry(maya, trip, "Stop " + day, day);
            entry(lea, runs, "Run " + day, day);
        }
        // The trip is a little ahead (one more follower), and it was started three days after the runs.
        mvc.perform(put("/v1/journeys/" + trip + "/follow").header("Authorization", anyone))
                .andExpect(status().isOk());
        jdbc.sql("update journeys set created_at = now() - interval '3 days' where title = '30 days of running'")
                .update();
        trending.rescore();

        mvc.perform(get("/v1/discover").header("Authorization", anyone))
                .andExpect(jsonPath("$.trending[0].title").value("Iceland ring road"))
                .andExpect(jsonPath("$.fresh[0].title").value("Iceland ring road"));
        // For someone who picked running, the runs count for half as much again and as a week newer.
        mvc.perform(get("/v1/discover").header("Authorization", runner))
                .andExpect(jsonPath("$.trending[0].title").value("30 days of running"))
                .andExpect(jsonPath("$.trending[1].title").value("Iceland ring road"))
                .andExpect(jsonPath("$.fresh[0].title").value("30 days of running"))
                .andExpect(jsonPath("$.fresh[1].title").value("Iceland ring road"));
        // It leans, it doesn't decide: a trip that is far ahead still leads.
        jdbc.sql("update journeys set trending_score = trending_score * 3 where title = 'Iceland ring road'")
                .update();
        mvc.perform(get("/v1/discover").header("Authorization", runner))
                .andExpect(jsonPath("$.trending[0].title").value("Iceland ring road"));
    }

    @Test
    void theWeeklyDigestGoesOutAsAPushAndAsAnEmailForThoseWhoAskedForOne() throws Exception {
        String maya = person("maya");
        String nora = person("nora");
        String kai = person("kai");
        device(nora, "ExponentPushToken[nora]", "UTC");
        device(kai, "ExponentPushToken[kai]", "UTC");
        String trip = journey(maya, "Southeast Asia by motorbike", "public", 20);
        mvc.perform(put("/v1/journeys/" + trip + "/follow").header("Authorization", nora))
                .andExpect(status().isOk());
        mvc.perform(put("/v1/journeys/" + trip + "/follow").header("Authorization", kai))
                .andExpect(status().isOk());
        String settings = mvc.perform(get("/v1/me/settings").header("Authorization", nora))
                .andReturn()
                .getResponse()
                .getContentAsString();
        mvc.perform(put("/v1/me/settings")
                        .header("Authorization", nora)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(settings.replace("\"digestEmail\":false", "\"digestEmail\":true")))
                .andExpect(status().isOk());
        entry(maya, trip, "Hoi An", 2);
        entry(maya, trip, "Mount Bromo", 0);
        jdbc.sql("delete from notifications").update(); // the pushes about the entries themselves are another test

        // It goes out on Sunday evening, once: asking again finds that everyone has had this week's.
        assertThat(digest.sendDue(SUNDAY_EVENING.minusSeconds(2 * 3600))).isZero(); // four o'clock: not yet
        assertThat(digest.sendDue(SUNDAY_EVENING)).isEqualTo(2);
        assertThat(digest.sendDue(SUNDAY_EVENING.plusSeconds(3600))).isZero();
        delivery.deliverDue();
        assertThat(emails.deliverDue()).isEqualTo(1);
        assertThat(emails.deliverDue()).isZero();

        assertThat(phone.sent()).hasSize(2);
        assertThat(phone.sent().get(0).title()).isEqualTo("This week in the journeys you follow");
        assertThat(phone.sent().get(0).body()).isEqualTo("2 new entries in a journey you follow.");
        assertThat(phone.sent().get(0).url()).isEqualTo("/digest");
        // Only Nora asked for the email. It is hers, and built from the same week as the page.
        assertThat(inbox.sent()).hasSize(1);
        Email email = inbox.sent().get(0);
        assertThat(email.to()).isEqualTo("nora@example.com");
        assertThat(email.subject()).isEqualTo("This week: 2 new entries in a journey you follow.");
        assertThat(email.html())
                .contains("Hi nora, here is your week")
                .contains("Southeast Asia by motorbike")
                .contains("Mount Bromo")
                .contains("/j/" + trip)
                .contains("2 new entries");
        assertThat(email.text()).contains("Southeast Asia by motorbike (2 new)").contains("Switch it off in the app");
        assertThat(email.sendOnceKey()).startsWith("digest-");
        mvc.perform(get("/v1/digest").header("Authorization", nora))
                .andExpect(jsonPath("$.entryCount").value(2));
    }

    @Test
    void theDigestEmailIsARealPageWithTitlesKeptSafe() throws Exception {
        String maya = person("maya");
        String nora = person("nora");
        String trip = journey(maya, "Tom & Jerry <script>", "public", 20);
        mvc.perform(put("/v1/journeys/" + trip + "/follow").header("Authorization", nora))
                .andExpect(status().isOk());
        String settings = mvc.perform(get("/v1/me/settings").header("Authorization", nora))
                .andReturn()
                .getResponse()
                .getContentAsString();
        mvc.perform(put("/v1/me/settings")
                        .header("Authorization", nora)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(settings.replace("\"digestEmail\":false", "\"digestEmail\":true")))
                .andExpect(status().isOk());
        entry(maya, trip, "Hoi An", 1);

        digest.sendDue(SUNDAY_EVENING);
        emails.deliverDue();

        assertThat(inbox.sent()).hasSize(1);
        org.hamcrest.MatcherAssert.assertThat(
                inbox.sent().get(0).html(), containsString("Tom &amp; Jerry &lt;script&gt;"));
        assertThat(inbox.sent().get(0).html()).startsWith("<!doctype html>").doesNotContain("<script>");
    }

    private void wantsReminders(String token) throws Exception {
        String settings = mvc.perform(get("/v1/me/settings").header("Authorization", token))
                .andReturn()
                .getResponse()
                .getContentAsString();
        assertThat(settings).contains("\"reminders\":false");
        mvc.perform(put("/v1/me/settings")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(settings.replace("\"reminders\":false", "\"reminders\":true")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reminders").value(true));
    }

    private void device(String token, String pushToken, String zone) throws Exception {
        mvc.perform(put("/v1/me/devices")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"%s\",\"platform\":\"android\",\"timeZone\":\"%s\"}"
                                .formatted(pushToken, zone)))
                .andExpect(status().isNoContent());
    }

    /** A 30-day challenge that started `daysAgo` days ago. Returns its id. */
    private String challenge(String token, String title, int daysAgo) throws Exception {
        String body = mvc.perform(post("/v1/journeys")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                                "{\"title\":\"%s\",\"template\":\"challenge30\",\"startDate\":\"%s\",\"visibility\":\"public\"}"
                                        .formatted(
                                                title,
                                                LocalDate.now(ZoneOffset.UTC).minusDays(daysAgo))))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return JsonPath.read(body, "$.id");
    }

    private double score(String title) {
        return jdbc.sql("select trending_score from journeys where title = :title")
                .param("title", title)
                .query(Double.class)
                .single();
    }
}
