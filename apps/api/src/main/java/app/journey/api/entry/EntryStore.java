package app.journey.api.entry;

import app.journey.api.common.Rules;
import app.journey.api.common.Sql;
import app.journey.api.journey.LabelStyle;
import app.journey.api.media.MediaKind;
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
      UUID id, UUID journeyId, String journeyTitle, UUID journeyOwnerId, LabelStyle labelStyle, UUID authorId, String authorUsername, String authorName,
      String authorAvatarKey, Instant happenedAt, LocalDate happenedOn, int dayNumber, int position, String title, String body, String placeName,
      boolean milestone, int likeCount, int commentCount, Instant createdAt, Instant editedAt, boolean liked) {}

  public record EntryMediaRow(UUID entryId, UUID mediaId, MediaKind kind, String storageKey, Integer width, Integer height, Integer durationS) {}

  public record MilestoneRow(UUID id, String title, LocalDate happenedOn, int dayNumber, int position) {}

  /** What is new in a journey for one reader: how many entries, and the first of them in story order. */
  public record NewEntries(int count, UUID firstId) {}

  /** The order of a story: when things happened, then when they were written down. The id settles exact ties. */
  private static final String STORY_ORDER = "e.happened_at, e.created_at, e.id";

  /**
   * An entry with its author, its day number (from the journey's start date), its position (its place in the
   * story, counting from 1), and whether the viewer liked it.
   */
  private static final String COLUMNS =
      """
      e.id, e.journey_id, j.title as journey_title, j.owner_id as journey_owner_id, j.label_style, e.author_id,
      p.username as author_username, p.display_name as author_name, pa.storage_key as author_avatar_key,
      e.happened_at, e.happened_on, (e.happened_on - j.start_date + 1) as day_number,
      (select count(*) from entries x where x.journey_id = e.journey_id
        and (x.happened_at, x.created_at, x.id) <= (e.happened_at, e.created_at, e.id)) as position,
      e.title, e.body, e.place_name, e.is_milestone, e.like_count, e.comment_count, e.created_at, e.edited_at,
      exists (select 1 from entry_likes l where l.entry_id = e.id and l.user_id = :viewer) as liked
      """;

  private static final String FROM =
      """
      from entries e
      join journeys j on j.id = e.journey_id
      join profiles p on p.id = e.author_id
      left join media pa on pa.id = p.avatar_media_id
      """;

  private static final String SELECT = "select " + COLUMNS + FROM;

  /** Entries by someone the viewer has blocked, or who has blocked them, are left out of every read. */
  private static final String NOT_BLOCKED = " and " + Rules.notBlocked("e.author_id", ":viewer");

  private static final RowMapper<EntryRow> ROW =
      (rs, n) -> new EntryRow(
          rs.getObject("id", UUID.class), rs.getObject("journey_id", UUID.class), rs.getString("journey_title"), rs.getObject("journey_owner_id", UUID.class),
          LabelStyle.read(rs.getString("label_style")), rs.getObject("author_id", UUID.class), rs.getString("author_username"), rs.getString("author_name"),
          rs.getString("author_avatar_key"), Sql.instant(rs, "happened_at"), rs.getObject("happened_on", LocalDate.class), rs.getInt("day_number"),
          rs.getInt("position"), rs.getString("title"), rs.getString("body"), rs.getString("place_name"), rs.getBoolean("is_milestone"),
          rs.getInt("like_count"), rs.getInt("comment_count"), Sql.instant(rs, "created_at"), Sql.instant(rs, "edited_at"), rs.getBoolean("liked"));

  private final JdbcClient jdbc;

  EntryStore(JdbcClient jdbc) {
    this.jdbc = jdbc;
  }

  public Optional<EntryRow> find(UUID id, UUID viewer) {
    return jdbc.sql(SELECT + " where e.id = :id" + NOT_BLOCKED).param("id", id).param("viewer", viewer).query(ROW).optional();
  }

  /** The entries with these ids that the viewer may read, in no particular order. Their journeys must be checked by the caller. */
  public List<EntryRow> findAll(List<UUID> ids, UUID viewer) {
    if (ids.isEmpty()) {
      return List.of();
    }
    return jdbc.sql(SELECT + " where e.id in (:ids)" + NOT_BLOCKED).param("ids", ids).param("viewer", viewer).query(ROW).list();
  }

  /** The entry this person already made from the same draft, if the app is sending it a second time. */
  public Optional<UUID> findByClientId(UUID authorId, UUID clientId) {
    return jdbc.sql("select id from entries where author_id = :author and client_id = :client")
        .param("author", authorId).param("client", clientId).query(UUID.class).optional();
  }

  /** Part of a journey's story, in the order things happened. */
  public List<EntryRow> timeline(UUID journeyId, UUID viewer, int limit, int offset) {
    return jdbc.sql(SELECT + " where e.journey_id = :journey" + NOT_BLOCKED + " order by " + STORY_ORDER + " limit :limit offset :offset")
        .param("journey", journeyId).param("viewer", viewer).param("limit", limit).param("offset", offset).query(ROW).list();
  }

  /** The newest part of the story, newest first. */
  public List<EntryRow> latest(UUID journeyId, UUID viewer, int limit) {
    return jdbc.sql(SELECT + " where e.journey_id = :journey" + NOT_BLOCKED + " order by e.happened_at desc, e.created_at desc, e.id desc limit :limit")
        .param("journey", journeyId).param("viewer", viewer).param("limit", limit).query(ROW).list();
  }

  /** How many entries of a journey this viewer can read. */
  public int count(UUID journeyId, UUID viewer) {
    return jdbc.sql("select count(*) from entries e where e.journey_id = :journey" + NOT_BLOCKED)
        .param("journey", journeyId).param("viewer", viewer).query(Integer.class).single();
  }

  /** How many entries come before this one in the story, as this viewer reads it. */
  public int countBefore(UUID journeyId, UUID entryId, UUID viewer) {
    return jdbc.sql(
            """
            select count(*) from entries e, entries t
            where t.id = :entry and e.journey_id = :journey and (e.happened_at, e.created_at, e.id) < (t.happened_at, t.created_at, t.id)
            """ + NOT_BLOCKED)
        .param("journey", journeyId).param("entry", entryId).param("viewer", viewer).query(Integer.class).single();
  }

  /**
   * For each journey, its newest entries by people other than the reader, most recently posted first. One
   * statement for the whole Home feed, however many journeys are on it.
   */
  public Map<UUID, List<EntryRow>> latestByOthers(List<UUID> journeyIds, UUID reader, int perJourney) {
    if (journeyIds.isEmpty()) {
      return Map.of();
    }
    return jdbc.sql(
            "select * from (select " + COLUMNS + ", row_number() over (partition by e.journey_id order by e.created_at desc, e.id) as rn " + FROM
                + " where e.journey_id in (:journeys) and e.author_id <> :viewer" + NOT_BLOCKED + ") ranked where rn <= :each order by journey_id, rn")
        .param("journeys", journeyIds).param("viewer", reader).param("each", perJourney).query(ROW).list().stream()
        .collect(Collectors.groupingBy(EntryRow::journeyId));
  }

  /** What other people added to a journey after a moment in time, as this reader sees it. */
  public NewEntries newSince(UUID journeyId, UUID viewer, Instant since) {
    return jdbc.sql(
            "select count(*) as n, (array_agg(e.id order by " + STORY_ORDER + "))[1] as first_id from entries e"
                + " where e.journey_id = :journey and e.author_id <> :viewer and e.created_at > :since" + NOT_BLOCKED)
        .param("journey", journeyId).param("viewer", viewer).param("since", Sql.timestamp(since))
        .query((rs, n) -> new NewEntries(rs.getInt("n"), rs.getObject("first_id", UUID.class)))
        .single();
  }

  /** The story's first photos, in story order. */
  public List<EntryMediaRow> photos(UUID journeyId, UUID viewer, int limit) {
    return jdbc.sql(
            """
            select em.entry_id, m.id, m.kind, m.storage_key, m.width, m.height, m.duration_s
            from entries e join entry_media em on em.entry_id = e.id join media m on m.id = em.media_id and m.kind = 'photo'
            where e.journey_id = :journey
            """ + NOT_BLOCKED + " order by " + STORY_ORDER + ", em.position limit :limit")
        .param("journey", journeyId).param("viewer", viewer).param("limit", limit).query(MEDIA).list();
  }

  public int photoCount(UUID journeyId, UUID viewer) {
    return jdbc.sql(
            """
            select count(*) from entries e join entry_media em on em.entry_id = e.id join media m on m.id = em.media_id and m.kind = 'photo'
            where e.journey_id = :journey
            """ + NOT_BLOCKED)
        .param("journey", journeyId).param("viewer", viewer).query(Integer.class).single();
  }

  /** The day numbers that have at least one entry, for the challenge card's row of ticks. */
  public List<Integer> days(UUID journeyId, int limit) {
    return jdbc.sql(
            """
            select distinct (e.happened_on - j.start_date + 1) as day from entries e join journeys j on j.id = e.journey_id
            where e.journey_id = :journey order by day limit :limit
            """)
        .param("journey", journeyId).param("limit", limit).query(Integer.class).list();
  }

  /** The story's big moments, in story order, for "Jump to". */
  public List<MilestoneRow> milestones(UUID journeyId, UUID viewer, int limit) {
    return jdbc.sql(
            """
            select e.id, coalesce(nullif(e.title, ''), left(e.body, 60)) as title, e.happened_on, (e.happened_on - j.start_date + 1) as day_number,
                   (select count(*) from entries x where x.journey_id = e.journey_id
                     and (x.happened_at, x.created_at, x.id) <= (e.happened_at, e.created_at, e.id)) as position
            from entries e join journeys j on j.id = e.journey_id
            where e.journey_id = :journey and e.is_milestone
            """ + NOT_BLOCKED + " order by " + STORY_ORDER + " limit :limit")
        .param("journey", journeyId).param("viewer", viewer).param("limit", limit)
        .query((rs, n) -> new MilestoneRow(
            rs.getObject("id", UUID.class), rs.getString("title"), rs.getObject("happened_on", LocalDate.class), rs.getInt("day_number"), rs.getInt("position")))
        .list();
  }

  private static final RowMapper<EntryMediaRow> MEDIA =
      (rs, n) -> new EntryMediaRow(
          rs.getObject("entry_id", UUID.class), rs.getObject("id", UUID.class), MediaKind.read(rs.getString("kind")), rs.getString("storage_key"),
          (Integer) rs.getObject("width"), (Integer) rs.getObject("height"), (Integer) rs.getObject("duration_s"));

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
        .param("ids", entryIds).query(MEDIA).list().stream()
        .collect(Collectors.groupingBy(EntryMediaRow::entryId));
  }

  public UUID insert(UUID journeyId, UUID authorId, UUID clientId, Instant happenedAt, LocalDate happenedOn, String title, String body, String placeName,
      boolean milestone) {
    return jdbc.sql(
            """
            insert into entries (journey_id, author_id, client_id, happened_at, happened_on, title, body, place_name, is_milestone)
            values (:journey, :author, cast(:client as uuid), :happenedAt, :happenedOn, :title, :body, :place, :milestone)
            returning id
            """)
        .param("journey", journeyId).param("author", authorId).param("client", clientId == null ? null : clientId.toString())
        .param("happenedAt", Sql.timestamp(happenedAt)).param("happenedOn", happenedOn)
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

  /** True when the like is new. The database keeps the entry's like count. */
  public boolean like(UUID entryId, UUID userId) {
    return jdbc.sql("insert into entry_likes (entry_id, user_id) values (:entry, :user) on conflict do nothing")
        .param("entry", entryId).param("user", userId).update() > 0;
  }

  public void unlike(UUID entryId, UUID userId) {
    jdbc.sql("delete from entry_likes where entry_id = :entry and user_id = :user").param("entry", entryId).param("user", userId).update();
  }

  /** A new entry wakes a paused journey. (The entry count and "last entry" are kept by the database.) */
  public void wakeJourney(UUID journeyId) {
    jdbc.sql("update journeys set status = case when status = 'paused' then 'active' else status end, updated_at = now() where id = :journey")
        .param("journey", journeyId).update();
  }
}
