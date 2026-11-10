package app.journey.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import app.journey.api.moderation.MediaScreening;
import app.journey.api.moderation.MediaScreening.Verdict;
import app.journey.api.moderation.ModerationService;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/** The automatic photo check is an outside service. When it can't be reached, uploading still works. */
class PhotoCheckOutageTest extends ApiTest {

    @MockitoBean
    MediaScreening screening;

    @Autowired
    ModerationService moderation;

    @Test
    void aPhotoUploadedWhileTheCheckIsDownIsShownAndCheckedOnceItIsBack() throws Exception {
        doThrow(new IllegalStateException("The check is having a day"))
                .when(screening)
                .screen(any(byte[].class));
        String maya = person("maya");
        String nora = person("nora");
        String journey = journey(maya, "Southeast Asia", "public", 3);

        String photo = uploadPhoto(maya);
        String entry = JsonPath.read(
                mvc.perform(post("/v1/journeys/" + journey + "/entries")
                                .header("Authorization", maya)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"title\":\"Hoi An\",\"mediaIds\":[\"%s\"]}".formatted(photo)))
                        .andExpect(status().isCreated())
                        .andReturn()
                        .getResponse()
                        .getContentAsString(),
                "$.id");
        mvc.perform(get("/v1/entries/" + entry).header("Authorization", nora))
                .andExpect(jsonPath("$.media", hasSize(1)));
        assertThat(waiting()).isEqualTo(1);

        // Still down at night: nothing changes, and the catch-up stops at the first photo instead of spinning.
        assertThat(moderation.checkWaiting()).isZero();
        assertThat(waiting()).isEqualTo(1);

        // Back, and it doubts this one: the photo is held from then on.
        doReturn(Verdict.flag("Explicit (99%)")).when(screening).screen(any(byte[].class));
        assertThat(moderation.checkWaiting()).isEqualTo(1);
        mvc.perform(get("/v1/entries/" + entry).header("Authorization", nora))
                .andExpect(jsonPath("$.media", hasSize(0)));
        mvc.perform(get("/v1/entries/" + entry).header("Authorization", maya))
                .andExpect(jsonPath("$.media[0].held").value(true));
        assertThat(jdbc.sql("select held_reason from media where held")
                        .query(String.class)
                        .single())
                .isEqualTo("Explicit (99%)");
        // Checked once is checked: the next night has nothing to do.
        assertThat(moderation.checkWaiting()).isZero();
        assertThat(waiting()).isZero();
    }

    private int waiting() {
        return jdbc.sql("select count(*) from media where status = 'ready' and screened_at is null")
                .query(Integer.class)
                .single();
    }
}
