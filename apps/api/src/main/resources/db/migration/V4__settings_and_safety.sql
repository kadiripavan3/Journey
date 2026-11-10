-- A person's settings, the people they have blocked, and what they have reported.

create table settings (
  user_id             uuid primary key references profiles (id) on delete cascade,
  notify_new_entries  boolean not null default true,
  notify_completed    boolean not null default true,
  notify_comments     boolean not null default true,
  notify_followers    boolean not null default true,
  notify_likes        boolean not null default true,
  weekly_digest       boolean not null default true,
  digest_email        boolean not null default false,
  reminders           boolean not null default true,
  default_visibility  text not null default 'public' check (default_visibility in ('public', 'unlisted', 'private')),
  updated_at          timestamptz not null default now()
);

-- Blocking works both ways: neither person sees the other's journeys, entries or comments.
create table blocks (
  blocker_id  uuid not null references profiles (id) on delete cascade,
  blocked_id  uuid not null references profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked on blocks (blocked_id);

-- A report stays even if the reporter or the reported thing is deleted later, so a reviewer still sees it.
create table reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid references profiles (id) on delete set null,
  target_type  text not null check (target_type in ('journey', 'entry', 'comment', 'profile')),
  target_id    uuid not null,
  reason       text not null check (reason in ('spam', 'harassment', 'nudity', 'violence', 'impersonation', 'other')),
  note         text not null default '' check (char_length(note) <= 500),
  status       text not null default 'open' check (status in ('open', 'reviewed')),
  created_at   timestamptz not null default now()
);
create index reports_open on reports (status, created_at);
