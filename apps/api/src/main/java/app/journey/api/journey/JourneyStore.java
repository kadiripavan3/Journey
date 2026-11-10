package app.journey.api.journey;

import app.journey.api.common.Sql;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Everything the API reads and writes about journeys and follows, as plain SQL. */
@Repository
public class JourneyStore {

  public record JourneyRow(
      UUID id, UUID ownerId, String title, String description, String category, String template, String labelStyle, String visibility, String status,
      List<String> tags, LocalDate startDate, Integer targetDays, Instant completedAt, String closingNote, Instant lastEntryAt, int entryCount,
      int followerCount, Instant createdAt, String ownerUsername, String ownerName, String ownerAvatarKey, String coverKey, LocalDate latestOn, boolean following, Instant lastReadAt) {}

  /** Every journey with its owner, its cover (the chosen one, or else the first photo), and whether and since when the viewer follows it. */
  private static final String SELECT =
      """
      select j.id, j.owner_id, j.title, j.description, j.category, j.template, j.label_style, j.visibility, j.status, j.tags,
             j.start_date, j.target_days, j.completed_at, j.closing_note, j.last_entry_at, j.entry_count, j.follower_count, j.created_at,
             p.username as owner_username, p.display_name as owner_name, pa.storage_key as owner_avatar_key,
             coalesce(cm.storage_key, (
               select m.storage_key from entries e
               join entry_media em on em.entry_id = e.id
               join media m on m.id = em.media_id
               where e.journey_id = j.id and m.kind = 'photo'
               order by e.happened_at, em.position limit 1)) as cover_key,
             (select max(e.happened_on) from entries e where e.journey_id = j.id) as latest_on,
             vf.user_id is not null as following, vf.last_read_at
      from journeys j
      join profiles p on p.id = j.owner_id
      left join journey_follows vf on vf.journey_id = j.id and vf.user_id = :viewer
      left join media pa on pa.id = p.avatar_media_id
      left join media cm on cm.id = j.cover_media_id
      """;

  private static final RowMapper<JourneyRow> ROW =
      (rs, n) -> new JourneyRow(
          rs.getObject("id", UUID.class), rs.getObject("owner_id", UUID.class), rs.getString("title"), rs.getString("description"),
          rs.getString("category"), rs.getString("template"), rs.getString("label_style"), rs.getString("visibility"), rs.getString("status"),
          Sql.strings(rs, "tags"), rs.getObject("start_date", LocalDate.class), (Integer) rs.getObject("target_days"),
          Sql.instant(rs, "completed_at"), rs.getString("closing_note"), Sql.instant(rs, "last_entry_at"), rs.getInt("entry_count"),
          rs.getInt("follower_count"), Sql.instant(rs, "created_at"), rs.getString("owner_username"), rs.getString("owner_name"),
          rs.getString("owner_avatar_key"), rs.getString("cover_key"), rs.getObject("latest_on", LocalDate.class), rs.getBoolean("following"),
          Sql.instant(rs, "last_read_at"));

  private final JdbcClient jdbc;

  JourneyStore(JdbcClient jdbc) {
    this.jdbc = jdbc;
  }

  /** Blocking hides journeys both ways: from the person blocked, and their own from the person who blocked them. */
  private static final String NOT_BLOCKED =
      " and not exists (select 1 from blocks b where (b.blocker_id = :viewer and b.blocked_id = j.owner_id) or (b.blocker_id = j.owner_id and b.blocked_id = :viewer))";

  public Optional<JourneyRow> find(UUID id, UUID viewer) {
    return jdbc.sql(SELECT + " where j.id = :id" + NOT_BLOCKED).param("viewer", viewer).param("id", id).query(ROW).optional();
  }

  /** Journeys matching a condition, written against the aliases j (journey) and p (owner). */
  public List<JourneyRow> list(String where, Map<String, ?> params, String orderBy, int limit, UUID viewer) {
    return jdbc.sql(SELECT + " where (" + where + ")" + NOT_BLOCKED + " order by " + orderBy + " limit :limit")
        .params(params).param("viewer", viewer).param("limit", limit).query(ROW).list();
  }

  public UUID insert(UUID ownerId, String title, String description, String category, String template, String labelStyle, String visibility,
      List<String> tags, UUID coverMediaId, LocalDate startDate, Integer targetDays) {
    return jdbc.sql(
            """
            insert into journeys (owner_id, title, description, category, template, label_style, visibility, tags, cover_media_id, start_date, target_days)
            values (:owner, :title, :description, :category, :template, :labelStyle, :visibility, cast(:tags as text[]), cast(:cover as uuid), :startDate, cast(:targetDays as int))
            returning id
            """)
        .param("owner", ownerId).param("title", title).param("description", description).param("category", category).param("template", template)
        .param("labelStyle", labelStyle).param("visibility", visibility).param("tags", Sql.arrayLiteral(tags))
        .param("cover", coverMediaId == null ? null : coverMediaId.toString()).param("startDate", startDate)
        .param("targetDays", targetDays == null ? null : targetDays.toString())
        .query(UUID.class).single();
  }

  public void update(UUID id, String title, String description, String category, String labelStyle, String visibility, List<String> tags,
      UUID coverMediaId, LocalDate startDate, String status) {
    jdbc.sql(
            """
            update journeys set title = :title, description = :description, category = :category, label_style = :labelStyle,
              visibility = :visibility, tags = cast(:tags as text[]), cover_media_id = cast(:cover as uuid), start_date = :startDate,
              status = :status, updated_at = now()
            where id = :id
            """)
        .param("title", title).param("description", description).param("category", category).param("labelStyle", labelStyle)
        .param("visibility", visibility).param("tags", Sql.arrayLiteral(tags)).param("cover", coverMediaId == null ? null : coverMediaId.toString())
        .param("startDate", startDate).param("status", status).param("id", id)
        .update();
  }

