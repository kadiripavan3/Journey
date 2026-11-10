package app.journey.api.account;

import app.journey.api.account.AccountStore.BlockedRow;
import app.journey.api.common.ApiProblem;
import app.journey.api.common.Page;
import app.journey.api.common.PageRequest;
import app.journey.api.journey.Visibility;
import app.journey.api.media.MediaService;
import app.journey.api.media.MediaSize;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/** A person's own settings, the people they block, what they report, and deleting their account. */
@Service
public class AccountService {

    public record SettingsResponse(
            @Schema(description = "New entries in journeys you follow, grouped per journey")
            boolean notifyNewEntries,

            @Schema(description = "Journeys you follow being completed")
            boolean notifyCompleted,

            boolean notifyComments,
            boolean notifyFollowers,
            @Schema(description = "Likes, in one batch") boolean notifyLikes,
            boolean weeklyDigest,

            @Schema(description = "Also send the weekly digest by email")
            boolean digestEmail,

            @Schema(
                    description =
                            "Gentle reminders to add an entry, at most one a day. Off until the person asks for them.")
            boolean reminders,

            @Schema(description = "What new journeys start as")
            Visibility defaultVisibility,

            @Schema(
                    description =
                            "The hour of the person's own day, 0 to 23, at which reminders arrive. 19 is 7 pm, and what is used when this is left out.")
            Integer reminderHour) {}

    /** A change to the settings. A field that is left out stays as it is, so an older version of the app can't switch off what it doesn't know. */
    public record SettingsChange(
            Boolean notifyNewEntries,
            Boolean notifyCompleted,
            Boolean notifyComments,
            Boolean notifyFollowers,
            Boolean notifyLikes,
            Boolean weeklyDigest,
            Boolean digestEmail,
            Boolean reminders,
            Visibility defaultVisibility,
            Integer reminderHour) {

        SettingsResponse on(SettingsResponse now) {
            return new SettingsResponse(
                    notifyNewEntries == null ? now.notifyNewEntries() : notifyNewEntries,
                    notifyCompleted == null ? now.notifyCompleted() : notifyCompleted,
                    notifyComments == null ? now.notifyComments() : notifyComments,
                    notifyFollowers == null ? now.notifyFollowers() : notifyFollowers,
                    notifyLikes == null ? now.notifyLikes() : notifyLikes,
                    weeklyDigest == null ? now.weeklyDigest() : weeklyDigest,
                    digestEmail == null ? now.digestEmail() : digestEmail,
                    reminders == null ? now.reminders() : reminders,
                    defaultVisibility == null ? now.defaultVisibility() : defaultVisibility,
                    reminderHour == null ? now.reminderHour() : reminderHour);
        }
    }

    public record BlockedPersonResponse(
            UUID id,
            String username,
            String displayName,
            @Schema(nullable = true) String avatarUrl,
            Instant blockedAt) {}

    public record ReportResponse(UUID id) {}

    /** What someone has until they change anything: everything on except email, and new journeys public. */
    public static final SettingsResponse DEFAULTS =
            new SettingsResponse(true, true, true, true, true, true, false, false, Visibility.PUBLIC, 19);

    /** One person can send this many reports in a day. Far more than anyone needs; far fewer than a script wants. */
    static final int MAX_REPORTS_A_DAY = 20;

    private static final Logger log = LoggerFactory.getLogger(AccountService.class);

    private final AccountStore accounts;
    private final MediaService media;
    private final List<SignInAccounts> signIns;
    private final TransactionTemplate transaction;

    AccountService(
            AccountStore accounts, MediaService media, List<SignInAccounts> signIns, TransactionTemplate transaction) {
        this.accounts = accounts;
        this.media = media;
        this.signIns = signIns;
        this.transaction = transaction;
    }

    public SettingsResponse settings(UUID me) {
        return accounts.settings(me).orElse(DEFAULTS);
    }

