package app.journey.api.notify;

import com.resend.core.exception.ResendException;
import com.resend.core.net.RequestOptions;
import com.resend.core.net.impl.HttpClient;
import com.resend.services.emails.Emails;
import com.resend.services.emails.model.CreateEmailOptions;
import java.time.Duration;
import okhttp3.OkHttpClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Sends email through Resend, with Resend's own Java library. It needs an API key
 * ({@code RESEND_API_KEY}) and a sender address on a domain that is verified with Resend
 * ({@code JOURNEY_EMAIL_FROM}, such as {@code Journey <hello@yourdomain>}). Without a key the API doesn't
 * start in this mode, so a missing key is noticed at once rather than on a Sunday evening.
 */
@Component
@ConditionalOnProperty(name = "journey.email.mode", havingValue = "resend")
class ResendEmailSender implements EmailSender {

    private final Emails emails;
    private final String from;

    ResendEmailSender(
            @Value("${journey.email.resend.api-key:}") String apiKey,
            @Value("${journey.email.resend.url:" + HttpClient.BASE_API + "}") String url,
            @Value("${journey.email.from}") String from) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException(
                    "Email is set to go through Resend (journey.email.mode=resend) but RESEND_API_KEY is empty. Set the key, or set JOURNEY_EMAIL_MODE=off to run without email for now.");
        }
        OkHttpClient http = new OkHttpClient.Builder()
                .connectTimeout(Duration.ofSeconds(5))
                .readTimeout(Duration.ofSeconds(15))
                .build();
        this.emails = new Emails(apiKey.trim(), new HttpClient(http, url));
        this.from = from;
    }

    @Override
    public void send(Email email) {
        CreateEmailOptions message = CreateEmailOptions.builder()
                .from(from)
                .to(email.to())
                .subject(email.subject())
                .html(email.html())
                .text(email.text())
                .build();
        try {
            emails.send(
                    message,
                    RequestOptions.builder()
                            .setIdempotencyKey(email.sendOnceKey())
                            .build());
        } catch (ResendException refused) {
            throw new IllegalStateException("Resend didn't take the email: " + refused.getMessage(), refused);
        }
    }
}
