package app.journey.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import app.journey.api.seed.LocalSeed;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

class MediaTest extends ApiTest {

    @Autowired
    LocalSeed seed;

    @Test
    void aProfilePictureIsUploadedThenServedBack() throws Exception {
        String nora = signIn("nora@example.com");
        String photo = uploadPhoto(nora);

        String me = mvc.perform(put("/v1/me/profile")
                        .header("Authorization", nora)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"displayName\":\"Nora Lind\",\"username\":\"nora.lind\",\"avatarMediaId\":\"%s\"}"
                                .formatted(photo)))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String url = JsonPath.read(me, "$.avatarUrl");

        mvc.perform(get(java.net.URI.create(url)))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "image/jpeg"));
        // Saving again without naming a picture keeps it; asking to remove it removes it.
        mvc.perform(put("/v1/me/profile")
                        .header("Authorization", nora)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"displayName\":\"Nora\",\"username\":\"nora.lind\"}"))
                .andExpect(jsonPath("$.avatarUrl").value(url));
        mvc.perform(put("/v1/me/profile")
                        .header("Authorization", nora)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"displayName\":\"Nora\",\"username\":\"nora.lind\",\"removeAvatar\":true}"))
                .andExpect(jsonPath("$.avatarUrl").isEmpty());
    }

    @Test
    void uploadsNeedTheLinkTheApiIssuedAndAKnownFormat() throws Exception {
        String nora = signIn("nora@example.com");

        mvc.perform(post("/v1/media/uploads")
                        .header("Authorization", nora)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kind\":\"photo\",\"contentType\":\"application/pdf\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("unsupported_media"));

        String target = mvc.perform(post("/v1/media/uploads")
                        .header("Authorization", nora)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kind\":\"photo\",\"contentType\":\"image/jpeg\"}"))
                .andReturn()
                .getResponse()
                .getContentAsString();
        String id = JsonPath.read(target, "$.mediaId");
        mvc.perform(put("/local-media/" + id + "?token=wrong").content(new byte[] {1, 2, 3}))
                .andExpect(status().isForbidden());
        mvc.perform(get("/media/2026/01/missing.jpg")).andExpect(status().isNotFound());
        mvc.perform(get("/media/..%2F..%2Fetc/passwd/x")).andExpect(status().is4xxClientError());
    }

    @Test
    void theSampleDataFillsDiscoverAndIsAddedOnlyOnce() throws Exception {
        org.junit.jupiter.api.Assertions.assertTrue(seed.seedIfEmpty());
        org.junit.jupiter.api.Assertions.assertFalse(seed.seedIfEmpty());
        String reader = person("reader");

        mvc.perform(get("/v1/discover").header("Authorization", reader))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.trending[0].title").value("Learn to surf"))
                .andExpect(jsonPath("$.trending[0].progressLabel").value("Day 6 of 30"))
                .andExpect(jsonPath("$.trending[0].coverUrl").isNotEmpty())
                .andExpect(jsonPath("$.completed[0].title").value("Cappadocia by balloon"));
        mvc.perform(get("/v1/profiles/maya.rides/journeys").header("Authorization", reader))
                .andExpect(jsonPath("$.items[0].title").value("Southeast Asia by motorbike"))
                .andExpect(jsonPath("$.items[0].progressLabel").value("Day 22"))
                .andExpect(jsonPath("$.items[0].owner.avatarUrl").isNotEmpty());
    }
}
