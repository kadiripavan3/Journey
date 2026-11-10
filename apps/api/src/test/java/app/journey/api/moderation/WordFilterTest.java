package app.journey.api.moderation;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** The comment filter holds the worst for a person to read, and leaves ordinary talk alone. */
class WordFilterTest {

    @ParameterizedTest
    @ValueSource(
            strings = {
                "you bitch",
                "BITCH!!!",
                "b.i.t.c.h",
                "You absolute B I T C H",
                "what a b-i-t-c-h you are",
                "b1tch",
                "what a wánker",
                "Kill yourself",
                "just kys already",
                "I'll kill you",
                "I’ll kill you",
                "hope   you\ndie",
                "@sshole"
            })
    void holdsSlursThreatsAndTheCrudestInsultsHoweverTheyAreSpelled(String comment) {
        assertThat(WordFilter.flags(comment)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "",
                "   ",
                "Damn, that hill was hell",
                "What a view!",
                "Scunthorpe is lovely in spring",
                "Désolé pour le retard",
                "We met a Pakistani chef in Lahore",
                "The spicy noodles nearly killed me",
                "skys were clear all week",
                "Bitchin' sunset",
                "Day 3 of 30, 5 km done",
                "I'd die for that croissant"
            })
    void leavesOrdinaryCommentsAlone(String comment) {
        assertThat(WordFilter.flags(comment)).isFalse();
    }

    @org.junit.jupiter.api.Test
    void nothingIsNothing() {
        assertThat(WordFilter.flags(null)).isFalse();
    }
}
