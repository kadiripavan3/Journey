package app.journey.api.moderation;

import app.journey.api.account.AccountService;
import app.journey.api.account.ReportTarget;
import app.journey.api.comment.CommentAdded;
import app.journey.api.common.ApiProblem;
import app.journey.api.media.MediaService;
import app.journey.api.media.MediaStatus;
import app.journey.api.moderation.ModerationStore.DeletionRequestRow;
import app.journey.api.moderation.ModerationStore.HeldCommentRow;
import app.journey.api.moderation.ModerationStore.LogRow;
import app.journey.api.moderation.ModerationStore.ReportRow;
import app.journey.api.notify.EmailAddresses;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Keeping people safe without deciding for them: an automatic check holds a photo it doubts, a word filter
 * holds a comment it doubts, and a person (a reviewer) decides. Nothing is removed automatically. Reports
 * and requests to delete an account, made on the web, wait in the same queue.
 */
@Service
public class ModerationService {

    private static final int QUEUE = 100;

    /** A held photo or clip as the reviewer's page shows it. A clip has a still frame and an address to watch it at. */
    public record HeldPhoto(
            UUID id,
            String url,
            String playbackUrl,
            String reason,
            String owner,
            Instant uploadedAt,
            Instant askedAgainAt) {}

    /** Everything that waits for a reviewer, oldest first, and the last things reviewers did. */
    public record Queue(
            List<ReportRow> reports,
            List<HeldPhoto> photos,
            List<HeldCommentRow> comments,
            List<DeletionRequestRow> deletionRequests,
            List<LogRow> log) {}

    private final ModerationStore store;
    private final MediaService media;
    private final AccountService accounts;
    private final EmailAddresses emails;
    private final ApplicationEventPublisher events;

    ModerationService(
            ModerationStore store,
            MediaService media,
            AccountService accounts,
            EmailAddresses emails,
            ApplicationEventPublisher events) {
        this.store = store;
        this.media = media;
        this.accounts = accounts;
        this.emails = emails;
        this.events = events;
    }

    // ---- for the person whose photo is held ----

    public void askAgain(UUID mediaId, UUID owner) {
        if (!media.askForSecondLook(mediaId, owner)) {
            throw new ApiProblem(HttpStatus.NOT_FOUND, "not_held", "That photo isn't being reviewed.");
        }
    }

    // ---- the reviewer's queue ----

    @Transactional(readOnly = true)
    public Queue queue() {
        List<HeldPhoto> photos = store.heldPhotos(QUEUE).stream()
                .map(p -> {
                    MediaService.MediaResponse shown = media.view(
                            p.id(),
                            p.kind(),
                            MediaStatus.READY,
                            p.storageKey(),
                            p.playbackId(),
                            null,
                            null,
                            null,
                            true);
                    return new HeldPhoto(
                            p.id(),
                            shown.thumbUrl(),
                            shown.playbackUrl(),
                            p.reason(),
                            p.owner(),
                            p.uploadedAt(),
                            p.askedAgainAt());
                })
                .toList();
        return new Queue(
                store.openReports(QUEUE),
                photos,
                store.heldComments(QUEUE),
                store.openDeletionRequests(QUEUE),
                store.recentLog(30));
    }

    /** Nothing wrong with it: the report (and any other about the same thing) is closed, and the thing stays. */
    @Transactional
    public void dismissReport(UUID reportId, String reviewer) {
        ReportRow report = requireOpen(reportId);
        store.closeReportsAbout(report.targetType(), report.targetId(), reviewer, "dismissed");
        store.log(
                reviewer,
                "dismissed a report",
                report.targetType().code(),
                report.targetId().toString(),
                report.reason());
    }

