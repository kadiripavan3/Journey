package app.journey.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.endsWith;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * Clips with the real video service's adapter, against a pretend Mux on this computer: the phone gets Mux's
 * one-time upload link, the clip is "processing" until Mux's signed call says it is ready, and readers see it
 * only then.
 */
class MuxClipsTest extends ApiTest {

    private static final String SECRET = "whsec-test";
    private static final HttpServer MUX;
    private static final List<String> CALLS = new CopyOnWriteArrayList<>();
    private static volatile String lastAuthorization;
    private static volatile String lastBody;
    private static volatile boolean down;

    static {
        try {
            MUX = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
        MUX.createContext("/", exchange -> {
            String path = exchange.getRequestURI().getPath();
            CALLS.add(exchange.getRequestMethod() + " " + path);
            lastAuthorization = exchange.getRequestHeaders().getFirst("Authorization");
            lastBody = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            byte[] answer = new byte[0];
            int code = 204;
            if (down) {
                code = 500;
                answer = "{\"error\":{\"type\":\"internal\",\"messages\":[\"down\"]}}".getBytes(StandardCharsets.UTF_8);
            } else if (exchange.getRequestMethod().equals("POST") && path.equals("/video/v1/uploads")) {
                code = 201;
                int n = (int)
                        CALLS.stream().filter(call -> call.startsWith("POST")).count();
                answer = ("{\"data\":{\"id\":\"upl_%d\",\"url\":\"https://storage.example/upload/upl_%d?token=abc\","
                                + "\"status\":\"waiting\",\"timeout\":3600,\"cors_origin\":\"*\"}}")
                        .formatted(n, n)
                        .getBytes(StandardCharsets.UTF_8);
            }
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(code, answer.length == 0 ? -1 : answer.length);
            if (answer.length > 0) {
                exchange.getResponseBody().write(answer);
            }
            exchange.close();
        });
        MUX.start();
    }

    @DynamicPropertySource
    static void useThePretendMux(DynamicPropertyRegistry settings) {
        settings.add("journey.video.mode", () -> "mux");
        settings.add(
                "journey.video.mux.api-url",
                () -> "http://127.0.0.1:" + MUX.getAddress().getPort());
        settings.add("journey.video.mux.token-id", () -> "token-id");
        settings.add("journey.video.mux.token-secret", () -> "token-secret");
        settings.add("journey.video.mux.webhook-secret", () -> SECRET);
    }

    @AfterAll
    static void stop() {
        MUX.stop(0);
    }

    @BeforeEach
    void quiet() {
        CALLS.clear();
        down = false;
    }

    private String startClip(String token) throws Exception {
        return mvc.perform(post("/v1/media/uploads")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kind\":\"video\",\"contentType\":\"video/quicktime\",\"durationSeconds\":40}"))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
    }

