package app.journey.api.account;

import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/** Local mode: sign-ins live in the local_users table. */
@Component
@ConditionalOnProperty(name = "journey.auth.mode", havingValue = "local")
class LocalSignInAccounts implements SignInAccounts {

  private final JdbcClient jdbc;

  LocalSignInAccounts(JdbcClient jdbc) {
    this.jdbc = jdbc;
  }

  @Override
  public void remove(UUID userId) {
    jdbc.sql("delete from local_users where id = :id").param("id", userId).update();
  }
}
