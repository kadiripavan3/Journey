package app.journey.api.journey;

import app.journey.api.common.Page;
import app.journey.api.common.PageRequest;
import app.journey.api.common.Rules;
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
            UUID id,
            UUID ownerId,
            String title,
            String description,
            String category,
            String template,
            LabelStyle labelStyle,
            Visibility visibility,
            JourneyStatus status,
            List<String> tags,
            LocalDate startDate,
            Integer targetDays,
            Instant completedAt,
            String closingNote,
            Instant lastEntryAt,
            int entryCount,
            int followerCount,
            Instant createdAt,
            String ownerUsername,
            String ownerName,
            String ownerAvatarKey,
            String coverKey,
            LocalDate latestOn,
            boolean following,
            Instant lastReadAt,
            boolean member,
            int memberCount,
            Instant autoPausedAt) {}

    /**
     * Every journey with its owner, its cover (the chosen one, or else the first photo the viewer may see), and
     * whether and since when the viewer follows it. A photo by someone the viewer has blocked never stands in
     * as the cover, and a chosen cover or a profile picture that is being held is left out (see {@link Rules}).
     */
    private static final String SELECT = """
      select j.id, j.owner_id, j.title, j.description, j.category, j.template, j.label_style, j.visibility, j.status, j.tags,
             j.start_date, j.target_days, j.completed_at, j.closing_note, j.last_entry_at, j.entry_count, j.follower_count, j.created_at,
             p.username as owner_username, p.display_name as owner_name, pa.storage_key as owner_avatar_key,
             coalesce(cm.storage_key, (
               select m.storage_key from entries e
               join entry_media em on em.entry_id = e.id
               join media m on m.id = em.media_id
               where e.journey_id = j.id and m.kind = 'photo' and %s and %s
               order by e.happened_at, em.position limit 1)) as cover_key,
             (select max(e.happened_on) from entries e where e.journey_id = j.id) as latest_on,
             (vf.user_id is not null and not vf.author) as following, vf.last_read_at,
             exists (select 1 from journey_members vm where vm.journey_id = j.id and vm.user_id = :viewer and vm.status = 'joined') as member,
             (select count(*) from journey_members jm where jm.journey_id = j.id and jm.status = 'joined') as member_count,
             j.auto_paused_at
      from journeys j
      join profiles p on p.id = j.owner_id
      left join journey_follows vf on vf.journey_id = j.id and vf.user_id = :viewer
      """.formatted(Rules.publicMedia("m"), Rules.entryBy("e", ":viewer"))
            + Rules.chosenPhoto("pa", "p.avatar_media_id")
            + Rules.chosenPhoto("cm", "j.cover_media_id");

    private static final RowMapper<JourneyRow> ROW = (rs, n) -> new JourneyRow(
            rs.getObject("id", UUID.class),
            rs.getObject("owner_id", UUID.class),
            rs.getString("title"),
            rs.getString("description"),
            rs.getString("category"),
            rs.getString("template"),
            LabelStyle.read(rs.getString("label_style")),
            Visibility.read(rs.getString("visibility")),
            JourneyStatus.read(rs.getString("status")),
            Sql.strings(rs, "tags"),
            rs.getObject("start_date", LocalDate.class),
            (Integer) rs.getObject("target_days"),
            Sql.instant(rs, "completed_at"),
            rs.getString("closing_note"),
            Sql.instant(rs, "last_entry_at"),
            rs.getInt("entry_count"),
            rs.getInt("follower_count"),
            Sql.instant(rs, "created_at"),
            rs.getString("owner_username"),
            rs.getString("owner_name"),
            rs.getString("owner_avatar_key"),
            rs.getString("cover_key"),
            rs.getObject("latest_on", LocalDate.class),
            rs.getBoolean("following"),
            Sql.instant(rs, "last_read_at"),
            rs.getBoolean("member"),
            rs.getInt("member_count"),
            Sql.instant(rs, "auto_paused_at"));

    private final JdbcClient jdbc;

    JourneyStore(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** A person who writes in a journey: its owner, or a friend who joined. */
    public record AuthorRow(UUID journeyId, UUID id, String username, String displayName, String avatarKey) {}

    /**
     * The friends who joined each of these journeys, in the order they joined, as this viewer may see them:
     * a friend the viewer has blocked, or who has blocked the viewer, is left out of the list of authors.
     */
    public Map<UUID, List<AuthorRow>> membersOf(List<UUID> journeyIds, UUID viewer) {
        if (journeyIds.isEmpty()) {
            return Map.of();
        }
        return jdbc
                .sql("select m.journey_id, p.id, p.username, p.display_name, a.storage_key as avatar_key"
                        + " from journey_members m join profiles p on p.id = m.user_id"
                        + Rules.chosenPhoto("a", "p.avatar_media_id")
                        + " where m.journey_id in (:ids) and m.status = 'joined' and "
                        + Rules.notBlocked("p.id", ":viewer") + " order by m.joined_at")
                .param("ids", journeyIds)
                .param("viewer", viewer)
                .query((rs, n) -> new AuthorRow(
                        rs.getObject("journey_id", UUID.class),
                        rs.getObject("id", UUID.class),
                        rs.getString("username"),
                        rs.getString("display_name"),
                        rs.getString("avatar_key")))
                .list()
                .stream()
                .collect(java.util.stream.Collectors.groupingBy(AuthorRow::journeyId));
    }

    /** Every read below shows only journeys the viewer may see. The rule itself lives in {@link Rules}. */
    private static final String VISIBLE = " and " + Rules.visibleJourney("j", ":viewer");

    public Optional<JourneyRow> find(UUID id, UUID viewer) {
        return jdbc.sql(SELECT + " where j.id = :id" + VISIBLE)
                .param("viewer", viewer)
                .param("id", id)
                .query(ROW)
                .optional();
    }

    /**
     * For someone holding an invite link: they may look at the journey before joining, even when it is private,
     * because its owner gave them the link. Blocking still hides it.
     */
    public Optional<JourneyRow> findForLink(UUID id, UUID viewer) {
        return jdbc.sql(SELECT + " where j.id = :id and " + Rules.notBlocked("j.owner_id", ":viewer"))
                .param("viewer", viewer)
                .param("id", id)
                .query(ROW)
                .optional();
    }

    /** For someone invited to journeys: they may look at them before joining, even when they are private. */
    public List<JourneyRow> findForInvited(List<UUID> ids, UUID viewer) {
        if (ids.isEmpty()) {
            return List.of();
        }
        return jdbc.sql(
                        SELECT + " where j.id in (:ids) and " + Rules.notBlocked("j.owner_id", ":viewer")
                                + " and exists (select 1 from journey_members im where im.journey_id = j.id and im.user_id = :viewer)")
                .param("viewer", viewer)
                .param("ids", ids)
                .query(ROW)
                .list();
    }

    /** The journeys with these ids that the viewer may see, in no particular order. */
    public List<JourneyRow> findAll(List<UUID> ids, UUID viewer) {
        if (ids.isEmpty()) {
            return List.of();
        }
        return jdbc.sql(SELECT + " where j.id in (:ids)" + VISIBLE)
                .param("ids", ids)
                .param("viewer", viewer)
                .query(ROW)
                .list();
    }

    /** The first journeys matching a condition, written against the aliases j (journey) and p (owner). */
    public List<JourneyRow> list(String where, Map<String, ?> params, String orderBy, int limit, UUID viewer) {
        return query(where, params, orderBy, limit, 0, viewer);
    }

    /** One page of the journeys matching a condition. */
    public Page<JourneyRow> page(String where, Map<String, ?> params, String orderBy, PageRequest page, UUID viewer) {
        return Page.of(query(where, params, orderBy, page.fetch(), page.offset(), viewer), page);
    }

    private List<JourneyRow> query(
            String where, Map<String, ?> params, String orderBy, int limit, int offset, UUID viewer) {
        return jdbc.sql(SELECT + " where (" + where + ")" + VISIBLE + " order by " + orderBy
                        + ", j.id limit :limit offset :offset")
                .params(params)
                .param("viewer", viewer)
                .param("limit", limit)
                .param("offset", offset)
                .query(ROW)
                .list();
    }

    /** The journey this person already made from the same draft, if the app is sending it a second time. */
    public Optional<UUID> findByClientId(UUID ownerId, UUID clientId) {
        return jdbc.sql("select id from journeys where owner_id = :owner and client_id = :client")
                .param("owner", ownerId)
                .param("client", clientId)
                .query(UUID.class)
                .optional();
    }

    /** Starts a journey. Empty when the same draft (clientId) is being saved by another request at this very moment. */
    public Optional<UUID> insert(
            UUID ownerId,
            UUID clientId,
            String title,
            String description,
            String category,
            String template,
            LabelStyle labelStyle,
            Visibility visibility,
            List<String> tags,
            UUID coverMediaId,
            LocalDate startDate,
            Integer targetDays) {
        Optional<UUID> id = jdbc.sql("""
            insert into journeys (owner_id, client_id, title, description, category, template, label_style, visibility, tags, cover_media_id, start_date, target_days)
            values (:owner, cast(:client as uuid), :title, :description, :category, :template, :labelStyle, :visibility, cast(:tags as text[]),
              cast(:cover as uuid), :startDate, cast(:targetDays as int))
            on conflict (owner_id, client_id) where client_id is not null do nothing
            returning id
            """)
                .param("owner", ownerId)
                .param("client", clientId == null ? null : clientId.toString())
                .param("title", title)
                .param("description", description)
                .param("category", category)
                .param("template", template)
                .param("labelStyle", labelStyle.code())
                .param("visibility", visibility.code())
                .param("tags", Sql.arrayLiteral(tags))
                .param("cover", coverMediaId == null ? null : coverMediaId.toString())
                .param("startDate", startDate)
                .param("targetDays", targetDays == null ? null : targetDays.toString())
                .query(UUID.class)
                .optional();
        id.ifPresent(journey -> setAuthor(ownerId, journey)); // the owner follows their own journey as an author
        return id;
    }

    /** Holds the journey for the rest of the transaction, so two requests can't both pass a check and then both change it. */
    public void lock(UUID id) {
        jdbc.sql("select id from journeys where id = :id for update")
                .param("id", id)
                .query(UUID.class)
                .optional();
    }

    public void update(
            UUID id,
            String title,
            String description,
            String category,
            LabelStyle labelStyle,
            Visibility visibility,
            List<String> tags,
            UUID coverMediaId,
            LocalDate startDate,
            JourneyStatus status) {
        jdbc.sql("""
            update journeys set title = :title, description = :description, category = :category, label_style = :labelStyle,
              visibility = :visibility, tags = cast(:tags as text[]), cover_media_id = cast(:cover as uuid), start_date = :startDate,
              status = :status, updated_at = now(),
              auto_paused_at = case when :status = 'paused' and status = 'paused' then auto_paused_at else null end
            where id = :id
            """)
                .param("title", title)
                .param("description", description)
                .param("category", category)
                .param("labelStyle", labelStyle.code())
                .param("visibility", visibility.code())
                .param("tags", Sql.arrayLiteral(tags))
                .param("cover", coverMediaId == null ? null : coverMediaId.toString())
                .param("startDate", startDate)
                .param("status", status.code())
                .param("id", id)
                .update();
    }

    public UUID coverMediaId(UUID id) {
        return jdbc.sql("select cover_media_id from journeys where id = :id")
                .param("id", id)
                .query(UUID.class)
                .optional()
                .orElse(null);
    }

    public LocalDate earliestEntryDate(UUID id) {
        return jdbc.sql("select min(happened_on) from entries where journey_id = :id")
                .param("id", id)
                .query(LocalDate.class)
                .optional()
                .orElse(null);
    }

    public void complete(UUID id, String closingNote) {
        jdbc.sql(
                        "update journeys set status = 'completed', completed_at = now(), closing_note = :note, updated_at = now() where id = :id")
                .param("note", closingNote)
                .param("id", id)
                .update();
    }

    public void delete(UUID id) {
        jdbc.sql("delete from journeys where id = :id").param("id", id).update();
    }

    /**
     * True when the follow is new. A new follower starts with the journey's latest entry unread,
     * so following a journey puts its newest chapter on their Home straight away.
     */
    public boolean follow(UUID userId, UUID journeyId) {
        int added =
                jdbc.sql("""
            insert into journey_follows (user_id, journey_id, last_read_at)
            values (:user, :journey,
                    coalesce((select max(e.created_at) - interval '1 millisecond' from entries e where e.journey_id = :journey and e.author_id <> :user), now()))
            on conflict do nothing
            """).param("user", userId).param("journey", journeyId).update();
        return added > 0;
    }

    /**
     * Marks someone as an author of the journey (its owner, or a friend who joined). Authors get "new since your
     * last visit" like followers do, without being counted as followers.
     */
    public void setAuthor(UUID userId, UUID journeyId) {
        jdbc.sql("""
            insert into journey_follows (user_id, journey_id, author, auto) values (:user, :journey, true, true)
            on conflict (user_id, journey_id) do update set author = true
            """).param("user", userId).param("journey", journeyId).update();
    }

    /** A friend who left or was removed: an ordinary follower from now on, or nothing at all if the journey is private. */
    public void unsetAuthor(UUID userId, UUID journeyId) {
        jdbc.sql(
                        "delete from journey_follows f using journeys j where j.id = f.journey_id and f.user_id = :user and f.journey_id = :journey and j.visibility = 'private'")
                .param("user", userId)
                .param("journey", journeyId)
                .update();
        jdbc.sql("update journey_follows set author = false where user_id = :user and journey_id = :journey")
                .param("user", userId)
                .param("journey", journeyId)
                .update();
    }

    /** When a journey becomes private, the people who followed it stop following: they can no longer see it. */
    public void dropFollowers(UUID journeyId) {
        jdbc.sql("delete from journey_follows where journey_id = :journey and not author")
                .param("journey", journeyId)
                .update();
    }

    /** Everyone who follows the owner starts following this journey too, with nothing marked as new yet. */
    public void followForFollowersOf(UUID ownerId, UUID journeyId) {
        jdbc.sql("""
            insert into journey_follows (user_id, journey_id, auto)
            select pf.follower_id, :journey, true from profile_follows pf where pf.followee_id = :owner
            on conflict do nothing
            """).param("owner", ownerId).param("journey", journeyId).update();
    }

    /** What a finished (or unfinished) journey adds up to. */
    public record Totals(int entries, int places, int photos, int likes, LocalDate firstDay, LocalDate lastDay) {}

    /** The journey added up as this viewer reads it: what someone they have blocked wrote in it is not counted. */
    public Totals totals(UUID journeyId, UUID viewer) {
        return jdbc.sql("""
            select count(*) as entries, count(distinct nullif(e.place_name, '')) as places, coalesce(sum(e.like_count), 0) as likes,
                   min(e.happened_on) as first_day, max(e.happened_on) as last_day,
                   (select count(*) from entry_media em join entries x on x.id = em.entry_id join media m on m.id = em.media_id
                     where x.journey_id = :id and m.kind = 'photo' and %s and %s) as photos
            from entries e where e.journey_id = :id and %s
            """.formatted(
                                Rules.publicMedia("m"), Rules.entryBy("x", ":viewer"), Rules.entryBy("e", ":viewer")))
                .param("id", journeyId)
                .param("viewer", viewer)
                .query((rs, n) -> new Totals(
                        rs.getInt("entries"),
                        rs.getInt("places"),
                        rs.getInt("photos"),
                        rs.getInt("likes"),
                        rs.getObject("first_day", LocalDate.class),
                        rs.getObject("last_day", LocalDate.class)))
                .single();
    }

    /** The photos of a journey's best moments as this viewer may see them: milestones first, then the most liked. */
    public List<String> momentKeys(UUID journeyId, UUID viewer, int limit) {
        return jdbc.sql("""
            select m.storage_key from entries e
            join entry_media em on em.entry_id = e.id and em.position = 0
            join media m on m.id = em.media_id and m.kind = 'photo' and %s
            where e.journey_id = :id and %s
            order by e.is_milestone desc, e.like_count desc, e.happened_at
            limit :limit
            """.formatted(Rules.publicMedia("m"), Rules.entryBy("e", ":viewer")))
                .param("id", journeyId)
                .param("viewer", viewer)
                .param("limit", limit)
                .query(String.class)
                .list();
    }

    public void unfollow(UUID userId, UUID journeyId) {
        jdbc.sql("delete from journey_follows where user_id = :user and journey_id = :journey and not author")
                .param("user", userId)
                .param("journey", journeyId)
                .update();
    }

    public void markRead(UUID userId, UUID journeyId) {
        jdbc.sql("update journey_follows set last_read_at = now() where user_id = :user and journey_id = :journey")
                .param("user", userId)
                .param("journey", journeyId)
                .update();
    }

    public int followingCount(UUID userId) {
        return jdbc.sql("select count(*) from journey_follows where user_id = :user and not author")
                .param("user", userId)
                .query(Integer.class)
                .single();
    }

    public record NewInJourney(UUID journeyId, int newCount) {}

    /** Journeys the reader follows or writes in, with entries posted by others since their last visit, most recent first. */
    public Page<NewInJourney> journeysWithNewEntries(UUID userId, PageRequest page) {
        List<NewInJourney> rows = jdbc.sql(
                        """
            select f.journey_id, count(*) as new_count, max(e.created_at) as latest
            from journey_follows f
            join journeys j on j.id = f.journey_id
            join entries e on e.journey_id = f.journey_id and e.created_at > f.last_read_at and e.author_id <> :user
            where f.user_id = :user and %s and %s
            group by f.journey_id
            order by latest desc, f.journey_id
            limit :limit offset :offset
            """.formatted(Rules.visibleJourney("j", ":user"), Rules.entryBy("e", ":user")))
                .param("user", userId)
                .param("limit", page.fetch())
                .param("offset", page.offset())
                .query((rs, n) -> new NewInJourney(rs.getObject("journey_id", UUID.class), rs.getInt("new_count")))
                .list();
        return Page.of(rows, page);
    }
}
