package app.journey.api.catalog;

import java.util.List;
import java.util.Optional;

/**
 * The fixed lists the app offers: interests, categories and journey templates. They live in code
 * because a change to them is a product decision, made together with the screens that show them.
 */
public final class Catalog {

    public record Category(String id, String label, String emoji) {}

    public record Interest(String id, String label, String emoji, String category) {}

    public record Template(
            String id,
            String name,
            String emoji,
            String description,
            String defaultCategory,
            String labelStyle,
            Integer targetDays,
            List<String> prompts) {}

    public static final List<Category> CATEGORIES = List.of(
            new Category("travel", "Travel", "✈️"),
            new Category("fitness", "Fitness", "💪"),
            new Category("learning", "Learning", "📚"),
            new Category("food", "Food", "🍜"),
            new Category("creative", "Creative", "🎨"),
            new Category("projects", "Projects", "🛠️"),
            new Category("life", "Life", "🌱"));

    public static final List<Interest> INTERESTS = List.of(
            new Interest("travel", "Travel", "✈️", "travel"),
            new Interest("hiking", "Hiking", "🥾", "travel"),
            new Interest("road-trips", "Road trips", "🏍️", "travel"),
            new Interest("photography", "Photography", "📷", "creative"),
            new Interest("fitness", "Fitness", "💪", "fitness"),
            new Interest("running", "Running", "🏃", "fitness"),
            new Interest("surfing", "Surfing", "🏄", "fitness"),
            new Interest("learning", "Learning", "📚", "learning"),
            new Interest("music", "Music", "🎸", "learning"),
            new Interest("languages", "Languages", "💬", "learning"),
            new Interest("food", "Food", "🍜", "food"),
            new Interest("art", "Art", "🎨", "creative"),
            new Interest("building", "Building", "🛠️", "projects"),
            new Interest("home", "Home", "🏡", "projects"),
            new Interest("life-changes", "Life changes", "🌱", "life"),
            new Interest("wellbeing", "Wellbeing", "🧘", "life"));

    public static final List<Template> TEMPLATES = List.of(
            new Template(
                    "trip",
                    "Trip",
                    "🧳",
                    "Day by day, with a map of where you've been",
                    "travel",
                    "day",
                    null,
                    List.of("What surprised you?", "Best thing you ate", "Where to next?")),
            new Template(
                    "challenge30",
                    "30-Day Challenge",
                    "🔥",
                    "A check-in a day, with people cheering",
                    "fitness",
                    "day",
                    30,
                    List.of("How did today go?", "What was hard?", "One small win")),
            new Template(
                    "skill",
                    "Learn a skill",
                    "📚",
                    "Lessons, practice and the day it clicks",
                    "learning",
                    "day",
                    null,
                    List.of("What did you practise?", "What finally clicked?", "What's next?")),
            new Template(
                    "build",
                    "Build something",
                    "🛠️",
                    "From the first sketch to the finished thing",
                    "projects",
                    "part",
                    null,
                    List.of("What did you get done?", "What went wrong?", "What's the next step?")),
            new Template(
                    "journal",
                    "Open journal",
                    "📓",
                    "Anything else, told in parts",
                    "life",
                    "part",
                    null,
                    List.of("What happened?", "How did it feel?")));

    private Catalog() {}

    public static boolean isCategory(String id) {
        return CATEGORIES.stream().anyMatch(c -> c.id().equals(id));
    }

    public static Optional<Template> template(String id) {
        return TEMPLATES.stream().filter(t -> t.id().equals(id)).findFirst();
    }

    /** The categories behind a person's interests, for suggestions. Unknown interests are ignored. */
    public static List<String> categoriesFor(List<String> interestIds) {
        return INTERESTS.stream()
                .filter(i -> interestIds.contains(i.id()))
                .map(Interest::category)
                .distinct()
                .toList();
    }
}
