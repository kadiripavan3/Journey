package app.journey.api.notify;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import app.journey.api.ApiTest;
import app.journey.api.common.Jobs;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * How pushes are handed to the push service: in calls of a hundred, with no database transaction open, and so
 * that a call that fails costs only its own messages another try.
 */
class PushDeliveryTest extends ApiTest {

    /** A push service that does what the test tells it to. */
    private static final class Scripted implements PushSender {
        final List<List<PushMessage>> calls = new ArrayList<>();
        final List<Boolean> insideTransaction = new ArrayList<>();
        int failOnCall = -1;
        Set<String> goneTickets = Set.of();
        Set<String> unanswered = Set.of();

        @Override
        public Handed send(List<PushMessage> messages) {
            calls.add(messages);
            insideTransaction.add(TransactionSynchronizationManager.isActualTransactionActive());
            if (calls.size() == failOnCall) {
                throw new IllegalStateException("503 from the push service");
            }
            return new Handed(
                    Set.of(),
                    messages.stream()
                            .map(message -> new Ticket("ticket-" + message.token(), message.token()))
                            .toList());
        }

        @Override
        public Outcome outcomes(Collection<String> ticketIds) {
            insideTransaction.add(TransactionSynchronizationManager.isActualTransactionActive());
            Set<String> answered = new java.util.HashSet<>(ticketIds);
            answered.removeAll(unanswered);
            return new Outcome(answered, goneTickets);
        }
    }

    @Autowired
    OutboxStore outbox;

    @Autowired
    DeviceStore devices;

    @Autowired
    PushWording wording;

    @Autowired
    TransactionTemplate transaction;

    @Autowired
    Jobs jobs;

    private final Scripted service = new Scripted();

    private PushDelivery delivery() {
        return new PushDelivery(outbox, devices, wording, service, transaction, jobs);
    }

    @Test
    void aCallThatFailsCostsOnlyItsOwnMessagesAnotherTryAndNoTransactionWaitsOnThePushService() throws Exception {
        // Maya has ten phones and eleven new followers: 110 pushes, so two calls of at most a hundred.
        String maya = person("maya");
        for (int phone = 0; phone < 10; phone++) {
            device(maya, "ExponentPushToken[maya-" + phone + "]");
        }
        for (int follower = 0; follower < 11; follower++) {
            mvc.perform(put("/v1/profiles/maya/follow").header("Authorization", person("fan" + follower)))
                    .andExpect(status().isOk());
        }
        service.failOnCall = 2;

        assertThat(delivery().deliverDue()).isEqualTo(11);

        // A message is never split over two calls: ten followers' worth went, the eleventh waits.
        assertThat(service.calls).extracting(List::size).containsExactly(100, 10);
        assertThat(service.insideTransaction).containsOnly(false);
        assertThat(count("status = 'sent'")).isEqualTo(10);
        assertThat(count("status = 'pending' and attempts = 1 and send_after > now()"))
                .isEqualTo(1);
        // Each push the service accepted left a ticket to ask about later.
        assertThat(jdbc.sql("select count(*) from push_tickets")
                        .query(Integer.class)
                        .single())
                .isEqualTo(10); // ten phones; the ticket ids here are per phone

        // Later, only the one that failed is sent again.
        jdbc.sql("update notifications set send_after = now() where status = 'pending'")
                .update();
        assertThat(delivery().deliverDue()).isEqualTo(1);
        assertThat(service.calls).extracting(List::size).containsExactly(100, 10, 10);
        assertThat(count("status = 'sent'")).isEqualTo(11);
    }

