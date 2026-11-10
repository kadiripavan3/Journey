package app.journey.api.moderation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.journey.api.moderation.MediaScreening.Verdict;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import software.amazon.awssdk.core.exception.SdkClientException;
import software.amazon.awssdk.services.rekognition.RekognitionClient;
import software.amazon.awssdk.services.rekognition.model.DetectModerationLabelsRequest;
import software.amazon.awssdk.services.rekognition.model.DetectModerationLabelsResponse;
import software.amazon.awssdk.services.rekognition.model.ModerationLabel;

/** What the Rekognition photo check asks and how it reads the answer, against a stand-in for AWS. */
class RekognitionMediaScreeningTest {

    private static final byte[] PHOTO = {1, 2, 3};

    /** Answers every request with the same labels and remembers what it was asked. */
    private static class FakeRekognition implements RekognitionClient {
        final List<DetectModerationLabelsRequest> asked = new ArrayList<>();
        private final List<ModerationLabel> labels;

        FakeRekognition(ModerationLabel... labels) {
            this.labels = List.of(labels);
        }

        @Override
        public DetectModerationLabelsResponse detectModerationLabels(DetectModerationLabelsRequest request) {
            asked.add(request);
            return DetectModerationLabelsResponse.builder()
                    .moderationLabels(labels)
                    .build();
        }

        @Override
        public String serviceName() {
            return SERVICE_NAME;
        }

        @Override
        public void close() {}
    }

    private static ModerationLabel label(String name, String parent, int level, float confidence) {
        return ModerationLabel.builder()
                .name(name)
                .parentName(parent)
                .taxonomyLevel(level)
                .confidence(confidence)
                .build();
    }

    @Test
    void sendsThePhotoAndTheConfidenceItWants() {
        FakeRekognition aws = new FakeRekognition();
        Verdict verdict = new RekognitionMediaScreening(() -> aws, 75f).screen(PHOTO);

        assertThat(verdict.flagged()).isFalse();
        assertThat(aws.asked).hasSize(1);
        assertThat(aws.asked.get(0).image().bytes().asByteArray()).isEqualTo(PHOTO);
        assertThat(aws.asked.get(0).minConfidence()).isEqualTo(75f);
    }

    @Test
    void letsBeachesBarsAndCastlesThrough() {
        FakeRekognition aws = new FakeRekognition(
                label("Swimwear or Underwear", "", 1, 98.1f),
                label("Female Swimwear or Underwear", "Swimwear or Underwear", 2, 98.1f),
                label("Alcohol", "", 1, 91.0f),
                label("Alcohol Use", "Alcohol", 2, 91.0f),
                label("Drinking", "Alcohol Use", 3, 91.0f),
                label("Rude Gestures", "", 1, 88.0f),
                label("Violence", "", 1, 86.0f),
                label("Weapons", "Violence", 2, 86.0f));

        assertThat(new RekognitionMediaScreening(() -> aws, 80f).screen(PHOTO)).isEqualTo(Verdict.fine());
    }

    @Test
    void holdsExplicitContentAndSaysWhatItSaw() {
        FakeRekognition aws = new FakeRekognition(
                label("Explicit", "", 1, 99.2f),
                label("Explicit Nudity", "Explicit", 2, 99.2f),
                label("Exposed Male Genitalia", "Explicit Nudity", 3, 97.6f),
                label("Swimwear or Underwear", "", 1, 99.9f));

        Verdict verdict = new RekognitionMediaScreening(() -> aws, 80f).screen(PHOTO);

        assertThat(verdict.flagged()).isTrue();
        assertThat(verdict.reason()).isEqualTo("Exposed Male Genitalia (98%)");
    }

    @Test
    void holdsGraphicViolenceDisturbingImagesAndHateSymbols() {
        assertThat(new RekognitionMediaScreening(
                                () -> new FakeRekognition(
                                        label("Violence", "", 1, 93.4f),
                                        label("Graphic Violence", "Violence", 2, 93.4f),
                                        label("Blood & Gore", "Graphic Violence", 3, 93.4f)),
                                80f)
                        .screen(PHOTO)
                        .reason())
                .isEqualTo("Blood & Gore (93%)");
        assertThat(new RekognitionMediaScreening(
                                () -> new FakeRekognition(label("Visually Disturbing", "", 1, 84.5f)), 80f)
                        .screen(PHOTO)
                        .reason())
                .isEqualTo("Visually Disturbing (85%)");
        assertThat(new RekognitionMediaScreening(
                                () -> new FakeRekognition(
                                        label("Hate Symbols", "", 1, 90f), label("Nazi Party", "Hate Symbols", 2, 90f)),
                                80f)
                        .screen(PHOTO)
                        .flagged())
                .isTrue();
        // An earlier version of the list, where "Explicit Nudity" is a top category and has no level numbers.
        assertThat(new RekognitionMediaScreening(
                                () -> new FakeRekognition(
                                        ModerationLabel.builder()
                                                .name("Explicit Nudity")
                                                .parentName("")
                                                .confidence(96f)
                                                .build(),
                                        ModerationLabel.builder()
                                                .name("Nudity")
                                                .parentName("Explicit Nudity")
                                                .confidence(95f)
                                                .build()),
                                80f)
                        .screen(PHOTO)
                        .flagged())
                .isTrue();
    }

    @Test
    void opensItsConnectionOnceAndOnlyWhenAPhotoComes() {
        AtomicInteger opened = new AtomicInteger();
        FakeRekognition aws = new FakeRekognition();
        RekognitionMediaScreening check = new RekognitionMediaScreening(
                () -> {
                    opened.incrementAndGet();
                    return aws;
                },
                80f);
        assertThat(opened).hasValue(0);
        check.screen(PHOTO);
        check.screen(PHOTO);
        assertThat(opened).hasValue(1);
    }

    @Test
    void aFailureAtAwsIsPassedOnSoThePhotoIsCheckedAgainLater() {
        RekognitionClient down = new FakeRekognition() {
            @Override
            public DetectModerationLabelsResponse detectModerationLabels(DetectModerationLabelsRequest request) {
                throw SdkClientException.create("Unable to load credentials");
            }
        };
        assertThatThrownBy(() -> new RekognitionMediaScreening(() -> down, 80f).screen(PHOTO))
                .isInstanceOf(SdkClientException.class);
    }
}
