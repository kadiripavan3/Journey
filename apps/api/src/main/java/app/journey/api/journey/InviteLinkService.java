package app.journey.api.journey;

import app.journey.api.common.ApiProblem;
import app.journey.api.common.PublicUrls;
import app.journey.api.journey.InviteLinkStore.LinkRow;
import app.journey.api.journey.JourneyService.JourneyResponse;
import app.journey.api.journey.JourneyStore.JourneyRow;
import app.journey.api.media.MediaService;
import app.journey.api.media.MediaSize;
import app.journey.api.people.PeopleService;
import app.journey.api.profile.PersonResponse;
import io.swagger.v3.oas.annotations.media.Schema;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The one-time link for a friend who isn't on Journey yet. The owner makes it and sends it however they
 * like; whoever opens it first, within 7 days, can join the journey. In the app only people who follow you
 * can invite you; that rule doesn't apply here, because the owner chose who gets the link.
 */
@Service
public class InviteLinkService {

    static final Duration GOOD_FOR = Duration.ofDays(7);

    /** Letters and digits that can't be mistaken for each other when read aloud or typed. */
    private static final String ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

    private static final SecureRandom RANDOM = new SecureRandom();

    public record InviteLinkResponse(
            @Schema(description = "The link to send. It is shown once: only a hash of it is kept.")
            String url,

            Instant expiresAt) {}

    public record LinkInvitationResponse(JourneyResponse journey, PersonResponse invitedBy, Instant expiresAt) {}

    /** What the web page behind a link shows to someone who may not have the app yet. */
    public record Preview(String title, String ownerName, String coverUrl, String token) {}

    private final InviteLinkStore links;
    private final JourneyService journeys;
    private final JourneyStore journeyStore;
    private final MemberStore members;
    private final MemberService memberService;
    private final PeopleService people;
    private final MediaService media;
    private final PublicUrls urls;

    InviteLinkService(
            InviteLinkStore links,
            JourneyService journeys,
            JourneyStore journeyStore,
            MemberStore members,
            MemberService memberService,
            PeopleService people,
            MediaService media,
            PublicUrls urls) {
        this.links = links;
        this.journeys = journeys;
        this.journeyStore = journeyStore;
        this.members = members;
        this.memberService = memberService;
        this.people = people;
        this.media = media;
        this.urls = urls;
    }

    /** The owner makes the journey's link. Making a new one stops the one before it. */
    @Transactional
    public InviteLinkResponse create(UUID journeyId, UUID owner) {
        JourneyRow journey = journeys.requireOwned(journeyId, owner);
        if (journey.status() == JourneyStatus.COMPLETED) {
            throw ApiProblem.badRequest(
                    "journey_completed", "This journey is completed, so nobody can be added to it.");
        }
        if (members.members(journeyId).size() >= MemberService.MAX_FRIENDS) {
            throw full();
        }
        String token = newToken();
        Instant expires = Instant.now().plus(GOOD_FOR);
        links.replace(journeyId, owner, hash(token), expires);
        return new InviteLinkResponse(urls.to("/i/" + token), expires);
    }

    /** What the link invites to, for the app's invitation screen. */
    @Transactional(readOnly = true)
    public LinkInvitationResponse look(String token, UUID viewer) {
        LinkRow link = usable(token);
        JourneyRow journey = journeyStore.findForLink(link.journeyId(), viewer).orElseThrow(InviteLinkService::gone);
        PersonResponse inviter = people.persons(List.of(link.createdBy())).get(link.createdBy());
        return new LinkInvitationResponse(journeys.view(journey, viewer), inviter, link.expiresAt());
    }

    /** Opening the link and saying yes: the person joins the journey and the link is used up. */
    @Transactional
    public JourneyResponse accept(String token, UUID me) {
        // Two people must not both take the last place, so they go through one at a time; whoever comes second
        // reads the link again and finds it used.
        journeyStore.lock(usable(token).journeyId());
        LinkRow link = usable(token);
        JourneyRow journey = journeyStore.findForLink(link.journeyId(), me).orElseThrow(InviteLinkService::gone);
        if (journey.ownerId().equals(me)) {
            throw ApiProblem.badRequest("thats_you", "This is your own journey. Send the link to a friend.");
        }
        if (journey.status() == JourneyStatus.COMPLETED) {
            throw ApiProblem.badRequest(
                    "journey_completed", "This journey is completed, so nobody can be added to it.");
        }
        boolean alreadyAsked = members.isAsked(journey.id(), me);
        if (!alreadyAsked && members.members(journey.id()).size() >= MemberService.MAX_FRIENDS) {
            throw full();
        }
        if (!links.use(link.id(), me)) {
            throw gone(); // someone else was a moment faster
        }
        members.join(journey.id(), me, link.createdBy());
        return memberService.joined(journey.id(), me);
    }

    /** For the web page behind the link. Empty when the link has been used, has run out or never existed. */
    @Transactional(readOnly = true)
    public Optional<Preview> preview(String token) {
        return links.find(hash(token))
                .filter(link -> link.usable(Instant.now()))
                .flatMap(link -> journeyStore.findForLink(link.journeyId(), link.createdBy()))
                .map(journey -> new Preview(
                        journey.title(),
                        journey.ownerName(),
                        media.urlFor(journey.coverKey(), MediaSize.MEDIUM),
                        token));
    }

    private LinkRow usable(String token) {
        return links.find(hash(token))
                .filter(link -> link.usable(Instant.now()))
                .orElseThrow(InviteLinkService::gone);
    }

    private static ApiProblem gone() {
        return new ApiProblem(
                HttpStatus.NOT_FOUND,
                "invite_gone",
                "This invitation link has been used or has run out. Ask for a new one.");
    }

    private static ApiProblem full() {
        return ApiProblem.badRequest(
                "journey_full",
                "A journey has up to " + (MemberService.MAX_FRIENDS + 1)
                        + " authors. Remove someone to invite another person.");
    }

    /** Sixteen characters in groups of four, such as k7m2-x9qd-p4wn-3hbs: about 79 bits, far too many to guess. */
    private static String newToken() {
        StringBuilder token = new StringBuilder();
        for (int i = 0; i < 16; i++) {
            if (i > 0 && i % 4 == 0) {
                token.append('-');
            }
            token.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        }
        return token.toString();
    }

    static String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(String.valueOf(token).trim().toLowerCase().getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
