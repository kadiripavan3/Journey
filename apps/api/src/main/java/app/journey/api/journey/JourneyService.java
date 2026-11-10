package app.journey.api.journey;

import app.journey.api.catalog.Catalog;
import app.journey.api.common.ApiProblem;
import app.journey.api.journey.JourneyStore.JourneyRow;
import app.journey.api.media.MediaService;
import app.journey.api.profile.PersonResponse;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The rules for journeys: who may see, change and follow them. */
@Service
public class JourneyService {

  static final int MAX_TAGS = 5;
  /** Discover only shows journeys with a cover and at least this many entries. */
  static final int DISCOVER_MIN_ENTRIES = 3;

  public record JourneyViewerResponse(boolean isOwner, boolean isFollowing, boolean canAddEntry) {}

  public record JourneyResponse(
      UUID id, String title, String description, String category, String template,
      @Schema(allowableValues = {"day", "part"}) String labelStyle,
      @Schema(allowableValues = {"public", "unlisted", "private"}) String visibility,
      @Schema(allowableValues = {"active", "paused", "completed"}) String status,
      List<String> tags,
      @Schema(nullable = true) String coverUrl,
      LocalDate startDate,
      @Schema(nullable = true) Integer targetDays,
      @Schema(description = "Day or part number of the latest entry; 0 before the first one") int latestNumber,
      @Schema(description = "Ready to show: \"Day 14\", \"Day 12 of 30\", \"Part 5\" or \"Not started\"") String progressLabel,
      int entryCount, int followerCount,
      @Schema(nullable = true) Instant lastEntryAt,
      @Schema(nullable = true) Instant completedAt,
      @Schema(nullable = true) String closingNote,
      PersonResponse owner, JourneyViewerResponse viewer) {}

  private final JourneyStore journeys;
  private final MediaService media;

  JourneyService(JourneyStore journeys, MediaService media) {
    this.journeys = journeys;
    this.media = media;
  }

  /** The journey, if this person may see it. A private journey looks exactly like one that doesn't exist. */
  public JourneyRow require(UUID id, UUID viewer) {
    return journeys.find(id, viewer)
        .filter(j -> !"private".equals(j.visibility()) || j.ownerId().equals(viewer))
        .orElseThrow(() -> new ApiProblem(HttpStatus.NOT_FOUND, "journey_not_found", "This journey isn't available."));
  }

  public JourneyRow requireOwned(UUID id, UUID viewer) {
    JourneyRow journey = require(id, viewer);
    if (!journey.ownerId().equals(viewer)) {
      throw new ApiProblem(HttpStatus.FORBIDDEN, "not_yours", "Only the owner can change this journey.");
    }
    return journey;
  }

  public boolean canAddEntry(JourneyRow journey, UUID viewer) {
    return journey.ownerId().equals(viewer) && !"completed".equals(journey.status());
  }

  @Transactional
  public JourneyResponse create(UUID owner, String title, String description, String templateId, String category, LocalDate startDate,
      String visibility, String labelStyle, List<String> tags, UUID coverMediaId) {
    Catalog.Template template = Catalog.template(templateId)
        .orElseThrow(() -> ApiProblem.badRequest("unknown_template", "Pick one of the starting points."));
    String chosenCategory = category == null || category.isBlank() ? template.defaultCategory() : category;
    requireCategory(chosenCategory);
    requireSensibleStart(startDate);
    if (coverMediaId != null) {
      media.requireOwn(List.of(coverMediaId), owner, "photo");
    }
    UUID id = journeys.insert(owner, title.trim(), clean(description), chosenCategory, template.id(),
        labelStyle == null ? template.labelStyle() : labelStyle, visibility, cleanTags(tags), coverMediaId, startDate, template.targetDays());
    return view(require(id, owner), owner);
  }

