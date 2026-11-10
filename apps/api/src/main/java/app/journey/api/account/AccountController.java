package app.journey.api.account;

import app.journey.api.account.AccountService.BlockedPersonResponse;
import app.journey.api.account.AccountService.ReportResponse;
import app.journey.api.account.AccountService.SettingsResponse;
import app.journey.api.auth.CurrentUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1")
@Tag(name = "Account and safety")
class AccountController {

  record ReportRequest(
      @NotBlank(message = "Choose what you're reporting.") @Schema(description = "journey, entry, comment or profile") String targetType,
      @NotNull(message = "Choose what you're reporting.") UUID targetId,
      @NotBlank(message = "Choose a reason.") @Schema(description = "spam, harassment, nudity, violence, impersonation or other") String reason,
      @Size(max = 500, message = "Keep the note to 500 characters or fewer.") String note) {}

  private final AccountService account;

  AccountController(AccountService account) {
    this.account = account;
  }

  @GetMapping("/me/settings")
  @Operation(operationId = "getSettings", summary = "Your notification choices and what new journeys start as")
  SettingsResponse settings(@AuthenticationPrincipal Jwt jwt) {
    return account.settings(me(jwt));
  }

  @PutMapping("/me/settings")
  @Operation(operationId = "saveSettings", summary = "Change your settings. Send all of them.")
  SettingsResponse save(@AuthenticationPrincipal Jwt jwt, @RequestBody SettingsResponse settings) {
    return account.save(me(jwt), settings);
  }

  @DeleteMapping("/me")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Operation(operationId = "deleteAccount", summary = "Delete your account and everything in it, for good")
  void delete(@AuthenticationPrincipal Jwt jwt) {
    account.delete(me(jwt));
  }

  @GetMapping("/me/blocks")
  @Operation(operationId = "getBlocked", summary = "The people you have blocked, most recent first")
  List<BlockedPersonResponse> blocked(@AuthenticationPrincipal Jwt jwt) {
    return account.blocked(me(jwt));
  }

  @PutMapping("/profiles/{username}/block")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Operation(operationId = "blockProfile", summary = "Block someone. Neither of you sees the other's journeys, entries or comments, and they aren't told.")
  void block(@AuthenticationPrincipal Jwt jwt, @PathVariable String username) {
    account.block(me(jwt), username);
  }

  @DeleteMapping("/profiles/{username}/block")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Operation(operationId = "unblockProfile", summary = "Unblock someone")
  void unblock(@AuthenticationPrincipal Jwt jwt, @PathVariable String username) {
    account.unblock(me(jwt), username);
  }

  @PostMapping("/reports")
  @ResponseStatus(HttpStatus.CREATED)
  @Operation(operationId = "report", summary = "Report a journey, an entry, a comment or a person. Reports are private.")
  ReportResponse report(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ReportRequest r) {
    return account.report(me(jwt), r.targetType(), r.targetId(), r.reason(), r.note());
  }

  private static UUID me(Jwt jwt) {
    return CurrentUser.from(jwt).id();
  }
}
