package app.journey.api.common;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * A ceiling on how fast one person (or, before sign-in, one address) may call the API: generous for reading,
 * tighter for changing things, tight for guessing sign-in codes. It stops a runaway loop or a script from
 * hurting everyone else.
 *
 * <p>The counts are kept in this copy of the API's memory, per minute. With several copies running, each has
 * its own count; that is good enough to stop abuse, and a shared limit at the edge can be added later.
 */
@Configuration
public class RateLimit implements HandlerInterceptor, WebMvcConfigurer {

  private record Window(long minute, AtomicInteger count) {}

  private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();
  private final boolean enabled;
  private final int reads;
  private final int writes;
  private final int signIns;

  RateLimit(
      @Value("${journey.rate-limit.enabled:true}") boolean enabled,
      @Value("${journey.rate-limit.reads-per-minute:600}") int reads,
      @Value("${journey.rate-limit.writes-per-minute:120}") int writes,
      @Value("${journey.rate-limit.sign-ins-per-minute:10}") int signIns) {
    this.enabled = enabled;
    this.reads = reads;
    this.writes = writes;
    this.signIns = signIns;
  }

  @Override
  public void addInterceptors(InterceptorRegistry registry) {
    registry.addInterceptor(this).addPathPatterns("/v1/**", "/local-auth/**").order(-10);
  }

  @Override
  public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
    if (!enabled) {
      return true;
    }
    boolean signIn = request.getRequestURI().startsWith("/local-auth/");
    boolean read = "GET".equals(request.getMethod()) || "HEAD".equals(request.getMethod()) || "OPTIONS".equals(request.getMethod());
    String kind = signIn ? "signin" : read ? "read" : "write";
    int ceiling = signIn ? signIns : read ? reads : writes;
    long minute = System.currentTimeMillis() / 60_000;
    Window window = windows.compute(kind + ":" + who(request), (key, current) ->
        current == null || current.minute() != minute ? new Window(minute, new AtomicInteger()) : current);
    if (window.count().incrementAndGet() > ceiling) {
      response.setHeader("Retry-After", String.valueOf(60 - (System.currentTimeMillis() / 1000) % 60));
      throw new ApiProblem(HttpStatus.TOO_MANY_REQUESTS, "slow_down", "That's a lot at once. Wait a minute and try again.");
    }
    if (windows.size() > 50_000) {
      windows.values().removeIf(old -> old.minute() != minute); // forget everyone who has been quiet since last minute
    }
    return true;
  }

  /** The signed-in person, or the caller's address when nobody is signed in yet. */
  private static String who(HttpServletRequest request) {
    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
    return auth instanceof JwtAuthenticationToken token ? token.getToken().getSubject() : request.getRemoteAddr();
  }
}
