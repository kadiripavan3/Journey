-- Every column that points at another table gets an index.
--
-- When a row is deleted (an account, a journey, an entry, a photo), the database looks in every table that
-- points at it, to delete or clear what hangs off it. Without an index on the pointing column each of those
-- looks reads the whole table: deleting one account with a thousand entries would read `notifications` a
-- thousand times. These are the columns that had none. Where a column is mostly empty, only the rows that
-- have a value are indexed.
--
-- A migration may take longer than a request is allowed to (see "Limits on the database" in docs/02-tech-stack.md).
set local statement_timeout = 0;

create index entry_media_media on entry_media (media_id);
create index journeys_cover on journeys (cover_media_id) where cover_media_id is not null;
create index profiles_avatar on profiles (avatar_media_id) where avatar_media_id is not null;
create index journey_members_invited_by on journey_members (invited_by);
create index invite_links_created_by on invite_links (created_by);
create index invite_links_used_by on invite_links (used_by) where used_by is not null;
create index reports_reporter on reports (reporter_id) where reporter_id is not null;
create index notifications_user on notifications (user_id);
create index notifications_actor on notifications (actor_id) where actor_id is not null;
create index notifications_journey on notifications (journey_id) where journey_id is not null;
create index notifications_entry on notifications (entry_id) where entry_id is not null;
