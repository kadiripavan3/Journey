package app.journey.api.media;

import app.journey.api.auth.CurrentUser;
import app.journey.api.media.MediaService.NewUpload;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import java.util.Map;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
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
      @NotBlank @Pattern(regexp = "photo|video", message = "Choose a photo or a clip.") @Schema(allowableValues = {"photo", "video"}) String kind,
      @NotBlank String contentType) {}

  record UploadResponse(
      @Schema(description = "Use this id when saving the entry, journey or profile") UUID mediaId,
      @Schema(description = "Send the file's bytes here") String uploadUrl,
      String method,
      Map<String, String> headers) {}

  @PostMapping("/uploads")
  @Operation(operationId = "startUpload", summary = "Get a place to upload one photo or clip")
  UploadResponse startUpload(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody StartUploadRequest request) {
    NewUpload upload = media.startUpload(CurrentUser.from(jwt).id(), request.kind(), request.contentType());
    return new UploadResponse(upload.mediaId(), upload.target().url(), upload.target().method(), upload.target().headers());
  }
}
