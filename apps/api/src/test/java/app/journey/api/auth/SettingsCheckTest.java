package app.journey.api.auth;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

/** Where real people use the API, everything that is switched on has what it needs, or the API says what is missing. */
class SettingsCheckTest {

    /** The first deploy the runbook describes: sign-in and photos connected, everything else switched off. */
    private static MockEnvironment firstDeploy() {
        return new MockEnvironment()
                .withProperty("journey.auth.mode", "supabase")
                .withProperty("journey.auth.supabase.url", "https://project.supabase.co")
                .withProperty("journey.auth.supabase.service-key", "service-key")
                .withProperty("journey.media.mode", "r2")
                .withProperty("journey.media.r2.endpoint", "https://account.r2.cloudflarestorage.com")
                .withProperty("journey.media.r2.bucket", "journey-media")
                .withProperty("journey.media.r2.access-key-id", "id")
                .withProperty("journey.media.r2.secret-access-key", "secret")
                .withProperty("journey.media.r2.public-url", "https://media.example.org")
                .withProperty("journey.video.mode", "off")
                .withProperty("journey.push.mode", "off")
                .withProperty("journey.email.mode", "off")
                .withProperty("journey.moderation.mode", "off")
                .withProperty("journey.public-url", "https://journey-api.fly.dev");
    }

    @Test
    void theFirstDeployStartsWithSignInAndPhotosAndTheRestSwitchedOff() {
        assertThatCode(() -> SettingsCheck.check(firstDeploy())).doesNotThrowAnyException();
    }

    @Test
    void everythingThatIsMissingIsNamedInOneList() {
        MockEnvironment nothingSet = new MockEnvironment()
                .withProperty("journey.auth.mode", "supabase")
                .withProperty("journey.media.mode", "r2")
                .withProperty("journey.video.mode", "mux")
                .withProperty("journey.email.mode", "resend")
                .withProperty("journey.email.from", "Journey <hello@example.com>")
                .withProperty("journey.moderation.mode", "rekognition")
                .withProperty("journey.admin.password", "review");
        assertThatThrownBy(() -> SettingsCheck.check(nothingSet))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("SUPABASE_URL")
                .hasMessageContaining("SUPABASE_SERVICE_KEY")
                .hasMessageContaining("R2_ENDPOINT")
                .hasMessageContaining("R2_PUBLIC_URL")
                .hasMessageContaining("MUX_TOKEN_ID")
                .hasMessageContaining("MUX_WEBHOOK_SECRET")
                .hasMessageContaining("JOURNEY_VIDEO_MODE=off")
                .hasMessageContaining("RESEND_API_KEY")
                .hasMessageContaining("JOURNEY_EMAIL_FROM")
                .hasMessageContaining("AWS_ACCESS_KEY_ID")
                .hasMessageContaining("JOURNEY_MODERATION_MODE=off")
                .hasMessageContaining("JOURNEY_PUBLIC_URL")
                .hasMessageContaining("JOURNEY_ADMIN_PASSWORD: at least 20 characters")
                .hasMessageContaining("docs/08-connect-services.md");
    }

    @Test
    void eachServiceThatIsSwitchedOnLaterNeedsItsOwnKeys() {
        MockEnvironment withClips = firstDeploy().withProperty("journey.video.mode", "mux");
        assertThatThrownBy(() -> SettingsCheck.check(withClips))
                .hasMessageContaining("MUX_TOKEN_SECRET")
                .hasMessageNotContaining("RESEND_API_KEY");
        withClips
                .withProperty("journey.video.mux.token-id", "id")
                .withProperty("journey.video.mux.token-secret", "secret")
                .withProperty("journey.video.mux.webhook-secret", "whsec");
        assertThatCode(() -> SettingsCheck.check(withClips)).doesNotThrowAnyException();

        // Links in emails and on shared pages must be https addresses people can open.
        MockEnvironment plain = firstDeploy().withProperty("journey.public-url", "http://localhost:8080");
        assertThatThrownBy(() -> SettingsCheck.check(plain)).hasMessageContaining("JOURNEY_PUBLIC_URL");
        // A long reviewers' password is fine; none at all means the reviewer's pages don't exist.
        assertThatCode(() -> SettingsCheck.check(
                        firstDeploy().withProperty("journey.admin.password", "a-long-password-from-a-manager")))
                .doesNotThrowAnyException();
    }

    @Test
    void onADevelopersComputerNothingIsAsked() {
        MockEnvironment local = new MockEnvironment().withProperty("journey.auth.mode", "local");
        local.setActiveProfiles("local");
        assertThatCode(() -> SettingsCheck.check(local)).doesNotThrowAnyException();
    }
}
