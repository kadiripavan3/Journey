package app.journey.api.common;

/**
 * The rules about who may see what, written once as SQL conditions. Every query that reads journeys,
 * entries or people for someone uses these, so a rule can't be right in one place and forgotten in another.
 */
public final class Rules {

    private Rules() {}

    /**
     * True when neither person has blocked the other. Blocking works both ways.
     *
     * <p>Written as two separate "not exists", one for each direction, so the database can answer each from
     * the index on {@code blocks} instead of trying both directions row by row.
     *
     * @param person the column or parameter holding the other person's id, such as {@code "e.author_id"}
     * @param viewer the parameter holding the viewer's id, such as {@code ":viewer"}
     */
    public static String notBlocked(String person, String viewer) {
        return ("(not exists (select 1 from blocks bk where bk.blocker_id = %2$s and bk.blocked_id = %1$s)"
                        + " and not exists (select 1 from blocks bk where bk.blocker_id = %1$s and bk.blocked_id = %2$s))")
                .formatted(person, viewer);
    }

    /**
     * True when the viewer may see the journey: its owner hasn't blocked them (or been blocked by them), and it is
     * public or unlisted, or the viewer is its owner or a friend who joined it. A private journey looks exactly
     * like one that doesn't exist to everyone else.
     *
     * @param journey the alias of the journeys table in the query, such as {@code "j"}
     * @param viewer the parameter holding the viewer's id, such as {@code ":viewer"}
     */
    public static String visibleJourney(String journey, String viewer) {
        return ("(" + notBlocked("%1$s.owner_id", viewer) + " and (%1$s.visibility <> 'private' or %1$s.owner_id = %2$s"
                        + " or exists (select 1 from journey_members rm where rm.journey_id = %1$s.id and rm.user_id = %2$s and rm.status = 'joined')))")
                .formatted(journey, viewer);
    }

    /**
     * True when the viewer may read an entry as far as its author goes: the two haven't blocked each other,
     * or the entry is in the viewer's own journey. An owner sees everything written in their journey, also
     * by someone they have blocked since, because they are the one who can remove it.
     *
     * @param entry the alias of the entries table in the query, such as {@code "e"}
     * @param viewer the parameter or column holding the viewer's id
     */
    public static String entryBy(String entry, String viewer) {
        return ("(" + notBlocked("%1$s.author_id", viewer)
                        + " or exists (select 1 from journeys oj where oj.id = %1$s.journey_id and oj.owner_id = %2$s))")
                .formatted(entry, viewer);
    }

    /**
     * True when the viewer may read a comment as far as its author goes: the two haven't blocked each other,
     * or the comment is under the viewer's own entry or in the viewer's own journey. Someone who commented and
     * then blocked the person they wrote to can't leave words behind that everyone sees except that person:
     * the owner of the journey still sees them, and is the one who can remove them.
     *
     * @param comment the alias of the comments table in the query, such as {@code "c"}
     * @param viewer the parameter or column holding the viewer's id
     */
    public static String commentBy(String comment, String viewer) {
        return ("(" + notBlocked("%1$s.author_id", viewer)
                        + " or exists (select 1 from entries ce join journeys cj on cj.id = ce.journey_id"
                        + " where ce.id = %1$s.entry_id and (ce.author_id = %2$s or cj.owner_id = %2$s)))")
                .formatted(comment, viewer);
    }

    /**
     * True when the viewer may see a photo as far as review goes: it isn't being held, or it is their own.
     * A photo the automatic check flagged is hidden from everyone but its owner until a reviewer releases it.
     *
     * @param media the alias of the media table in the query, such as {@code "m"}
     * @param viewer the parameter or column holding the viewer's id
     */
    public static String shownMedia(String media, String viewer) {
        return "(not %1$s.held or %1$s.owner_id = %2$s)".formatted(media, viewer);
    }

    /**
     * True when a photo may stand for something everyone sees (a journey's cover, a line in Activity, a recap):
     * it isn't being held. Those places never show a held photo, not even to its owner.
     *
     * @param media the alias of the media table in the query, such as {@code "m"}
     */
    public static String publicMedia(String media) {
        return "not %s.held".formatted(media);
    }

    /**
     * The join that brings in the photo someone chose to stand for them or for a journey: a profile picture or
     * a cover. A photo can be held after it was chosen (a reviewer's decision, or the nightly check catching
     * up); from that moment the join finds nothing, exactly as if no photo had been chosen. Every query that
     * reads a profile picture or a cover joins it this way.
     *
     * @param media the alias to give the media table, such as {@code "pa"}
     * @param chosen the column holding the chosen photo's id, such as {@code "p.avatar_media_id"}
     */
    public static String chosenPhoto(String media, String chosen) {
        return " left join media %1$s on %1$s.id = %2$s and %3$s ".formatted(media, chosen, publicMedia(media));
    }

    /**
     * True when the viewer may see a comment as far as review goes: it isn't being held, or they wrote it.
     *
     * @param comment the alias of the comments table in the query, such as {@code "c"}
     * @param viewer the parameter or column holding the viewer's id
     */
    public static String shownComment(String comment, String viewer) {
        return "(not %1$s.held or %1$s.author_id = %2$s)".formatted(comment, viewer);
    }

    /**
     * True when nobody is waiting for a reviewer to look at the journey: there is no open report against it or
     * against one of its entries. Discover, search and suggestions leave a reported journey out until then;
     * it still opens for anyone who has the link or follows it.
     *
     * @param journey the alias of the journeys table in the query, such as {@code "j"}
     */
    public static String notUnderReview(String journey) {
        return ("not exists (select 1 from reports rp where rp.status = 'open' and ((rp.target_type = 'journey'"
                        + " and rp.target_id = %1$s.id) or (rp.target_type = 'entry' and exists"
                        + " (select 1 from entries re where re.id = rp.target_id and re.journey_id = %1$s.id))))")
                .formatted(journey);
    }
}
