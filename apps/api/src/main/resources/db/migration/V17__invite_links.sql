-- A one-time link the owner of a journey gives to a friend who isn't on Journey yet. The link itself is never
-- stored, only a hash of it, so reading this table doesn't let anyone join. It works for one person, for 7 days.
create table invite_links (
  id          uuid primary key default gen_random_uuid(),
  journey_id  uuid not null references journeys (id) on delete cascade,
  token_hash  text not null unique,
  created_by  uuid not null references profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  used_by     uuid references profiles (id) on delete set null,
  used_at     timestamptz
);
create index invite_links_journey on invite_links (journey_id);