    /** A call the way Mux makes it: the body, and "t=<time>,v1=<HMAC of time.body>". */
    private MockHttpServletRequestBuilder fromMux(String body, Instant at, String secret) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        String time = String.valueOf(at.getEpochSecond());
        String signature = HexFormat.of().formatHex(mac.doFinal((time + "." + body).getBytes(StandardCharsets.UTF_8)));
        return post("/webhooks/mux")
                .contentType(MediaType.APPLICATION_JSON)
                .header("Mux-Signature", "t=" + time + ",v1=" + signature)
                .content(body);
    }

    private static String ready(String mediaId, String asset, String playback, double seconds) {
        return ("{\"type\":\"video.asset.ready\",\"object\":{\"type\":\"asset\",\"id\":\"%s\"},\"data\":{\"id\":\"%s\","
                        + "\"status\":\"ready\",\"duration\":%s,\"passthrough\":\"%s\",\"playback_ids\":[{\"id\":\"%s\",\"policy\":\"public\"}]}}")
                .formatted(asset, asset, seconds, mediaId, playback);
    }

    @Test
    void aClipIsProcessingUntilMuxSaysItIsReadyAndReadersSeeItOnlyThen() throws Exception {
        String kai = person("kai");
        String reader = person("reader");
        String journey = journey(kai, "Learn to surf", "public", 6);

        // The phone is sent to Mux's own one-time link, and Mux was asked with the access token.
        String target = startClip(kai);
        String clip = JsonPath.read(target, "$.mediaId");
        assertThat(JsonPath.<String>read(target, "$.uploadUrl")).startsWith("https://storage.example/upload/upl_");
        assertThat(JsonPath.<String>read(target, "$.method")).isEqualTo("PUT");
        assertThat(CALLS).containsExactly("POST /video/v1/uploads");
        assertThat(lastAuthorization)
                .isEqualTo("Basic "
                        + Base64.getEncoder().encodeToString("token-id:token-secret".getBytes(StandardCharsets.UTF_8)));
        assertThat(lastBody).contains("\"passthrough\":\"" + clip + "\"").contains("\"public\"");

        // Sent: it can go on an entry while Mux converts it. Kai sees it as processing; a reader doesn't see it yet.
        mvc.perform(post("/v1/media/uploads/" + clip + "/complete").header("Authorization", kai))
                .andExpect(status().isNoContent());
        String entry = JsonPath.read(
                mvc.perform(post("/v1/journeys/" + journey + "/entries")
                                .header("Authorization", kai)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"title\":\"Stood up\",\"mediaIds\":[\"%s\"]}".formatted(clip)))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.media[0].status").value("processing"))
                        .andExpect(jsonPath("$.media[0].playbackUrl").value(nullValue()))
                        .andExpect(jsonPath("$.media[0].url", endsWith("/share/clip.jpg")))
                        .andReturn()
                        .getResponse()
                        .getContentAsString(),
                "$.id");
        mvc.perform(get("/v1/entries/" + entry).header("Authorization", reader))
                .andExpect(jsonPath("$.title").value("Stood up"))
                .andExpect(jsonPath("$.media", hasSize(0)));

        // Only a call signed by Mux, and a recent one, changes anything.
        String body = ready(clip, "asset_1", "pb_1", 39.6);
        mvc.perform(post("/webhooks/mux")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("bad_signature"));
        mvc.perform(fromMux(body, Instant.now(), "someone-elses-secret")).andExpect(status().isUnauthorized());
        mvc.perform(fromMux(body, Instant.now().minusSeconds(3600), SECRET)).andExpect(status().isUnauthorized());
        mvc.perform(post("/webhooks/mux")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Mux-Signature", "nonsense")
                        .content(body))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/v1/entries/" + entry).header("Authorization", reader))
                .andExpect(jsonPath("$.media", hasSize(0)));

        mvc.perform(fromMux(body, Instant.now(), SECRET)).andExpect(status().isNoContent());
        mvc.perform(fromMux(body, Instant.now(), SECRET)).andExpect(status().isNoContent()); // Mux may say it twice

        mvc.perform(get("/v1/entries/" + entry).header("Authorization", reader))
                .andExpect(jsonPath("$.media[0].status").value("ready"))
                .andExpect(jsonPath("$.media[0].playbackUrl").value("https://stream.mux.com/pb_1.m3u8"))
                .andExpect(jsonPath(
                        "$.media[0].url", containsString("https://image.mux.com/pb_1/thumbnail.jpg?width=1280")))
                .andExpect(jsonPath("$.media[0].thumbUrl", containsString("width=640")))
                .andExpect(jsonPath("$.media[0].durationSeconds").value(40));

        // Deleting the account removes the clip at Mux as well.
        CALLS.clear();
        mvc.perform(delete("/v1/me").header("Authorization", kai)).andExpect(status().isNoContent());
        assertThat(CALLS).containsExactly("DELETE /video/v1/assets/asset_1");
    }

    @Test
    void aClipThatTurnsOutTooLongOrCannotBeConvertedFails() throws Exception {
        String kai = person("kai");
        String reader = person("reader");
        String journey = journey(kai, "Learn to surf", "public", 6);
        String tooLong = JsonPath.read(startClip(kai), "$.mediaId");
        String broken = JsonPath.read(startClip(kai), "$.mediaId");
        for (String clip : List.of(tooLong, broken)) {
            mvc.perform(post("/v1/media/uploads/" + clip + "/complete").header("Authorization", kai))
                    .andExpect(status().isNoContent());
        }
        String entry = JsonPath.read(
                mvc.perform(post("/v1/journeys/" + journey + "/entries")
                                .header("Authorization", kai)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"title\":\"Two clips\",\"mediaIds\":[\"%s\",\"%s\"]}"
                                        .formatted(tooLong, broken)))
                        .andExpect(status().isCreated())
                        .andReturn()
                        .getResponse()
                        .getContentAsString(),
                "$.id");
        CALLS.clear();

        // The app said 40 seconds; Mux measured 75. It is refused and removed there.
        mvc.perform(fromMux(ready(tooLong, "asset_long", "pb_long", 75.2), Instant.now(), SECRET))
                .andExpect(status().isNoContent());
        assertThat(CALLS).containsExactly("DELETE /video/v1/assets/asset_long");
        mvc.perform(fromMux(
                        "{\"type\":\"video.asset.errored\",\"data\":{\"id\":\"asset_bad\",\"passthrough\":\"%s\"}}"
                                .formatted(broken),
                        Instant.now(),
                        SECRET))
                .andExpect(status().isNoContent());

        mvc.perform(get("/v1/entries/" + entry).header("Authorization", kai))
                .andExpect(jsonPath("$.media[*].status", org.hamcrest.Matchers.contains("failed", "failed")))
                .andExpect(jsonPath("$.media[0].playbackUrl").value(nullValue()));
        mvc.perform(get("/v1/entries/" + entry).header("Authorization", reader))
                .andExpect(jsonPath("$.media", hasSize(0)));
        // A failed clip can't be put on anything new.
        mvc.perform(post("/v1/journeys/" + journey + "/entries")
                        .header("Authorization", kai)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"mediaIds\":[\"%s\"]}".formatted(broken)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("media_not_ready"))
                .andExpect(jsonPath("$.detail").value("A clip couldn't be used. Remove it and add it again."));
    }

    @Test
    void callsAboutOtherThingsAreIgnoredAndUnreadableOnesRefused() throws Exception {
        mvc.perform(fromMux("{\"type\":\"video.asset.created\",\"data\":{\"id\":\"a\"}}", Instant.now(), SECRET))
                .andExpect(status().isNoContent());
        mvc.perform(fromMux(ready("not-a-media-id", "a", "p", 3), Instant.now(), SECRET))
                .andExpect(status().isNoContent());
        // A clip whose record is gone (deleted while converting) is removed at Mux too.
        CALLS.clear();
        mvc.perform(fromMux(
                        ready("00000000-0000-0000-0000-000000000001", "asset_orphan", "p", 3), Instant.now(), SECRET))
                .andExpect(status().isNoContent());
        assertThat(CALLS).containsExactly("DELETE /video/v1/assets/asset_orphan");
        mvc.perform(fromMux("not json", Instant.now(), SECRET))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("bad_request"));
    }

    @Test
    void whenMuxIsDownTheAppGetsAClearAnswer() throws Exception {
        String kai = person("kai");
        down = true;
        mvc.perform(post("/v1/media/uploads")
                        .header("Authorization", kai)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kind\":\"video\",\"contentType\":\"video/mp4\",\"durationSeconds\":10}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("video_unavailable"))
                .andExpect(jsonPath("$.detail").value("Clips can't be uploaded right now. Try again in a moment."));
        // Photos don't depend on it.
        down = false;
        uploadPhoto(kai);
    }
}
