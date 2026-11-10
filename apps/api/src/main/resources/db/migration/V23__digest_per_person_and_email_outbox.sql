-- The weekly digest, sent so that a deploy in the middle loses nobody, and email that is tried again.

-- When a job finished, next to when it started. A run that never finished is easy to spot.
alter table job_runs add column finished_at timestamptz;

-- Who has had their digest for which week (their own week: it goes out on their own Sunday evening).
-- Written in the same transaction as the message itself, so a run that stops half-way is picked up where it
-- stopped, and nobody gets it twice.
create table digest_sent (
  user_id  uuid not null references profiles (id) on delete cascade,
  week     text not null,
  sent_at  timestamptz not null default now(),
  primary key (user_id, week)
);

-- Emails waiting to go out. The address is not kept here: it is looked up at the moment of sending. A row
-- goes a week after it was sent or given up on.
create table emails (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references profiles (id) on delete cascade,
  subject        text not null,
  html           text not null,
  body           text not null,
  send_once_key  text not null unique,
  status         text not null default 'pending' check (status in ('pending', 'sent', 'refused', 'gave_up')),
  attempts       int not null default 0,
  next_try_at    timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  done_at        timestamptz
);
create index emails_due on emails (next_try_at) where status = 'pending';
create index emails_done on emails (done_at) where status <> 'pending';
create index emails_user on emails (user_id);
