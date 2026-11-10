package app.journey.api.seed;

import app.journey.api.entry.EntryStore;
import app.journey.api.media.LocalDiskStorage;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.InputStream;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Local mode only: fills an empty database with a handful of made-up creators and journeys, so that
 * Home, Discover and the sign-up suggestions have something to show. The people and stories are the
 * ones in the designs. Nothing here runs against a real database.
 */
@Component
@ConditionalOnProperty(name = "journey.media.mode", havingValue = "local")
public class LocalSeed implements ApplicationRunner {

  private static final Logger log = LoggerFactory.getLogger(LocalSeed.class);

  private record Person(String username, String name, String bio, String avatar, List<String> interests) {}

  private record Story(String title, int day, String place, String photo, String body, boolean milestone) {}

  private record Trip(String owner, String title, String description, String template, String category, String labelStyle, Integer targetDays,
      int startedDaysAgo, int followers, String cover, List<String> tags, boolean completed, List<Story> stories) {}

  private static final List<Person> PEOPLE = List.of(
      new Person("maya.rides", "Maya Rivera", "Slow travel on two wheels. Somewhere between Hanoi and Bali right now.", "av-maya", List.of("travel", "road-trips")),
      new Person("lea.plays", "Lea Martin", "Learning guitar at 34. Wish me luck.", "av-lea", List.of("music", "learning")),
      new Person("kai.surfs", "Kai Nakamura", "Desk job, salty hair.", "av-kai", List.of("surfing", "fitness")),
      new Person("ana.walks", "Ana Costa", "Long walks in high places.", "av-ana", List.of("hiking", "travel")),
      new Person("lena.islands", "Lena Park", "One island at a time.", "av-lena", List.of("travel", "photography")),
      new Person("jonas.up", "Jonas Weber", "Looking at things from above.", null, List.of("travel")),
      new Person("noah.slow", "Noah Petit", "A van, a dog and no schedule.", null, List.of("road-trips")),
      new Person("mia.runs", "Mia Chen", "From the couch to somewhere.", null, List.of("running", "fitness")),
      new Person("theo.keys", "Theo Brandt", "Scales before breakfast.", null, List.of("music")),
      new Person("sam.cooks", "Sam Ortiz", "Cooking my way through the family notebook.", null, List.of("food")));

