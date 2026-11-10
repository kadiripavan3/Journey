package app.journey.api.auth;

import java.util.ArrayList;
import java.util.List;
import org.springframework.boot.context.event.ApplicationEnvironmentPreparedEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;

/**
 * The stand-ins (sign in with any email and a fixed code, files on this computer's disk, sample people) are
 * for building and testing. One setting must never be enough to switch them on where real people are: they
 * work only together with the {@code local} or {@code test} profile, and the API refuses to start otherwise.
 *
 * <p>It runs as soon as the settings are known, before anything connects to the database (it is listed in
 * {@code META-INF/spring.factories}).
 */
public class LocalModeGuard implements ApplicationListener<ApplicationEnvironmentPreparedEvent> {

    @Override
    public void onApplicationEvent(ApplicationEnvironmentPreparedEvent event) {
        check(event.getEnvironment());
    }

    static void check(Environment environment) {
        if (environment.acceptsProfiles(Profiles.of("local", "test"))) {
            return;
        }
        List<String> on = new ArrayList<>();
        if ("local".equals(environment.getProperty("journey.auth.mode"))) {
            on.add("journey.auth.mode=local (anyone can sign in as anyone)");
        }
        if ("local".equals(environment.getProperty("journey.media.mode"))) {
            on.add("journey.media.mode=local (uploads on this computer's disk)");
        }
        if ("local".equals(environment.getProperty("journey.places.mode"))) {
            on.add("journey.places.mode=local (a place search from a bundled list)");
        }
        if ("local".equals(environment.getProperty("journey.video.mode"))) {
            on.add("journey.video.mode=local (clips served from this computer's disk, unconverted)");
        }
        if (environment.getProperty("journey.seed.enabled", Boolean.class, false)) {
            on.add("journey.seed.enabled=true (sample people and journeys)");
        }
        if (!on.isEmpty()) {
            throw new IllegalStateException(
                    "These settings are for building and testing only and need the 'local' profile: "
                            + String.join("; ", on)
                            + ". Start with -Dspring.profiles.active=local on your own computer, or remove them here.");
        }
    }
}
