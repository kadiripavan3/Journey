package app.journey.api.moderation;

import jakarta.servlet.http.HttpServletResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.WebAuthenticationDetails;

/**
 * Who may open the reviewer's pages under /admin. They are not part of the app: a reviewer opens them in a
 * browser, which asks for a name and the reviewers' password ({@code JOURNEY_ADMIN_PASSWORD}). The name is
 * whatever the reviewer types; it is written next to everything they do. With no password set the pages
 * don't exist at all. An address that gets the password wrong ten times waits ten minutes, so it can't be
 * guessed by trying.
 */
@Configuration
class ReviewerSecurity {

    @Bean
    @Order(1) // before the rules for the API itself, which would turn /admin away
    SecurityFilterChain reviewers(HttpSecurity http, @Value("${journey.admin.password:}") String password)
            throws Exception {
        http.securityMatcher("/admin", "/admin/**");
        if (password.isBlank()) {
            http.authorizeHttpRequests(requests -> requests.anyRequest().denyAll())
                    .exceptionHandling(failures -> failures.authenticationEntryPoint((request, response, failure) ->
                                    response.setStatus(HttpServletResponse.SC_NOT_FOUND))
                            .accessDeniedHandler((request, response, denied) ->
                                    response.setStatus(HttpServletResponse.SC_NOT_FOUND)));
        } else {
            // Forms on these pages carry Spring's token against cross-site requests (on by default here).
            http.authorizeHttpRequests(requests -> requests.anyRequest().authenticated())
                    .authenticationProvider(new ReviewerSignIn(password))
                    .httpBasic(basic -> basic.realmName("Journey reviewers"));
        }
        return http.build();
    }

    /** Any name, with the reviewers' password. Wrong passwords are counted per address, in this copy of the API. */
    private static final class ReviewerSignIn implements AuthenticationProvider {

        private static final int TRIES = 10;
        private static final Duration WAIT = Duration.ofMinutes(10);

        private record Misses(int count, Instant since) {}

        private final String password;
        private final ConcurrentHashMap<String, Misses> misses = new ConcurrentHashMap<>();

        ReviewerSignIn(String password) {
            this.password = password;
        }

        @Override
        public Authentication authenticate(Authentication attempt) {
            String from = attempt.getDetails() instanceof WebAuthenticationDetails details
                    ? String.valueOf(details.getRemoteAddress())
                    : "unknown";
            Instant now = Instant.now();
            Misses before = misses.computeIfPresent(
                    from, (address, kept) -> kept.since().plus(WAIT).isBefore(now) ? null : kept);
            if (before != null && before.count() >= TRIES) {
                throw new LockedException("Too many wrong passwords from this address. Wait ten minutes.");
            }
            String name = attempt.getName() == null ? "" : attempt.getName().trim();
            String given = String.valueOf(attempt.getCredentials());
            boolean right = MessageDigest.isEqual(
                    given.getBytes(StandardCharsets.UTF_8), password.getBytes(StandardCharsets.UTF_8));
            if (!right || name.isEmpty() || name.length() > 60) {
                if (misses.size() > 10_000) {
                    misses.clear(); // better that everyone starts afresh than that the list grows without end
                }
                misses.merge(from, new Misses(1, now), (kept, one) -> new Misses(kept.count() + 1, kept.since()));
                throw new BadCredentialsException("Not a reviewer");
            }
            misses.remove(from);
            return UsernamePasswordAuthenticationToken.authenticated(
                    name, null, List.of(new SimpleGrantedAuthority("ROLE_REVIEWER")));
        }

        @Override
        public boolean supports(Class<?> authentication) {
            return UsernamePasswordAuthenticationToken.class.isAssignableFrom(authentication);
        }
    }
}
