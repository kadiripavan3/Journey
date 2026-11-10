package app.journey.api.moderation;

import io.swagger.v3.oas.annotations.Hidden;
import java.security.Principal;
import java.util.UUID;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;

/**
 * The reviewer's pages: one page with everything that waits (reports, held photos and comments, requests to
 * delete an account) and a button for each thing a reviewer can decide. Who may open them is in
 * {@link ReviewerSecurity}.
 */
@Controller
@Hidden
@RequestMapping("/admin")
class ReviewerPagesController {

    private static final String BACK = "redirect:/admin";

    private final ModerationService moderation;

    ReviewerPagesController(ModerationService moderation) {
        this.moderation = moderation;
    }

    @GetMapping
    String queue(Model model, Principal reviewer) {
        model.addAttribute("queue", moderation.queue());
        model.addAttribute("reviewer", reviewer.getName());
        return "admin/queue";
    }

    @PostMapping("/reports/{id}/dismiss")
    String dismiss(@PathVariable UUID id, Principal reviewer) {
        moderation.dismissReport(id, reviewer.getName());
        return BACK;
    }

    @PostMapping("/reports/{id}/remove")
    String remove(@PathVariable UUID id, Principal reviewer) {
        moderation.removeReported(id, reviewer.getName());
        return BACK;
    }

    @PostMapping("/photos/{id}/release")
    String releasePhoto(@PathVariable UUID id, Principal reviewer) {
        moderation.releasePhoto(id, reviewer.getName());
        return BACK;
    }

    @PostMapping("/photos/{id}/remove")
    String removePhoto(@PathVariable UUID id, Principal reviewer) {
        moderation.removePhoto(id, reviewer.getName());
        return BACK;
    }

    @PostMapping("/comments/{id}/release")
    String releaseComment(@PathVariable UUID id, Principal reviewer) {
        moderation.releaseComment(id, reviewer.getName());
        return BACK;
    }

    @PostMapping("/comments/{id}/remove")
    String removeComment(@PathVariable UUID id, Principal reviewer) {
        moderation.removeComment(id, reviewer.getName());
        return BACK;
    }

    @PostMapping("/deletion-requests/{id}/delete")
    String deleteRequestedAccount(@PathVariable UUID id, Principal reviewer) {
        moderation.deleteRequestedAccount(id, reviewer.getName());
        return BACK;
    }

    @PostMapping("/deletion-requests/{id}/close")
    String closeDeletionRequest(@PathVariable UUID id, Principal reviewer) {
        moderation.closeDeletionRequest(id, reviewer.getName());
        return BACK;
    }
}
