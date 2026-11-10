-- How much is going on in a journey right now, worked out every hour (see Trending). Discover's "Trending now"
-- is ordered by it.
alter table journeys add column trending_score double precision not null default 0;
create index journeys_trending on journeys (trending_score desc) where visibility = 'public';
-- The job counts what happened in the last week.
create index entry_likes_recent on entry_likes (created_at);
create index comments_recent on comments (created_at);
create index journey_follows_recent on journey_follows (created_at) where not author;
