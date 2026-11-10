package app.journey.api.auth;

import app.journey.api.common.ApiProblem;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Set;
import java.util.UUID;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Someone can be signed in before they have a profile: that is what the sign-up steps are for. Until the
 * profile exists they may look around, upload their picture and save the profile, and nothing else. Every
 * other change is refused here with a clear answer, so no feature has to think about a person who is only
 * half there.
 */
@Configuration
class ProfileGuard implements HandlerInterceptor, WebMvcConfigurer {

  private static final Set<String> CHANGES = Set.of("POST", "PUT", "PATCH", "DELETE");

  private final JdbcClient jdbc;

  ProfileGuard(JdbcClient jdbc) {
    this.jdbc = jdbc;
  }

  @Override
  public void addInterceptors(InterceptorRegistry registry) {
    // Saving or deleting the profile itself, and uploads (the profile picture comes first), don't need one yet.
    registry.addInterceptor(this).addPathPatterns("/v1/**").excludePathPatterns("/v1/me", "/v1/me/profile", "/v1/media/**");
  }

  @Override
  public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
    if (!CHANGES.contains(request.getMethod())) {
      return true;
    }
    Authentication who = SecurityContextHolder.getContext().getAuthentication();
    if (who instanceof JwtAuthenticationToken token) {
      UUID id = UUID.fromString(token.getToken().getSubject());
      boolean hasProfile = jdbc.sql("select exists (select 1 from profiles where id = :id)").param("id", id).query(Boolean.class).single();
      if (!hasProfile) {
        throw ApiProblem.conflict("profile_required", "Finish setting up your profile first.");
      }
    }
    return true;
  }
}
