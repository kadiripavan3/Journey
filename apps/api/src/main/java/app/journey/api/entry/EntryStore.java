package app.journey.api.entry;

import app.journey.api.common.Sql;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Everything the API reads and writes about entries, as plain SQL. */
@Repository
public class EntryStore {

  public record EntryRow(
      UUID id, UUID journeyId, String journeyTitle, UUID journeyOwnerId, String labelStyle, UUID authorId, String authorUsername, String authorName,
      String authorAvatarKey, Instant happenedAt, LocalDate happenedOn, int dayNumber, int partNumber, String title, String body, String placeName,
      boolean milestone, int likeCount, int commentCount, Instant createdAt, Instant editedAt, boolean liked) {}

  public record EntryMediaRow(UUID entryId, UUID mediaId, String kind, String storageKey, Integer width, Integer height, Integer durationS) {}

  /** An entry with its author, its day number (from the journey's start date), its part number (its place in the story), and whether the viewer liked it. */
  private static final String SELECT =
      """
      select e.id, e.journey_id, j.title as journey_title, j.owner_id as journey_owner_id, j.label_style, e.author_id,
             p.username as author_username, p.display_name as author_name, pa.storage_key as author_avatar_key,
             e.happened_at, e.happened_on, (e.happened_on - j.start_date + 1) as day_number,
             (select count(*) from entries x where x.journey_id = e.journey_id and (x.happened_at, x.created_at) <= (e.happened_at, e.created_at)) as part_number,
             e.title, e.body, e.place_name, e.is_milestone, e.like_count, e.comment_count, e.created_at, e.edited_at,
             exists (select 1 from entry_likes l where l.entry_id = e.id and l.user_id = :viewer) as liked
      from entries e
      join journeys j on j.id = e.journey_id
      join profiles p on p.id = e.author_id
      left join media pa on pa.id = p.avatar_media_id
      """;

  private static final RowMapper<EntryRow> ROW =
      (rs, n) -> new EntryRow(
          rs.getObject("id", UUID.class), rs.getObject("journey_id", UUID.class), rs.getString("journey_title"), rs.getObject("journey_owner_id", UUID.class),
          rs.getString("label_style"), rs.getObject("author_id", UUID.class), rs.getString("author_username"), rs.getString("author_name"),
          rs.getString("author_avatar_key"), Sql.instant(rs, "happened_at"), rs.getObject("happened_on", LocalDate.class), rs.getInt("day_number"),
          rs.getInt("part_number"), rs.getString("title"), rs.getString("body"), rs.getString("place_name"), rs.getBoolean("is_milestone"),
          rs.getInt("like_count"), rs.getInt("comment_count"), Sql.instant(rs, "created_at"), Sql.instant(rs, "edited_at"), rs.getBoolean("liked"));

  private final JdbcClient jdbc;

  EntryStore(JdbcClient jdbc) {
    this.jdbc = jdbc;
  }

  public Optional<EntryRow> find(UUID id, UUID viewer) {
    return jdbc.sql(SELECT + " where e.id = :id").param("id", id).param("viewer", viewer).query(ROW).optional();
  }

  /** A journey's entries in the order things happened. */
  public List<EntryRow> timeline(UUID journeyId, UUID viewer, int limit) {
    return jdbc.sql(SELECT + " where e.journey_id = :journey order by e.happened_at, e.created_at limit :limit")
        .param("journey", journeyId).param("viewer", viewer).param("limit", limit).query(ROW).list();
  }

  /** The newest entries in a journey by people other than the reader, most recently posted first. */
  public List<EntryRow> latestByOthers(UUID journeyId, UUID reader, int limit) {
    return jdbc.sql(SELECT + " where e.journey_id = :journey and e.author_id <> :reader order by e.created_at desc limit :limit")
        .param("journey", journeyId).param("reader", reader).param("viewer", reader).param("limit", limit).query(ROW).list();
  }

