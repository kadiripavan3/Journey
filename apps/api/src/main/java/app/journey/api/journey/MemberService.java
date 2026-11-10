package app.journey.api.journey;

import app.journey.api.common.ApiProblem;
import app.journey.api.common.Page;
import app.journey.api.common.PageRequest;
import app.journey.api.journey.JourneyService.JourneyResponse;
import app.journey.api.journey.JourneyStore.JourneyRow;
import app.journey.api.journey.MemberStore.MemberRow;
import app.journey.api.journey.MemberStore.Waiting;
import app.journey.api.media.MediaService;
import app.journey.api.people.PeopleService;
import app.journey.api.profile.PersonResponse;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
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

            @Schema(description = "owner or friend") ViewerRole role,

            MemberStatus status,
            int entryCount,

            @Schema(description = "When they were invited or, once joined, when they joined")
            Instant since) {}

    public record MembersResponse(
            List<MemberResponse> members,

            @Schema(description = "How many more friends can be invited")
            int spotsLeft,

            ViewerRole viewerRole) {}

    public record InvitationResponse(JourneyResponse journey, PersonResponse invitedBy, Instant invitedAt) {}

    private final MemberStore members;
    private final JourneyService journeys;
    private final JourneyStore journeyStore;
    private final PeopleService people;
    private final MediaService media;
    private final ApplicationEventPublisher events;

    MemberService(
            MemberStore members,
            JourneyService journeys,
            JourneyStore journeyStore,
            PeopleService people,
            MediaService media,
            ApplicationEventPublisher events) {
        this.members = members;
        this.journeys = journeys;
        this.journeyStore = journeyStore;
        this.people = people;
        this.media = media;
        this.events = events;
    }

    /** Who writes in a journey. People who are still deciding are shown only to the owner and to themselves. */
    @Transactional(readOnly = true)
    public MembersResponse members(UUID journeyId, UUID viewer) {
        JourneyRow journey = requireForInvited(journeyId, viewer);
        boolean isOwner = journey.ownerId().equals(viewer);
        List<MemberRow> asked = members.members(journeyId);
        Map<UUID, Integer> entryCounts = members.entryCounts(journeyId);
        List<MemberResponse> shown = new ArrayList<>();
        shown.add(new MemberResponse(
                media.person(journey.ownerId(), journey.ownerUsername(), journey.ownerName(), journey.ownerAvatarKey()),
                ViewerRole.OWNER,
                MemberStatus.JOINED,
                entryCounts.getOrDefault(journey.ownerId(), 0),
                journey.createdAt()));
        ViewerRole viewerRole = isOwner ? ViewerRole.OWNER : ViewerRole.NONE;
        for (MemberRow row : asked) {
            boolean joined = row.status() == MemberStatus.JOINED;
            if (row.userId().equals(viewer)) {
                viewerRole = joined ? ViewerRole.FRIEND : ViewerRole.INVITED;
            }
            if (joined || isOwner || row.userId().equals(viewer)) {
                shown.add(new MemberResponse(
                        media.person(row.userId(), row.username(), row.name(), row.avatarKey()),
                        ViewerRole.FRIEND,
                        row.status(),
                        entryCounts.getOrDefault(row.userId(), 0),
                        row.since()));
            }
        }
        return new MembersResponse(shown, Math.max(MAX_FRIENDS - asked.size(), 0), viewerRole);
    }

    /** The owner's followers who could be invited: people only get invitations from someone they follow. */
    public Page<PersonResponse> invitable(UUID journeyId, UUID viewer, PageRequest page) {
        journeys.requireOwned(journeyId, viewer);
        return members.invitable(journeyId, viewer, page)
                .map(rows -> rows.stream()
                        .map(p -> media.person(p.id(), p.username(), p.displayName(), p.avatarKey()))
                        .toList());
    }

    @Transactional
    public MembersResponse invite(UUID journeyId, UUID owner, String username) {
        journeyStore.lock(journeyId); // two invitations at once must not both pass the "room for one more" check
        JourneyRow journey = journeys.requireOwned(journeyId, owner);
        if (journey.status() == JourneyStatus.COMPLETED) {
            throw ApiProblem.badRequest(
                    "journey_completed", "This journey is completed, so nobody can be added to it.");
        }
        UUID friend = people.idOf(username, owner);
        if (friend.equals(owner)) {
            throw ApiProblem.badRequest("thats_you", "You're already on this journey.");
        }
        List<MemberRow> asked = members.members(journeyId);
        if (asked.stream().anyMatch(row -> row.userId().equals(friend))) {
            throw ApiProblem.badRequest("already_invited", "They've already been invited.");
        }
        if (asked.size() >= MAX_FRIENDS) {
            throw ApiProblem.badRequest(
                    "journey_full",
                    "A journey has up to " + (MAX_FRIENDS + 1) + " authors. Remove someone to invite another person.");
        }
        if (!people.follows(friend, owner)) {
            throw ApiProblem.badRequest("not_a_follower", "You can invite people who follow you.");
        }
        members.invite(journeyId, friend, owner);
        events.publishEvent(new FriendInvited(journeyId, friend));
        return members(journeyId, owner);
    }

    /** The owner removes a friend or takes an invitation back; a friend leaves or says no. Their entries stay. */
    @Transactional
    public void remove(UUID journeyId, UUID viewer, String username) {
        JourneyRow journey = requireForInvited(journeyId, viewer);
        UUID person = people.idOf(username, viewer);
        if (!journey.ownerId().equals(viewer) && !person.equals(viewer)) {
            throw new ApiProblem(
                    HttpStatus.FORBIDDEN, "not_yours", "Only the owner can remove people from this journey.");
        }
        if (person.equals(journey.ownerId())) {
            throw ApiProblem.badRequest("owner_stays", "The owner can't leave their own journey.");
        }
        if (members.remove(journeyId, person)) {
            journeyStore.unsetAuthor(person, journeyId);
        }
    }

    /** Invitations waiting for an answer, newest first. */
    @Transactional(readOnly = true)
    public Page<InvitationResponse> invitations(UUID me, PageRequest page) {
        Page<Waiting> waiting = members.waiting(me, page);
        Map<UUID, PersonResponse> inviters =
                people.persons(waiting.items().stream().map(Waiting::invitedBy).toList());
        // Found as "invited": someone asked onto a private journey may see it before they have joined.
        Map<UUID, JourneyResponse> invitedTo = journeys
                .views(
                        journeyStore.findForInvited(
                                waiting.items().stream().map(Waiting::journeyId).toList(), me),
                        me)
                .stream()
                .collect(Collectors.toMap(JourneyResponse::id, Function.identity()));
        return waiting.map(rows -> rows.stream()
                .filter(w -> invitedTo.containsKey(w.journeyId()) && inviters.containsKey(w.invitedBy()))
                .map(w -> new InvitationResponse(invitedTo.get(w.journeyId()), inviters.get(w.invitedBy()), w.at()))
                .toList());
    }

    /** Saying yes: the person becomes an author, so the others' entries reach their Home. */
    @Transactional
    public JourneyResponse accept(UUID journeyId, UUID me) {
        if (!members.accept(journeyId, me)) {
            throw new ApiProblem(HttpStatus.NOT_FOUND, "no_invitation", "This invitation isn't there any more.");
        }
        journeyStore.setAuthor(me, journeyId);
        return journeys.view(journeys.require(journeyId, me), me);
    }

    /** Like JourneyService.require, but someone invited to a private journey may look at it too. */
    private JourneyRow requireForInvited(UUID journeyId, UUID viewer) {
        return members.isAsked(journeyId, viewer)
                ? journeyStore.findForInvited(List.of(journeyId), viewer).stream()
                        .findFirst()
                        .orElseThrow(() -> new ApiProblem(
                                HttpStatus.NOT_FOUND, "journey_not_found", "This journey isn't available."))
                : journeys.require(journeyId, viewer);
    }
}
