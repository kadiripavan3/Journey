package app.journey.api.media;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/** When the API starts: photos uploaded before smaller versions were made at upload get theirs now. */
@Component
@Order(100) // after the sample data, which makes its own
class MediaBackfill implements ApplicationRunner {

    private final MediaService media;

    MediaBackfill(MediaService media) {
        this.media = media;
    }

    @Override
    public void run(ApplicationArguments args) {
        media.makeMissingSizes();
    }
}
