package app.journey.api.legal;

import app.journey.api.common.ApiProblem;
import app.journey.api.moderation.ModerationService;
import io.swagger.v3.oas.annotations.Hidden;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;

/**
 * The pages both app stores ask for, in plain words: terms, privacy, community guidelines, how to reach us,
 * and a way to ask for an account to be deleted without the app (Google Play requires one). The app links to
 * them from Settings.
 *
 * <p>The texts are drafts. They say what the product does today and must be read by a lawyer before launch;
 * each page says so at the top.
 */
@Controller
@Hidden
class LegalPagesController {

    private final ModerationService moderation;
    private final String contactEmail;

    LegalPagesController(ModerationService moderation, @Value("${journey.contact.email:}") String contactEmail) {
        this.moderation = moderation;
        this.contactEmail = contactEmail.trim();
    }

    /** The address people can write to. Empty until one is set ({@code JOURNEY_CONTACT_EMAIL}); the pages then say it is coming. */
    @ModelAttribute("contactEmail")
    String contactEmail() {
        return contactEmail;
    }

    @GetMapping("/terms")
    String terms() {
        return "legal/terms";
    }

    @GetMapping("/privacy")
    String privacy() {
        return "legal/privacy";
    }

    @GetMapping("/guidelines")
    String guidelines() {
        return "legal/guidelines";
    }

    @GetMapping("/contact")
    String contact() {
        return "legal/contact";
    }

    @GetMapping("/delete-account")
    String deleteAccount() {
        return "legal/delete-account";
    }

    /** The request goes to the reviewer's queue. A person checks that it comes from the account's owner before anything is deleted. */
    @PostMapping("/delete-account")
    String askForDeletion(
            @RequestParam(defaultValue = "") String email,
            @RequestParam(defaultValue = "") String username,
            @RequestParam(defaultValue = "") String note,
            Model model) {
        try {
            moderation.requestDeletion(email, username.replaceFirst("^@", ""), note);
        } catch (ApiProblem problem) {
            model.addAttribute("problem", problem.getMessage());
            model.addAttribute("email", email);
            model.addAttribute("username", username);
            model.addAttribute("note", note);
            return "legal/delete-account";
        }
        return "legal/delete-account-done";
    }
}
