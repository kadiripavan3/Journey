package app.journey.api.media;

import app.journey.api.auth.Me;
import app.journey.api.media.MediaService.NewUpload;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/media")
@Tag(name = "media", description = "Uploading photos and clips")
class MediaController {

    private final MediaService media;

    MediaController(MediaService media) {
        this.media = media;
    }

    record StartUploadRequest(
            @NotNull(message = "Choose a photo or a clip.") MediaKind kind,
            @NotBlank String contentType) {}

    record UploadResponse(
            @Schema(description = "Use this id when saving the entry, journey or profile")
            UUID mediaId,

            @Schema(description = "Send the file's bytes here")
            String uploadUrl,

            String method,
            Map<String, String> headers) {}

    @PostMapping("/uploads")
    @Operation(operationId = "startUpload", summary = "Get a place to upload one photo or clip")
    UploadResponse startUpload(@Me UUID me, @Valid @RequestBody StartUploadRequest request) {
        NewUpload upload = media.startUpload(me, request.kind(), request.contentType());
        return new UploadResponse(
                upload.mediaId(),
                upload.target().url(),
                upload.target().method(),
                upload.target().headers());
    }

    @PostMapping("/uploads/{id}/complete")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(
            operationId = "completeUpload",
            summary = "Say that the file has been sent. The API checks it and makes it ready to use.")
    void completeUpload(@Me UUID me, @PathVariable UUID id) {
        media.completeUpload(id, me);
    }
}
