package app.journey.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.doCallRealMethod;
import static org.mockito.Mockito.doThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import app.journey.api.media.MediaService;
import app.journey.api.media.MediaStorage;
import com.jayway.jsonpath.JsonPath;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.UncheckedIOException;
import java.net.URI;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.zip.CRC32;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

/**
 * The life of a photo: what arrives is opened and stored afresh, so what is shown is what was looked at; and
 * what is deleted is really gone, files included.
 */
class MediaLifeTest extends ApiTest {

    @Autowired
    MediaService media;

    @MockitoSpyBean
    MediaStorage storage;

    @Test
    void whatIsKeptIsMadeFromTheUploadAndTheUploadLinkStopsWorkingOnceItIsDone() throws Exception {
        String maya = person("maya");
        String target = startPhoto(maya, "image/jpeg");
        String id = JsonPath.read(target, "$.mediaId");
        send(target, "image/jpeg", jpeg(plain(400, 300, Color.GREEN)));
        String sentTo =
                jdbc.sql("select storage_key from media").query(String.class).single();
        assertThat(sentTo).startsWith("incoming/");
        // What is on its way in is shown to nobody.
        mvc.perform(get("/media/" + sentTo)).andExpect(status().isNotFound());

        mvc.perform(post("/v1/media/uploads/" + id + "/complete").header("Authorization", maya))
                .andExpect(status().isNoContent());

        String kept =
                jdbc.sql("select storage_key from media").query(String.class).single();
        assertThat(kept).startsWith("photos/").endsWith(".jpg").doesNotContain(id + ".jpg");
        assertThat(storage.size(sentTo)).isEmpty(); // the upload itself is gone
        // Sending something else through the same link afterwards changes nothing: the link is spent.
        mvc.perform(put(URI.create(JsonPath.<String>read(target, "$.uploadUrl")))
                        .contentType(MediaType.IMAGE_JPEG)
                        .content(jpeg(plain(400, 300, Color.MAGENTA))))
                .andExpect(status().isForbidden());
        String url = urlOf(maya, id);
        assertThat(colourAt(url, 200, 150)).isEqualTo("green");
        assertThat(jdbc.sql("select held from media").query(Boolean.class).single())
                .isFalse();
        // Saying "done" again is fine and changes nothing.
        mvc.perform(post("/v1/media/uploads/" + id + "/complete").header("Authorization", maya))
                .andExpect(status().isNoContent());
        assertThat(jdbc.sql("select storage_key from media").query(String.class).single())
                .isEqualTo(kept);
    }

    @Test
    void aFileIsJudgedByWhatItIsNotByWhatItCallsItself() throws Exception {
        String maya = person("maya");
        // A GIF sent as "image/jpeg": only its first frame would ever be looked at, so it isn't taken.
        ByteArrayOutputStream gif = new ByteArrayOutputStream();
        ImageIO.write(plain(40, 30, Color.GREEN), "gif", gif);
        String target = startPhoto(maya, "image/jpeg");
        send(target, "image/jpeg", gif.toByteArray());
        mvc.perform(post("/v1/media/uploads/" + JsonPath.<String>read(target, "$.mediaId") + "/complete")
                        .header("Authorization", maya))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("unsupported_media"))
                .andExpect(jsonPath("$.detail").value("That photo's format isn't supported. Use JPEG or PNG."));
        // Nothing of it is kept.
        assertThat(storage.size(jdbc.sql("select storage_key from media")
                        .query(String.class)
                        .single()))
                .isEmpty();

