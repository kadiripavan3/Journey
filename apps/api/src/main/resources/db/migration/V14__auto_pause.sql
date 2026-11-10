-- A journey with no entry for 30 days pauses by itself. This says when that happened, so the app can tell
-- "paused after 30 quiet days" from "the owner paused it". It is cleared when the journey is active again.
alter table journeys add column auto_paused_at timestamptz;
create index journeys_quiet on journeys (coalesce(last_entry_at, created_at)) where status = 'active';
