package app.journey.api.notify;

/**
 * Sends an email. In local mode it is written to the log; with {@code journey.email.mode=resend} it goes out
 * through Resend.
 */
public interface EmailSender {

    /**
     * One email to one person, with the same words as a web page ({@code html}) and as plain text.
     *
     * @param sendOnceKey the same key on a second try means the service sends it only once
     */
    record Email(String to, String subject, String html, String text, String sendOnceKey) {}

    /** Sends the email. Throws when it couldn't be handed over, so the caller can say so in its log and go on. */
    void send(Email email);
}
