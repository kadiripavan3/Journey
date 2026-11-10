package app.journey.api.people;

import app.journey.api.common.ApiProblem;
import app.journey.api.common.Keyset;
import app.journey.api.common.Page;
import app.journey.api.media.MediaService;
import app.journey.api.media.MediaSize;
import app.journey.api.people.PeopleStore.Found;
import app.journey.api.people.PeopleStore.PersonRow;
import app.journey.api.people.PeopleStore.ProfileRow;
import app.journey.api.profile.PersonResponse;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Public profiles and following people. Following someone also brings their future public journeys. */
@Service
public class PeopleService {

    public record PublicProfileViewerResponse(
            boolean isMe,
            boolean isFollowing,

            @Schema(description = "True when this person follows the viewer")
            boolean followsYou,

            @Schema(description = "True when the viewer has blocked this person")
            boolean hasBlocked) {}

    public record PublicProfileResponse(
            UUID id,
            String username,
            String displayName,
            String bio,
            @Schema(nullable = true) String link,
            @Schema(nullable = true) String avatarUrl,

            @Schema(description = "Journeys the viewer may see: all of your own, the public ones of anyone else")
            int journeyCount,

            int entryCount,
            int followerCount,
            int followingCount,
            PublicProfileViewerResponse viewer) {}

    public record ListedPersonViewerResponse(boolean isMe, boolean isFollowing) {}

    public record ListedPersonResponse(
            UUID id,
            String username,
            String displayName,
            @Schema(nullable = true) String avatarUrl,

            @Schema(nullable = true, description = "The title of their newest public journey")
            String latestJourney,

            ListedPersonViewerResponse viewer) {}

    private final PeopleStore people;
    private final MediaService media;

    private final ApplicationEventPublisher events;

    PeopleService(PeopleStore people, MediaService media, ApplicationEventPublisher events) {
        this.people = people;
        this.media = media;
        this.events = events;
    }

    public PublicProfileResponse profile(String username, UUID viewer) {
        return view(require(username, viewer), viewer);
    }

    @Transactional
    public PublicProfileResponse follow(String username, UUID viewer) {
        Found person = find(username, viewer);
        if (person.id().equals(viewer)) {
            throw ApiProblem.badRequest("thats_you", "You can't follow yourself.");
        }
        if (person.blockedByViewer()) {
            throw ApiProblem.badRequest("blocked", "You've blocked this person. Unblock them first.");
        }
        if (people.follow(viewer, person.id())) {
            events.publishEvent(new PersonFollowed(viewer, person.id()));
        }
        return profile(username, viewer);
    }

    @Transactional
    public PublicProfileResponse unfollow(String username, UUID viewer) {
        people.unfollow(viewer, idOf(username, viewer));
        return profile(username, viewer);
    }

    /**
     * The people who follow someone, or the people they follow, newest first. Nobody is listed for a person the
     * viewer has blocked: their profile still opens, so that they can be unblocked, and that is all of them
     * the viewer sees.
     */
    public Page<ListedPersonResponse> listed(String username, boolean followers, UUID viewer, Keyset page) {
        Found person = find(username, viewer);
        if (person.blockedByViewer()) {
            return new Page<>(List.of(), null);
        }
        return people.listed(person.id(), followers, viewer, page).map(rows -> listed(rows, viewer));
    }

    /** The shortest words an index can help to find: three letters. Shorter ones get the first matches, not the most followed. */
    static final int SEARCH_BEST_FROM = 3;

    /**
     * People whose name or username matches, most followed first.
     *
     * @param pattern the words as an "anywhere in the text" pattern: escaped, with a % on either side
     */
    public List<ListedPersonResponse> search(String pattern, UUID viewer, int limit) {
        int letters = pattern.replace("\\", "").length() - 2;
        return listed(people.search(pattern, letters >= SEARCH_BEST_FROM, viewer, limit), viewer);
    }

    private List<ListedPersonResponse> listed(List<PeopleStore.ListedRow> rows, UUID viewer) {
        return rows.stream()
                .map(row -> new ListedPersonResponse(
                        row.id(),
                        row.username(),
                        row.displayName(),
                        media.urlFor(row.avatarKey(), MediaSize.SMALL),
                        row.latestJourney(),
                        new ListedPersonViewerResponse(row.id().equals(viewer), row.following())))
                .toList();
    }

    /** True when the first person follows the second. */
    public boolean follows(UUID follower, UUID followee) {
        return people.follows(follower, followee);
    }

    /** The id behind a username, or "not found" (also when that person has blocked the viewer). */
    public UUID idOf(String username, UUID viewer) {
        return find(username, viewer).id();
    }

    /** Who a username belongs to, looked up by the username alone: nothing about the person is counted. */
    private Found find(String username, UUID viewer) {
        return people.find(username.toLowerCase(), viewer).orElseThrow(PeopleService::notFound);
    }

    private static ApiProblem notFound() {
        return new ApiProblem(HttpStatus.NOT_FOUND, "profile_not_found", "We can't find that person.");
    }

    /** People by id as they are shown next to what they did. */
    public Map<UUID, PersonResponse> persons(Collection<UUID> ids) {
        return people.byId(ids).values().stream().collect(Collectors.toMap(PersonRow::id, this::person));
    }

    private PersonResponse person(PersonRow row) {
        return media.person(row.id(), row.username(), row.displayName(), row.avatarKey());
    }

    private ProfileRow require(String username, UUID viewer) {
        return people.profile(username.toLowerCase(), viewer).orElseThrow(PeopleService::notFound);
    }

    private PublicProfileResponse view(ProfileRow p, UUID viewer) {
        return new PublicProfileResponse(
                p.id(),
                p.username(),
                p.displayName(),
                p.bio(),
                p.link(),
                media.urlFor(p.avatarKey()),
                p.journeyCount(),
                p.entryCount(),
                p.followerCount(),
                p.followingCount(),
                new PublicProfileViewerResponse(
                        p.id().equals(viewer), p.following(), p.followsViewer(), p.blockedByViewer()));
    }
}