        // A file of a few bytes that says it is a picture of 4,090 by 4,090 with sixteen bits a colour would
        // need 130 MB to open. It is refused from what its first lines say, before anything is unpacked.
        String heavy = startPhoto(maya, "image/png");
        send(heavy, "image/png", pngHeaderOnly(4090, 4090, 16, 6));
        mvc.perform(post("/v1/media/uploads/" + JsonPath.<String>read(heavy, "$.mediaId") + "/complete")
                        .header("Authorization", maya))
                .andExpect(status().isContentTooLarge())
                .andExpect(jsonPath("$.code").value("too_large"));
        // More than 25 megapixels is refused whatever it is made of.
        String wide = startPhoto(maya, "image/png");
        send(wide, "image/png", pngHeaderOnly(9000, 3000, 8, 2));
        mvc.perform(post("/v1/media/uploads/" + JsonPath.<String>read(wide, "$.mediaId") + "/complete")
                        .header("Authorization", maya))
                .andExpect(status().isContentTooLarge());
        // Nothing arrived at all.
        String empty = startPhoto(maya, "image/jpeg");
        mvc.perform(post("/v1/media/uploads/" + JsonPath.<String>read(empty, "$.mediaId") + "/complete")
                        .header("Authorization", maya))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("upload_missing"));
    }

    @Test
    void aPhotoSavedSidewaysIsKeptTheRightWayUpAndWithoutTheNotesThatTravelledInIt() throws Exception {
        String maya = person("maya");
        // Red on the left, blue on the right, with a note saying "turn me a quarter clockwise" and a place.
        BufferedImage picture = plain(400, 200, Color.BLUE);
        Graphics2D g = picture.createGraphics();
        g.setColor(Color.RED);
        g.fillRect(0, 0, 200, 200);
        g.dispose();
        byte[] sideways = withNotes(jpeg(picture), 6);
        assertThat(new String(sideways, StandardCharsets.ISO_8859_1))
                .contains("Exif")
                .contains("Skogafoss");

        String id = upload(maya, "image/jpeg", sideways);

        assertThat(jdbc.sql("select width || 'x' || height from media")
                        .query(String.class)
                        .single())
                .isEqualTo("200x400");
        String url = urlOf(maya, id);
        // Turned a quarter clockwise, what was on the left is on top.
        assertThat(colourAt(url, 100, 60)).isEqualTo("red");
        assertThat(colourAt(url, 100, 340)).isEqualTo("blue");
        byte[] kept =
                mvc.perform(get(URI.create(url))).andReturn().getResponse().getContentAsByteArray();
        assertThat(new String(kept, StandardCharsets.ISO_8859_1))
                .doesNotContain("Exif")
                .doesNotContain("Skogafoss");
    }

    @Test
    void onlyOneDoneAtATimeWorksOnAnUploadAndNobodyPilesUpUploads() throws Exception {
        String maya = person("maya");
        String target = startPhoto(maya, "image/jpeg");
        String id = JsonPath.read(target, "$.mediaId");
        send(target, "image/jpeg", jpeg(plain(40, 30, Color.GREEN)));
        // Another "done" for the same file is being worked on.
        jdbc.sql("update media set claimed_at = now()").update();
        mvc.perform(post("/v1/media/uploads/" + id + "/complete").header("Authorization", maya))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("busy"));
        // That one died half-way, minutes ago: the next "done" takes over.
        jdbc.sql("update media set claimed_at = now() - interval '5 minutes'").update();
        mvc.perform(post("/v1/media/uploads/" + id + "/complete").header("Authorization", maya))
                .andExpect(status().isNoContent());

        // Forty uploads started and not finished is the most one person can have at once.
        for (int i = 0; i < 40; i++) {
            startPhoto(maya, "image/jpeg");
        }
        mvc.perform(post("/v1/media/uploads")
                        .header("Authorization", maya)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kind\":\"photo\",\"contentType\":\"image/jpeg\"}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("too_many_uploads"));
    }

    @Test
    void whatIsDeletedOrNoLongerUsedLosesItsFilesToo() throws Exception {
        String maya = person("maya");
        String journey = journey(maya, "Southeast Asia", "public", 3);
        String onEntry = uploadPhoto(maya);
        String replaced = uploadPhoto(maya);
        String cover = uploadPhoto(maya);
        String entry = JsonPath.read(
                mvc.perform(post("/v1/journeys/" + journey + "/entries")
                                .header("Authorization", maya)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"title\":\"Hoi An\",\"mediaIds\":[\"%s\",\"%s\"]}"
                                        .formatted(onEntry, replaced)))
                        .andExpect(status().isCreated())
                        .andReturn()
                        .getResponse()
                        .getContentAsString(),
                "$.id");
        mvc.perform(patch("/v1/journeys/" + journey)
                        .header("Authorization", maya)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"coverMediaId\":\"%s\"}".formatted(cover)))
                .andExpect(status().isOk());
        String onEntryKey = keyOf(onEntry);
        String replacedKey = keyOf(replaced);
        String coverKey = keyOf(cover);
        assertThat(media.sweep()).isZero(); // everything is in use

        // A photo taken off its entry is no longer used by anything.
        mvc.perform(put("/v1/entries/" + entry)
                        .header("Authorization", maya)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Hoi An\",\"mediaIds\":[\"%s\"]}".formatted(onEntry)))
                .andExpect(status().isOk());
        assertThat(media.sweep()).isEqualTo(1);
        assertThat(storage.size(replacedKey)).isEmpty();
        assertThat(storage.size(replacedKey + ".w800.jpg")).isEmpty();
        assertThat(storage.size(replacedKey + ".w320.jpg")).isEmpty();
        assertThat(storage.size(onEntryKey)).isPresent();

        // Storage is having a moment when the journey is deleted: the records go, the files are tried again.
        doThrow(new UncheckedIOException(new java.io.IOException("storage is down")))
                .when(storage)
                .delete(argThat(key -> key.startsWith(coverKey)));
        mvc.perform(delete("/v1/journeys/" + journey).header("Authorization", maya))
                .andExpect(status().isNoContent());
        assertThat(media.sweep()).isEqualTo(1); // the entry's photo went; the cover's file couldn't
        assertThat(jdbc.sql("select count(*) from media").query(Integer.class).single())
                .isZero();
        assertThat(storage.size(onEntryKey)).isEmpty();
        assertThat(storage.size(coverKey)).isPresent();
        assertThat(jdbc.sql("select attempts from removed_files")
                        .query(Integer.class)
                        .single())
                .isEqualTo(1);
        // Not yet due again.
        assertThat(media.sweep()).isZero();
        doCallRealMethod().when(storage).delete(argThat(key -> key.startsWith(coverKey)));
        jdbc.sql("update removed_files set next_try_at = now()").update();
        assertThat(media.sweep()).isEqualTo(1);
        assertThat(storage.size(coverKey)).isEmpty();
        assertThat(jdbc.sql("select count(*) from removed_files")
                        .query(Integer.class)
                        .single())
                .isZero();
    }

    @Test
    void uploadsNobodyUsedAreRemovedAfterAWhileAndAnAccountTakesItsFilesWithIt() throws Exception {
        String maya = person("maya");
        String avatar = uploadPhoto(maya);
        mvc.perform(put("/v1/me/profile")
                        .header("Authorization", maya)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"displayName\":\"maya\",\"username\":\"maya\",\"avatarMediaId\":\"%s\"}"
                                .formatted(avatar)))
                .andExpect(status().isOk());
        String finished = uploadPhoto(maya); // never put on anything
        String started = JsonPath.read(startPhoto(maya, "image/jpeg"), "$.mediaId"); // never sent
        String avatarKey = keyOf(avatar);
        String finishedKey = keyOf(finished);

        // Two days on: the upload that never finished goes. The finished one may belong to an entry written
        // without a connection, which can wait a week.
        jdbc.sql("update media set created_at = now() - interval '2 days'").update();
        assertThat(media.sweep()).isEqualTo(1);
        assertThat(ids()).containsExactlyInAnyOrder(avatar, finished);
        jdbc.sql("update media set created_at = now() - interval '8 days'").update();
        assertThat(media.sweep()).isEqualTo(1);
        assertThat(ids()).containsExactly(avatar); // in use, however old
        assertThat(storage.size(finishedKey)).isEmpty();
        assertThat(started).isNotEqualTo(finished);

        mvc.perform(delete("/v1/me").header("Authorization", maya)).andExpect(status().isNoContent());
        assertThat(media.sweep()).isEqualTo(1);
        assertThat(storage.size(avatarKey)).isEmpty();
        assertThat(storage.size(avatarKey + ".w320.jpg")).isEmpty();
    }

    private java.util.List<String> ids() {
        return jdbc.sql("select id::text from media").query(String.class).list();
    }

    private String keyOf(String mediaId) {
        return jdbc.sql("select storage_key from media where id = cast(:id as uuid)")
                .param("id", mediaId)
                .query(String.class)
                .single();
    }

    /** The full-size address of one of this person's own photos, as an entry would show it. */
    private String urlOf(String token, String mediaId) throws Exception {
        String journey = journey(token, "For " + mediaId.substring(0, 8), "private", 1);
        String body = mvc.perform(post("/v1/journeys/" + journey + "/entries")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"mediaIds\":[\"%s\"]}".formatted(mediaId)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return JsonPath.read(body, "$.media[0].url");
    }

    private String colourAt(String url, int x, int y) throws Exception {
        byte[] file = mvc.perform(get(URI.create(url)))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsByteArray();
        int rgb = ImageIO.read(new ByteArrayInputStream(file)).getRGB(x, y);
        int red = (rgb >> 16) & 0xff;
        int green = (rgb >> 8) & 0xff;
        int blue = rgb & 0xff;
        if (red > 200 && green < 80 && blue < 80) {
            return "red";
        }
        if (blue > 200 && red < 80 && green < 80) {
            return "blue";
        }
        if (green > 200 && red < 80 && blue < 80) {
            return "green";
        }
        return red > 200 && blue > 200 && green < 80 ? "magenta" : "%d,%d,%d".formatted(red, green, blue);
    }

    private static BufferedImage plain(int width, int height, Color colour) {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = image.createGraphics();
        g.setColor(colour);
        g.fillRect(0, 0, width, height);
        g.dispose();
        return image;
    }

    /** A PNG that is only its first lines: the signature and the header saying how big it claims to be. */
    private static byte[] pngHeaderOnly(int width, int height, int bitDepth, int colourType) {
        byte[] header = ByteBuffer.allocate(13)
                .putInt(width)
                .putInt(height)
                .put((byte) bitDepth)
                .put((byte) colourType)
                .put((byte) 0)
                .put((byte) 0)
                .put((byte) 0)
                .array();
        CRC32 crc = new CRC32();
        crc.update("IHDR".getBytes(StandardCharsets.US_ASCII));
        crc.update(header);
        CRC32 none = new CRC32();
        none.update("IDAT".getBytes(StandardCharsets.US_ASCII));
        return ByteBuffer.allocate(8 + 4 + 4 + 13 + 4 + 12)
                .put(new byte[] {(byte) 0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a})
                .putInt(13)
                .put("IHDR".getBytes(StandardCharsets.US_ASCII))
                .put(header)
                .putInt((int) crc.getValue())
                // Where the picture itself would start. There is none: nothing may get as far as reading it.
                .putInt(0)
                .put("IDAT".getBytes(StandardCharsets.US_ASCII))
                .putInt((int) none.getValue())
                .array();
    }

    /** The same JPEG with a camera's notes put in after its first two bytes: which way is up, and a place name. */
    private static byte[] withNotes(byte[] jpeg, int orientation) {
        byte[] place = "Skogafoss".getBytes(StandardCharsets.US_ASCII);
        ByteBuffer tiff = ByteBuffer.allocate(8 + 2 + 12 + 4 + place.length);
        tiff.put((byte) 'M').put((byte) 'M').putShort((short) 42).putInt(8);
        tiff.putShort((short) 1); // one note
        tiff.putShort((short) 0x0112)
                .putShort((short) 3)
                .putInt(1)
                .putShort((short) orientation)
                .putShort((short) 0);
        tiff.putInt(0);
        tiff.put(place);
        byte[] notes = tiff.array();
        ByteBuffer out = ByteBuffer.allocate(jpeg.length + 4 + 6 + notes.length);
        out.put(jpeg, 0, 2);
        out.put((byte) 0xff).put((byte) 0xe1).putShort((short) (2 + 6 + notes.length));
        out.put(new byte[] {'E', 'x', 'i', 'f', 0, 0});
        out.put(notes);
        out.put(jpeg, 2, jpeg.length - 2);
        return out.array();
    }
}
