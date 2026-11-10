package app.journey.api.notify;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Sends pushes through the Expo Push Service, which passes them on to Apple and Google. One call takes up to
 * a hundred messages and answers with a "ticket" for each, in the same order. A ticket that says
 * {@code DeviceNotRegistered} means that phone will never get a push again, so its token is reported back to
 * be forgotten.
 *
 * <p>No key is needed unless "enhanced security" is switched on for the Expo project; then its access token
 * goes in {@code journey.push.expo.access-token}.
 */
@Component
@ConditionalOnProperty(name = "journey.push.mode", havingValue = "expo")
class ExpoPushSender implements PushSender {

    /** Expo takes at most this many messages in one call. */
    static final int PER_CALL = 100;

    private final RestClient expo;
    private final String url;
    private final String accessToken;

    ExpoPushSender(
            @Value("${journey.push.expo.url:https://exp.host/--/api/v2/push/send}") String url,
            @Value("${journey.push.expo.access-token:}") String accessToken) {
        JdkClientHttpRequestFactory http = new JdkClientHttpRequestFactory(
                HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build());
        http.setReadTimeout(Duration.ofSeconds(15));
        this.expo = RestClient.builder().requestFactory(http).build();
        this.url = url;
        this.accessToken = accessToken == null ? "" : accessToken.trim();
    }

    @Override
    public Set<String> send(List<PushMessage> messages) {
        Set<String> gone = new HashSet<>();
        for (int from = 0; from < messages.size(); from += PER_CALL) {
            List<PushMessage> batch = messages.subList(from, Math.min(from + PER_CALL, messages.size()));
            Map<String, Object> answer = expo.post()
                    .uri(url)
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .headers(headers -> {
                        if (!accessToken.isEmpty()) {
                            headers.set(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken);
                        }
                    })
                    .body(batch.stream().map(ExpoPushSender::wire).toList())
                    .retrieve()
                    .body(new ParameterizedTypeReference<Map<String, Object>>() {});
            Object tickets = answer == null ? null : answer.get("data");
            if (tickets instanceof List<?> list) {
                for (int i = 0; i < list.size() && i < batch.size(); i++) {
                    if (isGone(list.get(i))) {
                        gone.add(batch.get(i).token());
                    }
                }
            }
        }
        return gone;
    }

    /** One message the way Expo wants it. The app reads {@code data.url} to open the right screen. */
    private static Map<String, Object> wire(PushMessage message) {
        return Map.of(
                "to", message.token(),
                "title", message.title(),
                "body", message.body(),
                "sound", "default",
                "data", Map.of("url", message.url(), "kind", message.kind().code()));
    }

    private static boolean isGone(Object ticket) {
        return ticket instanceof Map<?, ?> fields
                && "error".equals(fields.get("status"))
                && fields.get("details") instanceof Map<?, ?> details
                && "DeviceNotRegistered".equals(details.get("error"));
    }
}
