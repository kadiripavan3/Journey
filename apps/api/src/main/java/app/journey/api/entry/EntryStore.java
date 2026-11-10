package app.journey.api.entry;

import app.journey.api.common.Keyset;
import app.journey.api.common.Page;
import app.journey.api.common.Rules;
import app.journey.api.common.Sql;
import app.journey.api.journey.LabelStyle;
import app.journey.api.media.MediaKind;
import app.journey.api.media.MediaStatus;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
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
            UUID id,
            UUID journeyId,
            String journeyTitle,
            UUID journeyOwnerId,
            LabelStyle labelStyle,
            UUID authorId,
            String authorUsername,
            String authorName,
            String authorAvatarKey,
            Instant happenedAt,
            LocalDate happenedOn,
            int dayNumber,
            int position,
            String title,
            String body,
            String placeName,
            Double lat,
            Double lng,
            LocationPrecision precision,
            boolean milestone,
            int likeCount,
            int commentCount,
            Instant createdAt,
            Instant editedAt,
            boolean liked) {}

    public record EntryMediaRow(
            UUID entryId,
            UUID mediaId,
            MediaKind kind,
            MediaStatus status,
            String storageKey,
            String playbackId,
            Integer width,
            Integer height,
            Integer durationS,
            boolean held) {}

    public record MilestoneRow(UUID id, String title, LocalDate happenedOn, int dayNumber, int position) {}

    /** One day of a story: how many entries the reader may see on it, the first of them, and where it was. */
    public record StoryDayRow(LocalDate happenedOn, int dayNumber, int entries, UUID firstId, String place) {}

    /** What is new in a journey for one reader: how many entries, and the first of them in story order. */
    public record NewEntries(int count, UUID firstId) {}

    /** A place in a story: the three things a story is ordered by. A page of a story starts or ends at one. */
    public record Edge(Instant happenedAt, Instant createdAt, UUID id) {

        public static Edge of(EntryRow entry) {
            return new Edge(entry.happenedAt(), entry.createdAt(), entry.id());
        }
    }

    /** Part of a story on either side of an {@link Edge}, each side in story order. */
    public record Around(List<EntryRow> before, List<EntryRow> after) {}

    /** An entry on the map, with only what a pin shows. */
    public record PinRow(
            UUID id,
            UUID authorId,
            String title,
            String bodyStart,
            String placeName,
            Double lat,
            Double lng,
            LocationPrecision precision,
            boolean milestone,
            LocalDate happenedOn,
            int dayNumber,
            int position,
            LabelStyle labelStyle) {}

    /** The story's first photos, and how many photos it has in all. */
    public record Photos(List<EntryMediaRow> first, int total) {}

    /** The order of a story: when things happened, then when they were written down. The id settles exact ties. */
    private static final String STORY_ORDER = "e.happened_at, e.created_at, e.id";

    private static final String STORY_ORDER_BACKWARDS = "e.happened_at desc, e.created_at desc, e.id desc";

    /**
     * An entry's place in its story, counting from 1, for an entry looked up by itself: the entries up to it
     * are counted in the index that holds the story in order (V34).
     */
    private static final String COUNTED = """
      (select count(*) from entries x where x.journey_id = e.journey_id
        and (x.happened_at, x.created_at, x.id) <= (e.happened_at, e.created_at, e.id))""";

    /**
     * Every entry's place in the story of the journey {@code :journey}, numbered in one pass over that index.
     * Reading several entries of one story joins this, instead of counting again for each of them.
     */
    private static final String STORY = """
       join (select x.id as entry_id, row_number() over (order by x.happened_at, x.created_at, x.id) as position
             from entries x where x.journey_id = :journey) story on story.entry_id = e.id
      """;

    /**
     * An entry with its author, its day number (from the journey's start date), its position (its place in the
     * story, counting from 1), and whether the viewer liked it.
     */
    private static String columns(String position) {
        return """
      e.id, e.journey_id, j.title as journey_title, j.owner_id as journey_owner_id, j.label_style, e.author_id,
      p.username as author_username, p.display_name as author_name, pa.storage_key as author_avatar_key,
      e.happened_at, e.happened_on, (e.happened_on - j.start_date + 1) as day_number,
      %s as position,
      e.title, e.body, e.place_name, e.lat, e.lng, e.location_precision, e.is_milestone, e.like_count, e.comment_count, e.created_at, e.edited_at,
      exists (select 1 from entry_likes l where l.entry_id = e.id and l.user_id = :viewer) as liked
      """.formatted(position);
    }

    private static final String FROM = """
      from entries e
      join journeys j on j.id = e.journey_id
      join profiles p on p.id = e.author_id
      """ + Rules.chosenPhoto("pa", "p.avatar_media_id");

    /** One entry, or a few picked by id. */
    private static final String SELECT = "select " + columns(COUNTED) + FROM;

    /** Entries by someone the viewer has blocked, or who has blocked them, are left out of every read. */
    private static final String NOT_BLOCKED = " and " + Rules.entryBy("e", ":viewer");

    /** A photo being reviewed is shown only to its owner. Written against the alias m (media). */
    private static final String SHOWN = " and " + Rules.shownMedia("m", ":viewer");

    /** Where photos stand for the journey as a whole (its grid, its count), one being reviewed is left out for everyone. */
    private static final String NOT_HELD = " and " + Rules.publicMedia("m");

    private static final RowMapper<EntryRow> ROW = (rs, n) -> new EntryRow(
            rs.getObject("id", UUID.class),
            rs.getObject("journey_id", UUID.class),
            rs.getString("journey_title"),
            rs.getObject("journey_owner_id", UUID.class),
            LabelStyle.read(rs.getString("label_style")),
            rs.getObject("author_id", UUID.class),
            rs.getString("author_username"),
            rs.getString("author_name"),
            rs.getString("author_avatar_key"),
            Sql.instant(rs, "happened_at"),
            rs.getObject("happened_on", LocalDate.class),
            rs.getInt("day_number"),
            rs.getInt("position"),
            rs.getString("title"),
            rs.getString("body"),
            rs.getString("place_name"),
            (Double) rs.getObject("lat"),
            (Double) rs.getObject("lng"),
            LocationPrecision.read(rs.getString("location_precision")),
            rs.getBoolean("is_milestone"),
            rs.getInt("like_count"),
            rs.getInt("comment_count"),
            Sql.instant(rs, "created_at"),
            Sql.instant(rs, "edited_at"),
            rs.getBoolean("liked"));

    private final JdbcClient jdbc;

    EntryStore(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<EntryRow> find(UUID id, UUID viewer) {
        return jdbc.sql(SELECT + " where e.id = :id" + NOT_BLOCKED)
                .param("id", id)
                .param("viewer", viewer)
                .query(ROW)
                .optional();
    }

    /** The entries with these ids that the viewer may read, in no particular order. Their journeys must be checked by the caller. */
    public List<EntryRow> findAll(List<UUID> ids, UUID viewer) {
        if (ids.isEmpty()) {
            return List.of();
        }
        return jdbc.sql(SELECT + " where e.id in (:ids)" + NOT_BLOCKED)
                .param("ids", ids)
                .param("viewer", viewer)
                .query(ROW)
                .list();
    }

    /** The entry this person already made from the same draft, if the app is sending it a second time. */
    public Optional<UUID> findByClientId(UUID authorId, UUID clientId) {
        return jdbc.sql("select id from entries where author_id = :author and client_id = :client")
                .param("author", authorId)
                .param("client", clientId)
                .query(UUID.class)
                .optional();
    }

    /** Only one author's part of a shared story; everyone's when no author is given. */
    private static String byAuthor(UUID author) {
        return author == null ? "" : " and e.author_id = :author";
    }

    /** The entries of one journey a viewer may read, with one author's when asked: where every read of a story starts. */
    private static String inJourney(UUID author) {
        return "select e.id from entries e where e.journey_id = :journey" + byAuthor(author) + NOT_BLOCKED;
    }

    /**
     * Reads entries of one story in two steps inside one statement. {@code pick} chooses which entries (ids
     * only, through the index that holds the story in order); then each is read in full, with its place in
     * the story from one numbering pass ({@link #STORY}). They come back in story order.
     */
    private JdbcClient.StatementSpec inStory(String select, String pick, UUID journeyId, UUID viewer, UUID author) {
        var query = jdbc.sql("with page as materialized (" + pick + ") " + select + " join page on page.id = e.id"
                        + STORY + " order by " + STORY_ORDER)
                .param("journey", journeyId)
                .param("viewer", viewer);
        return author == null ? query : query.param("author", author);
    }

    private static final String ENTRY_IN_STORY = "select " + columns("story.position") + FROM;

    /**
     * Part of a journey's story on either side of a place in it, for one page of the story.
     *
     * <p>Up to {@code before} entries that come before the edge (the nearest ones) and up to {@code after}
     * entries that come after it, each side in story order. The entry at the edge itself, if the viewer may
     * read it, belongs to the "after" side when {@code edgeGoesAfter} is true and to the "before" side when it
     * is false. Without an edge, the story is read from its start. Both sides are read from the index that
     * holds the story in order (V34), starting at the edge, so the cost doesn't grow with how far into the
     * story the page is. With an author, only what that person wrote.
     */
    public Around around(
            UUID journeyId, UUID viewer, UUID author, Edge edge, boolean edgeGoesAfter, int before, int after) {
        String at = " and (e.happened_at, e.created_at, e.id) ";
        String earlier = "(" + inJourney(author)
                + (edge == null
                        ? " and false"
                        : at + (edgeGoesAfter ? "<" : "<=") + " (:happenedAt, :createdAt, :edge)")
                + " order by " + STORY_ORDER_BACKWARDS + " limit :before)";
        String later = "(" + inJourney(author)
                + (edge == null ? "" : at + (edgeGoesAfter ? ">=" : ">") + " (:happenedAt, :createdAt, :edge)")
                + " order by " + STORY_ORDER + " limit :after)";
        var query = inStory(
                        "select " + columns("story.position") + ", page.earlier " + FROM,
                        "select s.id, true as earlier from " + earlier + " s union all select s.id, false from " + later
                                + " s",
                        journeyId,
                        viewer,
                        author)
                .param("before", before)
                .param("after", after);
        if (edge != null) {
            query = query.param("happenedAt", Sql.timestamp(edge.happenedAt()))
                    .param("createdAt", Sql.timestamp(edge.createdAt()))
                    .param("edge", edge.id());
        }
        List<EntryRow> earlierRows = new ArrayList<>();
        List<EntryRow> laterRows = new ArrayList<>();
        query.query((rs, n) -> {
                    EntryRow row = ROW.mapRow(rs, n);
                    (rs.getBoolean("earlier") ? earlierRows : laterRows).add(row);
                    return row;
                })
                .list();
        return new Around(earlierRows, laterRows);
    }

    /**
     * The two ends of a story for a journey's page: its first entry and its newest ones, in story order,
     * each entry once (a short story's first entry is also one of its newest).
     */
    public List<EntryRow> ends(UUID journeyId, UUID viewer, int newest) {
        return inStory(
                        ENTRY_IN_STORY,
                        "(" + inJourney(null) + " order by " + STORY_ORDER + " limit 1) union (" + inJourney(null)
                                + " order by " + STORY_ORDER_BACKWARDS + " limit :newest)",
                        journeyId,
                        viewer,
                        null)
                .param("newest", newest)
                .query(ROW)
                .list();
    }

    /**
     * The entries that have a place on the map, in story order, with only what a pin shows: no author, no
     * likes, and each entry's place in the story from one numbering pass.
     */
    public List<PinRow> pins(UUID journeyId, UUID viewer, int limit) {
        return inStory(
                        """
                select e.id, e.author_id, e.title, left(e.body, 61) as body_start, e.place_name, e.lat, e.lng, e.location_precision,
                       e.is_milestone, e.happened_on, (e.happened_on - j.start_date + 1) as day_number, story.position, j.label_style
                from entries e join journeys j on j.id = e.journey_id
                """,
                        inJourney(null) + " and e.lat is not null order by " + STORY_ORDER + " limit :limit",
                        journeyId,
                        viewer,
                        null)
                .param("limit", limit)
                .query((rs, n) -> new PinRow(
                        rs.getObject("id", UUID.class),
                        rs.getObject("author_id", UUID.class),
                        rs.getString("title"),
                        rs.getString("body_start"),
                        rs.getString("place_name"),
                        (Double) rs.getObject("lat"),
                        (Double) rs.getObject("lng"),
                        LocationPrecision.read(rs.getString("location_precision")),
                        rs.getBoolean("is_milestone"),
                        rs.getObject("happened_on", LocalDate.class),
                        rs.getInt("day_number"),
                        rs.getInt("position"),
                        LabelStyle.read(rs.getString("label_style"))))
                .list();
    }

    /** How many entries are on the map, and in how many different places. */
    public record MapTotals(int pins, int places) {}

    public MapTotals mapTotals(UUID journeyId, UUID viewer) {
        return jdbc.sql("select count(*) as pins, count(distinct lower(e.place_name)) as places from entries e"
                        + " where e.journey_id = :journey and e.lat is not null" + NOT_BLOCKED)
                .param("journey", journeyId)
                .param("viewer", viewer)
                .query((rs, n) -> new MapTotals(rs.getInt("pins"), rs.getInt("places")))
                .single();
    }

    /** How many entries of a journey one author wrote, as this viewer may read them. */
    public int count(UUID journeyId, UUID viewer, UUID author) {
        return jdbc.sql("select count(*) from entries e where e.journey_id = :journey and e.author_id = :author"
                        + NOT_BLOCKED)
                .param("journey", journeyId)
                .param("viewer", viewer)
                .param("author", author)
                .query(Integer.class)
                .single();
    }

    /**
     * For each journey, its newest entries by people other than the reader, most recently posted first. One
     * statement for the whole Home feed, however many journeys are on it, and for each journey only its
     * newest few are read (from the index that holds a journey's entries by when they were posted).
     */
    public Map<UUID, List<EntryRow>> latestByOthers(List<UUID> journeyIds, UUID reader, int perJourney) {
        if (journeyIds.isEmpty()) {
            return Map.of();
        }
        return jdbc
                .sql(SELECT + """
                     where e.id in (
                      select newest.id from journeys fj
                      cross join lateral (
                        select n.id from entries n
                        where n.journey_id = fj.id and n.author_id <> :viewer and %s
                        order by n.created_at desc, n.id limit :each) newest
                      where fj.id in (:journeys))
                    order by e.journey_id, e.created_at desc, e.id
                    """.formatted(Rules.entryBy("n", ":viewer")))
                .param("journeys", journeyIds)
                .param("viewer", reader)
                .param("each", perJourney)
                .query(ROW)
                .list()
                .stream()
                .collect(Collectors.groupingBy(EntryRow::journeyId));
    }

    /** What other people added to a journey after a moment in time, as this reader sees it. */
    public NewEntries newSince(UUID journeyId, UUID viewer, Instant since) {
        return jdbc.sql("select count(*) as n, (array_agg(e.id order by " + STORY_ORDER
                        + "))[1] as first_id from entries e"
                        + " where e.journey_id = :journey and e.author_id <> :viewer and e.created_at > :since"
                        + NOT_BLOCKED)
                .param("journey", journeyId)
                .param("viewer", viewer)
                .param("since", Sql.timestamp(since))
                .query((rs, n) -> new NewEntries(rs.getInt("n"), rs.getObject("first_id", UUID.class)))
                .single();
    }

    /** The story's first photos, in story order, and how many it has in all: one read for both. */
    public Photos photos(UUID journeyId, UUID viewer, int limit) {
        int[] total = {0};
        List<EntryMediaRow> first = jdbc.sql(
                        """
            select em.entry_id, m.id, m.kind, m.status, m.storage_key, m.playback_id, m.width, m.height, m.duration_s, m.held,
                   count(*) over () as total
            from entries e join entry_media em on em.entry_id = e.id join media m on m.id = em.media_id and m.kind = 'photo'
            where e.journey_id = :journey
            """ + NOT_BLOCKED + NOT_HELD + " order by " + STORY_ORDER + ", em.position limit :limit")
                .param("journey", journeyId)
                .param("viewer", viewer)
                .param("limit", limit)
                .query((rs, n) -> {
                    total[0] = rs.getInt("total");
                    return MEDIA.mapRow(rs, n);
                })
                .list();
        return new Photos(first, total[0]);
    }

    /** The day numbers that have at least one entry, for the challenge card's row of ticks. */
    public List<Integer> days(UUID journeyId, int limit) {
        return jdbc.sql("""
            select distinct (e.happened_on - j.start_date + 1) as day from entries e join journeys j on j.id = e.journey_id
            where e.journey_id = :journey order by day limit :limit
            """)
                .param("journey", journeyId)
                .param("limit", limit)
                .query(Integer.class)
                .list();
    }

    /**
     * The days of a story that have something on them, the newest first, a page at a time, for "Jump to". It
     * reads the journey's entries through the index on (journey, day) and never the entries themselves in full.
     */
    public Page<StoryDayRow> storyDays(UUID journeyId, UUID viewer, Keyset page) {
        var query = jdbc.sql("""
            select e.happened_on, (e.happened_on - j.start_date + 1) as day_number, count(*) as entries,
                   (array_agg(e.id order by e.happened_at, e.created_at, e.id))[1] as first_id,
                   (array_agg(e.place_name order by e.happened_at, e.created_at, e.id)
                      filter (where coalesce(e.place_name, '') <> ''))[1] as place
            from entries e join journeys j on j.id = e.journey_id
            where e.journey_id = :journey %s %s
            group by e.happened_on, j.start_date order by e.happened_on desc limit :limit
            """.formatted(NOT_BLOCKED, page.first() ? "" : "and e.happened_on < :before"))
                .param("journey", journeyId)
                .param("viewer", viewer)
                .param("limit", page.fetch());
        if (!page.first()) {
            query = query.param("before", day(page));
        }
        List<StoryDayRow> rows = query.query((rs, n) -> new StoryDayRow(
                        rs.getObject("happened_on", LocalDate.class),
                        rs.getInt("day_number"),
                        rs.getInt("entries"),
                        rs.getObject("first_id", UUID.class),
                        rs.getString("place")))
                .list();
        return page.page(rows, row -> Keyset.cursor(row.happenedOn()));
    }

    private static LocalDate day(Keyset page) {
        try {
            return LocalDate.parse(page.text(0));
        } catch (java.time.format.DateTimeParseException notADay) {
            throw Keyset.badCursor();
        }
    }

    /** The story's big moments, in story order, for "Jump to". */
    public List<MilestoneRow> milestones(UUID journeyId, UUID viewer, int limit) {
        return inStory(
                        """
                select e.id, coalesce(nullif(e.title, ''), left(e.body, 60)) as title, e.happened_on,
                       (e.happened_on - j.start_date + 1) as day_number, story.position
                from entries e join journeys j on j.id = e.journey_id
                """,
                        inJourney(null) + " and e.is_milestone order by " + STORY_ORDER + " limit :limit",
                        journeyId,
                        viewer,
                        null)
                .param("limit", limit)
                .query((rs, n) -> new MilestoneRow(
                        rs.getObject("id", UUID.class),
                        rs.getString("title"),
                        rs.getObject("happened_on", LocalDate.class),
                        rs.getInt("day_number"),
                        rs.getInt("position")))
                .list();
    }

    private static final RowMapper<EntryMediaRow> MEDIA = (rs, n) -> new EntryMediaRow(
            rs.getObject("entry_id", UUID.class),
            rs.getObject("id", UUID.class),
            MediaKind.read(rs.getString("kind")),
            MediaStatus.read(rs.getString("status")),
            rs.getString("storage_key"),
            rs.getString("playback_id"),
            (Integer) rs.getObject("width"),
            (Integer) rs.getObject("height"),
            (Integer) rs.getObject("duration_s"),
            rs.getBoolean("held"));

    /** The photos and clips of these entries as this viewer may see them: one being reviewed is shown only to its owner. */
    public Map<UUID, List<EntryMediaRow>> mediaFor(List<UUID> entryIds, UUID viewer) {
        if (entryIds.isEmpty()) {
            return Map.of();
        }
        return jdbc
                .sql("""
            select em.entry_id, m.id, m.kind, m.status, m.storage_key, m.playback_id, m.width, m.height, m.duration_s, m.held
            from entry_media em join media m on m.id = em.media_id
            where em.entry_id in (:ids)
            """ + SHOWN + " order by em.entry_id, em.position")
                .param("ids", entryIds)
                .param("viewer", viewer)
                .query(MEDIA)
                .list()
                .stream()
                .collect(Collectors.groupingBy(EntryMediaRow::entryId));
    }

    /** Adds an entry. Empty when the same draft (clientId) is being saved by another request at this very moment. */
    public Optional<UUID> insert(
            UUID journeyId,
            UUID authorId,
            UUID clientId,
            Instant happenedAt,
            LocalDate happenedOn,
            String title,
            String body,
            Place place,
            boolean milestone) {
        return jdbc.sql("""
            insert into entries (journey_id, author_id, client_id, happened_at, happened_on, title, body, place_name, lat, lng,
              location_precision, is_milestone)
            values (:journey, :author, cast(:client as uuid), :happenedAt, :happenedOn, :title, :body, :place, :lat, :lng,
              :precision, :milestone)
            on conflict (author_id, client_id) where client_id is not null do nothing
            returning id
            """)
                .param("journey", journeyId)
                .param("author", authorId)
                .param("client", clientId == null ? null : clientId.toString())
                .param("happenedAt", Sql.timestamp(happenedAt))
                .param("happenedOn", happenedOn)
                .param("title", title)
                .param("body", body)
                .param("place", place.name())
                .param("lat", place.lat())
                .param("lng", place.lng())
                .param("precision", place.precision().code())
                .param("milestone", milestone)
                .query(UUID.class)
                .optional();
    }

    public void update(
            UUID id,
            Instant happenedAt,
            LocalDate happenedOn,
            String title,
            String body,
            Place place,
            boolean milestone) {
        jdbc.sql("""
            update entries set happened_at = :happenedAt, happened_on = :happenedOn, title = :title, body = :body, place_name = :place,
              lat = :lat, lng = :lng, location_precision = :precision, is_milestone = :milestone, edited_at = now()
            where id = :id
            """)
                .param("happenedAt", Sql.timestamp(happenedAt))
                .param("happenedOn", happenedOn)
                .param("title", title)
                .param("body", body)
                .param("place", place.name())
                .param("lat", place.lat())
                .param("lng", place.lng())
                .param("precision", place.precision().code())
                .param("milestone", milestone)
                .param("id", id)
                .update();
    }

    public void replaceMedia(UUID entryId, List<UUID> mediaIds) {
        jdbc.sql("delete from entry_media where entry_id = :entry")
                .param("entry", entryId)
                .update();
        for (int i = 0; i < mediaIds.size(); i++) {
            jdbc.sql("insert into entry_media (entry_id, media_id, position) values (:entry, :media, :position)")
                    .param("entry", entryId)
                    .param("media", mediaIds.get(i))
                    .param("position", i)
                    .update();
        }
    }

    public void delete(UUID id) {
        jdbc.sql("delete from entries where id = :id").param("id", id).update();
    }

    /** True when the like is new. The database keeps the entry's like count. */
    public boolean like(UUID entryId, UUID userId) {
        return jdbc.sql("insert into entry_likes (entry_id, user_id) values (:entry, :user) on conflict do nothing")
                        .param("entry", entryId)
                        .param("user", userId)
                        .update()
                > 0;
    }

    public void unlike(UUID entryId, UUID userId) {
        jdbc.sql("delete from entry_likes where entry_id = :entry and user_id = :user")
                .param("entry", entryId)
                .param("user", userId)
                .update();
    }

    /**
     * A new entry wakes a paused journey. (The entry count and "last entry" are kept by the database.) A
     * journey that isn't paused has nothing to wake, and its row is left alone: the entry itself has already
     * changed it once.
     */
    public void wakeJourney(UUID journeyId) {
        jdbc.sql(
                        "update journeys set status = 'active', auto_paused_at = null, updated_at = now() where id = :journey and status = 'paused'")
                .param("journey", journeyId)
                .update();
    }
}
