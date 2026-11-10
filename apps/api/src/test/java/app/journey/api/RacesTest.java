package app.journey.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

/** Things that happen at the same moment, from several people at once, leave the numbers and the rules intact. */
class RacesTest extends ApiTest {

    private static final int PEOPLE = 8;

    @Test
    void likesAndUnlikesFromManyPeopleAtOnceLeaveTheCountEqualToTheLikes() throws Exception {
        String maya = person("maya");
        String entry = entry(maya, journey(maya, "Southeast Asia", "public", 3), "Hoi An", 0);
        List<String> fans = new ArrayList<>();
        for (int i = 0; i < PEOPLE; i++) {
            fans.add(person("fan" + i));
        }

        // Everyone likes and unlikes the same entry over and over; half of them end on a like.
        together(fans.size(), i -> {
            for (int round = 0; round < 6; round++) {
                mvc.perform(put("/v1/entries/" + entry + "/like").header("Authorization", fans.get(i)))
                        .andExpect(status().isOk());
                if (round < 5 || i % 2 == 0) {
                    mvc.perform(delete("/v1/entries/" + entry + "/like").header("Authorization", fans.get(i)))
                            .andExpect(status().isOk());
                }
            }
            return null;
        });

        assertThat(jdbc.sql("select count(*) from entry_likes")
                        .query(Integer.class)
                        .single())
                .isEqualTo(PEOPLE / 2);
        mvc.perform(get("/v1/entries/" + entry).header("Authorization", maya))
                .andExpect(jsonPath("$.likeCount").value(PEOPLE / 2));
    }

    @Test
    void aFollowAndAJourneyGoingPrivateAtTheSameMomentNeverLeaveAFollowBehind() throws Exception {
        String maya = person("maya");
        List<String> readers = new ArrayList<>();
        for (int i = 0; i < PEOPLE - 1; i++) {
            readers.add(person("reader" + i));
        }
        for (int round = 0; round < 6; round++) {
            String journey = journey(maya, "Round " + round, "public", 3);

            // While people are following it, its owner makes it private.
            List<Integer> answers = together(
                    PEOPLE,
                    i -> i == 0
                            ? mvc.perform(patch("/v1/journeys/" + journey)
                                            .header("Authorization", maya)
                                            .contentType(MediaType.APPLICATION_JSON)
                                            .content("{\"visibility\":\"private\"}"))
                                    .andReturn()
                                    .getResponse()
                                    .getStatus()
                            : mvc.perform(put("/v1/journeys/" + journey + "/follow")
                                            .header("Authorization", readers.get(i - 1)))
                                    .andReturn()
                                    .getResponse()
                                    .getStatus());

            // Each follow either happened in time (and was then taken away with the rest) or was refused.
            assertThat(answers.get(0)).isEqualTo(200);
            assertThat(answers.subList(1, answers.size())).allMatch(code -> code == 200 || code == 404);
            assertThat(jdbc.sql("""
                select count(*) from journey_follows f join journeys j on j.id = f.journey_id
                where j.visibility = 'private' and not f.author
                """).query(Integer.class).single())
                    .as("follows left on a private journey")
                    .isZero();
            assertThat(jdbc.sql("select coalesce(sum(follower_count), 0) from journeys where visibility = 'private'")
                            .query(Integer.class)
                            .single())
                    .isZero();
        }
    }

    private interface Step<T> {
        T run(int who) throws Exception;
    }

    /** Runs the same step for several people at the same moment and gives back their answers, in order. */
    private <T> List<T> together(int people, Step<T> step) throws Exception {
        ExecutorService threads = Executors.newFixedThreadPool(people);
        try {
            CountDownLatch go = new CountDownLatch(1);
            List<Future<T>> running = new ArrayList<>();
            for (int i = 0; i < people; i++) {
                int who = i;
                Callable<T> waitThenRun = () -> {
                    go.await();
                    return step.run(who);
                };
                running.add(threads.submit(waitThenRun));
            }
            go.countDown();
            List<T> answers = new ArrayList<>();
            for (Future<T> one : running) {
                answers.add(one.get());
            }
            return answers;
        } finally {
            threads.shutdownNow();
        }
    }
}
