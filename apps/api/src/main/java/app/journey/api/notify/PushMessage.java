package app.journey.api.notify;

/**
 * One push to one device: what it says, and where in the app it opens ({@code url} is an app path such as
 * {@code /journey/<id>/timeline}).
 */
public record PushMessage(String token, String title, String body, String url, NotificationKind kind) {}
