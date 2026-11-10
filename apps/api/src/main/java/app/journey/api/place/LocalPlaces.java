package app.journey.api.place;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import org.springframework.core.io.ClassPathResource;

/**
 * Local mode's stand-in for a place search: about a hundred well-known places, bundled with the API.
 *
 * <p>On a phone the app asks the phone itself where something is (Apple's place search on iPhone, Google's on
 * Android), so no map provider is needed. A browser has no such thing; the web preview and the sample data
 * use this list instead.
 */
public final class LocalPlaces {

    public record KnownPlace(String name, double lat, double lng) {}

    private static final List<KnownPlace> ALL = load();

    private LocalPlaces() {}

    /** The places whose name contains the words typed, those that start with them first. */
    public static List<KnownPlace> search(String words, int limit) {
        String wanted = plain(words);
        if (wanted.length() < 2) {
            return List.of();
        }
        List<KnownPlace> starts = new ArrayList<>();
        List<KnownPlace> contains = new ArrayList<>();
        for (KnownPlace place : ALL) {
            String name = plain(place.name());
            if (name.startsWith(wanted)) {
                starts.add(place);
            } else if (name.contains(wanted)) {
                contains.add(place);
            }
        }
        starts.addAll(contains);
        return starts.subList(0, Math.min(starts.size(), limit));
    }

    /** The place with exactly this name, for the sample data. */
    public static Optional<KnownPlace> named(String name) {
        return ALL.stream().filter(place -> place.name().equals(name)).findFirst();
    }

    /** Lower case and without accents, so "goreme" finds "Göreme". */
    private static String plain(String text) {
        return Normalizer.normalize(text == null ? "" : text.trim(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT);
    }

    private static List<KnownPlace> load() {
        List<KnownPlace> places = new ArrayList<>();
        try (BufferedReader lines = new BufferedReader(new InputStreamReader(
                new ClassPathResource("local/places.tsv").getInputStream(), StandardCharsets.UTF_8))) {
            for (String line = lines.readLine(); line != null; line = lines.readLine()) {
                String[] parts = line.split("\t");
                if (parts.length == 3) {
                    places.add(new KnownPlace(parts[0], Double.parseDouble(parts[1]), Double.parseDouble(parts[2])));
                }
            }
        } catch (IOException e) {
            throw new UncheckedIOException("Could not read the bundled list of places", e);
        }
        return List.copyOf(places);
    }
}
