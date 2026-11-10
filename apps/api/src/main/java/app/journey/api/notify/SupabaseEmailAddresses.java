package app.journey.api.notify;

import java.util.Optional;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * With Supabase sign-in: the address is in Supabase's own table of people, {@code auth.users}, which lives in
 * the same database the API already uses. The database user the API connects as must be allowed to read it
 * ({@code grant usage on schema auth} and {@code grant select on auth.users}); the default Supabase
 * {@code postgres} user is.
 */
@Repository
@ConditionalOnProperty(name = "journey.auth.mode", havingValue = "supabase")
class SupabaseEmailAddresses implements EmailAddresses {

    private final JdbcClient jdbc;

    SupabaseEmailAddresses(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public Optional<String> of(UUID userId) {
        return jdbc.sql("select email from auth.users where id = :id and email is not null")
                .param("id", userId)
                .query(String.class)
                .optional();
    }

    @Override
    public Optional<UUID> whose(String email) {
        return jdbc.sql("select id from auth.users where lower(email) = lower(:email) order by created_at limit 1")
                .param("email", email.trim())
                .query(UUID.class)
                .optional();
    }
}
