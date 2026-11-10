package app.journey.api.digest;

import app.journey.api.common.Jobs;
import app.journey.api.digest.DigestStore.Due;
import app.journey.api.digest.DigestStore.Moved;
import app.journey.api.entry.EntryService;
import app.journey.api.entry.EntryService.EntryResponse;
import app.journey.api.journey.JourneyService;
import app.journey.api.journey.JourneyService.JourneyResponse;
import app.journey.api.journey.JourneyStore;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.IsoFields;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The weekly digest: "This week in the journeys you follow". The page is read from the last seven days
 * whenever it is opened. Once a week a message goes to everyone who has something to catch up on and
 * hasn't switched the digest off; a week with nothing new sends nothing.
 */
@Service
public class DigestService {

  private static final Logger log = LoggerFactory.getLogger(DigestService.class);
  static final int DAYS = 7;

  public record DigestJourneyResponse(JourneyResponse journey, int newCount, @Schema(description = "The newest of the week's entries") EntryResponse latest) {}

  public record DigestResponse(
      LocalDate from, LocalDate to,
      @Schema(description = "How many entries the week brought, across all followed journeys") int entryCount,
      @Schema(nullable = true, description = "The most liked entry of the week") EntryResponse moment,
      List<DigestJourneyResponse> journeys,
      @Schema(description = "Followed journeys that were completed this week") List<JourneyResponse> finished) {}

  private final DigestStore digests;
  private final JourneyStore journeyStore;
  private final JourneyService journeys;
  private final EntryService entries;
  private final DigestSender sender;
  private final Jobs jobs;

  DigestService(DigestStore digests, JourneyStore journeyStore, JourneyService journeys, EntryService entries, DigestSender sender, Jobs jobs) {
    this.digests = digests;
    this.journeyStore = journeyStore;
    this.journeys = journeys;
    this.entries = entries;
    this.sender = sender;
    this.jobs = jobs;
  }

  /** The week for one reader. A fixed handful of statements, however many journeys moved. */
  @Transactional(readOnly = true)
  public DigestResponse thisWeek(UUID me) {
    List<Moved> moved = digests.moved(me, 20);
    List<UUID> finishedIds = digests.finished(me, 10);
    List<UUID> journeyIds = Stream.concat(moved.stream().map(Moved::journeyId), finishedIds.stream()).distinct().toList();
    Map<UUID, JourneyResponse> journeyById = journeys.views(journeyStore.findAll(journeyIds, me), me).stream()
        .collect(Collectors.toMap(JourneyResponse::id, Function.identity()));
    Map<UUID, EntryResponse> entryById = entries.byId(moved.stream().flatMap(m -> Stream.of(m.latest(), m.top())).distinct().toList(), me);

    // A journey or entry that went away between two statements is simply left out.
    List<Moved> shown = moved.stream().filter(m -> journeyById.containsKey(m.journeyId()) && entryById.containsKey(m.latest())).toList();
    List<DigestJourneyResponse> lines = shown.stream()
        .map(m -> new DigestJourneyResponse(journeyById.get(m.journeyId()), m.count(), entryById.get(m.latest()))).toList();
    EntryResponse moment = shown.stream().max(Comparator.comparingInt(Moved::topLikes)).map(m -> entryById.get(m.top())).orElse(null);
    List<JourneyResponse> finished = finishedIds.stream().map(journeyById::get).filter(Objects::nonNull).toList();
    LocalDate today = LocalDate.now(ZoneOffset.UTC);
    return new DigestResponse(today.minusDays(DAYS - 1L), today, shown.stream().mapToInt(Moved::count).sum(), moment, lines, finished);
  }

  /** Sunday evening: one message to each person with something to catch up on. Only one copy of the API sends it. */
  @Scheduled(cron = "${journey.digest.cron:0 0 18 * * SUN}", zone = "UTC")
  public void sendWeekly() {
    LocalDate today = LocalDate.now(ZoneOffset.UTC);
    String week = "%d-W%02d".formatted(today.get(IsoFields.WEEK_BASED_YEAR), today.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR));
    if (jobs.claim("weekly_digest", week)) {
      log.info("Weekly digest sent to {} people.", sendAll());
    }
  }

  /** Sends the digest to everyone who wants it and has news. Returns how many people got one. */
  public int sendAll() {
    List<Due> due = digests.due();
    due.forEach(d -> sender.send(d.userId(), d.entries(), d.journeysMoved(), d.byEmail()));
    return due.size();
  }
}
