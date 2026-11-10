package app.journey.api.auth;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * How people sign in.
 *
 * <ul>
 *   <li>{@code local}: the API hands out its own tokens for any email and a fixed test code. For
 *       building and testing without outside accounts. Never for production.
 *   <li>{@code supabase}: tokens come from Supabase Auth. Connected in a later step.
 * </ul>
 */
@ConfigurationProperties("journey.auth")
public record AuthProperties(String mode, Local local) {

  public record Local(String secret, String code, Duration tokenTtl) {}

  public boolean isLocal() {
    return "local".equals(mode);
  }
}