    @Transactional
    public SettingsResponse save(UUID me, SettingsChange change) {
        if (change.reminderHour() != null && (change.reminderHour() < 0 || change.reminderHour() > 23)) {
            throw ApiProblem.badRequest("invalid_reminder_hour", "Pick an hour of the day for reminders.");
        }
        accounts.saveSettings(me, change.on(settings(me)));
        return settings(me);
    }

    public Page<BlockedPersonResponse> blocked(UUID me, PageRequest page) {
        return accounts.blocked(me, page)
                .map(rows -> rows.stream().map(this::view).toList());
    }

    private BlockedPersonResponse view(BlockedRow row) {
        return new BlockedPersonResponse(
                row.id(),
                row.username(),
                row.displayName(),
                media.urlFor(row.avatarKey(), MediaSize.SMALL),
                row.blockedAt());
    }

    /**
     * Blocks someone, undoes every tie between the two people in both directions, and removes the comments the
     * blocked person left on the blocker's journeys. They aren't told. Someone who has blocked you can be
     * blocked back: that is how what they wrote under your entries goes away.
     */
    @Transactional
    public void block(UUID me, String username) {
        UUID them = accounts.idOfUsername(username.toLowerCase())
                .orElseThrow(() ->
                        new ApiProblem(HttpStatus.NOT_FOUND, "profile_not_found", "We couldn't find that person."));
        if (them.equals(me)) {
            throw ApiProblem.badRequest("thats_you", "You can't block yourself.");
        }
        accounts.block(me, them);
        accounts.removeCommentsOn(me, them);
    }

    @Transactional
    public void unblock(UUID me, String username) {
        accounts.unblock(me, username.toLowerCase());
    }

    /**
     * Reports are private and each one is reviewed by a person. Nothing is removed automatically. Only what
     * the reporter can actually see can be reported, once, and nobody sends reports by the hundred.
     */
    @Transactional
    public ReportResponse report(UUID me, ReportTarget target, UUID targetId, ReportReason reason, String note) {
        if (!accounts.canReport(me, target, targetId)) {
            throw new ApiProblem(
                    HttpStatus.NOT_FOUND, "not_found", "That isn't there any more, so there is nothing to report.");
        }
        if (accounts.reportsInTheLastDay(me) >= MAX_REPORTS_A_DAY) {
            throw new ApiProblem(
                    HttpStatus.TOO_MANY_REQUESTS,
                    "too_many_reports",
                    "That's a lot of reports for one day. We'll look at the ones you sent.");
        }
        return new ReportResponse(accounts.report(me, target, targetId, reason, note == null ? "" : note.trim()));
    }

    /**
     * Deletes the account for good: the profile, journeys, entries, comments, likes and follows (the database
     * removes what hangs off the profile and corrects every count), and the person's photos and clips (their
     * files follow within a minute). The sign-in is removed right after; if the sign-in service can't be
     * reached just then, it is tried again until it is gone.
     */
    public void delete(UUID me) {
        transaction.executeWithoutResult(status -> {
            media.deleteAllOwnedBy(me);
            accounts.deleteProfile(me);
            accounts.rememberDeleted(me);
        });
        removeSignIn(me);
    }

    /** True when the account was deleted a while ago and its sign-in is, or should soon be, gone. */
    public boolean wasDeleted(UUID userId) {
        return accounts.wasDeleted(userId);
    }

    /** Removes the sign-ins of deleted accounts that couldn't be removed at the time. Returns how many went. */
    public int removeSignInsStillWaiting() {
        int removed = 0;
        for (UUID id : accounts.takeSignInsToRemove(50)) {
            removed += removeSignIn(id) ? 1 : 0;
        }
        accounts.forgetDeletedBefore(30);
        return removed;
    }

    private boolean removeSignIn(UUID userId) {
        try {
            signIns.forEach(signIn -> signIn.remove(userId));
            accounts.signInRemoved(userId);
            return true;
        } catch (RuntimeException unreachable) {
            log.error(
                    "The sign-in of deleted account {} couldn't be removed; it will be tried again: {}",
                    userId,
                    unreachable.toString());
            return false;
        }
    }
}
