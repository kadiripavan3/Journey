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

    MockEnvironment seeded = new MockEnvironment().withProperty("journey.seed.enabled", "true").withProperty("journey.media.mode", "local");
    assertThatThrownBy(() -> LocalModeGuard.check(seeded)).hasMessageContaining("journey.seed.enabled").hasMessageContaining("journey.media.mode");
  }

  @Test
  void theSameSettingsAreFineOnADevelopersComputerAndInTests() {
    MockEnvironment local = new MockEnvironment().withProperty("journey.auth.mode", "local");
    local.setActiveProfiles("local");
    assertThatCode(() -> LocalModeGuard.check(local)).doesNotThrowAnyException();
    MockEnvironment real = new MockEnvironment().withProperty("journey.auth.mode", "supabase").withProperty("journey.media.mode", "r2");
    assertThatCode(() -> LocalModeGuard.check(real)).doesNotThrowAnyException();
  }
}
