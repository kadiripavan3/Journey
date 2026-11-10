package app.journey.api.account;

import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import app.journey.api.auth.LocalUsers;
import org.springframework.stereotype.Component;

/** Local mode: sign-ins live in the local_users table. */
@Component
@ConditionalOnProperty(name = "journey.auth.mode", havingValue = "local")
class LocalSignInAccounts implements SignInAccounts {

  private final LocalUsers users;

  LocalSignInAccounts(LocalUsers users) {
    this.users = users;
  }

  @Override
  public void remove(UUID userId) {
    users.remove(userId);
  }
}