  public Map<UUID, List<EntryMediaRow>> mediaFor(List<UUID> entryIds) {
    if (entryIds.isEmpty()) {
      return Map.of();
    }
    return jdbc.sql(
            """
            select em.entry_id, m.id, m.kind, m.storage_key, m.width, m.height, m.duration_s
            from entry_media em join media m on m.id = em.media_id
            where em.entry_id in (:ids)
            order by em.entry_id, em.position
            """)
        .param("ids", entryIds)
        .query((rs, n) -> new EntryMediaRow(
            rs.getObject("entry_id", UUID.class), rs.getObject("id", UUID.class), rs.getString("kind"), rs.getString("storage_key"),
            (Integer) rs.getObject("width"), (Integer) rs.getObject("height"), (Integer) rs.getObject("duration_s")))
        .list().stream()
        .collect(Collectors.groupingBy(EntryMediaRow::entryId));
  }

  public UUID insert(UUID journeyId, UUID authorId, Instant happenedAt, LocalDate happenedOn, String title, String body, String placeName, boolean milestone) {
    return jdbc.sql(
            """
            insert into entries (journey_id, author_id, happened_at, happened_on, title, body, place_name, is_milestone)
            values (:journey, :author, :happenedAt, :happenedOn, :title, :body, :place, :milestone)
            returning id
            """)
        .param("journey", journeyId).param("author", authorId).param("happenedAt", Sql.timestamp(happenedAt)).param("happenedOn", happenedOn)
        .param("title", title).param("body", body).param("place", placeName).param("milestone", milestone)
        .query(UUID.class).single();
  }

  public void update(UUID id, Instant happenedAt, LocalDate happenedOn, String title, String body, String placeName, boolean milestone) {
    jdbc.sql(
            """
            update entries set happened_at = :happenedAt, happened_on = :happenedOn, title = :title, body = :body, place_name = :place,
              is_milestone = :milestone, edited_at = now()
            where id = :id
            """)
        .param("happenedAt", Sql.timestamp(happenedAt)).param("happenedOn", happenedOn).param("title", title).param("body", body)
        .param("place", placeName).param("milestone", milestone).param("id", id)
        .update();
  }

  public void replaceMedia(UUID entryId, List<UUID> mediaIds) {
    jdbc.sql("delete from entry_media where entry_id = :entry").param("entry", entryId).update();
    for (int i = 0; i < mediaIds.size(); i++) {
      jdbc.sql("insert into entry_media (entry_id, media_id, position) values (:entry, :media, :position)")
          .param("entry", entryId).param("media", mediaIds.get(i)).param("position", i).update();
    }
  }

  public void delete(UUID id) {
    jdbc.sql("delete from entries where id = :id").param("id", id).update();
  }

  /** True when the like is new. */
  public boolean like(UUID entryId, UUID userId) {
    int added = jdbc.sql("insert into entry_likes (entry_id, user_id) values (:entry, :user) on conflict do nothing")
        .param("entry", entryId).param("user", userId).update();
    refreshLikeCount(entryId);
    return added > 0;
  }

  public void unlike(UUID entryId, UUID userId) {
    jdbc.sql("delete from entry_likes where entry_id = :entry and user_id = :user").param("entry", entryId).param("user", userId).update();
    refreshLikeCount(entryId);
  }

  private void refreshLikeCount(UUID entryId) {
    jdbc.sql("update entries set like_count = (select count(*) from entry_likes l where l.entry_id = :entry) where id = :entry")
        .param("entry", entryId).update();
  }

  public void refreshCommentCount(UUID entryId) {
    jdbc.sql("update entries set comment_count = (select count(*) from comments c where c.entry_id = :entry) where id = :entry")
        .param("entry", entryId).update();
  }

  /** Keeps the journey's counters right after entries are added or removed. A new entry also wakes a paused journey. */
  public void refreshJourneyCounters(UUID journeyId, boolean entryAdded) {
    jdbc.sql(
            """
            update journeys j set
              entry_count = (select count(*) from entries e where e.journey_id = j.id),
              last_entry_at = (select max(e.created_at) from entries e where e.journey_id = j.id),
              status = case when :added and j.status = 'paused' then 'active' else j.status end,
              updated_at = now()
            where j.id = :journey
            """)
        .param("added", entryAdded).param("journey", journeyId).update();
  }
}
