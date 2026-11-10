package app.journey.api.digest;

import app.journey.api.common.ApiProblem;
import app.journey.api.entry.EntryService;
import app.journey.api.entry.EntryService.EntryResponse;
import app.journey.api.journey.JourneyService;
import app.journey.api.journey.JourneyService.JourneyResponse;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

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

  private record Moved(UUID journeyId, int count, UUID latest, UUID top, int topLikes) {}

  private final JdbcClient jdbc;
  private final JourneyService journeys;
  private final EntryService entries;
  private final DigestSender sender;

  DigestService(JdbcClient jdbc, JourneyService journeys, EntryService entries, DigestSender sender) {
    this.jdbc = jdbc;
    this.journeys = journeys;
    this.entries = entries;
    this.sender = sender;
  }

  public DigestResponse thisWeek(UUID me) {
    List<Moved> moved = jdbc.sql(
            """
            select e.journey_id, count(*) as n, max(e.like_count) as top_likes,
                   (array_agg(e.id order by e.created_at desc))[1] as latest,
                   (array_agg(e.id order by e.like_count desc, e.created_at desc))[1] as top
            from entries e join journey_follows f on f.journey_id = e.journey_id and f.user_id = :me
            where e.author_id <> :me and e.created_at > now() - interval '7 days'
            group by e.journey_id order by max(e.created_at) desc limit 20
            """)
        .param("me", me)
        .query((rs, n) -> new Moved(rs.getObject("journey_id", UUID.class), rs.getInt("n"), rs.getObject("latest", UUID.class),
            rs.getObject("top", UUID.class), rs.getInt("top_likes")))
        .list();
    List<DigestJourneyResponse> lines = new ArrayList<>();
    List<Moved> shown = new ArrayList<>();
    for (Moved m : moved) {
      try {
        lines.add(new DigestJourneyResponse(journeys.view(journeys.require(m.journeyId(), me), me), m.count(), entries.get(m.latest(), me)));
        shown.add(m);
      } catch (ApiProblem hidden) {
        // A journey the person can no longer see (made private, or its creator blocked them) is left out.
      }
    }
    EntryResponse moment = shown.stream().max(Comparator.comparingInt(Moved::topLikes)).map(m -> entries.get(m.top(), me)).orElse(null);
    List<UUID> finishedIds = jdbc.sql(
            """
            select j.id from journeys j join journey_follows f on f.journey_id = j.id and f.user_id = :me
            where j.status = 'completed' and j.owner_id <> :me and j.completed_at > now() - interval '7 days'
            order by j.completed_at desc limit 10
            """)
        .param("me", me).query(UUID.class).list();
    List<JourneyResponse> finished = new ArrayList<>();
    for (UUID id : finishedIds) {
      try {
        finished.add(journeys.view(journeys.require(id, me), me));
      } catch (ApiProblem hidden) {
        // as above
      }
    }
    LocalDate today = LocalDate.now(ZoneOffset.UTC);
    return new DigestResponse(today.minusDays(DAYS - 1L), today, shown.stream().mapToInt(Moved::count).sum(), moment, lines, finished);
  }

  /** Sunday evening: one message to each person with something to catch up on. */
  @Scheduled(cron = "${journey.digest.cron:0 0 18 * * SUN}", zone = "UTC")
  public void sendWeekly() {
    int sent = sendAll();
    log.info("Weekly digest sent to {} people.", sent);
  }

  /** Sends the digest to everyone who wants it and has news. Returns how many people got one. */
  public int sendAll() {
    record Due(UUID userId, String email, int entries, int journeysMoved, boolean byEmail) {}
    List<Due> due = jdbc.sql(
            """
            select f.user_id, coalesce(s.digest_email, false) as by_email, count(*) as entries, count(distinct e.journey_id) as journeys
            from journey_follows f
            join entries e on e.journey_id = f.journey_id and e.author_id <> f.user_id and e.created_at > now() - interval '7 days'
            join journeys j on j.id = f.journey_id and (j.visibility <> 'private' or j.owner_id = f.user_id
              or exists (select 1 from journey_members m where m.journey_id = j.id and m.user_id = f.user_id and m.status = 'joined'))
            left join settings s on s.user_id = f.user_id
            where coalesce(s.weekly_digest, true)
            group by f.user_id, s.digest_email
            """)
        .query((rs, n) -> new Due(rs.getObject("user_id", UUID.class), null, rs.getInt("entries"), rs.getInt("journeys"), rs.getBoolean("by_email")))
        .list();
    due.forEach(d -> sender.send(d.userId(), d.entries(), d.journeysMoved(), d.byEmail()));
    return due.size();
  }
}
