package app.journey.api.notify;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.journey.api.notify.EmailSender.Email;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.stream.IntStream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * The adapters for the real push and email services, tried against a small stand-in server that answers the
 * way those services do. No account and no network are needed.
 */
class OutsideServicesTest {

    private record Call(String path, String authorization, String idempotencyKey, String body) {}

    private HttpServer server;
    private final List<Call> calls = new CopyOnWriteArrayList<>();
    private final List<String> answers = new ArrayList<>();
    private int status = 200;

    @BeforeEach
    void start() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            calls.add(new Call(
                    exchange.getRequestURI().getPath(),
                    exchange.getRequestHeaders().getFirst("Authorization"),
                    exchange.getRequestHeaders().getFirst("Idempotency-Key"),
                    body));
            byte[] answer = (answers.isEmpty() ? "{}" : answers.remove(0)).getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(status, answer.length);
            exchange.getResponseBody().write(answer);
            exchange.close();
        });
        server.start();
    }

    @AfterEach
    void stop() {
        server.stop(0);
    }

    private String address(String path) {
        return "http://127.0.0.1:" + server.getAddress().getPort() + path;
    }

    @Test
    void expoGetsEachPushWithWhereToOpenAndTellsUsWhichPhonesAreGone() {
        answers.add("""
                {"data":[{"status":"ok","id":"t1"},
                         {"status":"error","message":"not registered","details":{"error":"DeviceNotRegistered"}},
                         {"status":"error","message":"too big","details":{"error":"MessageTooBig"}}]}
                """);
        ExpoPushSender expo = new ExpoPushSender(address("/push/send"), "");
        Set<String> gone = expo.send(List.of(
                new PushMessage(
                        "ExponentPushToken[a]",
                        "Iceland ring road",
                        "kai liked “Skogafoss”.",
                        "/entry/1",
                        NotificationKind.LIKES),
                new PushMessage(
                        "ExponentPushToken[b]",
                        "Journey",
                        "kai started following you.",
                        "/profile/kai",
                        NotificationKind.PROFILE_FOLLOW),
                new PushMessage("ExponentPushToken[c]", "Journey", "x", "/digest", NotificationKind.WEEKLY_DIGEST)));

        // Only the phone Expo says is gone for good is forgotten; another kind of error is not a reason to.
        assertThat(gone).containsExactly("ExponentPushToken[b]");
        assertThat(calls).hasSize(1);
        Call call = calls.get(0);
        assertThat(call.path()).isEqualTo("/push/send");
        assertThat(call.authorization()).isNull();
        assertThat(call.body())
                .contains("\"to\":\"ExponentPushToken[a]\"")
                .contains("\"title\":\"Iceland ring road\"")
                .contains("\"url\":\"/entry/1\"")
                .contains("\"kind\":\"likes\"")
                .contains("\"sound\":\"default\"");
    }

    @Test
    void expoTakesAHundredAtATimeAndAnAccessTokenWhenThereIsOne() {
        answers.add("{\"data\":[]}");
        answers.add("{\"data\":[]}");
        ExpoPushSender expo = new ExpoPushSender(address("/push/send"), "secret-token");
        List<PushMessage> many = IntStream.range(0, 150)
                .mapToObj(i -> new PushMessage(
                        "ExponentPushToken[" + i + "]", "t", "b", "/digest", NotificationKind.WEEKLY_DIGEST))
                .toList();

        assertThat(expo.send(many)).isEmpty();

        assertThat(calls).hasSize(2);
        assertThat(calls.get(0).authorization()).isEqualTo("Bearer secret-token");
        assertThat(calls.get(0).body()).contains("ExponentPushToken[99]").doesNotContain("ExponentPushToken[100]");
        assertThat(calls.get(1).body()).contains("ExponentPushToken[100]").contains("ExponentPushToken[149]");
    }

    @Test
    void whenExpoCannotBeReachedTheSenderSaysSoRatherThanPretending() {
        status = 503;
        ExpoPushSender expo = new ExpoPushSender(address("/push/send"), "");
        assertThatThrownBy(() -> expo.send(List.of(
                        new PushMessage("ExponentPushToken[a]", "t", "b", "/digest", NotificationKind.WEEKLY_DIGEST))))
                .isInstanceOf(RuntimeException.class);
    }

    @Test
    void resendGetsTheEmailWithAKeyThatMakesASecondTryHarmless() {
        answers.add("{\"id\":\"email-1\"}");
        ResendEmailSender resend = new ResendEmailSender("re_test_key", address(""), "Journey <hello@journey.test>");

        resend.send(new Email(
                "nora@example.com", "This week: 2 new entries", "<p>Hi Nora</p>", "Hi Nora", "digest-nora-2026-W46"));

        assertThat(calls).hasSize(1);
        Call call = calls.get(0);
        assertThat(call.path()).isEqualTo("/emails");
        assertThat(call.authorization()).isEqualTo("Bearer re_test_key");
        assertThat(call.idempotencyKey()).isEqualTo("digest-nora-2026-W46");
        assertThat(call.body())
                .contains("\"from\":\"Journey <hello@journey.test>\"")
                .contains("nora@example.com")
                .contains("\"subject\":\"This week: 2 new entries\"")
                .contains("Hi Nora");
    }

    @Test
    void resendRefusingAnEmailIsAnErrorAndAMissingKeyStopsTheApiFromStarting() {
        status = 422;
        answers.add(
                "{\"statusCode\":422,\"name\":\"validation_error\",\"message\":\"The from address is not verified\"}");
        ResendEmailSender resend = new ResendEmailSender("re_test_key", address(""), "Journey <hello@journey.test>");
        assertThatThrownBy(() -> resend.send(new Email("nora@example.com", "s", "<p>h</p>", "t", "k")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Resend didn't take the email");

        assertThatThrownBy(() -> new ResendEmailSender(" ", address(""), "Journey <hello@journey.test>"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("RESEND_API_KEY")
                .hasMessageContaining("JOURNEY_EMAIL_MODE=off");
    }

    @Test
    void withEmailSwitchedOffNothingIsSentAndNothingBreaks() {
        new NoEmailSender().send(new Email("nora@example.com", "s", "<p>h</p>", "t", "k"));
        assertThat(calls).isEmpty();
    }

    @Test
    void aListReadsTheWayAPersonWouldSayIt() {
        assertThat(PushWording.list(List.of("A"))).isEqualTo("A");
        assertThat(PushWording.list(List.of("A", "B"))).isEqualTo("A and B");
        assertThat(PushWording.list(List.of("A", "B", "C"))).isEqualTo("A, B and C");
    }
}
