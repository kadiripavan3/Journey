package app.journey.api.people;

import app.journey.api.common.ApiProblem;
import app.journey.api.media.MediaService;
import app.journey.api.people.PeopleStore.PersonRow;
import app.journey.api.people.PeopleStore.ProfileRow;
import app.journey.api.profile.PersonResponse;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Public profiles and following people. Following someone also brings their future public journeys. */
@Service
public class PeopleService {

  static final int LIST_LIMIT = 200;

  public record PublicProfileViewerResponse(
      boolean isMe, boolean isFollowing, @Schema(description = "True when this person follows the viewer") boolean followsYou,
      @Schema(description = "True when the viewer has blocked this person") boolean hasBlocked) {}

  public record PublicProfileResponse(
      UUID id, String username, String displayName, String bio,
      @Schema(nullable = true) String link,
      @Schema(nullable = true) String avatarUrl,
      @Schema(description = "Journeys the viewer may see: all of your own, the public ones of anyone else") int journeyCount,
      int entryCount, int followerCount, int followingCount, PublicProfileViewerResponse viewer) {}

  public record ListedPersonViewerResponse(boolean isMe, boolean isFollowing) {}

  public record ListedPersonResponse(
      UUID id, String username, String displayName,
      @Schema(nullable = true) String avatarUrl,
      @Schema(nullable = true, description = "The title of their newest public journey") String latestJourney,
      ListedPersonViewerResponse viewer) {}

  private final PeopleStore people;
  private final MediaService media;

  PeopleService(PeopleStore people, MediaService media) {
    this.people = people;
    this.media = media;
  }

  public PublicProfileResponse profile(String username, UUID viewer) {
    return view(require(username, viewer), viewer);
  }

  @Transactional
  public PublicProfileResponse follow(String username, UUID viewer) {
    ProfileRow person = require(username, viewer);
    if (person.id().equals(viewer)) {
      throw ApiProblem.badRequest("thats_you", "You can't follow yourself.");
    }
    if (person.blockedByViewer()) {
      throw ApiProblem.badRequest("blocked", "You've blocked this person. Unblock them first.");
    }
    people.follow(viewer, person.id());
    return profile(username, viewer);
  }

  @Transactional
  public PublicProfileResponse unfollow(String username, UUID viewer) {
    people.unfollow(viewer, require(username, viewer).id());
    return profile(username, viewer);
  }

  /** The people who follow someone, or the people they follow. */
  public List<ListedPersonResponse> listed(String username, boolean followers, UUID viewer) {
    return people.listed(require(username, viewer).id(), followers, viewer, LIST_LIMIT).stream()
        .map(row -> new ListedPersonResponse(
            row.id(), row.username(), row.displayName(), media.urlFor(row.avatarKey()), row.latestJourney(),
            new ListedPersonViewerResponse(row.id().equals(viewer), row.following())))
        .toList();
  }

  /** People whose name or username matches. */
  public List<ListedPersonResponse> search(String pattern, UUID viewer, int limit) {
    return people.search(pattern, viewer, limit).stream()
        .map(row -> new ListedPersonResponse(
            row.id(), row.username(), row.displayName(), media.urlFor(row.avatarKey()), row.latestJourney(),
            new ListedPersonViewerResponse(row.id().equals(viewer), row.following())))
        .toList();
  }

  /** The id behind a username, or "not found" (also when that person has blocked the viewer). */
  public UUID idOf(String username, UUID viewer) {
    return require(username, viewer).id();
  }

  /** People by id as they are shown next to what they did. */
  public Map<UUID, PersonResponse> persons(Collection<UUID> ids) {
    return people.byId(ids).values().stream().collect(Collectors.toMap(PersonRow::id, this::person));
  }

  private PersonResponse person(PersonRow row) {
    return new PersonResponse(row.id(), row.username(), row.displayName(), media.urlFor(row.avatarKey()));
  }

  private ProfileRow require(String username, UUID viewer) {
    return people.profile(username.toLowerCase(), viewer)
        .orElseThrow(() -> new ApiProblem(HttpStatus.NOT_FOUND, "profile_not_found", "We can't find that person."));
  }

  private PublicProfileResponse view(ProfileRow p, UUID viewer) {
    return new PublicProfileResponse(
        p.id(), p.username(), p.displayName(), p.bio(), p.link(), media.urlFor(p.avatarKey()), p.journeyCount(), p.entryCount(),
        p.followerCount(), p.followingCount(), new PublicProfileViewerResponse(p.id().equals(viewer), p.following(), p.followsViewer(), p.blockedByViewer()));
  }
}