  @Transactional
  public JourneyResponse update(UUID id, UUID viewer, String title, String description, String category, LocalDate startDate, String visibility,
      String labelStyle, List<String> tags, UUID coverMediaId, boolean clearCover, String status) {
    JourneyRow current = requireOwned(id, viewer);
    if (category != null) {
      requireCategory(category);
    }
    if (startDate != null && !startDate.equals(current.startDate())) {
      requireSensibleStart(startDate);
      LocalDate earliest = journeys.earliestEntryDate(id);
      if (earliest != null && startDate.isAfter(earliest)) {
        throw ApiProblem.badRequest("start_after_entries", "The journey can't start after its first entry. Move that entry first.");
      }
    }
    if (status != null && !status.equals(current.status())) {
      if ("completed".equals(current.status()) || "completed".equals(status)) {
        throw ApiProblem.badRequest("invalid_status", "A journey can be paused or resumed here. Completing it has its own step.");
      }
    }
    UUID cover = clearCover ? null : coverMediaId != null ? coverMediaId : journeys.coverMediaId(id);
    if (coverMediaId != null) {
      media.requireOwn(List.of(coverMediaId), viewer, "photo");
    }
    journeys.update(id,
        title == null ? current.title() : title.trim(),
        description == null ? current.description() : clean(description),
        category == null ? current.category() : category,
        labelStyle == null ? current.labelStyle() : labelStyle,
        visibility == null ? current.visibility() : visibility,
        tags == null ? current.tags() : cleanTags(tags),
        cover,
        startDate == null ? current.startDate() : startDate,
        status == null ? current.status() : status);
    return view(require(id, viewer), viewer);
  }

  @Transactional
  public JourneyResponse complete(UUID id, UUID viewer, String closingNote) {
    JourneyRow journey = requireOwned(id, viewer);
    if ("completed".equals(journey.status())) {
      throw ApiProblem.badRequest("already_completed", "This journey is already completed.");
    }
    if (journey.entryCount() == 0) {
      throw ApiProblem.badRequest("no_entries", "Add at least one entry before completing the journey.");
    }
    journeys.complete(id, closingNote == null || closingNote.isBlank() ? null : closingNote.trim());
    return view(require(id, viewer), viewer);
  }

  @Transactional
  public void delete(UUID id, UUID viewer) {
    requireOwned(id, viewer);
    journeys.delete(id);
  }

  @Transactional
  public JourneyResponse follow(UUID id, UUID viewer) {
    JourneyRow journey = require(id, viewer);
    if (journey.ownerId().equals(viewer)) {
      throw ApiProblem.badRequest("own_journey", "This is your own journey. You already see everything in it.");
    }
    journeys.follow(viewer, id);
    return view(require(id, viewer), viewer);
  }

  @Transactional
  public JourneyResponse unfollow(UUID id, UUID viewer) {
    require(id, viewer);
    journeys.unfollow(viewer, id);
    return view(require(id, viewer), viewer);
  }

  @Transactional
  public void markRead(UUID id, UUID viewer) {
    require(id, viewer);
    journeys.markRead(viewer, id);
  }

  /** The viewer's own journeys, of every visibility, newest activity first. */
  public List<JourneyResponse> mine(UUID viewer) {
    return views(journeys.list("j.owner_id = :owner", Map.of("owner", viewer), "coalesce(j.last_entry_at, j.created_at) desc", 100, viewer), viewer);
  }

  /** Journeys the viewer follows, newest activity first. */
  public List<JourneyResponse> following(UUID viewer) {
    return views(
        journeys.list(
            "exists (select 1 from journey_follows mf where mf.journey_id = j.id and mf.user_id = :me) and (j.visibility <> 'private' or j.owner_id = :me)",
            Map.of("me", viewer), "coalesce(j.last_entry_at, j.created_at) desc", 100, viewer),
        viewer);
  }

  /** Someone's public journeys, for their profile. */
  public List<JourneyResponse> publicBy(String username, UUID viewer) {
    return views(journeys.list("p.username = :username and j.visibility = 'public'", Map.of("username", username),
        "coalesce(j.last_entry_at, j.created_at) desc", 100, viewer), viewer);
  }

  public record DiscoverResponse(List<JourneyResponse> trending, List<JourneyResponse> fresh, List<JourneyResponse> completed) {}

