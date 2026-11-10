-- Indexes for Activity and for "my journeys", so each question goes straight to the rows it needs.
set local statement_timeout = 0;

-- The journeys a person writes in (their own, and the shared ones they joined): "my journeys" and a
-- profile's journeys start from these few rows instead of looking at every journey.
create index journey_follows_authors on journey_follows (user_id, journey_id) where author;

-- "Theo started following Iceland ring road": the people who chose to follow a journey, newest first.
-- Authors, and follows made for a creator's followers, are never announced, so they are left out.
create index journey_follows_chosen on journey_follows (journey_id, created_at) where not author and not auto;

-- "Lena and 46 others liked ...": the likes of one entry by when they were given, so Activity reads the
-- last 30 days of an entry's likes and not all of them.
create index entry_likes_by_entry on entry_likes (entry_id, created_at, user_id);
