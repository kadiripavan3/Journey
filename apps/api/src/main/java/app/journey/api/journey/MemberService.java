package app.journey.api.journey;

import app.journey.api.common.ApiProblem;
import app.journey.api.common.Sql;
import app.journey.api.journey.JourneyService.JourneyResponse;
import app.journey.api.journey.JourneyStore.JourneyRow;
import app.journey.api.media.MediaService;
import app.journey.api.people.PeopleService;
import app.journey.api.profile.PersonResponse;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Shared journeys. The owner invites up to three friends; nobody is added without saying yes. Friends add
 * entries and change their own. Only the owner changes the journey or removes people. A friend can leave at
 * any time, and their entries stay unless they delete them.
 */
@Service
public class MemberService {

  /** A journey has up to four authors: the owner and three friends. */
  static final int MAX_FRIENDS = 3;

  public record MemberResponse(
      PersonResponse person,
      @Schema(description = "owner or friend") String role,
      @Schema(description = "joined or invited") String status,
      int entryCount,
      @Schema(description = "When they were invited or, once joined, when they joined") Instant since) {}

  public record MembersResponse(
      List<MemberResponse> members,
      @Schema(description = "How many more friends can be invited") int spotsLeft,
      @Schema(description = "owner, friend, invited or none") String viewerRole) {}

  public record InvitationResponse(JourneyResponse journey, PersonResponse invitedBy, Instant invitedAt) {}

  private final JdbcClient jdbc;
  private final JourneyService journeys;
  private final JourneyStore journeyStore;
  private final PeopleService people;
  private final MediaService media;
  private final ApplicationEventPublisher events;

  MemberService(JdbcClient jdbc, JourneyService journeys, JourneyStore journeyStore, PeopleService people, MediaService media,
      ApplicationEventPublisher events) {
    this.events = events;
    this.jdbc = jdbc;
    this.journeys = journeys;
    this.journeyStore = journeyStore;
    this.people = people;
    this.media = media;
  }

  /** Who writes in a journey. People who are still deciding are shown only to the owner and to themselves. */
  public MembersResponse members(UUID journeyId, UUID viewer) {
    JourneyRow journey = requireForInvited(journeyId, viewer);
    boolean isOwner = journey.ownerId().equals(viewer);
    List<MemberResponse> members = new ArrayList<>();
    members.add(new MemberResponse(
        new PersonResponse(journey.ownerId(), journey.ownerUsername(), journey.ownerName(), media.urlFor(journey.ownerAvatarKey())),
        "owner", "joined", entryCount(journeyId, journey.ownerId()), journey.createdAt()));
    String viewerRole = isOwner ? "owner" : "none";
    for (Row row : rows(journeyId)) {
      if (row.userId().equals(viewer)) {
        viewerRole = "joined".equals(row.status()) ? "friend" : "invited";
      }
      if ("joined".equals(row.status()) || isOwner || row.userId().equals(viewer)) {
        members.add(new MemberResponse(new PersonResponse(row.userId(), row.username(), row.name(), media.urlFor(row.avatarKey())), "friend", row.status(),
            entryCount(journeyId, row.userId()), row.since()));
      }
    }
    return new MembersResponse(members, Math.max(MAX_FRIENDS - rows(journeyId).size(), 0), viewerRole);
  }

  /** The owner's followers who could be invited: people only get invitations from someone they follow. */
  public List<PersonResponse> invitable(UUID journeyId, UUID viewer) {
    journeys.requireOwned(journeyId, viewer);
    return jdbc.sql(
            """
            select p.id, p.username, p.display_name, a.storage_key as avatar_key
            from profile_follows f join profiles p on p.id = f.follower_id left join media a on a.id = p.avatar_media_id
            where f.followee_id = :me
              and not exists (select 1 from journey_members m where m.journey_id = :journey and m.user_id = p.id)
              and not exists (select 1 from blocks b where (b.blocker_id = :me and b.blocked_id = p.id) or (b.blocker_id = p.id and b.blocked_id = :me))
            order by f.created_at desc limit 100
            """)
        .param("me", viewer).param("journey", journeyId)
        .query((rs, n) -> new PersonResponse(rs.getObject("id", UUID.class), rs.getString("username"), rs.getString("display_name"), media.urlFor(rs.getString("avatar_key"))))
        .list();
  }