  public UUID coverMediaId(UUID id) {
    return jdbc.sql("select cover_media_id from journeys where id = :id").param("id", id).query(UUID.class).optional().orElse(null);
  }

  public LocalDate earliestEntryDate(UUID id) {
    return jdbc.sql("select min(happened_on) from entries where journey_id = :id").param("id", id).query(LocalDate.class).optional().orElse(null);
  }

  public void complete(UUID id, String closingNote) {
    jdbc.sql("update journeys set status = 'completed', completed_at = now(), closing_note = :note, updated_at = now() where id = :id")
        .param("note", closingNote).param("id", id).update();
  }

  public void delete(UUID id) {
    jdbc.sql("delete from journeys where id = :id").param("id", id).update();
  }

  /**
   * True when the follow is new. A new follower starts with the journey's latest entry unread,
   * so following a journey puts its newest chapter on their Home straight away.
   */
  public boolean follow(UUID userId, UUID journeyId) {
    int added = jdbc.sql(
            """
            insert into journey_follows (user_id, journey_id, last_read_at)
            values (:user, :journey,
                    coalesce((select max(e.created_at) - interval '1 millisecond' from entries e where e.journey_id = :journey and e.author_id <> :user), now()))
            on conflict do nothing
            """)
        .param("user", userId).param("journey", journeyId).update();
    if (added > 0) {
      jdbc.sql("update journeys set follower_count = follower_count + 1 where id = :id").param("id", journeyId).update();
    }
    return added > 0;
  }

  /** Everyone who follows the owner starts following this journey too, with nothing marked as new yet. */
  public void followForFollowersOf(UUID ownerId, UUID journeyId) {
    jdbc.sql(
            """
            insert into journey_follows (user_id, journey_id, auto)
            select pf.follower_id, :journey, true from profile_follows pf where pf.followee_id = :owner
            on conflict do nothing
            """)
        .param("owner", ownerId).param("journey", journeyId).update();
    jdbc.sql("update journeys set follower_count = (select count(*) from journey_follows f where f.journey_id = :id) where id = :id")
        .param("id", journeyId).update();
  }

  /** What a finished (or unfinished) journey adds up to. */
  public record Totals(int entries, int places, int photos, int likes, LocalDate firstDay, LocalDate lastDay) {}

  public Totals totals(UUID journeyId) {
    return jdbc.sql(
            """
            select count(*) as entries, count(distinct nullif(e.place_name, '')) as places, coalesce(sum(e.like_count), 0) as likes,
                   min(e.happened_on) as first_day, max(e.happened_on) as last_day,
                   (select count(*) from entry_media em join entries x on x.id = em.entry_id join media m on m.id = em.media_id
                     where x.journey_id = :id and m.kind = 'photo') as photos
            from entries e where e.journey_id = :id
            """)
        .param("id", journeyId)
        .query((rs, n) -> new Totals(rs.getInt("entries"), rs.getInt("places"), rs.getInt("photos"), rs.getInt("likes"),
            rs.getObject("first_day", LocalDate.class), rs.getObject("last_day", LocalDate.class)))
        .single();
  }

  /** The photos of a journey's best moments: milestones first, then the most liked. */
  public List<String> momentKeys(UUID journeyId, int limit) {
    return jdbc.sql(
            """
            select m.storage_key from entries e
            join entry_media em on em.entry_id = e.id and em.position = 0
            join media m on m.id = em.media_id and m.kind = 'photo'
            where e.journey_id = :id
            order by e.is_milestone desc, e.like_count desc, e.happened_at
            limit :limit
            """)
        .param("id", journeyId).param("limit", limit).query(String.class).list();
  }

  public void unfollow(UUID userId, UUID journeyId) {
    int removed = jdbc.sql("delete from journey_follows where user_id = :user and journey_id = :journey")
        .param("user", userId).param("journey", journeyId).update();
    if (removed > 0) {
      jdbc.sql("update journeys set follower_count = greatest(follower_count - 1, 0) where id = :id").param("id", journeyId).update();
    }
  }

  public void markRead(UUID userId, UUID journeyId) {
    jdbc.sql("update journey_follows set last_read_at = now() where user_id = :user and journey_id = :journey")
        .param("user", userId).param("journey", journeyId).update();
  }

  public int followingCount(UUID userId) {
    return jdbc.sql("select count(*) from journey_follows where user_id = :user").param("user", userId).query(Integer.class).single();
  }

  public record NewInJourney(UUID journeyId, int newCount) {}

  /** Followed journeys with entries posted by others since the reader's last visit, most recent first. */
  public List<NewInJourney> journeysWithNewEntries(UUID userId, int limit) {
    return jdbc.sql(
            """
            select f.journey_id, count(*) as new_count, max(e.created_at) as latest
            from journey_follows f
            join entries e on e.journey_id = f.journey_id and e.created_at > f.last_read_at and e.author_id <> :user
            where f.user_id = :user
            group by f.journey_id
            order by latest desc
            limit :limit
            """)
        .param("user", userId).param("limit", limit)
        .query((rs, n) -> new NewInJourney(rs.getObject("journey_id", UUID.class), rs.getInt("new_count")))
        .list();
  }
}
