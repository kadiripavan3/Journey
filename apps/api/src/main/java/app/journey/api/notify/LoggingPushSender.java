package app.journey.api.notify;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * The stand-in for the push service: every push is written to the API's log, where the person testing can
 * read it. It also keeps the last few, so tests can look at what would have been sent.
 */
@Component
@ConditionalOnProperty(name = "journey.push.mode", havingValue = "local")
public class LoggingPushSender implements PushSender {

    private static final Logger log = LoggerFactory.getLogger(LoggingPushSender.class);
    private static final int KEPT = 200;

    private final Deque<PushMessage> sent = new ArrayDeque<>();

    @Override
    public synchronized Set<String> send(List<PushMessage> messages) {
        for (PushMessage message : messages) {
            log.info("Push to {}: {} | {} (opens {})", message.token(), message.title(), message.body(), message.url());
            sent.addLast(message);
            if (sent.size() > KEPT) {
                sent.removeFirst();
            }
        }
        return Set.of();
    }

    /** The most recent pushes, oldest first. */
    public synchronized List<PushMessage> sent() {
        return List.copyOf(sent);
    }

    public synchronized void clear() {
        sent.clear();
    }
}
