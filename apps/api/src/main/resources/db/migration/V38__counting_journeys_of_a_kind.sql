-- A category's page and the page of challenges say how many journeys are going on and how many finished this
-- month. Counting them when the page opens would read every public journey, so the hourly job counts them
-- once (Trending.count) and keeps the answers here: one row for each category and length of challenge, a few
-- dozen rows in all. The numbers on a page can be up to an hour old.
create table journey_tallies (
  category text not null,
  -- the number of days to reach, for a challenge; -1 for journeys that have none
  target_days integer not null,
  in_progress integer not null,
  finished_this_month integer not null,
  counted_at timestamptz not null default now(),
  primary key (category, target_days)
);