    /** The journey, entry or comment a report points at is removed for good. A person is never removed from here. */
    @Transactional
    public void removeReported(UUID reportId, String reviewer) {
        ReportRow report = requireOpen(reportId);
        if (report.targetType() == ReportTarget.PROFILE) {
            throw ApiProblem.badRequest("cannot_remove_person", "A person can't be removed from the queue.");
        }
        store.removeTarget(report.targetType(), report.targetId());
        store.closeReportsAbout(report.targetType(), report.targetId(), reviewer, "removed");
        store.log(
                reviewer,
                "removed reported content",
                report.targetType().code(),
                report.targetId().toString(),
                "%s: %s".formatted(report.reason(), report.what() == null ? "already gone" : report.what()));
    }

    private ReportRow requireOpen(UUID reportId) {
        return store.openReport(reportId)
                .orElseThrow(() ->
                        new ApiProblem(HttpStatus.NOT_FOUND, "report_closed", "That report has already been handled."));
    }

    @Transactional
    public void releasePhoto(UUID mediaId, String reviewer) {
        if (media.letThrough(mediaId)) {
            store.log(reviewer, "released a photo", "photo", mediaId.toString(), "");
        }
    }

    @Transactional
    public void removePhoto(UUID mediaId, String reviewer) {
        if (store.isHeld(mediaId)) {
            media.remove(mediaId);
            store.log(reviewer, "removed a photo", "photo", mediaId.toString(), "");
        }
    }

    /** A comment that is let through is, for everyone else, a comment that was just added: they hear about it now. */
    @Transactional
    public void releaseComment(UUID commentId, String reviewer) {
        if (store.releaseComment(commentId)) {
            store.log(reviewer, "released a comment", "comment", commentId.toString(), "");
            events.publishEvent(new CommentAdded(commentId));
        }
    }

    @Transactional
    public void removeComment(UUID commentId, String reviewer) {
        store.deleteComment(commentId)
                .ifPresent(said -> store.log(reviewer, "removed a comment", "comment", commentId.toString(), said));
    }

    // ---- "please delete my account", asked on the web ----

    @Transactional
    public void requestDeletion(String email, String username, String note) {
        String address = email == null ? "" : email.trim();
        if (!address.matches("[^@\\s]+@[^@\\s]+\\.[^@\\s]+") || address.length() > 254) {
            throw ApiProblem.badRequest("invalid_email", "Enter the email address you signed up with.");
        }
        store.addDeletionRequest(address, cut(username, 40), cut(note, 500));
    }

    /**
     * The owner asked on the web, and the reviewer has made sure it is really them: the account that signs in
     * with that address is deleted, exactly as "Delete account" in the app does it. If nobody signs in with
     * that address, the request is closed and the log says so.
     */
    public void deleteRequestedAccount(UUID requestId, String reviewer) {
        DeletionRequestRow request = store.openDeletionRequest(requestId)
                .orElseThrow(() -> new ApiProblem(
                        HttpStatus.NOT_FOUND, "request_closed", "That request has already been handled."));
        Optional<UUID> who = emails.whose(request.email());
        who.ifPresent(accounts::delete);
        if (store.closeDeletionRequest(requestId, reviewer, who.isPresent() ? "deleted" : "no_account")) {
            store.log(
                    reviewer,
                    who.isPresent()
                            ? "deleted an account at its owner's request"
                            : "closed a deletion request: nobody signs in with that address",
                    "deletion_request",
                    requestId.toString(),
                    "");
        }
    }

    /** Closed without deleting anything: the person didn't answer, or it wasn't them. */
    @Transactional
    public void closeDeletionRequest(UUID requestId, String reviewer) {
        if (store.closeDeletionRequest(requestId, reviewer, "closed")) {
            store.log(
                    reviewer,
                    "closed a deletion request without deleting",
                    "deletion_request",
                    requestId.toString(),
                    "");
        }
    }

    /**
     * Once a night: closed deletion requests go after a month; the record of what reviewers did, and reports
     * that were decided, after half a year.
     */
    public int forgetOldRecords() {
        return store.forgetOldRecords(30, 180);
    }

    private static String cut(String text, int max) {
        String clean = text == null ? "" : text.trim();
        return clean.length() > max ? clean.substring(0, max) : clean;
    }
}
