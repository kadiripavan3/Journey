package app.journey.api.journey;

import app.journey.api.common.Sql;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Reads and writes invite links. Only a hash of each link is kept. */
@Repository
public class InviteLinkStore {

    public record LinkRow(UUID id, UUID journeyId, UUID createdBy, Instant createdAt, Instant expiresAt, UUID usedBy) {

        public boolean usable(Instant now) {
            return usedBy == null && expiresAt.isAfter(now);
        }
    }

    private final JdbcClient jdbc;

    InviteLinkStore(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** Makes the journey's link. An earlier link nobody used stops working: a journey has one open link at a time. */
    public void replace(UUID journeyId, UUID createdBy, String tokenHash, Instant expiresAt) {
        jdbc.sql("delete from invite_links where journey_id = :journey and used_by is null")
                .param("journey", journeyId)
                .update();
        jdbc.sql(
                        "insert into invite_links (journey_id, token_hash, created_by, expires_at) values (:journey, :hash, :by, :expires)")
                .param("journey", journeyId)
                .param("hash", tokenHash)
                .param("by", createdBy)
                .param("expires", Sql.timestamp(expiresAt))
                .update();
    }

    public Optional<LinkRow> find(String tokenHash) {
        return jdbc.sql(
                        "select id, journey_id, created_by, created_at, expires_at, used_by from invite_links where token_hash = :hash")
                .param("hash", tokenHash)
                .query((rs, n) -> new LinkRow(
                        rs.getObject("id", UUID.class),
                        rs.getObject("journey_id", UUID.class),
                        rs.getObject("created_by", UUID.class),
                        Sql.instant(rs, "created_at"),
                        Sql.instant(rs, "expires_at"),
                        rs.getObject("used_by", UUID.class)))
                .optional();
    }

    /** True for the one person who gets to use the link. A second person, or a second try, gets false. */
    public boolean use(UUID id, UUID userId) {
        return jdbc.sql(
                                "update invite_links set used_by = :user, used_at = now() where id = :id and used_by is null and expires_at > now()")
                        .param("user", userId)
                        .param("id", id)
                        .update()
                > 0;
    }
}
