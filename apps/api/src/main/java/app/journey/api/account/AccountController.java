package app.journey.api.account;

import app.journey.api.account.AccountService.BlockedPersonResponse;
import app.journey.api.account.AccountService.ReportResponse;
import app.journey.api.account.AccountService.SettingsChange;
import app.journey.api.account.AccountService.SettingsResponse;
import app.journey.api.auth.Me;
import app.journey.api.common.Page;
import app.journey.api.common.PageRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1")
@Tag(name = "Account and safety")
class AccountController {

    record ReportRequest(
            @NotNull(message = "Choose what you're reporting.")
            ReportTarget targetType,

            @NotNull(message = "Choose what you're reporting.")
            UUID targetId,

            @NotNull(message = "Choose a reason.") ReportReason reason,

            @Size(max = 500, message = "Keep the note to 500 characters or fewer.")
            String note) {}

    private final AccountService account;

    AccountController(AccountService account) {
        this.account = account;
    }

    @GetMapping("/me/settings")
    @Operation(operationId = "getSettings", summary = "Your notification choices and what new journeys start as")
    SettingsResponse settings(@Me UUID me) {
        return account.settings(me);
    }

    @PutMapping("/me/settings")
    @Operation(
            operationId = "saveSettings",
            summary = "Change your settings. Send the ones that change; the rest stay as they are.")
    SettingsResponse save(@Me UUID me, @RequestBody SettingsChange change) {
        return account.save(me, change);
    }

    @DeleteMapping("/me")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(operationId = "deleteAccount", summary = "Delete your account and everything in it, for good")
    void delete(@Me UUID me) {
        account.delete(me);
    }

    @GetMapping("/me/blocks")
    @Operation(operationId = "getBlocked", summary = "The people you have blocked, most recent first")
    Page<BlockedPersonResponse> blocked(
            @Me UUID me, @RequestParam(required = false) String cursor, @RequestParam(required = false) Integer limit) {
        return account.blocked(me, PageRequest.of(cursor, limit, 50));
    }

    @PutMapping("/profiles/{username}/block")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(
            operationId = "blockProfile",
            summary =
                    "Block someone. Neither of you sees the other's journeys, entries or comments, and they aren't told.")
    void block(@Me UUID me, @PathVariable String username) {
        account.block(me, username);
    }

    @DeleteMapping("/profiles/{username}/block")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(operationId = "unblockProfile", summary = "Unblock someone")
    void unblock(@Me UUID me, @PathVariable String username) {
        account.unblock(me, username);
    }

    @PostMapping("/reports")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(
            operationId = "report",
            summary = "Report a journey, an entry, a comment or a person. Reports are private.")
    ReportResponse report(@Me UUID me, @Valid @RequestBody ReportRequest r) {
        return account.report(me, r.targetType(), r.targetId(), r.reason(), r.note());
    }
}
