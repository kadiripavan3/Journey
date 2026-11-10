package app.journey.api.moderation;

import java.text.Normalizer;
import java.util.Arrays;
import java.util.Locale;
import java.util.Set;

/**
 * A small filter for comments. It doesn't decide what is acceptable: it picks out comments a person should
 * read before others do (slurs, threats, the crudest insults). A caught comment is held, not deleted; its
 * author still sees it, and a reviewer releases or removes it.
 *
 * <p>The list is short on purpose. Ordinary swearing between friends ("damn, that hill") is not on it.
 */
public final class WordFilter {

    private WordFilter() {}

    /**
     * Whole words that hold a comment. Kept lower case, without accents. Words that are ordinary in another
     * language people write here ("retard" is French for "late") stay off the list.
     */
    private static final Set<String> WORDS = Set.of(
            "asshole",
            "bitch",
            "cunt",
            "dickhead",
            "faggot",
            "fucker",
            "motherfucker",
            "nigger",
            "nigga",
            "slut",
            "twat",
            "wanker",
            "whore",
            "kike",
            "spic",
            "chink",
            "tranny",
            "paki");

    /** Phrases that hold a comment wherever they appear. */
    private static final Set<String> PHRASES =
            Set.of("kill yourself", "kys", "go die", "i will kill you", "i'll kill you", "hope you die");

    public static boolean flags(String text) {
        if (text == null || text.isBlank()) {
            return false;
        }
        String plain = Normalizer.normalize(text, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .replace('’', '\'')
                .toLowerCase(Locale.ROOT);
        // Letters only, so "b.i.t.c.h" and "bitch!!!" are the same word; digits often stand in for letters.
        String spaced = plain.replace('0', 'o')
                .replace('1', 'i')
                .replace('3', 'e')
                .replace('4', 'a')
                .replace('5', 's')
                .replace('@', 'a')
                .replace('$', 's');
        String[] words = spaced.split("[^a-z]+");
        boolean word = Arrays.stream(words).anyMatch(WORDS::contains)
                || WORDS.contains(spaced.replaceAll("[^a-z]", ""))
                || spelledOut(words);
        String squeezed = " " + spaced.replaceAll("[^a-z']+", " ").trim() + " ";
        return word || PHRASES.stream().anyMatch(phrase -> squeezed.contains(" " + phrase + " "));
    }

    /** True when letters written one at a time ("you b i t c h") spell a word on the list. */
    private static boolean spelledOut(String[] words) {
        StringBuilder letters = new StringBuilder();
        for (String word : words) {
            if (word.length() == 1) {
                letters.append(word);
            } else {
                letters.append(' ');
            }
        }
        return Arrays.stream(letters.toString().split(" +"))
                .anyMatch(run -> WORDS.stream().anyMatch(run::contains));
    }
}