  private static final List<Trip> TRIPS = List.of(
      new Trip("maya.rides", "Southeast Asia by motorbike", "3,000 km from Hanoi to Bali on a 2003 Honda Win. Slow roads, street food and too many flat tyres.",
          "trip", "travel", "day", null, 21, 1200, "road", List.of("vietnam", "roadtrip", "motorbike"), false, List.of(
              new Story("Picked up the bike", 1, "Hanoi, Vietnam", "scooters", "She's 23 years old and sounds it. We leave tomorrow.", false),
              new Story("Up into the mountains", 9, "Ha Giang, Vietnam", "terraces", "Nine days in and the first real climb. The bike coped better than I did.", true),
              new Story("Roads that look like rivers", 12, "Ha Giang loop", "terraces", "From the top of Ma Pi Leng you can see the whole loop.", false),
              new Story("Floating market at sunrise", 14, "Hoi An, Vietnam", "market", "Bought mangoes from a boat. Zero regrets.", false),
              new Story("Sunrise over Mount Bromo", 22, "Mount Bromo, Indonesia", "bromo", "Left the guesthouse at 3am, rode up in the dark and watched the crater turn pink. Worth every cold minute.", true))),
      new Trip("lea.plays", "30 days of guitar", "One chord a day until it sounds like music.", "challenge30", "learning", "day", 30, 11, 46, "guitar",
          List.of("learnguitar", "30days"), false, List.of(
              new Story("Day one. Fingers hurt.", 1, null, "guitar-neck", "Twenty minutes and I can't feel my fingertips. Apparently that's normal.", false),
              new Story("First full song, start to end", 10, null, "guitar", "Three chords and the truth. Mostly three chords.", true),
              new Story("Finally nailed the G chord", 11, null, "guitar-neck", "Slow, clean and only slightly buzzy.", false),
              new Story("Strumming without looking", 12, null, "guitar", "Looked up at the window for a whole bar. Felt like flying.", false))),
      new Trip("kai.surfs", "Learn to surf", "Thirty days in Bali to stand up on a board. Low expectations, high sunscreen.", "challenge30", "fitness", "day", 30, 5, 2400,
          "surf-video", List.of("surfing", "bali", "30days"), false, List.of(
              new Story("Board rented. Wetsuit too big.", 1, "Canggu, Bali", "surfboard", "The instructor says the board is \"very forgiving\". We'll see.", false),
              new Story("Paddling is the whole sport", 4, "Canggu, Bali", "surfboard", "Nobody tells you it's 95% paddling. My shoulders have filed a complaint.", false),
              new Story("Stood up for four whole seconds", 6, "Canggu, Bali", "surf-video", "Fell 40 times, stood up once. That counts, right?", true))),
      new Trip("ana.walks", "Four days on the Inca Trail", "Forty-two kilometres, four passes and one very old city at the end.", "trip", "travel", "day", null, 3, 640,
          "machu-picchu", List.of("peru", "hiking"), false, List.of(
              new Story("Kilometre 82", 1, "Cusco, Peru", "terraces", "Passports stamped, boots tied. The porters are already out of sight.", false),
              new Story("Dead Woman's Pass", 2, "Inca Trail, Peru", "terraces", "4,215 metres. I counted steps in tens to get up the last stretch.", true),
              new Story("Above the clouds", 3, "Inca Trail, Peru", "machu-picchu", "Woke up above a white sea. Tomorrow we walk down into it.", false),
              new Story("The Sun Gate", 4, "Machu Picchu, Peru", "machu-picchu", "It was fog, fog, fog, and then it wasn't.", true))),
      new Trip("lena.islands", "Island hopping, Philippines", "Three weeks, eleven ferries, as many beaches as possible.", "trip", "travel", "day", null, 8, 310, "el-nido",
          List.of("philippines", "islands"), false, List.of(
              new Story("First ferry of many", 1, "Coron, Philippines", "sea-cave", "The timetable is more of a suggestion.", false),
              new Story("The hidden beach", 6, "El Nido, Philippines", "sea-cave", "You swim through a gap in the rock and there it is.", false),
              new Story("Seven lagoons in one day", 9, "El Nido, Philippines", "el-nido", "The boatman knew every hidden beach.", true))),
      new Trip("jonas.up", "Cappadocia by balloon", "Three mornings, three flights, one very early alarm.", "trip", "travel", "day", null, 12, 860, "cappadocia",
          List.of("turkey", "balloons"), true, List.of(
              new Story("Fifty balloons before breakfast", 1, "Göreme, Turkey", "cappadocia", "They rise all at once, like someone turned gravity down.", true),
              new Story("Up with them", 2, "Göreme, Turkey", "cappadocia", "Quieter than I expected. You only hear the burner.", false),
              new Story("One last sunrise", 3, "Göreme, Turkey", "cappadocia", "Watched from the ground with tea this time. Just as good.", false))),
      new Trip("noah.slow", "Van life, the slow way", "Portugal's coast at thirty kilometres an hour.", "journal", "travel", "part", null, 20, 520, "van",
          List.of("vanlife", "portugal"), false, List.of(
              new Story("She runs", 2, "Porto, Portugal", "van", "After two weeks in the garage, the engine caught first time.", false),
              new Story("Parking with a view", 9, "Nazaré, Portugal", "van", "Front row for the big waves, free of charge.", false),
              new Story("The slow way south", 17, "Sagres, Portugal", "van", "We've stopped checking the map.", false))),
      new Trip("mia.runs", "Couch to 10K", "Nine weeks from the sofa to ten kilometres.", "skill", "fitness", "day", null, 33, 2100, "runner",
          List.of("running", "couchto10k"), false, List.of(
              new Story("Sixty seconds at a time", 1, null, "runner", "Run a minute, walk a minute. Eight times. I nearly died.", false),
              new Story("Five whole kilometres", 22, null, "runner", "No walking breaks. I may have cried a little.", true),
              new Story("Hills, apparently", 33, null, "runner", "Week five adds hills. Nobody asked for hills.", false))),
      new Trip("theo.keys", "100 days of piano", "Twenty minutes every morning for a hundred days.", "skill", "learning", "day", null, 40, 310, "piano",
          List.of("piano", "100days"), false, List.of(
              new Story("Finding middle C", 1, null, "piano", "My grandfather's piano, tuned for the first time in ten years.", false),
              new Story("Both hands at once", 18, null, "piano", "Slowly. Painfully. But at once.", true),
              new Story("A whole page of Satie", 41, null, "piano", "Gymnopédie No. 1, at half speed, with feeling.", false))),
      new Trip("sam.cooks", "My grandmother's recipes", "Cooking every page of her notebook, in order.", "journal", "food", "part", null, 60, 1100, "cooking",
          List.of("cooking", "family"), false, List.of(
              new Story("Page one: red onion soup", 3, null, "cooking", "Her handwriting says \"enough salt\". Thanks, abuela.", false),
              new Story("The one with no measurements", 30, null, "cooking", "\"Flour until it feels right.\" It took four tries to feel right.", false),
              new Story("Sunday rice", 58, null, "cooking", "The whole flat smells like her kitchen.", true))));

