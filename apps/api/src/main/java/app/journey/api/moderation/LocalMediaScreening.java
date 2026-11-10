package app.journey.api.moderation;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import javax.imageio.ImageIO;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Local mode's stand-in for the photo check. It lets every photo through, with one exception that exists so
 * the "held for review" flow can be tried without a real service: a photo that is one solid magenta colour
 * is flagged. (Nobody takes such a photo by accident; a test or a tester makes one on purpose.)
 */
@Component
@ConditionalOnProperty(name = "journey.moderation.mode", havingValue = "local")
class LocalMediaScreening implements MediaScreening {

    @Override
    public Verdict screen(byte[] jpeg) {
        try {
            BufferedImage image = ImageIO.read(new ByteArrayInputStream(jpeg));
            if (image != null && isMagenta(image, 0.25) && isMagenta(image, 0.5) && isMagenta(image, 0.75)) {
                return Verdict.flag("The local stand-in's test marker (a solid magenta photo)");
            }
        } catch (IOException | RuntimeException unreadable) {
            // Not a picture the stand-in can read: nothing to flag.
        }
        return Verdict.fine();
    }

    /** The pixel that far along the diagonal is magenta, give or take what JPEG does to a colour. */
    private static boolean isMagenta(BufferedImage image, double along) {
        int rgb = image.getRGB((int) (image.getWidth() * along), (int) (image.getHeight() * along));
        int red = (rgb >> 16) & 0xff;
        int green = (rgb >> 8) & 0xff;
        int blue = rgb & 0xff;
        return red > 225 && green < 40 && blue > 225;
    }
}
