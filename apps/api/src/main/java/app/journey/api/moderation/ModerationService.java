package app.journey.api.moderation;

import app.journey.api.account.ReportTarget;
import app.journey.api.common.ApiProblem;
import app.journey.api.media.MediaKind;
import app.journey.api.media.MediaReady;
import app.journey.api.media.MediaService;
import app.journey.api.media.MediaSize;
import app.journey.api.media.MediaStorage;
import app.journey.api.moderation.MediaScreening.Verdict;
import app.journey.api.moderation.ModerationStore.DeletionRequestRow;
import app.journey.api.moderation.ModerationStore.HeldCommentRow;
import app.journey.api.moderation.ModerationStore.LogRow;
import app.journey.api.moderation.ModerationStore.ReportRow;
import app.journey.api.moderation.ModerationStore.Unscreened;
import java.io.IOException;
import java.io.InputStream;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.event.EventListener;
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

    private static final Logger log = LoggerFactory.getLogger(ModerationService.class);
    private static final int QUEUE = 100;

    /** A held photo as the reviewer's page shows it. */
    public record HeldPhoto(
            UUID id, String url, String reason, String owner, Instant uploadedAt, Instant askedAgainAt) {}

    /** Everything that waits for a reviewer, oldest first, and the last things reviewers did. */
    public record Queue(
            List<ReportRow> reports,
            List<HeldPhoto> photos,
            List<HeldCommentRow> comments,
            List<DeletionRequestRow> deletionRequests,
            List<LogRow> log) {}

    private final ModerationStore store;
    private final ObjectProvider<MediaScreening> screening;
    private final MediaStorage storage;
    private final MediaService media;

    ModerationService(
            ModerationStore store, ObjectProvider<MediaScreening> screening, MediaStorage storage, MediaService media) {
        this.store = store;
        this.screening = screening;
        this.storage = storage;
        this.media = media;
    }

    // ---- the automatic check ----

    /** Every photo is checked the moment its upload is complete, before anyone else can see it. */
    @EventListener
    public void photoReady(MediaReady ready) {
        if (ready.kind() == MediaKind.PHOTO) {
            check(ready.mediaId(), ready.storageKey());
        }
    }

    /**
     * Checks photos the check hasn't seen: ones uploaded while it couldn't be reached, and ones from before it
     * existed. Stops at the first photo it can't check, so an outage doesn't spin. Returns how many it checked.
     * (No transaction around it: each photo's result is saved as soon as it is known.)
     */
    public int checkWaiting() {
        int checked = 0;
        List<Unscreened> batch;
        while (!(batch = store.unscreened(50)).isEmpty()) {
            for (Unscreened photo : batch) {
                if (!check(photo.id(), photo.storageKey())) {
                    return checked;
                }
                checked++;
            }
        }
        return checked;
    }

    /** True when the photo was checked. False when the check couldn't be reached: the photo stays as it is and is tried again later. */
    private boolean check(UUID mediaId, String storageKey) {
        MediaScreening check = screening.getIfAvailable();
        if (check == null) {
            return false;
        }
        try {
            Verdict verdict = check.screen(read(MediaSize.MEDIUM.keyFor(storageKey)));
            store.markScreened(mediaId, verdict.flagged(), verdict.reason());
            if (verdict.flagged()) {
                log.info("Photo {} is held for review: {}", mediaId, verdict.reason());
            }
            return true;
        } catch (IOException gone) {
            // The file isn't there to look at; there is nothing to hold.
            store.markScreened(mediaId, false, null);
            return true;
        } catch (RuntimeException unreachable) {
            log.warn(
                    "The photo check couldn't look at {}; it will be tried again: {}", mediaId, unreachable.toString());
            return false;
        }
    }

    private byte[] read(String storageKey) throws IOException {
        try (InputStream in = storage.open(storageKey)) {
            return in.readAllBytes();
        }
    }

    // ---- for the person whose photo is held ----

    @Transactional
    public void askAgain(UUID mediaId, UUID owner) {
        if (!store.askAgain(mediaId, owner)) {
            throw new ApiProblem(HttpStatus.NOT_FOUND, "not_held", "That photo isn't being reviewed.");
        }
    }

    // ---- the reviewer's queue ----

    @Transactional(readOnly = true)
    public Queue queue() {
        List<HeldPhoto> photos = store.heldPhotos(QUEUE).stream()
                .map(p -> new HeldPhoto(
                        p.id(),
                        media.urlFor(p.storageKey(), MediaSize.MEDIUM),
                        p.reason(),
                        p.owner(),
                        p.uploadedAt(),
                        p.askedAgainAt()))
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
        if (store.releasePhoto(mediaId)) {
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

    @Transactional
    public void releaseComment(UUID commentId, String reviewer) {
        if (store.releaseComment(commentId)) {
            store.log(reviewer, "released a comment", "comment", commentId.toString(), "");
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

    @Transactional
    public void deletionDone(UUID requestId, String reviewer) {
        if (store.markDeletionDone(requestId, reviewer)) {
            store.log(reviewer, "handled a deletion request", "deletion_request", requestId.toString(), "");
        }
    }

    private static String cut(String text, int max) {
        String clean = text == null ? "" : text.trim();
        return clean.length() > max ? clean.substring(0, max) : clean;
    }
}
