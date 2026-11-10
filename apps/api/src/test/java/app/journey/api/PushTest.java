package app.journey.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import app.journey.api.notify.LoggingPushSender;
import app.journey.api.notify.NotificationKind;
import app.journey.api.notify.OutboxStore;
import app.journey.api.notify.PushDelivery;
import app.journey.api.notify.PushMessage;
import com.jayway.jsonpath.JsonPath;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

/**
 * Push notifications: who is told about what, in which words, and what is never sent. The pushes go to the
 * stand-in, which keeps them so they can be read here.
 */
class PushTest extends ApiTest {

    @Autowired
    PushDelivery delivery;

    @Autowired
    LoggingPushSender phone;

    @Autowired
    OutboxStore outbox;

    @BeforeEach
    void noOldPushes() {
        phone.clear();
    }

    @Test
    void aBurstOfEntriesArrivesAsOnePushAndOnlyOnPhonesThatAskedForIt() throws Exception {
        String maya = person("maya");
        String nora = person("nora");
        String kai = person("kai");
        String journey = journey(maya, "Southeast Asia by motorbike", "public", 9);
        mvc.perform(put("/v1/journeys/" + journey + "/follow").header("Authorization", nora))
                .andExpect(status().isOk());
        mvc.perform(put("/v1/journeys/" + journey + "/follow").header("Authorization", kai))
                .andExpect(status().isOk());
        device(nora, "ExponentPushToken[nora-phone]");
        device(maya, "ExponentPushToken[maya-phone]");

        entry(maya, journey, "Ferry to Java", 2);
        entry(maya, journey, "Probolinggo", 1);
        entry(maya, journey, "Sunrise over Mount Bromo", 0);

        assertThat(delivery.deliverDue()).isEqualTo(1);
        List<PushMessage> sent = phone.sent();
        // Kai follows too but has no phone registered; Maya is never told about her own entries.
        assertThat(sent).hasSize(1);
        assertThat(sent.get(0).token()).isEqualTo("ExponentPushToken[nora-phone]");
        assertThat(sent.get(0).title()).isEqualTo("Southeast Asia by motorbike");
        assertThat(sent.get(0).body())
                .isEqualTo("maya added 3 entries: Ferry to Java, Probolinggo and Sunrise over Mount Bromo.");
        assertThat(sent.get(0).url()).isEqualTo("/journey/" + journey + "/timeline");
        assertThat(sent.get(0).kind()).isEqualTo(NotificationKind.NEW_ENTRIES);
        // Sent once: the next run has nothing to do. The next entry is a new message.
        assertThat(delivery.deliverDue()).isZero();
        phone.clear();
        entry(maya, journey, "Roads that look like rivers", 0);
        delivery.deliverDue();
        assertThat(phone.sent())
                .extracting(PushMessage::body)
                .containsExactly("maya posted Day 10: “Roads that look like rivers”");
    }

