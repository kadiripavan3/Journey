-- What is to be told to everyone who follows a journey: a new entry, or that the journey is complete. The
-- request that causes it writes one row here, in its own transaction; the push job turns each row into one
-- waiting message per follower. So posting to a journey with a hundred thousand followers takes the author
-- no longer than posting to one with none.
create table announcements (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('new_entries', 'journey_completed')),
  journey_id uuid not null references journeys (id) on delete cascade,
  entry_id uuid references entries (id) on delete cascade,
  actor_id uuid not null references profiles (id) on delete cascade,
  send_after timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index announcements_journey on announcements (journey_id);
create index announcements_entry on announcements (entry_id) where entry_id is not null;
create index announcements_actor on announcements (actor_id);
