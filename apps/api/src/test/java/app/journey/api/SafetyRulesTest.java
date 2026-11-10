package app.journey.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import app.journey.api.notify.LoggingPushSender;
import app.journey.api.notify.PushDelivery;
import app.journey.api.notify.PushMessage;
import com.jayway.jsonpath.JsonPath;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

/**
 * Rules that keep people safe from each other, each of which once had a hole: blocking back, reporting,
 * what a friend who left a shared journey may still do, which phones count, and what a push may say.
 */
class SafetyRulesTest extends ApiTest {

    @Autowired
    PushDelivery delivery;

    @Autowired
    LoggingPushSender phone;

    @BeforeEach
    void noOldPushes() {
        phone.clear();
    }

    @Test
    void someoneWhoBlockedYouCanBeBlockedBackAndWhatTheyWroteUnderYourEntriesGoes() throws Exception {
        String vera = person("vera");
        String xan = person("xan");
        String entry = entry(vera, journey(vera, "Iceland ring road", "public", 4), "Skogafoss", 0);
        comment(xan, entry, "What a boring trip");
        mvc.perform(put("/v1/profiles/vera/block").header("Authorization", xan)).andExpect(status().isNoContent());

        // Xan has blocked Vera. Vera can still block Xan, by name, and that takes Xan's comment off her journey.
        mvc.perform(put("/v1/profiles/xan/block").header("Authorization", vera)).andExpect(status().isNoContent());

        assertThat(jdbc.sql("select count(*) from comments")
                        .query(Integer.class)
                        .single())
                .isZero();
        mvc.perform(get("/v1/entries/" + entry).header("Authorization", vera))
                .andExpect(jsonPath("$.commentCount").value(0));
        mvc.perform(get("/v1/me/blocks").header("Authorization", vera))
                .andExpect(jsonPath("$.items[0].username").value("xan"));
        // A name nobody has is still "we couldn't find that person".
        mvc.perform(put("/v1/profiles/nobody/block").header("Authorization", vera))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("profile_not_found"));
    }

    @Test
    void onlyWhatYouCanSeeCanBeReportedOnceAndNotByTheHundred() throws Exception {
        String maya = person("maya");
        String nora = person("nora");
        String open = journey(maya, "Southeast Asia", "public", 9);
        String hidden = journey(maya, "Diary", "private", 9);

        String first = report(nora, "journey", open, 201);
        // Saying it twice (or tapping twice) is one report.
        assertThat(report(nora, "journey", open, 201)).isEqualTo(first);
        assertThat(jdbc.sql("select count(*) from reports").query(Integer.class).single())
                .isEqualTo(1);

        // A private journey, or an id that was made up, is "not there" for the reporter.
        mvc.perform(reportRequest(nora, "journey", hidden))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("not_found"))
                .andExpect(jsonPath("$.detail").value("That isn't there any more, so there is nothing to report."));
        mvc.perform(reportRequest(nora, "entry", "00000000-0000-0000-0000-000000000001"))
                .andExpect(status().isNotFound());
        // A person can be reported by someone they have blocked: that is often exactly when it is needed.
        mvc.perform(put("/v1/profiles/nora/block").header("Authorization", maya))
                .andExpect(status().isNoContent());
        String mayaId = jdbc.sql("select id::text from profiles where username = 'maya'")
                .query(String.class)
                .single();
        report(nora, "profile", mayaId, 201);

        // Twenty a day is the ceiling.
        jdbc.sql("""
                insert into reports (reporter_id, target_type, target_id, reason)
                select (select id from profiles where username = 'nora'), 'entry', gen_random_uuid(), 'spam'
                from generate_series(1, 18)
                """).update();
        String ray = person("ray");
        mvc.perform(reportRequest(nora, "journey", journey(ray, "Japan by rail", "public", 2)))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("too_many_reports"));
    }

    @Test
    void aFriendWhoLeftASharedJourneyCanDeleteWhatTheyWroteButNotRewriteIt() throws Exception {
        String owner = person("owner");
        String friend = person("friend");
        String journey = journey(owner, "Iceland ring road", "public", 4);
        share(owner, journey, friend, "friend");
        String theirs = entry(friend, journey, "My day in Vik", 1);
        String stays = entry(friend, journey, "Glacier lagoon", 0);

        // The owner takes the friend off the journey, and makes it private.
        mvc.perform(delete("/v1/journeys/" + journey + "/members/friend").header("Authorization", owner))
                .andExpect(status().isNoContent());
        mvc.perform(put("/v1/entries/" + theirs)
                        .header("Authorization", friend)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"The owner is a fool\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("not_on_journey"));
        mvc.perform(patch("/v1/journeys/" + journey)
                        .header("Authorization", owner)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"visibility\":\"private\"}"))
                .andExpect(status().isOk());
        mvc.perform(get("/v1/entries/" + theirs).header("Authorization", friend))
                .andExpect(status().isNotFound());

        // What they wrote is still theirs to take back, even though they can no longer open the journey.
        mvc.perform(delete("/v1/entries/" + theirs).header("Authorization", friend))
                .andExpect(status().isNoContent());
        mvc.perform(get("/v1/journeys/" + journey).header("Authorization", owner))
                .andExpect(jsonPath("$.entryCount").value(1));
        // Someone else's entry in a journey they can't see is, as before, simply not there.
        String stranger = person("stranger");
        mvc.perform(delete("/v1/entries/" + stays).header("Authorization", stranger))
                .andExpect(status().isNotFound());
        mvc.perform(delete("/v1/entries/" + stays).header("Authorization", owner))
                .andExpect(status().isNoContent());
    }

    @Test
    void onlyARealPushAddressCountsAsAPhoneAndAPersonHasTenAtMost() throws Exception {
        String nora = person("nora");
        for (String wrong :
                List.of("x", "ExponentPushToken[]", "ExponentPushToken[a b]", "https://evil.example/hook")) {
            mvc.perform(put("/v1/me/devices")
                            .header("Authorization", nora)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"token\":\"%s\",\"platform\":\"ios\"}".formatted(wrong)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("invalid_device"));
        }
        device(nora, "ExpoPushToken[the-newer-spelling]");
        for (int i = 0; i < 11; i++) {
            device(nora, "ExponentPushToken[phone-" + i + "]");
            jdbc.sql("update devices set seen_at = now() - make_interval(mins => :age) where token = :token")
                    .param("age", 20 - i)
                    .param("token", "ExponentPushToken[phone-" + i + "]")
                    .update();
        }
        device(nora, "ExponentPushToken[the-newest]");
        List<String> kept =
                jdbc.sql("select token from devices").query(String.class).list();
        assertThat(kept)
                .hasSize(10)
                .contains("ExponentPushToken[the-newest]")
                .doesNotContain("ExponentPushToken[phone-0]");
    }

    @Test
    void aPushSaysWhatReallyStandsWhenItIsSent() throws Exception {
        String maya = person("maya");
        String nora = person("nora");
        String kai = person("kai");
        device(maya, "ExponentPushToken[maya]");
        String journey = journey(maya, "Southeast Asia", "public", 9);
        String entry = entry(maya, journey, "Hoi An", 0);

        // Follow, unfollow, follow: Maya is told once, not three times.
        for (int i = 0; i < 3; i++) {
            mvc.perform(put("/v1/profiles/maya/follow").header("Authorization", nora))
                    .andExpect(status().isOk());
            mvc.perform(delete("/v1/profiles/maya/follow").header("Authorization", nora))
                    .andExpect(status().isOk());
        }
        assertThat(count("kind = 'profile_follow'")).isEqualTo(1);
        // ...and as Nora no longer follows when it would be sent, not even that once.
        delivery.deliverDue();
        assertThat(phone.sent()).isEmpty();

        // Like, unlike, like by one person is one like. Two people liking, and one taking it back, is one like.
        for (int i = 0; i < 3; i++) {
            mvc.perform(put("/v1/entries/" + entry + "/like").header("Authorization", nora))
                    .andExpect(status().isOk());
            mvc.perform(delete("/v1/entries/" + entry + "/like").header("Authorization", nora))
                    .andExpect(status().isOk());
        }
        mvc.perform(put("/v1/entries/" + entry + "/like").header("Authorization", nora))
                .andExpect(status().isOk());
        mvc.perform(put("/v1/entries/" + entry + "/like").header("Authorization", kai))
                .andExpect(status().isOk());
        mvc.perform(delete("/v1/entries/" + entry + "/like").header("Authorization", kai))
                .andExpect(status().isOk());
        delivery.deliverDue();
        assertThat(phone.sent()).extracting(PushMessage::body).containsExactly("nora liked “Hoi An”.");

        // A like that was taken back before it was told leaves nothing to tell.
        phone.clear();
        String other = entry(maya, journey, "Hue", 0);
        mvc.perform(put("/v1/entries/" + other + "/like").header("Authorization", kai))
                .andExpect(status().isOk());
        mvc.perform(delete("/v1/entries/" + other + "/like").header("Authorization", kai))
                .andExpect(status().isOk());
        delivery.deliverDue();
        assertThat(phone.sent()).isEmpty();
    }

    @Test
    void aPushNeverNamesWhatSomeoneYouBlockedWroteAndOneBadMessageDoesNotStopTheRest() throws Exception {
        String owner = person("owner");
        String friend = person("friend");
        String reader = person("reader");
        String journey = journey(owner, "Iceland ring road", "public", 4);
        share(owner, journey, friend, "friend");
        mvc.perform(put("/v1/journeys/" + journey + "/follow").header("Authorization", reader))
                .andExpect(status().isOk());
        device(reader, "ExponentPushToken[reader]");
        // The friend has blocked the reader: for the reader, what the friend writes isn't there.
        mvc.perform(put("/v1/profiles/reader/block").header("Authorization", friend))
                .andExpect(status().isNoContent());
        mvc.perform(put("/v1/journeys/" + journey + "/follow").header("Authorization", reader))
                .andExpect(status().isOk());

        entry(owner, journey, "Reykjavik", 2);
        entry(friend, journey, "Words the reader must not see", 1);
        entry(owner, journey, "Vik", 0);
        // A message of a kind this version doesn't know (a newer version wrote it) is in the same batch.
        jdbc.sql("alter table notifications drop constraint notifications_kind_check")
                .update();
        try {
            jdbc.sql("""
                    insert into notifications (user_id, kind) select id, 'something_new' from profiles where username = 'reader'
                    """).update();

            assertThat(delivery.deliverDue()).isEqualTo(2);
        } finally {
            jdbc.sql("delete from notifications where kind = 'something_new'").update();
            jdbc.sql("""
                    alter table notifications add constraint notifications_kind_check check (kind in ('new_entries',
                      'journey_completed', 'likes', 'comment', 'reply', 'journey_follow', 'profile_follow', 'invitation',
                      'friend_joined', 'reminder', 'weekly_digest', 'journey_paused'))
                    """).update();
        }

        assertThat(phone.sent()).hasSize(1);
        assertThat(phone.sent().get(0).body()).isEqualTo("owner added 2 entries: Reykjavik and Vik.");
    }

    @Test
    void savingOneSettingLeavesTheOthersAsTheyWere() throws Exception {
        String nora = person("nora");
        mvc.perform(put("/v1/me/settings")
                        .header("Authorization", nora)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"notifyLikes\":false,\"defaultVisibility\":\"unlisted\"}"))
                .andExpect(status().isOk());
        // An older version of the app, which has never heard of some switches, saves one of the ones it knows.
        mvc.perform(put("/v1/me/settings")
                        .header("Authorization", nora)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reminders\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reminders").value(true))
                .andExpect(jsonPath("$.notifyLikes").value(false))
                .andExpect(jsonPath("$.notifyNewEntries").value(true))
                .andExpect(jsonPath("$.weeklyDigest").value(true))
                .andExpect(jsonPath("$.defaultVisibility").value("unlisted"))
                .andExpect(jsonPath("$.reminderHour").value(19));
    }

    @Test
    void joiningByLinkTellsTheOwnerAndAUsedLinkStaysUsed() throws Exception {
        String owner = person("owner");
        String friend = person("friend");
        device(owner, "ExponentPushToken[owner]");
        String journey = journey(owner, "Iceland ring road", "public", 4);
        String body = mvc.perform(
                        post("/v1/journeys/" + journey + "/invite-link").header("Authorization", owner))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String url = JsonPath.read(body, "$.url");
        String token = url.substring(url.lastIndexOf('/') + 1);

        mvc.perform(post("/v1/invites/" + token + "/accept").header("Authorization", friend))
                .andExpect(status().isOk());
        delivery.deliverDue();
        assertThat(phone.sent()).extracting(PushMessage::body).containsExactly("friend joined your journey.");

        // The friend later deletes their account. The link they used doesn't come back to life.
        mvc.perform(delete("/v1/me").header("Authorization", friend)).andExpect(status().isNoContent());
        String late = person("late");
        mvc.perform(post("/v1/invites/" + token + "/accept").header("Authorization", late))
                .andExpect(status().isNotFound());
        mvc.perform(get("/v1/journeys/" + journey + "/members").header("Authorization", owner))
                .andExpect(jsonPath("$.members", hasSize(1)));
    }

    private int count(String where) {
        return jdbc.sql("select count(*) from notifications where " + where)
                .query(Integer.class)
                .single();
    }

    private void device(String token, String pushToken) throws Exception {
        mvc.perform(put("/v1/me/devices")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"%s\",\"platform\":\"ios\"}".formatted(pushToken)))
                .andExpect(status().isNoContent());
    }

    private void comment(String token, String entry, String words) throws Exception {
        mvc.perform(post("/v1/entries/" + entry + "/comments")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"%s\"}".formatted(words)))
                .andExpect(status().isCreated());
    }

    /** The friend follows the owner, is invited to the journey and says yes. */
    private void share(String owner, String journey, String friend, String friendName) throws Exception {
        String ownerName = jdbc.sql(
                        "select p.username from journeys j join profiles p on p.id = j.owner_id where j.id = cast(:id as uuid)")
                .param("id", journey)
                .query(String.class)
                .single();
        mvc.perform(put("/v1/profiles/" + ownerName + "/follow").header("Authorization", friend))
                .andExpect(status().isOk());
        mvc.perform(post("/v1/journeys/" + journey + "/members")
                        .header("Authorization", owner)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"%s\"}".formatted(friendName)))
                .andExpect(status().isOk());
        mvc.perform(post("/v1/journeys/" + journey + "/invitation/accept").header("Authorization", friend))
                .andExpect(status().isOk());
    }

    private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder reportRequest(
            String token, String type, String id) {
        return post("/v1/reports")
                .header("Authorization", token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"targetType\":\"%s\",\"targetId\":\"%s\",\"reason\":\"spam\"}".formatted(type, id));
    }

    private String report(String token, String type, String id, int expected) throws Exception {
        String body = mvc.perform(reportRequest(token, type, id))
                .andExpect(status().is(expected))
                .andReturn()
                .getResponse()
                .getContentAsString();
        return JsonPath.read(body, "$.id");
    }
}
