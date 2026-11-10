package app.journey.api.moderation;

import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.function.Supplier;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.rekognition.RekognitionClient;
import software.amazon.awssdk.services.rekognition.model.DetectModerationLabelsRequest;
import software.amazon.awssdk.services.rekognition.model.Image;
import software.amazon.awssdk.services.rekognition.model.ModerationLabel;

/**
 * The photo check done by AWS Rekognition. It holds explicit content, graphic violence, disturbing images and
 * hate symbols. It does not hold swimwear, a drink in someone's hand, a rude gesture or a sword in a museum:
 * travel photos are full of beaches, bars and castles, and those are fine.
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

    private final Supplier<RekognitionClient> client;
    private final float minConfidence;
    private RekognitionClient opened;

    @Autowired
    RekognitionMediaScreening(
            @Value("${journey.moderation.rekognition.region:eu-west-1}") String region,
            @Value("${journey.moderation.rekognition.min-confidence:80}") float minConfidence) {
        // Made on first use, so the API starts without credentials; a photo is then let through and checked later.
        this(() -> RekognitionClient.builder().region(Region.of(region)).build(), minConfidence);
    }

    RekognitionMediaScreening(Supplier<RekognitionClient> client, float minConfidence) {
        this.client = client;
        this.minConfidence = minConfidence;
    }

    @Override
    public Verdict screen(byte[] jpeg) {
        List<ModerationLabel> labels = client().detectModerationLabels(DetectModerationLabelsRequest.builder()
                        .image(Image.builder()
                                .bytes(SdkBytes.fromByteArray(jpeg))
                                .build())
                        .minConfidence(minConfidence)
                        .build())
                .moderationLabels();
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
