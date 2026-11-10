package app.journey.api.notify;

import java.util.List;
import java.util.Set;

/**
 * Delivers pushes to phones. In local mode they are written to the log; with {@code journey.push.mode=expo}
 * they go to the Expo Push Service, which passes them on to Apple and Google.
 */
public interface PushSender {

    /**
     * Sends the messages. Returns the device tokens the service says no longer exist (the app was removed, or
     * pushes were switched off for good), so they can be forgotten. Throws when the service can't be reached;
     * nothing is marked as sent then, and the messages are tried again later.
     */
    Set<String> send(List<PushMessage> messages);
}
