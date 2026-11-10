package app.journey.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.endsWith;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.net.URI;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

/** Short clips with the local stand-in: kept as they arrive, ready at once, at most three a minute long. */
class ClipsTest extends ApiTest {

    /** Starts a clip upload, sends some bytes and says it is done. Returns the media id. */
    private String uploadClip(String token, int seconds) throws Exception {
        String target = startClip(token, seconds);
        mvc.perform(put(URI.create(JsonPath.<String>read(target, "$.uploadUrl")))
                        .contentType(MediaType.valueOf("video/mp4"))
                        .content(new byte[] {0, 0, 0, 24, 'f', 't', 'y', 'p', 'm', 'p', '4', '2'}))
                .andExpect(status().isNoContent());
        String id = JsonPath.read(target, "$.mediaId");
        mvc.perform(post("/v1/media/uploads/" + id + "/complete").header("Authorization", token))
                .andExpect(status().isNoContent());
        return id;
    }

    private String startClip(String token, int seconds) throws Exception {
        return mvc.perform(post("/v1/media/uploads")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kind\":\"video\",\"contentType\":\"video/mp4\",\"durationSeconds\":%d}"
                                .formatted(seconds)))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
    }

    @Test
    void aClipGoesOnAnEntryNextToPhotosAndPlaysFromItsOwnAddress() throws Exception {
        String kai = person("kai");
        String reader = person("reader");
        String journey = journey(kai, "Learn to surf", "public", 6);
        String clip = uploadClip(kai, 42);
        String photo = uploadPhoto(kai);

        String body = mvc.perform(post("/v1/journeys/" + journey + "/entries")
                        .header("Authorization", kai)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Stood up for four whole seconds\",\"mediaIds\":[\"%s\",\"%s\"]}"
                                .formatted(clip, photo)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.media", hasSize(2)))
                .andExpect(jsonPath("$.media[0].kind").value("video"))
                .andExpect(jsonPath("$.media[0].status").value("ready"))
                .andExpect(jsonPath("$.media[0].durationSeconds").value(42))
                .andExpect(jsonPath("$.media[0].playbackUrl", endsWith(".mp4")))
                // No still frame locally: a neutral picture stands in, so lists and cards always have one.
                .andExpect(jsonPath("$.media[0].url", endsWith("/share/clip.jpg")))
                .andExpect(jsonPath("$.media[0].thumbUrl", endsWith("/share/clip.jpg")))
                .andExpect(jsonPath("$.media[1].kind").value("photo"))
                .andExpect(jsonPath("$.media[1].playbackUrl").isEmpty())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String entry = JsonPath.read(body, "$.id");

        // Readers get it too, the file is really there, and so is the neutral picture.
        mvc.perform(get("/v1/entries/" + entry).header("Authorization", reader))
                .andExpect(jsonPath("$.media[0].playbackUrl", endsWith(".mp4")));
        mvc.perform(get(URI.create(JsonPath.<String>read(body, "$.media[0].playbackUrl"))))
                .andExpect(status().isOk());
        mvc.perform(get("/share/clip.jpg")).andExpect(status().isOk());
        // A clip is not a photo: the journey's page counts and shows photos only.
        mvc.perform(get("/v1/journeys/" + journey + "/summary").header("Authorization", reader))
                .andExpect(jsonPath("$.photoCount").value(1));

        // Deleting the account takes the clip's file with it.
        mvc.perform(delete("/v1/me").header("Authorization", kai)).andExpect(status().isNoContent());
        mvc.perform(get(URI.create(JsonPath.<String>read(body, "$.media[0].playbackUrl"))))
                .andExpect(status().isNotFound());
        assertThat(jdbc.sql("select count(*) from media").query(Integer.class).single())
                .isZero();
    }

    @Test
    void clipsAreShortFewAndOfAKnownFormat() throws Exception {
        String kai = person("kai");
        String journey = journey(kai, "Learn to surf", "public", 6);
        mvc.perform(post("/v1/media/uploads")
                        .header("Authorization", kai)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kind\":\"video\",\"contentType\":\"video/mp4\",\"durationSeconds\":61}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("clip_too_long"))
                .andExpect(jsonPath("$.detail").value("Keep clips to 60 seconds or less."));
        mvc.perform(post("/v1/media/uploads")
                        .header("Authorization", kai)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kind\":\"video\",\"contentType\":\"video/x-msvideo\",\"durationSeconds\":5}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("unsupported_media"))
                .andExpect(jsonPath("$.detail", containsString("MP4 or MOV")));
        // A clip recorded in a browser (the web preview) is WebM; that is taken too.
        mvc.perform(post("/v1/media/uploads")
                        .header("Authorization", kai)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kind\":\"video\",\"contentType\":\"video/webm\",\"durationSeconds\":5}"))
                .andExpect(status().is2xxSuccessful())
                .andExpect(jsonPath("$.mediaId").exists());

        // Nothing sent yet: saying "done" doesn't make it so.
        String waiting = JsonPath.read(startClip(kai, 10), "$.mediaId");
        mvc.perform(post("/v1/media/uploads/" + waiting + "/complete").header("Authorization", kai))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("upload_missing"))
                .andExpect(jsonPath("$.detail").value("The clip didn't arrive. Try again."));

        String ids = "\"%s\",\"%s\",\"%s\",\"%s\""
                .formatted(uploadClip(kai, 5), uploadClip(kai, 6), uploadClip(kai, 7), uploadClip(kai, 8));
        mvc.perform(post("/v1/journeys/" + journey + "/entries")
                        .header("Authorization", kai)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"mediaIds\":[%s]}".formatted(ids)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("too_many_clips"));
        // Three clips and nothing else is a fine entry.
        mvc.perform(post("/v1/journeys/" + journey + "/entries")
                        .header("Authorization", kai)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"mediaIds\":[%s]}".formatted(ids.substring(0, ids.lastIndexOf(',')))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.media", hasSize(3)));
    }
}
