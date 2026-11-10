package app.journey.api.comment;

import app.journey.api.comment.CommentStore.CommentRow;
import app.journey.api.common.ApiProblem;
import app.journey.api.common.Keyset;
import app.journey.api.common.Page;
import app.journey.api.entry.EntryService;
import app.journey.api.entry.EntryStore.EntryRow;
import app.journey.api.media.MediaService;
import app.journey.api.moderation.WordFilter;
import app.journey.api.profile.PersonResponse;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Comments on entries, with one level of replies. Anyone who can see an entry can comment on it. */
@Service
public class CommentService {

    static final int MAX_LENGTH = 500;

    public record CommentViewerResponse(boolean canDelete) {}

    public record CommentResponse(
            UUID id,
            UUID entryId,

            @Schema(nullable = true, description = "The comment this one replies to. Replies are one level deep.")
            UUID parentId,

            PersonResponse author,
            String body,
            Instant createdAt,

            @Schema(description = "True when the journey's creator wrote it")
            boolean byCreator,

            @Schema(
                    description =
                            "True while the comment waits for a reviewer. Only its author ever sees a held comment.")
            boolean held,

            CommentViewerResponse viewer) {}

    private final CommentStore comments;
    private final EntryService entries;
    private final MediaService media;

    private final ApplicationEventPublisher events;

    CommentService(CommentStore comments, EntryService entries, MediaService media, ApplicationEventPublisher events) {
        this.comments = comments;
        this.entries = entries;
        this.media = media;
        this.events = events;
    }

    /** A page of an entry's comments: threads oldest first, each followed by its replies. */
    public Page<CommentResponse> list(UUID entryId, UUID viewer, Keyset page) {
        EntryRow entry = entries.require(entryId, viewer);
        return comments.page(entryId, viewer, page)
                .map(rows -> rows.stream().map(row -> view(row, entry, viewer)).toList());
    }

    /** Adds a comment. Sending the same one twice (same clientId) gives back the first, never a second. */
    @Transactional
    public CommentResponse add(UUID entryId, UUID author, String body, UUID parentId, UUID clientId) {
        EntryRow entry = entries.require(entryId, author);
        if (clientId != null) {
            Optional<CommentRow> existing =
                    comments.findByClientId(author, clientId).flatMap(comments::find);
            if (existing.isPresent()) {
                return view(existing.get(), entry, author);
            }
        }
        String text = body == null ? "" : body.trim();
        if (text.isEmpty()) {
            throw ApiProblem.badRequest("empty_comment", "Write something first.");
        }
        if (text.length() > MAX_LENGTH) {
            throw ApiProblem.badRequest("comment_too_long", "Keep comments to " + MAX_LENGTH + " characters or fewer.");
        }
        UUID parent = null;
        if (parentId != null) {
            CommentRow answered = comments.find(parentId)
                    .filter(c -> c.entryId().equals(entryId))
                    .orElseThrow(() -> ApiProblem.badRequest(
                            "comment_gone", "The comment you're replying to isn't there any more."));
            // Replies are one level deep: a reply to a reply joins the same thread.
            if (answered.held()) {
                throw ApiProblem.badRequest("comment_gone", "The comment you're replying to isn't there any more.");
            }
            parent = answered.parentId() == null ? answered.id() : answered.parentId();
        }
        // Empty means the same comment arrived twice at the same moment and the other request saved it first.
        // A comment the word filter catches is kept, but only its author sees it until a reviewer has read it.
        boolean held = WordFilter.flags(text);
        Optional<UUID> added = comments.insert(entryId, author, parent, text, clientId, held);
        if (!held) {
            added.ifPresent(comment ->
                    events.publishEvent(new CommentAdded(comment))); // nobody hears of a comment they can't see
        }
        UUID id = added.or(() -> comments.findByClientId(author, clientId)).orElseThrow();
        return view(comments.find(id).orElseThrow(), entry, author);
    }

    /** The person who wrote a comment can delete it, and so can the journey's creator. Its replies go with it. */
    @Transactional
    public void delete(UUID id, UUID viewer) {
        CommentRow comment = comments.find(id).orElseThrow(CommentService::notFound);
        EntryRow entry;
        try {
            entry = entries.require(comment.entryId(), viewer);
        } catch (ApiProblem hidden) {
            throw notFound();
        }
        if (!comment.authorId().equals(viewer) && !entry.journeyOwnerId().equals(viewer)) {
            throw new ApiProblem(
                    HttpStatus.FORBIDDEN,
                    "not_yours",
                    "Only the person who wrote a comment, or the journey's creator, can delete it.");
        }
        comments.delete(id);
    }

    /**
     * A reviewer removes a comment that broke the guidelines: the same removal as its author's own, replies
     * included. Returns what it said, for the record; empty when it was already gone.
     */
    @Transactional
    public Optional<String> removeForReviewer(UUID id) {
        Optional<String> said = comments.find(id).map(CommentRow::body);
        said.ifPresent(body -> comments.delete(id));
        return said;
    }

    private static ApiProblem notFound() {
        return new ApiProblem(HttpStatus.NOT_FOUND, "comment_not_found", "This comment isn't available.");
    }

    private CommentResponse view(CommentRow c, EntryRow entry, UUID viewer) {
        return new CommentResponse(
                c.id(),
                c.entryId(),
                c.parentId(),
                media.person(c.authorId(), c.authorUsername(), c.authorName(), c.authorAvatarKey()),
                c.body(),
                c.createdAt(),
                c.authorId().equals(entry.journeyOwnerId()),
                c.held(),
                new CommentViewerResponse(
                        c.authorId().equals(viewer) || entry.journeyOwnerId().equals(viewer)));
    }
}