  @Transactional
  public MembersResponse invite(UUID journeyId, UUID owner, String username) {
    JourneyRow journey = journeys.requireOwned(journeyId, owner);
    if ("completed".equals(journey.status())) {
      throw ApiProblem.badRequest("journey_completed", "This journey is completed, so nobody can be added to it.");
    }
    UUID friend = people.idOf(username, owner);
    if (friend.equals(owner)) {
      throw ApiProblem.badRequest("thats_you", "You're already on this journey.");
    }
    List<Row> current = rows(journeyId);
    if (current.stream().anyMatch(row -> row.userId().equals(friend))) {
      throw ApiProblem.badRequest("already_invited", "They've already been invited.");
    }
    if (current.size() >= MAX_FRIENDS) {
      throw ApiProblem.badRequest("journey_full", "A journey has up to " + (MAX_FRIENDS + 1) + " authors. Remove someone to invite another person.");
    }
    boolean followsOwner = jdbc.sql("select exists (select 1 from profile_follows where follower_id = :friend and followee_id = :owner)")
        .param("friend", friend).param("owner", owner).query(Boolean.class).single();
    if (!followsOwner) {
      throw ApiProblem.badRequest("not_a_follower", "You can invite people who follow you.");
    }
    jdbc.sql("insert into journey_members (journey_id, user_id, status, invited_by) values (:journey, :friend, 'invited', :owner)")
        .param("journey", journeyId).param("friend", friend).param("owner", owner).update();
    events.publishEvent(new FriendInvited(journeyId, friend));
    return members(journeyId, owner);
  }

  /** The owner removes a friend or takes an invitation back; a friend leaves or says no. Their entries stay. */
  @Transactional
  public void remove(UUID journeyId, UUID viewer, String username) {
    JourneyRow journey = requireForInvited(journeyId, viewer);
    UUID person = people.idOf(username, viewer);
    if (!journey.ownerId().equals(viewer) && !person.equals(viewer)) {
      throw new ApiProblem(HttpStatus.FORBIDDEN, "not_yours", "Only the owner can remove people from this journey.");
    }
    jdbc.sql("delete from journey_members where journey_id = :journey and user_id = :person").param("journey", journeyId).param("person", person).update();
  }

  /** Invitations waiting for an answer, newest first. */
  public List<InvitationResponse> invitations(UUID me) {
    record Waiting(UUID journeyId, UUID invitedBy, Instant at) {}
    List<Waiting> waiting = jdbc.sql("select journey_id, invited_by, created_at from journey_members where user_id = :me and status = 'invited' order by created_at desc")
        .param("me", me)
        .query((rs, n) -> new Waiting(rs.getObject("journey_id", UUID.class), rs.getObject("invited_by", UUID.class), Sql.instant(rs, "created_at")))
        .list();
    var inviters = people.persons(waiting.stream().map(Waiting::invitedBy).toList());
    List<InvitationResponse> invitations = new ArrayList<>();
    for (Waiting w : waiting) {
      // Found directly: someone invited to a private journey may see it before they have joined.
      journeyStore.find(w.journeyId(), me).ifPresent(journey -> invitations.add(new InvitationResponse(journeys.view(journey, me), inviters.get(w.invitedBy()), w.at())));
    }
    return invitations;
  }

  /** Saying yes: the person becomes an author, and follows the journey so the others' entries reach their Home. */
  @Transactional
  public JourneyResponse accept(UUID journeyId, UUID me) {
    int joined = jdbc.sql("update journey_members set status = 'joined', joined_at = now() where journey_id = :journey and user_id = :me and status = 'invited'")
        .param("journey", journeyId).param("me", me).update();
    if (joined == 0) {
      throw new ApiProblem(HttpStatus.NOT_FOUND, "no_invitation", "This invitation isn't there any more.");
    }
    journeyStore.follow(me, journeyId);
    return journeys.view(journeys.require(journeyId, me), me);
  }

  private record Row(UUID userId, String username, String name, String avatarKey, String status, Instant since) {}

  private List<Row> rows(UUID journeyId) {
    return jdbc.sql(
            """
            select p.id, p.username, p.display_name, a.storage_key as avatar_key, m.status, coalesce(m.joined_at, m.created_at) as since
            from journey_members m join profiles p on p.id = m.user_id left join media a on a.id = p.avatar_media_id
            where m.journey_id = :journey order by m.created_at
            """)
        .param("journey", journeyId)
        .query((rs, n) -> new Row(rs.getObject("id", UUID.class), rs.getString("username"), rs.getString("display_name"), rs.getString("avatar_key"),
            rs.getString("status"), Sql.instant(rs, "since")))
        .list();
  }

  private int entryCount(UUID journeyId, UUID author) {
    return jdbc.sql("select count(*) from entries where journey_id = :journey and author_id = :author").param("journey", journeyId).param("author", author)
        .query(Integer.class).single();
  }

  /** Like JourneyService.require, but someone invited to a private journey may look at it too. */
  private JourneyRow requireForInvited(UUID journeyId, UUID viewer) {
    boolean invited = jdbc.sql("select exists (select 1 from journey_members where journey_id = :journey and user_id = :viewer)")
        .param("journey", journeyId).param("viewer", viewer).query(Boolean.class).single();
    return invited
        ? journeyStore.find(journeyId, viewer).orElseThrow(() -> new ApiProblem(HttpStatus.NOT_FOUND, "journey_not_found", "This journey isn't available."))
        : journeys.require(journeyId, viewer);
  }
}
