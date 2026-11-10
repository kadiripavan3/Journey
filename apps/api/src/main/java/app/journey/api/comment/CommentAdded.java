package app.journey.api.comment;

import java.util.UUID;

/** Announced when a comment or a reply is added. Notifications listen for it. */
public record CommentAdded(UUID commentId) {}