  private final JdbcClient jdbc;
  private final LocalDiskStorage storage;
  private final EntryStore entries;
  private final boolean enabled;

  LocalSeed(JdbcClient jdbc, LocalDiskStorage storage, EntryStore entries, @Value("${journey.seed.enabled:false}") boolean enabled) {
    this.jdbc = jdbc;
    this.storage = storage;
    this.entries = entries;
    this.enabled = enabled;
  }

  @Override
  public void run(ApplicationArguments args) {
    if (!enabled) {
      return;
    }
    try {
      if (seedIfEmpty()) {
        log.info("Added the sample creators and journeys ({} journeys).", TRIPS.size());
      }
    } catch (RuntimeException | IOException e) {
      log.warn("Could not add the sample journeys: {}", e.toString());
    }
  }

  /** Adds the sample data when there are no journeys yet. Returns whether it did. */
  @Transactional
  public boolean seedIfEmpty() throws IOException {
    if (jdbc.sql("select count(*) from journeys").query(Integer.class).single() > 0) {
      return false;
    }
    Map<String, UUID> photoIds = new HashMap<>();
    Map<String, UUID> people = new HashMap<>();
    for (Person person : PEOPLE) {
      UUID id = jdbc.sql("insert into local_users (email) values (:email) on conflict (email) do update set email = excluded.email returning id")
          .param("email", person.username() + "@demo.journey").query(UUID.class).single();
      UUID avatar = person.avatar() == null ? null : photo(person.avatar(), id, photoIds);
      jdbc.sql(
              """
              insert into profiles (id, username, display_name, bio, interests, avatar_media_id)
              values (:id, :username, :name, :bio, cast(:interests as text[]), cast(:avatar as uuid))
              on conflict do nothing
              """)
          .param("id", id).param("username", person.username()).param("name", person.name()).param("bio", person.bio())
          .param("interests", "{" + String.join(",", person.interests()) + "}").param("avatar", avatar == null ? null : avatar.toString())
          .update();
      people.put(person.username(), id);
    }
    Instant now = Instant.now();
    LocalDate today = LocalDate.now(ZoneOffset.UTC);
    for (Trip trip : TRIPS) {
      UUID owner = people.get(trip.owner());
      LocalDate start = today.minusDays(trip.startedDaysAgo());
      UUID journey = jdbc.sql(
              """
              insert into journeys (owner_id, title, description, category, template, label_style, visibility, tags, cover_media_id, start_date,
                target_days, follower_count, status, completed_at, closing_note, created_at)
              values (:owner, :title, :description, :category, :template, :labelStyle, 'public', cast(:tags as text[]), :cover, :start,
                cast(:target as int), :followers, :status, :completedAt, :note, :createdAt)
              returning id
              """)
          .param("owner", owner).param("title", trip.title()).param("description", trip.description()).param("category", trip.category())
          .param("template", trip.template()).param("labelStyle", trip.labelStyle()).param("tags", "{" + String.join(",", trip.tags()) + "}")
          .param("cover", photo(trip.cover(), owner, photoIds)).param("start", start)
          .param("target", trip.targetDays() == null ? null : trip.targetDays().toString()).param("followers", trip.followers())
          .param("status", trip.completed() ? "completed" : "active")
          .param("completedAt", trip.completed() ? Timestamp.from(now.minus(2, ChronoUnit.DAYS)) : null)
          .param("note", trip.completed() ? "Three flights, three sunrises. Thank you for coming along." : null)
          .param("createdAt", Timestamp.from(start.atStartOfDay().toInstant(ZoneOffset.UTC)))
          .query(UUID.class).single();
      int hour = 7;
      for (Story story : trip.stories()) {
        LocalDate on = start.plusDays(story.day() - 1L);
        Instant at = on.atTime(hour++ % 12 + 6, 20).toInstant(ZoneOffset.UTC);
        if (at.isAfter(now)) {
          // Today's entry can't be in the future: a couple of hours ago, but still today.
          Instant recent = now.minus(2, ChronoUnit.HOURS);
          Instant startOfDay = on.atStartOfDay().toInstant(ZoneOffset.UTC);
          at = recent.isBefore(startOfDay) ? startOfDay : recent;
        }
        UUID entry = jdbc.sql(
                """
                insert into entries (journey_id, author_id, happened_at, happened_on, title, body, place_name, is_milestone, created_at)
                values (:journey, :author, :at, :on, :title, :body, :place, :milestone, :at)
                returning id
                """)
            .param("journey", journey).param("author", owner).param("at", Timestamp.from(at)).param("on", on).param("title", story.title())
            .param("body", story.body()).param("place", story.place()).param("milestone", story.milestone())
            .query(UUID.class).single();
        entries.replaceMedia(entry, List.of(photo(story.photo(), owner, photoIds)));
      }
      entries.refreshJourneyCounters(journey, false);
    }
    return true;
  }

  /** Copies one of the bundled photos into storage (once) and returns its media id. */
  private UUID photo(String name, UUID owner, Map<String, UUID> done) throws IOException {
    UUID existing = done.get(name);
    if (existing != null) {
      return existing;
    }
    ClassPathResource resource = new ClassPathResource("seed/img/" + name + ".jpg");
    String key = "seed/img/" + name + ".jpg";
    long bytes;
    try (InputStream in = resource.getInputStream()) {
      bytes = storage.store(key, in, Long.MAX_VALUE);
    }
    BufferedImage image;
    try (InputStream in = resource.getInputStream()) {
      image = ImageIO.read(in);
    }
    UUID id = jdbc.sql(
            """
            insert into media (owner_id, kind, content_type, storage_key, bytes, width, height, status)
            values (:owner, 'photo', 'image/jpeg', :key, :bytes, :w, :h, 'ready')
            on conflict (storage_key) do update set status = 'ready'
            returning id
            """)
        .param("owner", owner).param("key", key).param("bytes", bytes).param("w", image == null ? null : image.getWidth())
        .param("h", image == null ? null : image.getHeight())
        .query(UUID.class).single();
    done.put(name, id);
    return id;
  }
}
