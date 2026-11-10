package app.journey.api.auth;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import org.springframework.boot.context.event.ApplicationEnvironmentPreparedEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;

/**
 * The stand-ins (sign in with any email and a fixed code, files on this computer's disk, sample people) are
 * for building and testing. One setting must never be enough to switch them on where real people are: they
 * work only together with the {@code local} or {@code test} profile, and the API refuses to start otherwise.
 *
 * <p>It also refuses a switch set to a word it doesn't know ({@code journey.video.mode=muxx}): otherwise that part
 * of the API would quietly not exist.
 *
 * <p>It runs as soon as the settings are known, before anything connects to the database (it is listed in
 * {@code META-INF/spring.factories}).
 */
public class LocalModeGuard implements ApplicationListener<ApplicationEnvironmentPreparedEvent> {

    @Override
    public void onApplicationEvent(ApplicationEnvironmentPreparedEvent event) {
        check(event.getEnvironment());
        SettingsCheck.check(event.getEnvironment());
    }

    /** Every switch and the words it understands. A word it doesn't know is a typing mistake, not "off". */
    private static final Map<String, List<String>> MODES = Map.of(
            "journey.auth.mode", List.of("supabase", "local"),
            "journey.media.mode", List.of("r2", "local"),
            "journey.video.mode", List.of("mux", "off", "local"),
            "journey.places.mode", List.of("device", "local"),
            "journey.push.mode", List.of("expo", "off", "local"),
            "journey.email.mode", List.of("resend", "off", "local"),
            "journey.moderation.mode", List.of("rekognition", "off", "local"),
            "journey.apple.mode", List.of("apple", "off"));

    static void check(Environment environment) {
        List<String> unknown = new ArrayList<>();
        new TreeMap<>(MODES).forEach((setting, words) -> {
            String value = environment.getProperty(setting);
            if (value != null && !words.contains(value)) {
                unknown.add("%s=%s (it can be: %s)".formatted(setting, value, String.join(", ", words)));
            }
        });
        if (!unknown.isEmpty()) {
            throw new IllegalStateException(
                    "These settings have a value the API doesn't know: " + String.join("; ", unknown) + ".");
        }
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
        if ("local".equals(environment.getProperty("journey.moderation.mode"))) {
            on.add("journey.moderation.mode=local (no photo is ever checked)");
        }
        if (environment.getProperty("journey.seed.enabled", Boolean.class, false)) {
            on.add("journey.seed.enabled=true (sample people and journeys)");
        }
        if ("local".equals(environment.getProperty("journey.push.mode"))) {
            on.add("journey.push.mode=local (pushes are only written to the log; nobody's phone gets them)");
        }
        if ("local".equals(environment.getProperty("journey.email.mode"))) {
            on.add("journey.email.mode=local (emails are only written to the log)");
        }
        if (!on.isEmpty()) {
            throw new IllegalStateException(
                    "These settings are for building and testing only and need the 'local' profile: "
                            + String.join("; ", on)
                            + ". Start with -Dspring.profiles.active=local on your own computer, or remove them here.");
        }
    }
}
