package app.journey.api.notify;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Reads and writes the devices that asked for pushes. */
@Repository
public class DeviceStore {

    /** A person whose newest device is in this time zone, with the hour they want reminders at. */
    public record Reminded(UUID userId, String timeZone, int reminderHour) {}

    private final JdbcClient jdbc;

    DeviceStore(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Remembers a device for a person. A phone has one token: if someone else was signed in on it before, it
     * is theirs no longer.
     */
    public void register(UUID userId, String token, DevicePlatform platform, String timeZone) {
        jdbc.sql("""
            insert into devices (token, user_id, platform, time_zone) values (:token, :user, :platform, :zone)
            on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform,
              time_zone = excluded.time_zone, seen_at = now()
            """)
                .param("token", token)
                .param("user", userId)
                .param("platform", platform.code())
                .param("zone", timeZone)
                .update();
    }

    /** Forgets a device, if it is this person's. */
    public void forget(UUID userId, String token) {
        jdbc.sql("delete from devices where token = :token and user_id = :user")
                .param("token", token)
                .param("user", userId)
                .update();
    }

    /** Forgets devices the push service says no longer exist. */
    public void forget(Collection<String> tokens) {
        if (!tokens.isEmpty()) {
            jdbc.sql("delete from devices where token in (:tokens)")
                    .param("tokens", tokens)
                    .update();
        }
    }

    /** Each person's device tokens. */
    public Map<UUID, List<String>> tokensOf(Collection<UUID> userIds) {
        if (userIds.isEmpty()) {
            return Map.of();
        }
        record Row(UUID userId, String token) {}
        return jdbc
                .sql("select user_id, token from devices where user_id in (:users) order by seen_at desc")
                .param("users", userIds)
                .query((rs, n) -> new Row(rs.getObject("user_id", UUID.class), rs.getString("token")))
                .list()
                .stream()
                .collect(Collectors.groupingBy(Row::userId, Collectors.mapping(Row::token, Collectors.toList())));
    }

    /** Everyone who can get a push and hasn't switched reminders off, with where they are and when they want them. */
    public List<Reminded> wantingReminders() {
        return jdbc.sql("""
            select distinct on (d.user_id) d.user_id, d.time_zone, coalesce(s.reminder_hour, 19) as reminder_hour
            from devices d left join settings s on s.user_id = d.user_id
            where coalesce(s.reminders, true)
            order by d.user_id, d.seen_at desc
            """)
                .query((rs, n) -> new Reminded(
                        rs.getObject("user_id", UUID.class), rs.getString("time_zone"), rs.getInt("reminder_hour")))
                .list();
    }
}