  /** Discover uses simple rules that can be explained: most followed, newest, and recently completed. */
  public DiscoverResponse discover(UUID viewer, String category) {
    String base = "j.visibility = 'public' and j.entry_count >= " + DISCOVER_MIN_ENTRIES + " and (cast(:category as text) is null or j.category = :category)";
    Map<String, Object> params = new java.util.HashMap<>();
    params.put("category", category == null || category.isBlank() ? null : category);
    return new DiscoverResponse(
        views(journeys.list(base + " and j.status = 'active'", params, "j.follower_count desc, j.last_entry_at desc nulls last", 12, viewer), viewer),
        views(journeys.list(base + " and j.status <> 'completed'", params, "j.created_at desc", 12, viewer), viewer),
        views(journeys.list(base + " and j.status = 'completed'", params, "j.completed_at desc nulls last", 12, viewer), viewer));
  }

  /** A few public journeys to follow, favouring the person's interests. Never their own or ones they already follow. */
  public List<JourneyResponse> suggested(UUID viewer, List<String> interests, int limit) {
    List<String> categories = Catalog.categoriesFor(interests);
    Map<String, Object> params = Map.of("me", viewer, "categories", categories.isEmpty() ? List.of("-") : categories);
    return views(
        journeys.list(
            """
            j.visibility = 'public' and j.status = 'active' and j.entry_count >= 1 and j.owner_id <> :me
            and not exists (select 1 from journey_follows sf where sf.journey_id = j.id and sf.user_id = :me)
            """,
            params, "(j.category in (:categories)) desc, j.follower_count desc, j.last_entry_at desc nulls last", limit, viewer),
        viewer);
  }

  public List<JourneyResponse> views(List<JourneyRow> rows, UUID viewer) {
    return rows.stream().map(row -> view(row, viewer)).toList();
  }

  public JourneyResponse view(JourneyRow j, UUID viewer) {
    int latest = latestNumber(j);
    return new JourneyResponse(
        j.id(), j.title(), j.description(), j.category(), j.template(), j.labelStyle(), j.visibility(), j.status(), j.tags(),
        media.urlFor(j.coverKey()), j.startDate(), j.targetDays(), latest, progressLabel(j, latest), j.entryCount(), j.followerCount(),
        j.lastEntryAt(), j.completedAt(), j.closingNote(),
        new PersonResponse(j.ownerId(), j.ownerUsername(), j.ownerName(), media.urlFor(j.ownerAvatarKey())),
        new JourneyViewerResponse(j.ownerId().equals(viewer), j.following(), canAddEntry(j, viewer)));
  }

  private static int latestNumber(JourneyRow j) {
    if (j.entryCount() == 0) {
      return 0;
    }
    if ("part".equals(j.labelStyle()) || j.latestOn() == null) {
      return j.entryCount();
    }
    return (int) ChronoUnit.DAYS.between(j.startDate(), j.latestOn()) + 1;
  }

  private static String progressLabel(JourneyRow j, int latest) {
    if (latest == 0) {
      return "Not started";
    }
    if ("part".equals(j.labelStyle())) {
      return "Part " + latest;
    }
    return j.targetDays() == null ? "Day " + latest : "Day " + latest + " of " + j.targetDays();
  }

  private static void requireCategory(String category) {
    if (!Catalog.isCategory(category)) {
      throw ApiProblem.badRequest("unknown_category", "Pick one of the categories.");
    }
  }

  private static void requireSensibleStart(LocalDate startDate) {
    LocalDate today = LocalDate.now();
    if (startDate.isAfter(today.plusYears(1)) || startDate.isBefore(today.minusYears(50))) {
      throw ApiProblem.badRequest("invalid_start_date", "Check the start date.");
    }
  }

  private static String clean(String text) {
    return text == null ? "" : text.trim();
  }

  /** "#Road Trip" becomes "roadtrip": lower case, letters and digits only, no doubles. */
  static List<String> cleanTags(List<String> tags) {
    if (tags == null) {
      return List.of();
    }
    List<String> clean = tags.stream()
        .map(tag -> tag.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", ""))
        .filter(tag -> !tag.isEmpty() && tag.length() <= 30)
        .distinct().toList();
    if (clean.size() > MAX_TAGS) {
      throw ApiProblem.badRequest("too_many_tags", "Use up to " + MAX_TAGS + " tags.");
    }
    return clean;
  }
}
