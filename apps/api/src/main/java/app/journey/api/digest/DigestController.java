package app.journey.api.digest;

import app.journey.api.auth.Me;
import app.journey.api.digest.DigestService.DigestResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/digest")
@Tag(name = "Weekly digest")
class DigestController {

  private final DigestService digest;

  DigestController(DigestService digest) {
    this.digest = digest;
  }

  @GetMapping
  @Operation(operationId = "getDigest", summary = "This week in the journeys you follow")
  DigestResponse thisWeek(@Me UUID me) {
    return digest.thisWeek(me);
  }
}
