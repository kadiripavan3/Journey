package app.journey.api.moderation;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.Duration;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.function.Supplier;
import javax.imageio.ImageIO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.rekognition.RekognitionClient;
import software.amazon.awssdk.services.rekognition.model.DetectModerationLabelsRequest;
import software.amazon.awssdk.services.rekognition.model.Image;
import software.amazon.awssdk.services.rekognition.model.ImageTooLargeException;
import software.amazon.awssdk.services.rekognition.model.InvalidImageFormatException;
import software.amazon.awssdk.services.rekognition.model.InvalidParameterException;
import software.amazon.awssdk.services.rekognition.model.ModerationLabel;

/**
 * The photo check done by AWS Rekognition. It holds explicit content, graphic violence, disturbing images and
 * hate symbols. It does not hold swimwear, a drink in someone's hand, a rude gesture or a sword in a museum:
 * travel photos are full of beaches, bars and castles, and those are fine.
 *
 * <p>A picture Rekognition refuses to read is held for a person; an outage is not (the picture is shown, and
 * looked at once Rekognition is back).
 *
 * <p>It needs AWS credentials the usual way ({@code AWS_ACCESS_KEY_ID} and {@code AWS_SECRET_ACCESS_KEY} in the
 * environment) with permission for {@code rekognition:DetectModerationLabels}, and a region where Rekognition
 * runs ({@code journey.moderation.rekognition.region}).
 */
@Component
@ConditionalOnProperty(name = "journey.moderation.mode", havingValue = "rekognition")
class RekognitionMediaScreening implements MediaScreening {

    /**
     * The labels that hold a photo. Rekognition answers with a label and every category above it, so naming a
     * category covers everything inside it. "Violence" as a whole is not here, because it includes "Weapons";
     * its graphic part is. The second name in a pair is what an earlier version of Rekognition's list calls it.
     */
    static final Set<String> HELD = Set.of(
            "Explicit",
            "Explicit Nudity",
            "Graphic Violence",
            "Graphic Violence Or Gore",
            "Visually Disturbing",
            "Hate Symbols");

    private static final int SMALLEST = 80;

    private final Supplier<RekognitionClient> client;
    private final float minConfidence;
    private RekognitionClient opened;

    @Autowired
    RekognitionMediaScreening(
            @Value("${journey.moderation.rekognition.region:eu-west-1}") String region,
            @Value("${journey.moderation.rekognition.min-confidence:80}") float minConfidence) {
        this(opened(region), minConfidence);
    }

    /**
     * The client, made when the API starts. Without credentials the check could look at nothing, and nobody
     * would notice: so the API says so and doesn't start.
     */
    private static Supplier<RekognitionClient> opened(String region) {
        try (DefaultCredentialsProvider keys =
                DefaultCredentialsProvider.builder().build()) {
            keys.resolveCredentials();
        } catch (RuntimeException missing) {
            throw new IllegalStateException(
                    "journey.moderation.mode=rekognition needs AWS credentials: set AWS_ACCESS_KEY_ID and"
                            + " AWS_SECRET_ACCESS_KEY (or JOURNEY_MODERATION_MODE=off to run without the automatic"
                            + " photo check for now).",
                    missing);
        }
        RekognitionClient client = RekognitionClient.builder()
                .region(Region.of(region))
                .overrideConfiguration(calls ->
                        calls.apiCallTimeout(Duration.ofSeconds(20)).apiCallAttemptTimeout(Duration.ofSeconds(8)))
                .build();
        return () -> client;
    }

    RekognitionMediaScreening(Supplier<RekognitionClient> client, float minConfidence) {
        this.client = client;
        this.minConfidence = minConfidence;
    }

    @Override
    public Verdict screen(byte[] jpeg) {
        List<ModerationLabel> labels;
        try {
            labels = client().detectModerationLabels(DetectModerationLabelsRequest.builder()
                            .image(Image.builder()
                                    .bytes(SdkBytes.fromByteArray(bigEnough(jpeg)))
                                    .build())
                            .minConfidence(minConfidence)
                            .build())
                    .moderationLabels();
        } catch (InvalidImageFormatException | ImageTooLargeException | InvalidParameterException refused) {
            // Rekognition will say the same about these bytes every time.
            throw new UnreadablePhoto(
                    refused.awsErrorDetails() == null
                            ? "refused"
                            : refused.awsErrorDetails().errorCode());
        }
        if (labels.stream().noneMatch(label -> HELD.contains(label.name()))) {
            return Verdict.fine();
        }
        // For the reviewer: the most exact thing Rekognition said about the photo, and how sure it was.
        ModerationLabel exact = labels.stream()
                .filter(label -> HELD.contains(label.name()) || HELD.contains(label.parentName()))
                .max(Comparator.comparing(RekognitionMediaScreening::level).thenComparing(ModerationLabel::confidence))
                .orElseThrow();
        return Verdict.flag("%s (%d%%)".formatted(exact.name(), Math.round(exact.confidence())));
    }

    /**
     * Rekognition takes pictures of at least 80 pixels each way. A very thin strip (a panorama made small) is
     * put on a white ground of that size, so it is looked at like any other photo.
     */
    static byte[] bigEnough(byte[] jpeg) {
        try {
            BufferedImage image = ImageIO.read(new ByteArrayInputStream(jpeg));
            if (image == null || (image.getWidth() >= SMALLEST && image.getHeight() >= SMALLEST)) {
                return jpeg;
            }
            BufferedImage ground = new BufferedImage(
                    Math.max(image.getWidth(), SMALLEST),
                    Math.max(image.getHeight(), SMALLEST),
                    BufferedImage.TYPE_INT_RGB);
            Graphics2D g = ground.createGraphics();
            g.setColor(Color.WHITE);
            g.fillRect(0, 0, ground.getWidth(), ground.getHeight());
            g.drawImage(image, 0, 0, null);
            g.dispose();
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            ImageIO.write(ground, "jpg", bytes);
            return bytes.toByteArray();
        } catch (IOException | RuntimeException unreadable) {
            return jpeg; // Rekognition will say what it thinks of it
        }
    }

    private static int level(ModerationLabel label) {
        return label.taxonomyLevel() == null ? 0 : label.taxonomyLevel();
    }

    private synchronized RekognitionClient client() {
        if (opened == null) {
            opened = client.get();
        }
        return opened;
    }
}
