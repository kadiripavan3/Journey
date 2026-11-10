package app.journey.api.account;

import app.journey.api.account.AccountStore.BlockedRow;
import app.journey.api.common.ApiProblem;
import app.journey.api.common.Page;
import app.journey.api.common.PageRequest;
import app.journey.api.journey.Visibility;
import app.journey.api.media.MediaService;
import app.journey.api.media.MediaSize;
import app.journey.api.people.PeopleService;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

            @Schema(description = "Gentle reminders to add an entry, at most one a day")
            boolean reminders,

            @Schema(description = "What new journeys start as")
            Visibility defaultVisibility,

            @Schema(
                    description =
                            "The hour of the person's own day, 0 to 23, at which reminders arrive. 19 is 7 pm, and what is used when this is left out.")
            Integer reminderHour) {}

    public record BlockedPersonResponse(
            UUID id,
            String username,
            String displayName,
            @Schema(nullable = true) String avatarUrl,
            Instant blockedAt) {}

    public record ReportResponse(UUID id) {}

    /** What someone has until they change anything: everything on except email, and new journeys public. */
    public static final SettingsResponse DEFAULTS =
            new SettingsResponse(true, true, true, true, true, true, false, true, Visibility.PUBLIC, 19);

    private final AccountStore accounts;
    private final PeopleService people;
    private final MediaService media;
    private final List<SignInAccounts> signIns;

    AccountService(AccountStore accounts, PeopleService people, MediaService media, List<SignInAccounts> signIns) {
        this.accounts = accounts;
        this.people = people;
        this.media = media;
        this.signIns = signIns;
    }

    public SettingsResponse settings(UUID me) {
        return accounts.settings(me).orElse(DEFAULTS);
    }

    @Transactional
    public SettingsResponse save(UUID me, SettingsResponse settings) {
        if (settings.defaultVisibility() == null) {
            throw ApiProblem.badRequest("invalid_visibility", "Choose Public, Unlisted or Private.");
        }
        if (settings.reminderHour() != null && (settings.reminderHour() < 0 || settings.reminderHour() > 23)) {
            throw ApiProblem.badRequest("invalid_reminder_hour", "Pick an hour of the day for reminders.");
        }
        accounts.saveSettings(me, settings);
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
     * blocked person left on the blocker's journeys. They aren't told.
     */
    @Transactional
    public void block(UUID me, String username) {
        UUID them = people.idOf(username, me);
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

    /** Reports are private and each one is reviewed by a person. Nothing is removed automatically. */
    @Transactional
    public ReportResponse report(UUID me, ReportTarget target, UUID targetId, ReportReason reason, String note) {
        return new ReportResponse(accounts.report(me, target, targetId, reason, note == null ? "" : note.trim()));
    }

    /**
     * Deletes the account for good: the profile, journeys, entries, comments, likes and follows (the database
     * removes what hangs off the profile and corrects every count), the person's photos and clips, and their sign-in.
     */
    @Transactional
    public void delete(UUID me) {
        media.deleteAllOwnedBy(me);
        accounts.deleteProfile(me);
        signIns.forEach(signIn -> signIn.remove(me));
    }
}
