-- Discover's lists are read from the top of an index, in order, and stop after a dozen journeys.
-- "Trending now" already has its index (journeys_trending, V15). These are for "New journeys" and "Completed".
--
-- None of them mentions the entry or follower counts on purpose: an index that did would have to be rewritten
-- for every new entry and every follow. A journey with too few entries is passed over while reading instead.
set local statement_timeout = 0;

create index journeys_newest on journeys (created_at desc) where visibility = 'public';
create index journeys_completed on journeys (completed_at desc) where visibility = 'public' and status = 'completed';
