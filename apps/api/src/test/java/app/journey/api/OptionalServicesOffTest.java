package app.journey.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import app.journey.api.notify.PushDelivery;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;

/**
 * The API can go live before every account exists: clips, pushes, email and the automatic photo check can each
 * be switched off, and everything else keeps working.
 */
@TestPropertySource(
        properties = {
            "journey.video.mode=off",
            "journey.push.mode=off",
            "journey.email.mode=off",
            "journey.moderation.mode=off"
        })
class OptionalServicesOffTest extends ApiTest {

    @Autowired
    PushDelivery delivery;

    @Test
    void withClipsOffTheAppIsToldNotToOfferThemAndPhotosStillWork() throws Exception {
        String nora = person("nora");
        mvc.perform(get("/v1/catalog").header("Authorization", nora))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.clips").value(false));
        mvc.perform(post("/v1/media/uploads")
                        .header("Authorization", nora)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kind\":\"video\",\"contentType\":\"video/mp4\",\"durationSeconds\":12}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("clips_off"))
                .andExpect(jsonPath("$.detail").value("Clips aren't switched on yet. Photos work as always."));
        // A photo goes up, is made smaller and is shown, with no automatic check to wait for.
        uploadPhoto(nora);
        // The refused clip left nothing behind; the photo is there, made smaller, and not held.
        assertThat(jdbc.sql("select kind || ':' || status || ':' || sized || ':' || held from media")
                        .query(String.class)
                        .list())
                .containsExactly("photo:ready:true:false");
    }

    @Test
    void withPushesOffWhatWouldHaveBeenPushedIsQuietlyDropped() throws Exception {
        String maya = person("maya");
        String nora = person("nora");
        mvc.perform(put("/v1/me/devices")
                        .header("Authorization", maya)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"ExponentPushToken[maya]\",\"platform\":\"ios\"}"))
                .andExpect(status().isNoContent());
        mvc.perform(put("/v1/profiles/maya/follow").header("Authorization", nora))
                .andExpect(status().isOk());

        assertThat(delivery.deliverDue()).isEqualTo(1);
        assertThat(jdbc.sql("select status from notifications")
                        .query(String.class)
                        .single())
                .isEqualTo("sent");
        assertThat(jdbc.sql("select count(*) from push_tickets")
                        .query(Integer.class)
                        .single())
                .isZero();
    }
}
