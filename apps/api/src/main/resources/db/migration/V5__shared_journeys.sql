-- Shared journeys: the owner invites up to three friends, who add their own entries once they accept.
create table journey_members (
  journey_id  uuid not null references journeys (id) on delete cascade,
  user_id     uuid not null references profiles (id) on delete cascade,
  status      text not null check (status in ('invited', 'joined')),
  invited_by  uuid not null references profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  joined_at   timestamptz,
  primary key (journey_id, user_id)
);
create index journey_members_user on journey_members (user_id, status);
