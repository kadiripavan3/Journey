package app.journey.api.entry;

import app.journey.api.common.Page;
import app.journey.api.common.PageRequest;
import app.journey.api.entry.EntryService.EntryResponse;
import app.journey.api.journey.JourneyService;
import app.journey.api.journey.JourneyService.JourneyResponse;
import app.journey.api.journey.JourneyStore;
import app.journey.api.journey.JourneyStore.NewInJourney;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Home: what is new in the journeys a person follows or writes in, one group per journey, the journey with
 * the newest entry first. It reads a fixed handful of statements however many journeys are on the page.
 */
@Service
public class FeedService {

    static final int PAGE = 20;
    static final int ENTRIES_PER_JOURNEY = 3;

    public record FeedGroupResponse(
            JourneyResponse journey,

            @Schema(description = "How many entries are new to the reader")
            int newCount,

            @Schema(description = "The newest of them, newest first; at most three")
            List<EntryResponse> entries) {}

    public record FeedResponse(
            List<FeedGroupResponse> groups,

            @Schema(description = "How many journeys the reader follows, for the empty state")
            int followingCount,

            @Schema(
                    nullable = true,
                    description = "Send as `cursor` for more journeys with news. Null when there are no more.")
            String nextCursor) {}

    private final JourneyStore journeyStore;
    private final JourneyService journeys;
    private final EntryService entries;

    FeedService(JourneyStore journeyStore, JourneyService journeys, EntryService entries) {
        this.journeyStore = journeyStore;
        this.journeys = journeys;
        this.entries = entries;
    }

    @Transactional(readOnly = true)
    public FeedResponse feed(UUID reader, PageRequest request) {
        Page<NewInJourney> found = journeyStore.journeysWithNewEntries(reader, request);
        List<UUID> ids = found.items().stream().map(NewInJourney::journeyId).toList();
        Map<UUID, JourneyResponse> byId = journeys.views(journeyStore.findAll(ids, reader), reader).stream()
                .collect(Collectors.toMap(JourneyResponse::id, Function.identity()));
        Map<UUID, List<EntryResponse>> latest = entries.latestByOthers(ids, reader, ENTRIES_PER_JOURNEY);
        List<FeedGroupResponse> groups = found.items().stream()
                .filter(group -> byId.containsKey(group.journeyId())) // gone between two statements: leave it out
                .map(group -> {
                    List<EntryResponse> newest = latest.getOrDefault(group.journeyId(), List.of());
                    return new FeedGroupResponse(
                            byId.get(group.journeyId()),
                            group.newCount(),
                            newest.subList(0, Math.min(newest.size(), group.newCount())));
                })
                .toList();
        return new FeedResponse(groups, journeyStore.followingCount(reader), found.nextCursor());
    }
}
