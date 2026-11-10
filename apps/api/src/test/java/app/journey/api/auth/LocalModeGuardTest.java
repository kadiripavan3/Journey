package app.journey.api.auth;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

/** The stand-ins can't be switched on by a setting alone. */
class LocalModeGuardTest {

    @Test
    void localSignInWithoutTheLocalProfileStopsTheApiFromStarting() {
        MockEnvironment production = new MockEnvironment().withProperty("journey.auth.mode", "local");
        assertThatThrownBy(() -> LocalModeGuard.check(production))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("journey.auth.mode=local")
                .hasMessageContaining("'local' profile");

        MockEnvironment seeded = new MockEnvironment()
                .withProperty("journey.seed.enabled", "true")
                .withProperty("journey.media.mode", "local");
        assertThatThrownBy(() -> LocalModeGuard.check(seeded))
                .hasMessageContaining("journey.seed.enabled")
                .hasMessageContaining("journey.media.mode");
    }

    @Test
    void pushesAndEmailsThatOnlyGoToTheLogNeedTheLocalProfileToo() {
        MockEnvironment quiet = new MockEnvironment()
                .withProperty("journey.push.mode", "local")
                .withProperty("journey.email.mode", "local");
        assertThatThrownBy(() -> LocalModeGuard.check(quiet))
                .hasMessageContaining("journey.push.mode=local")
                .hasMessageContaining("journey.email.mode=local");
        MockEnvironment real = new MockEnvironment()
                .withProperty("journey.push.mode", "expo")
                .withProperty("journey.email.mode", "resend");
        assertThatCode(() -> LocalModeGuard.check(real)).doesNotThrowAnyException();
    }

    @Test
    void theSameSettingsAreFineOnADevelopersComputerAndInTests() {
        MockEnvironment local = new MockEnvironment().withProperty("journey.auth.mode", "local");
        local.setActiveProfiles("local");
        assertThatCode(() -> LocalModeGuard.check(local)).doesNotThrowAnyException();
        MockEnvironment real = new MockEnvironment()
                .withProperty("journey.auth.mode", "supabase")
                .withProperty("journey.media.mode", "r2");
        assertThatCode(() -> LocalModeGuard.check(real)).doesNotThrowAnyException();
    }

    @Test
    void aSwitchSetToAWordNobodyKnowsStopsTheApiFromStartingAndSaysWhatItCanBe() {
        MockEnvironment typo = new MockEnvironment().withProperty("journey.video.mode", "muxx");
        typo.setActiveProfiles("local");
        assertThatThrownBy(() -> LocalModeGuard.check(typo))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("journey.video.mode=muxx")
                .hasMessageContaining("mux, off, local");
        // Switched off is a word it knows, with or without the local profile.
        MockEnvironment later = new MockEnvironment()
                .withProperty("journey.video.mode", "off")
                .withProperty("journey.push.mode", "off")
                .withProperty("journey.email.mode", "off")
                .withProperty("journey.moderation.mode", "off");
        assertThatCode(() -> LocalModeGuard.check(later)).doesNotThrowAnyException();
    }
}
