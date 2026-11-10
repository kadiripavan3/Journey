package app.journey.api.media;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import org.junit.jupiter.api.Test;

/**
 * Mux's signature, checked against a value worked out with a different tool than the code under test:
 *
 * <pre>printf '%s' '1700000000.{"type":"video.asset.ready","data":{"id":"asset-1"}}' \
 *   | openssl dgst -sha256 -hmac 'whsec-for-the-test'</pre>
 */
class MuxSignatureTest {

    private static final byte[] BODY =
            "{\"type\":\"video.asset.ready\",\"data\":{\"id\":\"asset-1\"}}".getBytes(StandardCharsets.UTF_8);
    private static final String SIGNATURE = "e8ae096681eff7d910d6e8a5a24221e12363845beab7a52c7268e4ac0f412d56";
    private static final Instant SENT = Instant.ofEpochSecond(1_700_000_000L);

    private final MuxWebhookController mux = new MuxWebhookController(null, "whsec-for-the-test");

    @Test
    void aCallSignedTheWayMuxSignsItIsAccepted() {
        assertThat(mux.signedByMux("t=1700000000,v1=" + SIGNATURE, BODY, SENT)).isTrue();
        assertThat(mux.signedByMux("t=1700000000, v1=" + SIGNATURE, BODY, SENT.plusSeconds(200)))
                .as("a space after the comma, and a few minutes on the way")
                .isTrue();
    }

    @Test
    void anythingElseIsRefused() {
        String header = "t=1700000000,v1=" + SIGNATURE;
        assertThat(mux.signedByMux(header, "{\"type\":\"video.asset.ready\"}".getBytes(StandardCharsets.UTF_8), SENT))
                .as("another body")
                .isFalse();
        assertThat(mux.signedByMux("t=1700000001,v1=" + SIGNATURE, BODY, SENT))
                .as("another time than the one that was signed")
                .isFalse();
        assertThat(mux.signedByMux(
                        header, BODY, SENT.plus(MuxWebhookController.TOLERANCE).plusSeconds(1)))
                .as("played back later")
                .isFalse();
        assertThat(mux.signedByMux(
                        header, BODY, SENT.minus(MuxWebhookController.TOLERANCE).minusSeconds(1)))
                .as("dated in the future")
                .isFalse();
        assertThat(new MuxWebhookController(null, "another-secret").signedByMux(header, BODY, SENT))
                .as("signed with another secret")
                .isFalse();
        for (String broken : new String[] {null, "", "v1=" + SIGNATURE, "t=1700000000", "t=soon,v1=" + SIGNATURE}) {
            assertThat(mux.signedByMux(broken, BODY, SENT))
                    .as(String.valueOf(broken))
                    .isFalse();
        }
    }

    @Test
    void withoutTheSecretTheApiSaysWhatIsMissing() {
        assertThatThrownBy(() -> new MuxWebhookController(null, " "))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("MUX_WEBHOOK_SECRET");
    }
}
