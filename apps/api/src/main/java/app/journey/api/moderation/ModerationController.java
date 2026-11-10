package app.journey.api.moderation;

import app.journey.api.auth.Me;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1")
@Tag(name = "Account and safety")
class ModerationController {

    private final ModerationService moderation;

    ModerationController(ModerationService moderation) {
        this.moderation = moderation;
    }

    @PostMapping("/media/{id}/second-look")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(
            operationId = "askSecondLook",
            summary = "Ask a reviewer to look again at a photo of yours that the automatic check is holding")
    void askSecondLook(@Me UUID me, @PathVariable UUID id) {
        moderation.askAgain(id, me);
    }
}
