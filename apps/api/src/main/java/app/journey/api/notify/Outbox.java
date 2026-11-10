package app.journey.api.notify;

import app.journey.api.comment.CommentAdded;
import app.journey.api.entry.EntryAdded;
import app.journey.api.entry.EntryLiked;
import app.journey.api.journey.FriendInvited;
import app.journey.api.journey.FriendJoined;
import app.journey.api.journey.JourneyAutoPaused;
import app.journey.api.journey.JourneyCompleted;
import app.journey.api.journey.JourneyFollowed;
import app.journey.api.people.PersonFollowed;
import java.time.Duration;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Turns what happens in the app into pushes waiting to be sent. Each listener runs inside the transaction of
 * the thing it hears about, so a push is queued exactly when that thing is kept, and never for something that
 * was undone. Who gets told, and the switches that silence a kind of push, are in {@link OutboxStore}.
 */
@Component
public class Outbox {

    private final OutboxStore outbox;
    private final Duration entriesWait;
    private final Duration likesWait;

    Outbox(
            OutboxStore outbox,
            @Value("${journey.push.entries-wait:PT10M}") Duration entriesWait,
            @Value("${journey.push.likes-wait:PT1H}") Duration likesWait) {
        this.outbox = outbox;
        this.entriesWait = entriesWait;
        this.likesWait = likesWait;
    }

    /** New entries wait a little before they are pushed, so three entries posted in a row arrive as one message. */
    @EventListener
    void on(EntryAdded added) {
        outbox.newEntry(added.entryId(), added.journeyId(), added.authorId(), entriesWait);
    }

    /** Likes on an entry are gathered for an hour: "Lena and 46 others liked…", at most once an hour. */
    @EventListener
    void on(EntryLiked liked) {
        outbox.liked(liked.entryId(), liked.userId(), likesWait);
    }

    @EventListener
    void on(CommentAdded added) {
        outbox.commented(added.commentId());
    }

    @EventListener
    void on(JourneyCompleted completed) {
        outbox.journeyCompleted(completed.journeyId(), completed.ownerId());
    }

    @EventListener
    void on(JourneyFollowed followed) {
        outbox.journeyFollowed(followed.journeyId(), followed.userId());
    }

    @EventListener
    void on(PersonFollowed followed) {
        outbox.personFollowed(followed.followerId(), followed.followeeId());
    }

    @EventListener
    void on(FriendInvited invited) {
        outbox.invited(invited.journeyId(), invited.friendId());
    }

    @EventListener
    void on(FriendJoined joined) {
        outbox.friendJoined(joined.journeyId(), joined.friendId());
    }

    /** A gentle reminder to add to a journey. The words are chosen by the reminder job. */
    public void remind(UUID userId, UUID journeyId, String words) {
        outbox.tell(userId, NotificationKind.REMINDER, journeyId, words, null);
    }

    /** The week's digest is out. Asking twice before it is sent queues it once. */
    public void weeklyDigest(UUID userId, String words) {
        outbox.tell(userId, NotificationKind.WEEKLY_DIGEST, null, words, "digest");
    }

    /** A journey paused by itself after 30 quiet days: its owner hears about it, once. */
    @EventListener
    void on(JourneyAutoPaused paused) {
        outbox.tell(
                paused.ownerId(),
                NotificationKind.JOURNEY_PAUSED,
                paused.journeyId(),
                null,
                "paused:" + paused.journeyId());
    }
}
