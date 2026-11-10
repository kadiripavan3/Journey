package app.journey.api.common;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.BucketConfiguration;
import io.github.bucket4j.ConsumptionProbe;
import io.github.bucket4j.distributed.ExpirationAfterWriteStrategy;
import io.github.bucket4j.distributed.jdbc.PrimaryKeyMapper;
import io.github.bucket4j.postgresql.Bucket4jPostgreSQL;
import io.github.bucket4j.postgresql.PostgreSQLSelectForUpdateBasedProxyManager;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * A ceiling on how fast one person (or, before sign-in, one address) may call the API: generous for reading,
 * tighter for changing things, tight for guessing sign-in codes. It stops a runaway loop or a script from
 * hurting everyone else. The counting is done by Bucket4j.
 *
 * <p>Changes and sign-in attempts are counted in PostgreSQL, so the ceiling holds across every copy of the API.
 * Reads are counted in this copy's memory: there are far more of them, a database write for each would cost
 * more than it protects, and a per-copy ceiling is enough to stop a loop.
 */
@Configuration
public class RateLimit implements HandlerInterceptor, WebMvcConfigurer {

    private static final Duration MINUTE = Duration.ofMinutes(1);

    private final boolean enabled;
    private final Bandwidth reads;
    private final BucketConfiguration writes;
    private final BucketConfiguration signIns;
    private final PostgreSQLSelectForUpdateBasedProxyManager<String> shared;
    private final ConcurrentHashMap<String, Bucket> readers = new ConcurrentHashMap<>();
    private final Jobs jobs;

    RateLimit(
            DataSource dataSource,
            Jobs jobs,
            @Value("${journey.rate-limit.enabled:true}") boolean enabled,
            @Value("${journey.rate-limit.reads-per-minute:600}") int reads,
            @Value("${journey.rate-limit.writes-per-minute:120}") int writes,
            @Value("${journey.rate-limit.sign-ins-per-minute:10}") int signIns) {
        this.jobs = jobs;
        this.enabled = enabled;
        this.reads = perMinute(reads);
        this.writes = BucketConfiguration.builder().addLimit(perMinute(writes)).build();
        this.signIns =
                BucketConfiguration.builder().addLimit(perMinute(signIns)).build();
        this.shared = Bucket4jPostgreSQL.selectForUpdateBasedBuilder(dataSource)
                .primaryKeyMapper(PrimaryKeyMapper.STRING)
                .table("rate_limits")
                .idColumn("id")
                .stateColumn("state")
                .expiresAtColumn("expires_at")
                .expirationAfterWrite(
                        ExpirationAfterWriteStrategy.basedOnTimeForRefillingBucketUpToMax(Duration.ofMinutes(5)))
                .build();
    }

    /** A full allowance to start with, topped up evenly over the minute. */
    private static Bandwidth perMinute(int allowance) {
        return Bandwidth.builder()
                .capacity(allowance)
                .refillGreedy(allowance, MINUTE)
                .build();
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(this)
                .addPathPatterns("/v1/**", "/local-auth/**", "/delete-account")
                .order(-10);
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (!enabled) {
            return true;
        }
        String who = who(request);
        ConsumptionProbe probe;
        // Signing in, and the public form that asks for an account to be deleted, share the small allowance.
        if (request.getRequestURI().startsWith("/local-auth/")
                || (request.getRequestURI().equals("/delete-account") && !isRead(request))) {
            probe = shared.builder().build("signin:" + who, () -> signIns).tryConsumeAndReturnRemaining(1);
        } else if (isRead(request)) {
            if (readers.size() > 50_000) {
                readers.clear(); // everyone starts the minute afresh; far better than growing without end
            }
            probe = readers.computeIfAbsent(
                            who, key -> Bucket.builder().addLimit(reads).build())
                    .tryConsumeAndReturnRemaining(1);
        } else {
            probe = shared.builder().build("write:" + who, () -> writes).tryConsumeAndReturnRemaining(1);
        }
        if (!probe.isConsumed()) {
            response.setHeader(
                    "Retry-After",
                    String.valueOf(Math.max(1, TimeUnit.NANOSECONDS.toSeconds(probe.getNanosToWaitForRefill()))));
            throw new ApiProblem(
                    HttpStatus.TOO_MANY_REQUESTS, "slow_down", "That's a lot at once. Wait a minute and try again.");
        }
        return true;
    }

    /** Each night, forget the people who have been quiet: their allowance is full again anyway. */
    @Scheduled(cron = "${journey.rate-limit.cleanup-cron:0 45 3 * * *}", zone = "UTC")
    void forgetQuietPeople() {
        if (jobs.claim("rate_limit_cleanup", LocalDate.now(ZoneOffset.UTC).toString())) {
            while (shared.removeExpired(1000) > 0) {
                // keep going until none are left
            }
        }
    }

    private static boolean isRead(HttpServletRequest request) {
        return "GET".equals(request.getMethod())
                || "HEAD".equals(request.getMethod())
                || "OPTIONS".equals(request.getMethod());
    }

    /** The signed-in person, or the caller's address when nobody is signed in yet. */
    private static String who(HttpServletRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth instanceof JwtAuthenticationToken token ? token.getToken().getSubject() : request.getRemoteAddr();
    }
}
