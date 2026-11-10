package app.journey.api.activity;

import app.journey.api.activity.ActivityService.ActivityResponse;
import app.journey.api.activity.ActivityService.ActivityUnseenResponse;
import app.journey.api.auth.Me;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.UUID;
import org.springframework.http.HttpStatus;
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
    @Operation(
            operationId = "getActivity",
            summary =
                    "The inbox: new entries per journey, likes batched per entry, comments, replies and new followers")
    ActivityResponse inbox(@Me UUID me) {
        return activity.inbox(me);
    }

    @GetMapping("/unseen")
    @Operation(
            operationId = "getActivityUnseen",
            summary = "Whether anything happened since you last opened Activity: the dot on the tab bar")
    ActivityUnseenResponse unseen(@Me UUID me) {
        return activity.unseen(me);
    }

    @PostMapping("/seen")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(operationId = "markActivitySeen", summary = "Everything in Activity so far has been seen")
    void seen(@Me UUID me) {
        activity.markSeen(me);
    }
}