    @Test
    void aMessageThatWasTakenAndNeverMarkedAsSentIsTriedAgain() throws Exception {
        String maya = person("maya");
        String nora = person("nora");
        device(maya, "ExponentPushToken[maya]");
        mvc.perform(put("/v1/profiles/maya/follow").header("Authorization", nora))
                .andExpect(status().isOk());
        // The API stopped after taking the message: it has been "being sent" for twenty minutes.
        jdbc.sql(
                        "update notifications set status = 'sending', claimed_at = now() - interval '20 minutes', batch_key = 'k'")
                .update();
        // Meanwhile a newer message with the same key started waiting; putting the old one back must not clash with it.
        jdbc.sql("""
                insert into notifications (user_id, kind, batch_key, actor_id)
                select user_id, kind, batch_key, actor_id from notifications
                """).update();
        assertThat(delivery().deliverDue()).isEqualTo(1);
        assertThat(count("status = 'sending'")).isEqualTo(1);

        assertThat(delivery().putBackStuck()).isEqualTo(1);

        assertThat(count("status = 'sending'")).isZero();
        assertThat(count("status = 'pending' and attempts = 1 and batch_key is null"))
                .isEqualTo(1);
        // A message taken a moment ago is left alone.
        jdbc.sql("update notifications set status = 'sending', claimed_at = now() where status = 'pending'")
                .update();
        assertThat(delivery().putBackStuck()).isZero();
    }

    @Test
    void aPhoneThePushServiceLaterSaysIsGoneIsForgotten() throws Exception {
        String maya = person("maya");
        String nora = person("nora");
        device(maya, "ExponentPushToken[old-phone]");
        device(maya, "ExponentPushToken[new-phone]");
        mvc.perform(put("/v1/profiles/maya/follow").header("Authorization", nora))
                .andExpect(status().isOk());
        PushDelivery delivery = delivery();
        delivery.deliverDue();
        assertThat(tickets())
                .containsExactlyInAnyOrder(
                        "ticket-ExponentPushToken[old-phone]", "ticket-ExponentPushToken[new-phone]");

        // Too early to ask: the push service needs a few minutes.
        assertThat(delivery.readOutcomes()).isZero();
        assertThat(service.insideTransaction).hasSize(1); // only the send

        jdbc.sql("update push_tickets set created_at = now() - interval '20 minutes'")
                .update();
        service.goneTickets = Set.of("ticket-ExponentPushToken[old-phone]");
        assertThat(delivery.readOutcomes()).isEqualTo(1);

        assertThat(jdbc.sql("select token from devices").query(String.class).list())
                .containsExactly("ExponentPushToken[new-phone]");
        assertThat(tickets()).isEmpty();
        assertThat(service.insideTransaction).containsOnly(false);

        // A ticket the service has no answer for is asked about again, and given up on after a day.
        jdbc.sql("insert into push_tickets (id, token, created_at) values ('slow', 'x', now() - interval '1 hour')")
                .update();
        service.unanswered = Set.of("slow");
        delivery.readOutcomes();
        assertThat(tickets()).containsExactly("slow");
        jdbc.sql("update push_tickets set created_at = now() - interval '25 hours'")
                .update();
        delivery.readOutcomes();
        assertThat(tickets()).isEmpty();
    }

    @Test
    void aPersonWithVeryManyPhonesGetsThePushOnTheTenNewest() throws Exception {
        String maya = person("maya");
        String nora = person("nora");
        for (int phone : IntStream.range(0, 12).toArray()) {
            device(maya, "ExponentPushToken[p" + phone + "]");
            jdbc.sql("update devices set seen_at = now() - make_interval(mins => :age) where token = :token")
                    .param("age", 12 - phone)
                    .param("token", "ExponentPushToken[p" + phone + "]")
                    .update();
        }
        mvc.perform(put("/v1/profiles/maya/follow").header("Authorization", nora))
                .andExpect(status().isOk());

        delivery().deliverDue();

        assertThat(service.calls).hasSize(1);
        assertThat(service.calls.get(0))
                .extracting(PushMessage::token)
                .hasSize(10)
                .doesNotContain("ExponentPushToken[p0]", "ExponentPushToken[p1]");
    }

    private int count(String where) {
        return jdbc.sql("select count(*) from notifications where " + where)
                .query(Integer.class)
                .single();
    }

    private List<String> tickets() {
        return jdbc.sql("select id from push_tickets").query(String.class).list();
    }

    private void device(String token, String pushToken) throws Exception {
        mvc.perform(put("/v1/me/devices")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"" + pushToken + "\",\"platform\":\"ios\",\"timeZone\":\"UTC\"}"))
                .andExpect(status().isNoContent());
    }
}
