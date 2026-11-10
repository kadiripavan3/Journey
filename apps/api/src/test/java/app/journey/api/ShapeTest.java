package app.journey.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import app.journey.api.common.Jobs;
import app.journey.api.media.MediaService;
import com.jayway.jsonpath.JsonPath;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

/** The shape every part of the API shares: pages, sending twice, small photos, fixed sets of words, and jobs that run once. */
class ShapeTest extends ApiTest {

    @Autowired
    Jobs jobs;

    @Autowired
    MediaService media;

    @Test
    void aLongListComesInPagesThatNeitherRepeatNorSkip() throws Exception {
        String maya = person("maya");
        for (int i = 1; i <= 5; i++) {
            entry(maya, journey(maya, "Journey " + i, "public", 9), "Start", 0);
        }
        Set<String> seen = new HashSet<>();
        String cursor = null;
        int pages = 0;
        do {
            String body = mvc.perform(get("/v1/me/journeys")
                            .param("limit", "2")
                            .param("cursor", cursor == null ? "" : cursor)
                            .header("Authorization", maya))
                    .andExpect(status().isOk())
                    .andReturn()
                    .getResponse()
                    .getContentAsString();
            List<String> ids = JsonPath.read(body, "$.items[*].id");
            assertThat(ids.size()).isLessThanOrEqualTo(2);
            assertThat(seen.addAll(ids)).isTrue();
            cursor = JsonPath.read(body, "$.nextCursor");
            pages++;
        } while (cursor != null);
        assertThat(seen).hasSize(5);
        assertThat(pages).isEqualTo(3);
        // The newest activity comes first, and a cursor nobody handed out is refused politely.
        mvc.perform(get("/v1/me/journeys").param("limit", "1").header("Authorization", maya))
                .andExpect(jsonPath("$.items[0].title").value("Journey 5"));
        mvc.perform(get("/v1/me/journeys").param("cursor", "nonsense").header("Authorization", maya))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("bad_cursor"));
        mvc.perform(get("/v1/me/journeys").param("limit", "5000").header("Authorization", maya))
                .andExpect(jsonPath("$.items", hasSize(5)));
    }

    @Test
    void aStoryIsReadInPagesFromTheStartOrFromAnyEntry() throws Exception {
        String maya = person("maya");
        String journey = journey(maya, "Southeast Asia", "public", 9);
        List<String> ids = new ArrayList<>();
        for (int day = 7; day >= 1; day--) {
            ids.add(entry(maya, journey, "Entry " + (8 - day), day));
        }
        mvc.perform(get("/v1/journeys/" + journey + "/entries")
                        .param("limit", "3")
                        .header("Authorization", maya))
                .andExpect(jsonPath("$.items", hasSize(3)))
                .andExpect(jsonPath("$.items[0].position").value(1))
                .andExpect(jsonPath("$.items[2].title").value("Entry 3"))
                .andExpect(jsonPath("$.total").value(7))
                .andExpect(jsonPath("$.prevCursor").value(nullValue()))
                .andExpect(jsonPath("$.nextCursor").isNotEmpty());
        // Opened at the fifth entry: the page that holds it, with a way back and a way on.
        String middle = mvc.perform(get("/v1/journeys/" + journey + "/entries")
                        .param("limit", "3")
                        .param("around", ids.get(4))
                        .param("cursor", "")
                        .header("Authorization", maya))
                .andExpect(jsonPath("$.items[*].position", org.hamcrest.Matchers.contains(4, 5, 6)))
                .andReturn()
                .getResponse()
                .getContentAsString();
        mvc.perform(get("/v1/journeys/" + journey + "/entries")
                        .param("limit", "3")
                        .param("cursor", JsonPath.<String>read(middle, "$.prevCursor"))
                        .header("Authorization", maya))
                .andExpect(jsonPath("$.items[*].position", org.hamcrest.Matchers.contains(1, 2, 3)))
                .andExpect(jsonPath("$.prevCursor").value(nullValue()));
        mvc.perform(get("/v1/journeys/" + journey + "/entries")
                        .param("limit", "3")
                        .param("cursor", JsonPath.<String>read(middle, "$.nextCursor"))
                        .header("Authorization", maya))
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].position").value(7))
                .andExpect(jsonPath("$.nextCursor").value(nullValue()));
        mvc.perform(get("/v1/journeys/" + journey + "/entries")
                        .param("around", UUID.randomUUID().toString())
                        .header("Authorization", maya))
                .andExpect(status().isNotFound());
    }

    @Test
    void aJourneysPageGetsWhatItShowsWithoutLoadingTheStory() throws Exception {
        String maya = person("maya");
        String nora = person("nora");
        String challenge = JsonPath.read(
                mvc.perform(post("/v1/journeys")
                                .header("Authorization", maya)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"title\":\"30 days of guitar\",\"template\":\"challenge30\",\"startDate\":\"%s\",\"visibility\":\"public\"}"
                                                .formatted(java.time.LocalDate.now(java.time.ZoneOffset.UTC)
                                                        .minusDays(5))))
                        .andExpect(status().isCreated())
                        .andReturn()
                        .getResponse()
                        .getContentAsString(),
                "$.id");
        String photo = uploadPhoto(maya);
        mvc.perform(post("/v1/journeys/" + challenge + "/entries")
                        .header("Authorization", maya)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                                "{\"title\":\"First chord\",\"isMilestone\":true,\"mediaIds\":[\"%s\"],\"happenedAt\":\"%s\"}"
                                        .formatted(
                                                photo,
                                                java.time.Instant.now().minus(4, java.time.temporal.ChronoUnit.DAYS))))
                .andExpect(status().isCreated());
        entry(maya, challenge, "Sore fingers", 3);
        mvc.perform(put("/v1/journeys/" + challenge + "/follow").header("Authorization", nora))
                .andExpect(status().isOk());
        mvc.perform(post("/v1/journeys/" + challenge + "/read").header("Authorization", nora))
                .andExpect(status().isNoContent());
        entry(maya, challenge, "A whole song", 1);
        String newest = entry(maya, challenge, "Played for a friend", 0);

        mvc.perform(get("/v1/journeys/" + challenge + "/summary").header("Authorization", nora))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.first.title").value("First chord"))
                .andExpect(jsonPath("$.latest", hasSize(3)))
                .andExpect(jsonPath("$.latest[0].id").value(newest))
                .andExpect(jsonPath("$.latest[2].title").value("Sore fingers"))
                .andExpect(jsonPath("$.photos", hasSize(1)))
                .andExpect(jsonPath("$.photoCount").value(1))
                .andExpect(jsonPath("$.days", org.hamcrest.Matchers.contains(2, 3, 5, 6)))
                .andExpect(jsonPath("$.milestones", hasSize(1)))
                .andExpect(jsonPath("$.milestones[0].label").value("Day 2"))
                .andExpect(jsonPath("$.newCount").value(2))
                .andExpect(jsonPath("$.firstNewEntryId").isNotEmpty());
        // Nothing is "new" to the person who wrote it, and an empty journey has an empty summary.
        mvc.perform(get("/v1/journeys/" + challenge + "/summary").header("Authorization", maya))
                .andExpect(jsonPath("$.newCount").value(0));
        String empty = journey(maya, "Not yet", "public", 0);
        mvc.perform(get("/v1/journeys/" + empty + "/summary").header("Authorization", maya))
                .andExpect(jsonPath("$.first").value(nullValue()))
                .andExpect(jsonPath("$.latest", hasSize(0)))
                .andExpect(jsonPath("$.days", hasSize(0)));
    }

    @Test
    void sendingTheSameThingTwiceMakesItOnce() throws Exception {
        String maya = person("maya");
        String draft = UUID.randomUUID().toString();
        String create =
                "{\"title\":\"Southeast Asia\",\"template\":\"trip\",\"startDate\":\"%s\",\"visibility\":\"public\",\"clientId\":\"%s\"}"
                        .formatted(java.time.LocalDate.now(java.time.ZoneOffset.UTC), draft);
        String first = mvc.perform(post("/v1/journeys")
                        .header("Authorization", maya)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(create))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String journey = JsonPath.read(first, "$.id");
        mvc.perform(post("/v1/journeys")
                        .header("Authorization", maya)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(create))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(journey));
        mvc.perform(get("/v1/me/journeys").header("Authorization", maya)).andExpect(jsonPath("$.items", hasSize(1)));

        String entryDraft = "{\"title\":\"Hoi An\",\"clientId\":\"%s\"}".formatted(UUID.randomUUID());
        String entry = JsonPath.read(
                mvc.perform(post("/v1/journeys/" + journey + "/entries")
                                .header("Authorization", maya)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(entryDraft))
                        .andExpect(status().isCreated())
                        .andReturn()
                        .getResponse()
                        .getContentAsString(),
                "$.id");
        mvc.perform(post("/v1/journeys/" + journey + "/entries")
                        .header("Authorization", maya)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(entryDraft))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(entry));
        mvc.perform(get("/v1/journeys/" + journey).header("Authorization", maya))
                .andExpect(jsonPath("$.entryCount").value(1));

        String comment = "{\"body\":\"Lovely\",\"clientId\":\"%s\"}".formatted(UUID.randomUUID());
        for (int i = 0; i < 2; i++) {
            mvc.perform(post("/v1/entries/" + entry + "/comments")
                            .header("Authorization", maya)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(comment))
                    .andExpect(status().isCreated());
        }
        mvc.perform(get("/v1/entries/" + entry).header("Authorization", maya))
                .andExpect(jsonPath("$.commentCount").value(1));
        // Without an id of its own, each send is a new thing, as before.
        mvc.perform(post("/v1/entries/" + entry + "/comments")
                        .header("Authorization", maya)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"Lovely\"}"))
                .andExpect(status().isCreated());
        mvc.perform(get("/v1/entries/" + entry).header("Authorization", maya))
                .andExpect(jsonPath("$.commentCount").value(2));
    }

    @Test
    void commentsArriveThreadByThread() throws Exception {
        String maya = person("maya");
        String nora = person("nora");
        String entry = entry(maya, journey(maya, "Southeast Asia", "public", 3), "Hoi An", 0);
        String first = JsonPath.read(
                mvc.perform(post("/v1/entries/" + entry + "/comments")
                                .header("Authorization", nora)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"body\":\"One\"}"))
                        .andReturn()
                        .getResponse()
                        .getContentAsString(),
                "$.id");
        mvc.perform(post("/v1/entries/" + entry + "/comments")
                        .header("Authorization", nora)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"Two\"}"))
                .andExpect(status().isCreated());
        mvc.perform(post("/v1/entries/" + entry + "/comments")
                        .header("Authorization", maya)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"Answer to one\",\"parentId\":\"%s\"}".formatted(first)))
                .andExpect(status().isCreated());

        mvc.perform(get("/v1/entries/" + entry + "/comments").header("Authorization", nora))
                .andExpect(jsonPath("$.items[*].body", org.hamcrest.Matchers.contains("One", "Answer to one", "Two")));
        String page = mvc.perform(get("/v1/entries/" + entry + "/comments")
                        .param("limit", "2")
                        .header("Authorization", nora))
                .andExpect(jsonPath("$.items[*].body", org.hamcrest.Matchers.contains("One", "Answer to one")))
                .andReturn()
                .getResponse()
                .getContentAsString();
        mvc.perform(get("/v1/entries/" + entry + "/comments")
                        .param("limit", "2")
                        .param("cursor", JsonPath.<String>read(page, "$.nextCursor"))
                        .header("Authorization", nora))
                .andExpect(jsonPath("$.items[*].body", org.hamcrest.Matchers.contains("Two")))
                .andExpect(jsonPath("$.nextCursor").value(nullValue()));
    }

    @Test
    void listsGetSmallPhotosAndTheFullOneIsStillThere() throws Exception {
        String maya = signIn("maya@example.com");
        String big = uploadPhoto(maya, 1600, 1200);
        mvc.perform(put("/v1/me/profile")
                        .header("Authorization", maya)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"displayName\":\"Maya\",\"username\":\"maya\",\"avatarMediaId\":\"%s\"}"
                                .formatted(big)))
                .andExpect(status().isOk());
        String journey = journey(maya, "Southeast Asia", "public", 3);
        String body = mvc.perform(post("/v1/journeys/" + journey + "/entries")
                        .header("Authorization", maya)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Hoi An\",\"mediaIds\":[\"%s\"]}".formatted(big)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.media[0].width").value(1600))
                .andExpect(jsonPath("$.media[0].thumbUrl", containsString(".w800.jpg")))
                .andExpect(jsonPath("$.author.avatarUrl", containsString(".w320.jpg")))
                .andReturn()
                .getResponse()
                .getContentAsString();
        mvc.perform(get("/v1/journeys/" + journey).header("Authorization", maya))
                .andExpect(jsonPath("$.coverThumbUrl", containsString(".w800.jpg")))
                .andExpect(jsonPath("$.coverUrl", org.hamcrest.Matchers.not(containsString(".w800"))));

        assertThat(widthOf(JsonPath.read(body, "$.media[0].url"))).isEqualTo(1600);
        assertThat(widthOf(JsonPath.read(body, "$.media[0].thumbUrl"))).isEqualTo(800);
        assertThat(widthOf(JsonPath.read(body, "$.author.avatarUrl"))).isEqualTo(320);
        // A small photo is never blown up: its smaller versions are the photo itself.
        String small = uploadPhoto(maya);
        String tiny = mvc.perform(post("/v1/journeys/" + journey + "/entries")
                        .header("Authorization", maya)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"mediaIds\":[\"%s\"]}".formatted(small)))
                .andReturn()
                .getResponse()
                .getContentAsString();
        assertThat(widthOf(JsonPath.read(tiny, "$.media[0].thumbUrl"))).isEqualTo(8);
    }

    @Test
    void aNotificationSwitchedOffAlsoLeavesActivity() throws Exception {
        String maya = person("maya");
        String nora = person("nora");
        String entry = entry(maya, journey(maya, "Southeast Asia", "public", 3), "Hoi An", 0);
        mvc.perform(put("/v1/entries/" + entry + "/like").header("Authorization", nora))
                .andExpect(status().isOk());
        mvc.perform(put("/v1/profiles/maya/follow").header("Authorization", nora))
                .andExpect(status().isOk());
        mvc.perform(get("/v1/activity").header("Authorization", maya))
                .andExpect(jsonPath("$.items[?(@.kind=='likes')]", hasSize(1)))
                .andExpect(jsonPath("$.items[?(@.kind=='profile_follow')]", hasSize(1)));

        String settings = mvc.perform(get("/v1/me/settings").header("Authorization", maya))
                .andReturn()
                .getResponse()
                .getContentAsString();
        mvc.perform(put("/v1/me/settings")
                        .header("Authorization", maya)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(settings.replace("\"notifyLikes\":true", "\"notifyLikes\":false")))
                .andExpect(status().isOk());

        mvc.perform(get("/v1/activity").header("Authorization", maya))
                .andExpect(jsonPath("$.items[?(@.kind=='likes')]", hasSize(0)))
                .andExpect(jsonPath("$.items[?(@.kind=='profile_follow')]", hasSize(1)));
    }

    @Test
    void aWordOutsideAFixedSetGetsItsOwnAnswer() throws Exception {
        String maya = person("maya");
        mvc.perform(
                        post("/v1/journeys")
                                .header("Authorization", maya)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"title\":\"Mine\",\"template\":\"trip\",\"startDate\":\"2026-01-01\",\"visibility\":\"friends\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("invalid_visibility"))
                .andExpect(jsonPath("$.detail").value("Choose who can see it."));
        mvc.perform(post("/v1/media/uploads")
                        .header("Authorization", maya)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kind\":\"hologram\",\"contentType\":\"image/jpeg\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("invalid_media_kind"));
        // The words themselves are lower case on the wire.
        String journey = journey(maya, "Southeast Asia", "unlisted", 3);
        mvc.perform(get("/v1/journeys/" + journey).header("Authorization", maya))
                .andExpect(jsonPath("$.visibility").value("unlisted"))
                .andExpect(jsonPath("$.status").value("active"))
                .andExpect(jsonPath("$.labelStyle").value("day"));
    }

    @Test
    void aScheduledJobRunsOncePerPeriodAndUnusedUploadsAreTidiedAway() throws Exception {
        assertThat(jobs.claim("weekly_digest", "2026-W46")).isTrue();
        assertThat(jobs.claim("weekly_digest", "2026-W46")).isFalse();
        assertThat(jobs.claim("weekly_digest", "2026-W47")).isTrue();

        String maya = person("maya");
        String used = uploadPhoto(maya);
        String unused = uploadPhoto(maya);
        String fresh = uploadPhoto(maya);
        String journey = journey(maya, "Southeast Asia", "public", 3);
        mvc.perform(post("/v1/journeys/" + journey + "/entries")
                        .header("Authorization", maya)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"mediaIds\":[\"%s\"]}".formatted(used)))
                .andExpect(status().isCreated());
        mvc.perform(post("/v1/media/uploads")
                        .header("Authorization", maya)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kind\":\"photo\",\"contentType\":\"image/jpeg\"}"))
                .andExpect(status().isOk()); // started, never sent
        jdbc.sql("update media set created_at = now() - interval '2 days' where id <> cast(:fresh as uuid)")
                .param("fresh", fresh)
                .update();

        assertThat(media.removeAbandoned()).isEqualTo(2);
        assertThat(jdbc.sql("select id::text from media order by created_at")
                        .query(String.class)
                        .list())
                .containsExactlyInAnyOrder(used, fresh);
        assertThat(unused).isNotEqualTo(used);
    }

    @Test
    void theSameDraftSentTwiceAtTheSameMomentStillMakesOne() throws Exception {
        String maya = person("maya");
        String journey = journey(maya, "Southeast Asia", "public", 3);
        java.util.concurrent.ExecutorService two = java.util.concurrent.Executors.newFixedThreadPool(2);
        try {
            for (int round = 0; round < 6; round++) {
                String draft = "{\"title\":\"Hoi An %d\",\"clientId\":\"%s\"}".formatted(round, UUID.randomUUID());
                java.util.concurrent.CountDownLatch go = new java.util.concurrent.CountDownLatch(1);
                java.util.concurrent.Callable<String> send = () -> {
                    go.await();
                    return mvc.perform(post("/v1/journeys/" + journey + "/entries")
                                    .header("Authorization", maya)
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(draft))
                            .andExpect(status().isCreated())
                            .andReturn()
                            .getResponse()
                            .getContentAsString();
                };
                var first = two.submit(send);
                var second = two.submit(send);
                go.countDown();
                assertThat(JsonPath.<String>read(first.get(), "$.id"))
                        .isEqualTo(JsonPath.<String>read(second.get(), "$.id"));
            }
        } finally {
            two.shutdownNow();
        }
        mvc.perform(get("/v1/journeys/" + journey).header("Authorization", maya))
                .andExpect(jsonPath("$.entryCount").value(6));
    }

    @Test
    void aPhotoThatUnpacksIntoSomethingEnormousIsRefused() throws Exception {
        String maya = person("maya");
        String target = mvc.perform(post("/v1/media/uploads")
                        .header("Authorization", maya)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kind\":\"photo\",\"contentType\":\"image/png\"}"))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        // 56 megapixels of one colour: a tiny file, a huge picture.
        ByteArrayOutputStream png = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(8000, 7000, BufferedImage.TYPE_BYTE_BINARY), "png", png);
        assertThat(png.size()).isLessThan(1024 * 1024);
        mvc.perform(put(URI.create(JsonPath.<String>read(target, "$.uploadUrl")))
                        .contentType(MediaType.IMAGE_PNG)
                        .content(png.toByteArray()))
                .andExpect(status().isNoContent());
        // The file arrives; the API refuses it when it looks at it, and doesn't keep it.
        String id = JsonPath.read(target, "$.mediaId");
        mvc.perform(post("/v1/media/uploads/" + id + "/complete").header("Authorization", maya))
                .andExpect(status().isContentTooLarge())
                .andExpect(jsonPath("$.code").value("too_large"));
        mvc.perform(get(URI.create(JsonPath.<String>read(target, "$.uploadUrl").replaceAll("/local-media/.*", "/media/")
                        + storageKeyOf(id))))
                .andExpect(status().isNotFound());
        String journey = journey(maya, "Southeast Asia", "public", 3);
        mvc.perform(post("/v1/journeys/" + journey + "/entries")
                        .header("Authorization", maya)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"mediaIds\":[\"%s\"]}".formatted(JsonPath.<String>read(target, "$.mediaId"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("media_not_ready"));
    }

    private String storageKeyOf(String mediaId) {
        return jdbc.sql("select storage_key from media where id = cast(:id as uuid)")
                .param("id", mediaId)
                .query(String.class)
                .single();
    }

    @Test
    void anUploadIsOnlyUsableOnceItIsCompleteAndOnlyItsOwnerCanCompleteIt() throws Exception {
        String maya = person("maya");
        String nora = person("nora");
        String target = mvc.perform(post("/v1/media/uploads")
                        .header("Authorization", maya)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kind\":\"photo\",\"contentType\":\"image/jpeg\"}"))
                .andReturn()
                .getResponse()
                .getContentAsString();
        String id = JsonPath.read(target, "$.mediaId");
        // Nothing has been sent yet.
        mvc.perform(post("/v1/media/uploads/" + id + "/complete").header("Authorization", maya))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("upload_missing"));
        ByteArrayOutputStream jpeg = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(1000, 500, BufferedImage.TYPE_INT_RGB), "jpg", jpeg);
        mvc.perform(put(URI.create(JsonPath.<String>read(target, "$.uploadUrl")))
                        .contentType(MediaType.IMAGE_JPEG)
                        .content(jpeg.toByteArray()))
                .andExpect(status().isNoContent());
        String journey = journey(maya, "Southeast Asia", "public", 3);
        String attach = "{\"mediaIds\":[\"%s\"]}".formatted(id);
        mvc.perform(post("/v1/journeys/" + journey + "/entries")
                        .header("Authorization", maya)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(attach))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("media_not_ready"));
        mvc.perform(post("/v1/media/uploads/" + id + "/complete").header("Authorization", nora))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("unknown_media"));

        mvc.perform(post("/v1/media/uploads/" + id + "/complete").header("Authorization", maya))
                .andExpect(status().isNoContent());
        mvc.perform(post("/v1/media/uploads/" + id + "/complete").header("Authorization", maya))
                .andExpect(status().isNoContent()); // saying it twice is fine
        mvc.perform(post("/v1/journeys/" + journey + "/entries")
                        .header("Authorization", maya)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(attach))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.media[0].width").value(1000))
                .andExpect(jsonPath("$.media[0].height").value(500));

        // A photo from before sizes were made at upload gets them when the API next starts.
        jdbc.sql("update media set sized = false").update();
        assertThat(media.makeMissingSizes()).isEqualTo(1);
        assertThat(media.makeMissingSizes()).isZero();
    }

    /** Uploads a JPEG of the given size the way the app does. Returns the media id. */
    private String uploadPhoto(String token, int width, int height) throws Exception {
        String target = mvc.perform(post("/v1/media/uploads")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kind\":\"photo\",\"contentType\":\"image/jpeg\"}"))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        ByteArrayOutputStream jpeg = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB), "jpg", jpeg);
        mvc.perform(put(URI.create(JsonPath.<String>read(target, "$.uploadUrl")))
                        .contentType(MediaType.IMAGE_JPEG)
                        .content(jpeg.toByteArray()))
                .andExpect(status().isNoContent());
        String id = JsonPath.read(target, "$.mediaId");
        mvc.perform(post("/v1/media/uploads/" + id + "/complete").header("Authorization", token))
                .andExpect(status().isNoContent());
        return id;
    }

    private int widthOf(String url) throws Exception {
        byte[] bytes = mvc.perform(get(URI.create(url)))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.IMAGE_JPEG))
                .andReturn()
                .getResponse()
                .getContentAsByteArray();
        return ImageIO.read(new java.io.ByteArrayInputStream(bytes)).getWidth();
    }
}
