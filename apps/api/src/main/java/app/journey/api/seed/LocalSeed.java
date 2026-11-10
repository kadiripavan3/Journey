package app.journey.api.seed;

import app.journey.api.entry.EntryAdded;
import app.journey.api.entry.EntryStore;
import app.journey.api.journey.FriendInvited;
import app.journey.api.journey.JourneyStore;
import app.journey.api.media.LocalDiskStorage;
import app.journey.api.media.MediaSizes;
import app.journey.api.place.LocalPlaces;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Local mode only: fills an empty database with a handful of made-up creators and journeys, so that
 * Home, Discover and the sign-up suggestions have something to show, and has those creators react when
 * the person testing posts something. The people and stories are the ones in the designs. Nothing here
 * runs against a real database.
 */
@Component
@ConditionalOnProperty(name = "journey.media.mode", havingValue = "local")
public class LocalSeed implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(LocalSeed.class);

    private record Person(String username, String name, String bio, String avatar, List<String> interests) {}

    private record Story(String title, int day, String place, String photo, String body, boolean milestone) {}

    private record Trip(
            String owner,
            String title,
            String description,
            String template,
            String category,
            String labelStyle,
            Integer targetDays,
            int startedDaysAgo,
            int followers,
            String cover,
            List<String> tags,
            boolean completed,
            List<Story> stories) {}

    private static final List<Person> PEOPLE = List.of(
            new Person(
                    "maya.rides",
                    "Maya Rivera",
                    "Slow travel on two wheels. Somewhere between Hanoi and Bali right now.",
                    "av-maya",
                    List.of("travel", "road-trips")),
            new Person(
                    "lea.plays",
                    "Lea Martin",
                    "Learning guitar at 34. Wish me luck.",
                    "av-lea",
                    List.of("music", "learning")),
            new Person("kai.surfs", "Kai Nakamura", "Desk job, salty hair.", "av-kai", List.of("surfing", "fitness")),
            new Person("ana.walks", "Ana Costa", "Long walks in high places.", "av-ana", List.of("hiking", "travel")),
            new Person(
                    "lena.islands", "Lena Park", "One island at a time.", "av-lena", List.of("travel", "photography")),
            new Person("jonas.up", "Jonas Weber", "Looking at things from above.", null, List.of("travel")),
            new Person("noah.slow", "Noah Petit", "A van, a dog and no schedule.", null, List.of("road-trips")),
            new Person("mia.runs", "Mia Chen", "From the couch to somewhere.", null, List.of("running", "fitness")),
            new Person("theo.keys", "Theo Brandt", "Scales before breakfast.", null, List.of("music")),
            new Person("sam.cooks", "Sam Ortiz", "Cooking my way through the family notebook.", null, List.of("food")));

    private static final List<Trip> TRIPS = List.of(
            new Trip(
                    "maya.rides",
                    "Southeast Asia by motorbike",
                    "3,000 km from Hanoi to Bali on a 2003 Honda Win. Slow roads, street food and too many flat tyres.",
                    "trip",
                    "travel",
                    "day",
                    null,
                    21,
                    1200,
                    "road",
                    List.of("vietnam", "roadtrip", "motorbike"),
                    false,
                    List.of(
                            new Story(
                                    "Picked up the bike",
                                    1,
                                    "Hanoi, Vietnam",
                                    "scooters",
                                    "She's 23 years old and sounds it. We leave tomorrow.",
                                    false),
                            new Story(
                                    "Up into the mountains",
                                    9,
                                    "Ha Giang, Vietnam",
                                    "terraces",
                                    "Nine days in and the first real climb. The bike coped better than I did.",
                                    true),
                            new Story(
                                    "Roads that look like rivers",
                                    12,
                                    "Ha Giang loop",
                                    "terraces",
                                    "From the top of Ma Pi Leng you can see the whole loop.",
                                    false),
                            new Story(
                                    "Floating market at sunrise",
                                    14,
                                    "Hoi An, Vietnam",
                                    "market",
                                    "Bought mangoes from a boat. Zero regrets.",
                                    false),
                            new Story(
                                    "Sunrise over Mount Bromo",
                                    22,
                                    "Mount Bromo, Indonesia",
                                    "bromo",
                                    "Left the guesthouse at 3am, rode up in the dark and watched the crater turn pink. Worth every cold minute.",
                                    true))),
            new Trip(
                    "lea.plays",
                    "30 days of guitar",
                    "One chord a day until it sounds like music.",
                    "challenge30",
                    "learning",
                    "day",
                    30,
                    11,
                    46,
                    "guitar",
                    List.of("learnguitar", "30days"),
                    false,
                    List.of(
                            new Story(
                                    "Day one. Fingers hurt.",
                                    1,
                                    null,
                                    "guitar-neck",
                                    "Twenty minutes and I can't feel my fingertips. Apparently that's normal.",
                                    false),
                            new Story(
                                    "First full song, start to end",
                                    10,
                                    null,
                                    "guitar",
                                    "Three chords and the truth. Mostly three chords.",
                                    true),
                            new Story(
                                    "Finally nailed the G chord",
                                    11,
                                    null,
                                    "guitar-neck",
                                    "Slow, clean and only slightly buzzy.",
                                    false),
                            new Story(
                                    "Strumming without looking",
                                    12,
                                    null,
                                    "guitar",
                                    "Looked up at the window for a whole bar. Felt like flying.",
                                    false))),
            new Trip(
                    "kai.surfs",
                    "Learn to surf",
                    "Thirty days in Bali to stand up on a board. Low expectations, high sunscreen.",
                    "challenge30",
                    "fitness",
                    "day",
                    30,
                    5,
                    2400,
                    "surf-video",
                    List.of("surfing", "bali", "30days"),
                    false,
                    List.of(
                            new Story(
                                    "Board rented. Wetsuit too big.",
                                    1,
                                    "Canggu, Bali",
                                    "surfboard",
                                    "The instructor says the board is \"very forgiving\". We'll see.",
                                    false),
                            new Story(
                                    "Paddling is the whole sport",
                                    4,
                                    "Canggu, Bali",
                                    "surfboard",
                                    "Nobody tells you it's 95% paddling. My shoulders have filed a complaint.",
                                    false),
                            new Story(
                                    "Stood up for four whole seconds",
                                    6,
                                    "Canggu, Bali",
                                    "surf-video",
                                    "Fell 40 times, stood up once. That counts, right?",
                                    true))),
            new Trip(
                    "ana.walks",
                    "Four days on the Inca Trail",
                    "Forty-two kilometres, four passes and one very old city at the end.",
                    "trip",
                    "travel",
                    "day",
                    null,
                    3,
                    640,
                    "machu-picchu",
                    List.of("peru", "hiking"),
                    false,
                    List.of(
                            new Story(
                                    "Kilometre 82",
                                    1,
                                    "Cusco, Peru",
                                    "terraces",
                                    "Passports stamped, boots tied. The porters are already out of sight.",
                                    false),
                            new Story(
                                    "Dead Woman's Pass",
                                    2,
                                    "Inca Trail, Peru",
                                    "terraces",
                                    "4,215 metres. I counted steps in tens to get up the last stretch.",
                                    true),
                            new Story(
                                    "Above the clouds",
                                    3,
                                    "Inca Trail, Peru",
                                    "machu-picchu",
                                    "Woke up above a white sea. Tomorrow we walk down into it.",
                                    false),
                            new Story(
                                    "The Sun Gate",
                                    4,
                                    "Machu Picchu, Peru",
                                    "machu-picchu",
                                    "It was fog, fog, fog, and then it wasn't.",
                                    true))),
            new Trip(
                    "lena.islands",
                    "Island hopping, Philippines",
                    "Three weeks, eleven ferries, as many beaches as possible.",
                    "trip",
                    "travel",
                    "day",
                    null,
                    8,
                    310,
                    "el-nido",
                    List.of("philippines", "islands"),
                    false,
                    List.of(
                            new Story(
                                    "First ferry of many",
                                    1,
                                    "Coron, Philippines",
                                    "sea-cave",
                                    "The timetable is more of a suggestion.",
                                    false),
                            new Story(
                                    "The hidden beach",
                                    6,
                                    "El Nido, Philippines",
                                    "sea-cave",
                                    "You swim through a gap in the rock and there it is.",
                                    false),
                            new Story(
                                    "Seven lagoons in one day",
                                    9,
                                    "El Nido, Philippines",
                                    "el-nido",
                                    "The boatman knew every hidden beach.",
                                    true))),
            new Trip(
                    "jonas.up",
                    "Cappadocia by balloon",
                    "Three mornings, three flights, one very early alarm.",
                    "trip",
                    "travel",
                    "day",
                    null,
                    12,
                    860,
                    "cappadocia",
                    List.of("turkey", "balloons"),
                    true,
                    List.of(
                            new Story(
                                    "Fifty balloons before breakfast",
                                    1,
                                    "Göreme, Turkey",
                                    "cappadocia",
                                    "They rise all at once, like someone turned gravity down.",
                                    true),
                            new Story(
                                    "Up with them",
                                    2,
                                    "Göreme, Turkey",
                                    "cappadocia",
                                    "Quieter than I expected. You only hear the burner.",
                                    false),
                            new Story(
                                    "One last sunrise",
                                    3,
                                    "Göreme, Turkey",
                                    "cappadocia",
                                    "Watched from the ground with tea this time. Just as good.",
                                    false))),
            new Trip(
                    "noah.slow",
                    "Van life, the slow way",
                    "Portugal's coast at thirty kilometres an hour.",
                    "journal",
                    "travel",
                    "part",
                    null,
                    20,
                    520,
                    "van",
                    List.of("vanlife", "portugal"),
                    false,
                    List.of(
                            new Story(
                                    "She runs",
                                    2,
                                    "Porto, Portugal",
                                    "van",
                                    "After two weeks in the garage, the engine caught first time.",
                                    false),
                            new Story(
                                    "Parking with a view",
                                    9,
                                    "Nazaré, Portugal",
                                    "van",
                                    "Front row for the big waves, free of charge.",
                                    false),
                            new Story(
                                    "The slow way south",
                                    17,
                                    "Sagres, Portugal",
                                    "van",
                                    "We've stopped checking the map.",
                                    false))),
            new Trip(
                    "mia.runs",
                    "Couch to 10K",
                    "Nine weeks from the sofa to ten kilometres.",
                    "skill",
                    "fitness",
                    "day",
                    null,
                    33,
                    2100,
                    "runner",
                    List.of("running", "couchto10k"),
                    false,
                    List.of(
                            new Story(
                                    "Sixty seconds at a time",
                                    1,
                                    null,
                                    "runner",
                                    "Run a minute, walk a minute. Eight times. I nearly died.",
                                    false),
                            new Story(
                                    "Five whole kilometres",
                                    22,
                                    null,
                                    "runner",
                                    "No walking breaks. I may have cried a little.",
                                    true),
                            new Story(
                                    "Hills, apparently",
                                    33,
                                    null,
                                    "runner",
                                    "Week five adds hills. Nobody asked for hills.",
                                    false))),
            new Trip(
                    "theo.keys",
                    "100 days of piano",
                    "Twenty minutes every morning for a hundred days.",
                    "skill",
                    "learning",
                    "day",
                    null,
                    40,
                    310,
                    "piano",
                    List.of("piano", "100days"),
                    false,
                    List.of(
                            new Story(
                                    "Finding middle C",
                                    1,
                                    null,
                                    "piano",
                                    "My grandfather's piano, tuned for the first time in ten years.",
                                    false),
                            new Story("Both hands at once", 18, null, "piano", "Slowly. Painfully. But at once.", true),
                            new Story(
                                    "A whole page of Satie",
                                    41,
                                    null,
                                    "piano",
                                    "Gymnopédie No. 1, at half speed, with feeling.",
                                    false))),
            new Trip(
                    "sam.cooks",
                    "My grandmother's recipes",
                    "Cooking every page of her notebook, in order.",
                    "journal",
                    "food",
                    "part",
                    null,
                    60,
                    1100,
                    "cooking",
                    List.of("cooking", "family"),
                    false,
                    List.of(
                            new Story(
                                    "Page one: red onion soup",
                                    3,
                                    null,
                                    "cooking",
                                    "Her handwriting says \"enough salt\". Thanks, abuela.",
                                    false),
                            new Story(
                                    "The one with no measurements",
                                    30,
                                    null,
                                    "cooking",
                                    "\"Flour until it feels right.\" It took four tries to feel right.",
                                    false),
                            new Story(
                                    "Sunday rice",
                                    58,
                                    null,
                                    "cooking",
                                    "The whole flat smells like her kitchen.",
                                    true))));

    private final JdbcClient jdbc;
    private final LocalDiskStorage storage;
    private final MediaSizes sizes;
    private final EntryStore entries;
    private final JourneyStore journeys;
    private final TransactionTemplate transaction;
    private final boolean enabled;

    LocalSeed(
            JdbcClient jdbc,
            LocalDiskStorage storage,
            MediaSizes sizes,
            EntryStore entries,
            JourneyStore journeys,
            TransactionTemplate transaction,
            @Value("${journey.seed.enabled:false}") boolean enabled) {
        this.jdbc = jdbc;
        this.storage = storage;
        this.sizes = sizes;
        this.entries = entries;
        this.journeys = journeys;
        this.transaction = transaction;
        this.enabled = enabled;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!enabled) {
            return;
        }
        // Each step is all or nothing: if it fails half way, the next start finds an empty database and tries again.
        try {
            if (seedIfEmpty()) {
                log.info("Added the sample creators and journeys ({} journeys).", TRIPS.size());
            }
            if (addReactionsIfMissing()) {
                log.info("Added sample likes and comments.");
            }
        } catch (RuntimeException e) {
            log.warn("Could not add the sample journeys: {}", e.toString());
        }
    }

    /** Adds the sample data when there are no journeys yet. Returns whether it did. */
    public boolean seedIfEmpty() {
        return Boolean.TRUE.equals(transaction.execute(status -> addPeopleAndJourneys()));
    }

    private boolean addPeopleAndJourneys() {
        if (jdbc.sql("select count(*) from journeys").query(Integer.class).single() > 0) {
            return false;
        }
        Map<String, UUID> photoIds = new HashMap<>();
        Map<String, UUID> people = new HashMap<>();
        for (Person person : PEOPLE) {
            UUID id = jdbc.sql(
                            "insert into local_users (email) values (:email) on conflict (email) do update set email = excluded.email returning id")
                    .param("email", person.username() + "@demo.journey")
                    .query(UUID.class)
                    .single();
            UUID avatar = person.avatar() == null ? null : photo(person.avatar(), id, photoIds);
            jdbc.sql("""
              insert into profiles (id, username, display_name, bio, interests, avatar_media_id)
              values (:id, :username, :name, :bio, cast(:interests as text[]), cast(:avatar as uuid))
              on conflict do nothing
              """)
                    .param("id", id)
                    .param("username", person.username())
                    .param("name", person.name())
                    .param("bio", person.bio())
                    .param("interests", "{" + String.join(",", person.interests()) + "}")
                    .param("avatar", avatar == null ? null : avatar.toString())
                    .update();
            people.put(person.username(), id);
        }
        Instant now = Instant.now();
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        for (Trip trip : TRIPS) {
            UUID owner = people.get(trip.owner());
            LocalDate start = today.minusDays(trip.startedDaysAgo());
            UUID journey = jdbc.sql("""
              insert into journeys (owner_id, title, description, category, template, label_style, visibility, tags, cover_media_id, start_date,
                target_days, follower_count, status, completed_at, closing_note, created_at)
              values (:owner, :title, :description, :category, :template, :labelStyle, 'public', cast(:tags as text[]), :cover, :start,
                cast(:target as int), :followers, :status, :completedAt, :note, :createdAt)
              returning id
              """)
                    .param("owner", owner)
                    .param("title", trip.title())
                    .param("description", trip.description())
                    .param("category", trip.category())
                    .param("template", trip.template())
                    .param("labelStyle", trip.labelStyle())
                    .param("tags", "{" + String.join(",", trip.tags()) + "}")
                    .param("cover", photo(trip.cover(), owner, photoIds))
                    .param("start", start)
                    .param(
                            "target",
                            trip.targetDays() == null ? null : trip.targetDays().toString())
                    .param("followers", trip.followers())
                    .param("status", trip.completed() ? "completed" : "active")
                    .param("completedAt", trip.completed() ? Timestamp.from(now.minus(2, ChronoUnit.DAYS)) : null)
                    .param(
                            "note",
                            trip.completed() ? "Three flights, three sunrises. Thank you for coming along." : null)
                    .param("createdAt", Timestamp.from(start.atStartOfDay().toInstant(ZoneOffset.UTC)))
                    .query(UUID.class)
                    .single();
            journeys.setAuthor(owner, journey);
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
                java.util.Optional<LocalPlaces.KnownPlace> point =
                        story.place() == null ? java.util.Optional.empty() : LocalPlaces.named(story.place());
                UUID entry = jdbc.sql("""
                insert into entries (journey_id, author_id, happened_at, happened_on, title, body, place_name, lat, lng,
                  location_precision, is_milestone, created_at)
                values (:journey, :author, :at, :on, :title, :body, :place, :lat, :lng, :precision, :milestone, :at)
                returning id
                """)
                        .param("journey", journey)
                        .param("author", owner)
                        .param("at", Timestamp.from(at))
                        .param("on", on)
                        .param("title", story.title())
                        .param("body", story.body())
                        .param("place", story.place())
                        .param("lat", point.map(LocalPlaces.KnownPlace::lat).orElse(null))
                        .param("lng", point.map(LocalPlaces.KnownPlace::lng).orElse(null))
                        .param("precision", point.isPresent() ? "city" : "none")
                        .param("milestone", story.milestone())
                        .query(UUID.class)
                        .single();
                entries.replaceMedia(entry, List.of(photo(story.photo(), owner, photoIds)));
            }
        }
        return true;
    }

    private static final List<String> REMARKS = List.of(
            "This looks amazing.",
            "Following along from here!",
            "Can't wait for the next one.",
            "Saving this for my own trip one day.",
            "How long did that take?",
            "Brilliant. Keep going.");
    private static final List<String> ANSWERS =
            List.of("Thank you! More soon.", "Longer than planned, as always.", "Come along next time!");

    /** The sample creators like and comment on each other's entries, so counts and comment threads have something to show. */
    public boolean addReactionsIfMissing() {
        return Boolean.TRUE.equals(transaction.execute(status -> addLikesAndComments()));
    }

    private boolean addLikesAndComments() {
        List<UUID> sample = samplePeople();
        if (sample.size() < 3
                || jdbc.sql("select count(*) from comments")
                                .query(Integer.class)
                                .single()
                        > 0) {
            return false;
        }
        record Target(UUID entry, UUID author, Instant at) {}
        List<Target> targets = jdbc.sql(
                        "select e.id, e.author_id, e.created_at from entries e where e.author_id in (:sample) order by e.created_at")
                .param("sample", sample)
                .query((rs, n) -> new Target(
                        rs.getObject("id", UUID.class),
                        rs.getObject("author_id", UUID.class),
                        rs.getTimestamp("created_at").toInstant()))
                .list();
        int turn = 0;
        for (Target target : targets) {
            List<UUID> others =
                    sample.stream().filter(id -> !id.equals(target.author())).toList();
            int likes = 2 + turn % 5;
            for (int i = 0; i < likes; i++) {
                jdbc.sql(
                                "insert into entry_likes (entry_id, user_id, created_at) values (:entry, :user, :at) on conflict do nothing")
                        .param("entry", target.entry())
                        .param("user", others.get((turn + i) % others.size()))
                        .param("at", Timestamp.from(target.at().plus(20L + i, ChronoUnit.MINUTES)))
                        .update();
            }
            if (turn % 2 == 0) {
                UUID remark = jdbc.sql(
                                "insert into comments (entry_id, author_id, body, created_at) values (:entry, :author, :body, :at) returning id")
                        .param("entry", target.entry())
                        .param("author", others.get(turn % others.size()))
                        .param("body", REMARKS.get(turn % REMARKS.size()))
                        .param("at", Timestamp.from(target.at().plus(40, ChronoUnit.MINUTES)))
                        .query(UUID.class)
                        .single();
                if (turn % 4 == 0) {
                    jdbc.sql(
                                    "insert into comments (entry_id, author_id, parent_id, body, created_at) values (:entry, :author, :parent, :body, :at)")
                            .param("entry", target.entry())
                            .param("author", target.author())
                            .param("parent", remark)
                            .param("body", ANSWERS.get(turn % ANSWERS.size()))
                            .param("at", Timestamp.from(target.at().plus(70, ChronoUnit.MINUTES)))
                            .update();
                }
            }
            turn++;
        }
        return true;
    }

    /**
     * So that one person testing alone sees likes, comments and Activity work: when they post to a public
     * journey, two of the sample creators like the entry, one says something, and the first time one follows along.
     */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void sampleCreatorsReact(EntryAdded added) {
        if (!enabled) {
            return;
        }
        List<UUID> sample = samplePeople();
        boolean isPublic = jdbc.sql("select visibility = 'public' from journeys where id = :id")
                .param("id", added.journeyId())
                .query(Boolean.class)
                .optional()
                .orElse(false);
        if (sample.size() < 3 || sample.contains(added.authorId()) || !isPublic) {
            return;
        }
        int pick = Math.floorMod(added.entryId().hashCode(), sample.size());
        UUID first = sample.get(pick);
        UUID second = sample.get((pick + 1) % sample.size());
        entries.like(added.entryId(), first);
        entries.like(added.entryId(), second);
        jdbc.sql("insert into comments (entry_id, author_id, body) values (:entry, :author, :body)")
                .param("entry", added.entryId())
                .param("author", second)
                .param("body", REMARKS.get(pick % REMARKS.size()))
                .update();
        boolean followed = jdbc.sql(
                                "insert into journey_follows (user_id, journey_id) values (:user, :journey) on conflict do nothing")
                        .param("user", first)
                        .param("journey", added.journeyId())
                        .update()
                > 0;
        if (followed) {
            jdbc.sql(
                            "insert into profile_follows (follower_id, followee_id) values (:follower, :followee) on conflict do nothing")
                    .param("follower", first)
                    .param("followee", added.authorId())
                    .update();
        }
    }

    /** So that one person testing alone can try a shared journey: an invited sample creator says yes and adds an entry. */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void sampleCreatorJoins(FriendInvited invited) {
        if (!enabled || !samplePeople().contains(invited.friendId())) {
            return;
        }
        jdbc.sql(
                        "update journey_members set status = 'joined', joined_at = now() where journey_id = :journey and user_id = :friend")
                .param("journey", invited.journeyId())
                .param("friend", invited.friendId())
                .update();
        journeys.setAuthor(invited.friendId(), invited.journeyId());
        jdbc.sql("""
            insert into entries (journey_id, author_id, happened_at, happened_on, title, body)
            select j.id, :friend, now(), greatest(j.start_date, (now() at time zone 'UTC')::date), 'Along for the ride',
                   'Thanks for the invitation. I''ll add my side of the story here.'
            from journeys j where j.id = :journey
            """)
                .param("journey", invited.journeyId())
                .param("friend", invited.friendId())
                .update();
        entries.wakeJourney(invited.journeyId());
    }

    private List<UUID> samplePeople() {
        return jdbc.sql(
                        "select p.id from profiles p join local_users u on u.id = p.id where u.email like '%@demo.journey' order by p.username")
                .query(UUID.class)
                .list();
    }

    /** Copies one of the bundled photos into storage (once) and returns its media id. */
    private UUID photo(String name, UUID owner, Map<String, UUID> done) {
        UUID existing = done.get(name);
        if (existing != null) {
            return existing;
        }
        ClassPathResource resource = new ClassPathResource("seed/img/" + name + ".jpg");
        String key = "seed/img/" + name + ".jpg";
        MediaSizes.Made made;
        try (InputStream in = resource.getInputStream()) {
            made = sizes.store(in.readAllBytes(), key);
        } catch (IOException e) {
            throw new UncheckedIOException("Could not read the sample photo " + name, e);
        }
        UUID id = jdbc.sql("""
            insert into media (owner_id, kind, content_type, storage_key, bytes, width, height, status, sized, screened_at)
            values (:owner, 'photo', 'image/jpeg', :key, :bytes, :w, :h, 'ready', true, now())
            on conflict (storage_key) do update set status = 'ready', sized = true
            returning id
            """)
                .param("owner", owner)
                .param("key", key)
                .param("bytes", made.bytes())
                .param("w", made.width())
                .param("h", made.height())
                .query(UUID.class)
                .single();
        done.put(name, id);
        return id;
    }
}
