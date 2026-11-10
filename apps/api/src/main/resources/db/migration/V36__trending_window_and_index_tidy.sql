-- An index for the hourly trending job, and the indexes that cost more than they gave.
--
-- Nothing is live yet, so indexes are still made the plain way, inside the migration. On a table that holds
-- real data, an index is built with "create index concurrently" in a migration of its own (see "Limits on
-- the database" in docs/02-tech-stack.md).
set local statement_timeout = 0;

-- Entries by when they were posted, whatever journey they are in: the trending job and the weekly digest
-- both ask "what was posted this week" and had to read every entry to find out.
create index entries_posted on entries (created_at);

-- Indexes on journeys that named "last entry": every new entry changes that column, so every new entry had to
-- rewrite the journey's place in all of the table's indexes. Neither earned it. The first matched no list
-- (lists are ordered by newest activity through the reader's own follows, or by the Discover indexes). The
-- second served one job a night, which can look at the active journeys without it. With both gone, a new
-- entry or a new follower changes a journey's row in place and touches no index at all.
drop index journeys_listed;
drop index journeys_quiet;

-- Follows of a journey: the index now also holds who follows, so "does this person follow this journey" is
-- one step into it. With the journey alone, the database sometimes read every follower of a popular journey
-- to find the one row. It serves everything the old index did.
create index journey_follows_by_journey on journey_follows (journey_id, user_id);
drop index journey_follows_journey;

-- This repeated the table's own key with "last read" added. Marking a journey as read changes that column,
-- so each visit to a story rewrote two index entries for nothing: Home finds a reader's follows by the key.
drop index journey_follows_unread;
