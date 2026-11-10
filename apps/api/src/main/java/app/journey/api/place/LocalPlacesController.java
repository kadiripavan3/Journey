package app.journey.api.place;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The place search for where the phone has none of its own: the web preview. It exists only in local mode
 * and answers from a bundled list. On a phone the app never calls it.
 */
@RestController
@RequestMapping("/v1/local/places")
@ConditionalOnProperty(name = "journey.places.mode", havingValue = "local")
@Tag(name = "local-places", description = "A stand-in place search for the web preview. Exists only in local mode.")
class LocalPlacesController {

    record PlaceResponse(String name, double lat, double lng) {}

    @GetMapping
    @Operation(
            operationId = "searchLocalPlaces",
            summary = "Places from a bundled list whose name matches the words typed")
    List<PlaceResponse> search(@RequestParam("q") String words) {
        return LocalPlaces.search(words, 8).stream()
                .map(place -> new PlaceResponse(place.name(), place.lat(), place.lng()))
                .toList();
    }
}
