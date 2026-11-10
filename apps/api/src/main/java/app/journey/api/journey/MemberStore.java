package app.journey.api.journey;

import app.journey.api.common.Page;
import app.journey.api.common.PageRequest;
import app.journey.api.common.Rules;
import app.journey.api.common.Sql;
import app.journey.api.people.PeopleStore.PersonRow;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Reads and writes who is on a shared journey. */
@Repository
public class MemberStore {

  public record MemberRow(UUID userId, String username, String name, String avatarKey, MemberStatus status, Instant since) {}

  /** An invitation waiting for an answer. */
  public record Waiting(UUID journeyId, UUID invitedBy, Instant at) {}

  private final JdbcClient jdbc;

  MemberStore(JdbcClient jdbc) {
    this.jdbc = jdbc;
  }

  /** Everyone asked onto a journey, in the order they were asked: those who joined and those still deciding. */
  public List<MemberRow> members(UUID journeyId) {
    return jdbc.sql(
            """
            select p.id, p.username, p.display_name, a.storage_key as avatar_key, m.status, coalesce(m.joined_at, m.created_at) as since
            from journey_members m join profiles p on p.id = m.user_id left join media a on a.id = p.avatar_media_id
            where m.journey_id = :journey order by m.created_at
            """)
        .param("journey", journeyId)
        .query((rs, n) -> new MemberRow(rs.getObject("id", UUID.class), rs.getString("username"), rs.getString("display_name"), rs.getString("avatar_key"),
            MemberStatus.read(rs.getString("status")), Sql.instant(rs, "since")))
        .list();
  }

  /** How many entries each author has written in a journey. */
  public Map<UUID, Integer> entryCounts(UUID journeyId) {
    record Count(UUID author, int entries) {}
    return jdbc.sql("select author_id, count(*) as n from entries where journey_id = :journey group by author_id")
        .param("journey", journeyId)
        .query((rs, n) -> new Count(rs.getObject("author_id", UUID.class), rs.getInt("n")))
        .list().stream().collect(Collectors.toMap(Count::author, Count::entries));
  }

  /** True when the person was asked onto the journey, whether or not they have answered. */
  public boolean isAsked(UUID journeyId, UUID userId) {
    return jdbc.sql("select exists (select 1 from journey_members where journey_id = :journey and user_id = :user)")
        .param("journey", journeyId).param("user", userId).query(Boolean.class).single();
  }

  /** The owner's followers who could be invited, most recent followers first. People only get invitations from someone they follow. */
  public Page<PersonRow> invitable(UUID journeyId, UUID owner, PageRequest page) {
    List<PersonRow> rows = jdbc.sql(
            """
            select p.id, p.username, p.display_name, a.storage_key as avatar_key
            from profile_follows f join profiles p on p.id = f.follower_id left join media a on a.id = p.avatar_media_id
            where f.followee_id = :me
              and not exists (select 1 from journey_members m where m.journey_id = :journey and m.user_id = p.id)
              and %s
            order by f.created_at desc, p.id limit :limit offset :offset
            """.formatted(Rules.notBlocked("p.id", ":me")))
        .param("me", owner).param("journey", journeyId).param("limit", page.fetch()).param("offset", page.offset())
        .query((rs, n) -> new PersonRow(rs.getObject("id", UUID.class), rs.getString("username"), rs.getString("display_name"), rs.getString("avatar_key")))
        .list();
    return Page.of(rows, page);
  }

  public void invite(UUID journeyId, UUID friend, UUID owner) {
    jdbc.sql("insert into journey_members (journey_id, user_id, status, invited_by) values (:journey, :friend, 'invited', :owner)")
        .param("journey", journeyId).param("friend", friend).param("owner", owner).update();
  }

  /** True when there was an invitation to say yes to. */
  public boolean accept(UUID journeyId, UUID userId) {
    return jdbc.sql("update journey_members set status = 'joined', joined_at = now() where journey_id = :journey and user_id = :me and status = 'invited'")
        .param("journey", journeyId).param("me", userId).update() > 0;
  }

  public void remove(UUID journeyId, UUID userId) {
    jdbc.sql("delete from journey_members where journey_id = :journey and user_id = :person").param("journey", journeyId).param("person", userId).update();
  }

  /** Invitations waiting for this person's answer, newest first. */
  public Page<Waiting> waiting(UUID userId, PageRequest page) {
    List<Waiting> rows = jdbc.sql(
            """
            select journey_id, invited_by, created_at from journey_members
            where user_id = :me and status = 'invited' order by created_at desc, journey_id limit :limit offset :offset
            """)
        .param("me", userId).param("limit", page.fetch()).param("offset", page.offset())
        .query((rs, n) -> new Waiting(rs.getObject("journey_id", UUID.class), rs.getObject("invited_by", UUID.class), Sql.instant(rs, "created_at")))
        .list();
    return Page.of(rows, page);
  }
}
