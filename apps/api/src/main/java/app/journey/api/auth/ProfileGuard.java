package app.journey.api.auth;

import app.journey.api.common.ApiProblem;
import app.journey.api.profile.ProfileStore;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Set;
import org.springframework.context.annotation.Configuration;
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

    private final ProfileStore profiles;

    ProfileGuard(ProfileStore profiles) {
        this.profiles = profiles;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // Saving or deleting the profile itself, and uploads (the profile picture comes first), don't need one yet.
        registry.addInterceptor(this)
                .addPathPatterns("/v1/**")
                .excludePathPatterns("/v1/me", "/v1/me/profile", "/v1/media/**");
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (!CHANGES.contains(request.getMethod())) {
            return true;
        }
        if (!profiles.exists(MeResolver.current().id())) {
            throw ApiProblem.conflict("profile_required", "Finish setting up your profile first.");
        }
        return true;
    }
}