    @Test
    void everyKindOfNewsHasItsOwnWordsAndOpensTheRightPlace() throws Exception {
        String nora = person("nora");
        String kai = person("kai");
        String lena = person("lena");
        device(nora, "ExponentPushToken[nora]");
        device(kai, "ExponentPushToken[kai]");
        String journey = journey(nora, "Iceland ring road", "public", 5);
        String entry = entry(nora, journey, "Skogafoss in the rain", 0);

        // Likes on one entry are one message that counts up.
        mvc.perform(put("/v1/entries/" + entry + "/like").header("Authorization", kai))
                .andExpect(status().isOk());
        mvc.perform(put("/v1/entries/" + entry + "/like").header("Authorization", lena))
                .andExpect(status().isOk());
        mvc.perform(put("/v1/entries/" + entry + "/like").header("Authorization", lena))
                .andExpect(status().isOk());
        // A comment for the author, and an answer for the commenter.
        String comment = JsonPath.read(
                mvc.perform(post("/v1/entries/" + entry + "/comments")
                                .header("Authorization", kai)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"body\":\"How cold was it?\"}"))
                        .andExpect(status().isCreated())
                        .andReturn()
                        .getResponse()
                        .getContentAsString(),
                "$.id");
        mvc.perform(post("/v1/entries/" + entry + "/comments")
                        .header("Authorization", nora)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"Colder than it looks\",\"parentId\":\"%s\"}".formatted(comment)))
                .andExpect(status().isCreated());
        // Follows of the person and of the journey, an invitation and its answer, and the end of the journey.
        mvc.perform(put("/v1/profiles/nora/follow").header("Authorization", kai))
                .andExpect(status().isOk());
        mvc.perform(put("/v1/journeys/" + journey + "/follow").header("Authorization", kai))
                .andExpect(status().isOk());
        mvc.perform(post("/v1/journeys/" + journey + "/members")
                        .header("Authorization", nora)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"kai\"}"))
                .andExpect(status().isOk());
        mvc.perform(post("/v1/journeys/" + journey + "/invitation/accept").header("Authorization", kai))
                .andExpect(status().isOk());
        mvc.perform(post("/v1/journeys/" + journey + "/complete")
                        .header("Authorization", nora)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk());

        delivery.deliverDue();

        assertThat(to("ExponentPushToken[nora]"))
                .containsExactlyInAnyOrder(
                        "Iceland ring road | lena and 1 other liked “Skogafoss in the rain”. | /entry/" + entry,
                        "Iceland ring road | kai commented on “Skogafoss in the rain”: “How cold was it?” | /entry/"
                                + entry + "?comments=1",
                        "Journey | kai started following you. | /profile/kai",
                        "Iceland ring road | kai started following your journey. | /profile/kai",
                        "Iceland ring road | kai joined your journey. | /journey/" + journey + "/people");
        assertThat(to("ExponentPushToken[kai]"))
                .containsExactlyInAnyOrder(
                        "Iceland ring road | nora replied to your comment: “Colder than it looks” | /entry/" + entry
                                + "?comments=1",
                        "Iceland ring road | nora invited you to add to this journey. | /invitation/" + journey,
                        "Iceland ring road | nora completed the journey. See how it ended. | /journey/" + journey
                                + "/recap");
    }

    @Test
    void nothingIsPushedThatWasSwitchedOffOrCanNoLongerBeSeen() throws Exception {
        String maya = person("maya");
        String nora = person("nora");
        String ray = person("ray");
        device(nora, "ExponentPushToken[nora]");
        device(maya, "ExponentPushToken[maya]");
        String journey = journey(maya, "Southeast Asia", "public", 9);
        String mine = journey(nora, "Iceland ring road", "public", 5);
        String entry = entry(nora, mine, "Skogafoss", 0);
        mvc.perform(put("/v1/journeys/" + journey + "/follow").header("Authorization", nora))
                .andExpect(status().isOk());
        delivery.deliverDue();
        phone.clear();

        // Switched off before it happened: nothing is queued at all.
        String settings = mvc.perform(get("/v1/me/settings").header("Authorization", nora))
                .andReturn()
                .getResponse()
                .getContentAsString();
        mvc.perform(put("/v1/me/settings")
                        .header("Authorization", nora)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(settings.replace("\"notifyLikes\":true", "\"notifyLikes\":false")))
                .andExpect(status().isOk());
        mvc.perform(put("/v1/entries/" + entry + "/like").header("Authorization", ray))
                .andExpect(status().isOk());
        assertThat(pending()).isZero();

        // Queued, and then: the journey went private, the commenter was blocked, the kind was switched off.
        entry(maya, journey, "Hoi An", 0);
        mvc.perform(post("/v1/entries/" + entry + "/comments")
                        .header("Authorization", ray)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"Buy now\"}"))
                .andExpect(status().isCreated());
        mvc.perform(put("/v1/profiles/nora/follow").header("Authorization", maya))
                .andExpect(status().isOk());
        assertThat(pending()).isEqualTo(3);
        mvc.perform(patch("/v1/journeys/" + journey)
                        .header("Authorization", maya)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"visibility\":\"private\"}"))
                .andExpect(status().isOk());
        mvc.perform(put("/v1/profiles/ray/block").header("Authorization", nora)).andExpect(status().isNoContent());
        mvc.perform(put("/v1/me/settings")
                        .header("Authorization", nora)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(settings.replace("\"notifyFollowers\":true", "\"notifyFollowers\":false")))
                .andExpect(status().isOk());

        delivery.deliverDue();

        assertThat(phone.sent()).isEmpty();
        assertThat(pending()).isZero();
        assertThat(jdbc.sql("select count(*) from notifications where status = 'sent'")
                        .query(Integer.class)
                        .single())
                .isEqualTo(1); // only the very first one, from before
    }

    @Test
    void aPhoneIsRegisteredOnceBelongsToWhoeverSignedInLastAndCanBeForgotten() throws Exception {
        String nora = person("nora");
        String kai = person("kai");
        String half = signIn("half@example.com");
        String body =
                "{\"token\":\"ExponentPushToken[shared-phone]\",\"platform\":\"ios\",\"timeZone\":\"Europe/Berlin\"}";
        mvc.perform(put("/v1/me/devices")
                        .header("Authorization", nora)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isNoContent());
        mvc.perform(put("/v1/me/devices")
                        .header("Authorization", nora)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isNoContent());
        assertThat(owners()).containsExactly("nora:Europe/Berlin");

        // Kai signs in on the same phone: its pushes are Kai's now. A time zone nobody knows becomes UTC.
        mvc.perform(put("/v1/me/devices")
                        .header("Authorization", kai)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body.replace("Europe/Berlin", "Mars/Olympus")))
                .andExpect(status().isNoContent());
        assertThat(owners()).containsExactly("kai:UTC");
        // Nora can't remove what is no longer hers; Kai can.
        mvc.perform(delete("/v1/me/devices")
                        .param("token", "ExponentPushToken[shared-phone]")
                        .header("Authorization", nora))
                .andExpect(status().isNoContent());
        assertThat(owners()).hasSize(1);
        mvc.perform(delete("/v1/me/devices")
                        .param("token", "ExponentPushToken[shared-phone]")
                        .header("Authorization", kai))
                .andExpect(status().isNoContent());
        assertThat(owners()).isEmpty();

        mvc.perform(put("/v1/me/devices")
                        .header("Authorization", nora)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"x\",\"platform\":\"toaster\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("invalid_platform"));
        mvc.perform(put("/v1/me/devices")
                        .header("Authorization", nora)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"platform\":\"ios\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.token").value("The device's push address is missing."));
        mvc.perform(put("/v1/me/devices")
                        .header("Authorization", half)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("profile_required"));
    }

    @Test
    void aPushThatCouldNotBeSentIsTriedAgainLaterAndGivenUpOnAfterAFewTries() throws Exception {
        String maya = person("maya");
        String nora = person("nora");
        device(maya, "ExponentPushToken[maya]");
        mvc.perform(put("/v1/profiles/maya/follow").header("Authorization", nora))
                .andExpect(status().isOk());
        List<UUID> waiting = jdbc.sql("select id from notifications where status = 'pending'")
                .query(UUID.class)
                .list();
        assertThat(waiting).hasSize(1);

        outbox.retryLater(waiting, 3);
        // Put back for later: not due now, so nothing is sent.
        assertThat(delivery.deliverDue()).isZero();
        assertThat(jdbc.sql("select attempts from notifications")
                        .query(Integer.class)
                        .single())
                .isEqualTo(1);
        outbox.retryLater(waiting, 3);
        outbox.retryLater(waiting, 3);
        assertThat(jdbc.sql("select status from notifications")
                        .query(String.class)
                        .single())
                .isEqualTo("skipped");
    }

    private void device(String token, String pushToken) throws Exception {
        mvc.perform(put("/v1/me/devices")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"%s\",\"platform\":\"ios\"}".formatted(pushToken)))
                .andExpect(status().isNoContent());
    }

    /** What one phone got: "title | body | where it opens". */
    private List<String> to(String pushToken) {
        return phone.sent().stream()
                .filter(message -> message.token().equals(pushToken))
                .map(message -> message.title() + " | " + message.body() + " | " + message.url())
                .toList();
    }

    private int pending() {
        return jdbc.sql("select count(*) from notifications where status = 'pending'")
                .query(Integer.class)
                .single();
    }

    private List<String> owners() {
        return jdbc.sql("select p.username || ':' || d.time_zone from devices d join profiles p on p.id = d.user_id")
                .query(String.class)
                .list();
    }
}
