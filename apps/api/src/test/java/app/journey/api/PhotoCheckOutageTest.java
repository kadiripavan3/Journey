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

import app.journey.api.media.MediaService;
import app.journey.api.moderation.MediaScreening;
import app.journey.api.moderation.MediaScreening.Verdict;
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
    MediaService media;

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

        // Still down a while later: nothing changes, and the catch-up stops instead of spinning.
        assertThat(media.checkWaiting()).isZero();
        assertThat(waiting()).isEqualTo(1);

        // Back, and it doubts this one: the photo is held from then on.
        doReturn(Verdict.flag("Explicit (99%)")).when(screening).screen(any(byte[].class));
        assertThat(media.checkWaiting()).isEqualTo(1);
        mvc.perform(get("/v1/entries/" + entry).header("Authorization", nora))
                .andExpect(jsonPath("$.media", hasSize(0)));
        mvc.perform(get("/v1/entries/" + entry).header("Authorization", maya))
                .andExpect(jsonPath("$.media[0].held").value(true));
        assertThat(jdbc.sql("select held_reason from media where held")
                        .query(String.class)
                        .single())
                .isEqualTo("Explicit (99%)");
        // Checked once is checked: the next time there is nothing to do.
        assertThat(media.checkWaiting()).isZero();
        assertThat(waiting()).isZero();
    }

    @Test
    void aPhotoTheCheckCanNeverLookAtIsHeldForAPersonAndDoesNotHoldUpTheOthers() throws Exception {
        doThrow(new IllegalStateException("Timed out")).when(screening).screen(any(byte[].class));
        String maya = person("maya");
        String stubborn = uploadPhoto(maya);
        // Shown for now, and tried again a few times.
        for (int round = 0; round < 3; round++) {
            assertThat(media.checkWaiting()).isZero();
        }
        assertThat(jdbc.sql("select held from media where id = cast(:id as uuid)")
                        .param("id", stubborn)
                        .query(Boolean.class)
                        .single())
                .isFalse();

        // The check is back for everything else. The one tried most is looked at last, so it holds nobody up.
        doReturn(Verdict.fine()).when(screening).screen(any(byte[].class));
        String next = uploadPhoto(maya);
        assertThat(jdbc.sql("select screened_at is not null from media where id = cast(:id as uuid)")
                        .param("id", next)
                        .query(Boolean.class)
                        .single())
                .isTrue();
        // And the one the check keeps failing on: after the fifth try a person looks instead.
        doThrow(new IllegalStateException("Timed out")).when(screening).screen(any(byte[].class));
        assertThat(media.checkWaiting()).isZero();
        assertThat(jdbc.sql("select held_reason from media where id = cast(:id as uuid) and held")
                        .param("id", stubborn)
                        .query(String.class)
                        .single())
                .isEqualTo("The automatic check could not look at this after several tries");
        assertThat(waiting()).isZero();
    }

    @Test
    void aPictureTheCheckRefusesToReadIsHeldForAPersonStraightAway() throws Exception {
        doThrow(new MediaScreening.UnreadablePhoto("InvalidImageFormatException"))
                .when(screening)
                .screen(any(byte[].class));
        String maya = person("maya");
        String photo = uploadPhoto(maya);
        assertThat(jdbc.sql(
                                "select held_reason from media where id = cast(:id as uuid) and held and screened_at is not null")
                        .param("id", photo)
                        .query(String.class)
                        .single())
                .isEqualTo("The automatic check couldn't read this picture: InvalidImageFormatException");
    }

    private int waiting() {
        return jdbc.sql("select count(*) from media where status = 'ready' and screened_at is null")
                .query(Integer.class)
                .single();
    }
}
