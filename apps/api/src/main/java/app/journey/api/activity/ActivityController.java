package app.journey.api.activity;

import app.journey.api.activity.ActivityService.ActivityResponse;
import app.journey.api.auth.CurrentUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/activity")
@Tag(name = "Activity")
class ActivityController {

  private final ActivityService activity;

  ActivityController(ActivityService activity) {
    this.activity = activity;
  }

  @GetMapping
  @Operation(operationId = "getActivity", summary = "The inbox: new entries per journey, likes batched per entry, comments, replies and new followers")
  ActivityResponse inbox(@AuthenticationPrincipal Jwt jwt) {
    return activity.inbox(CurrentUser.from(jwt).id());
  }

  @PostMapping("/seen")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Operation(operationId = "markActivitySeen", summary = "Everything in Activity so far has been seen")
  void seen(@AuthenticationPrincipal Jwt jwt) {
    activity.markSeen(CurrentUser.from(jwt).id());
  }
}
