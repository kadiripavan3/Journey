-- Push notifications.

-- A phone (or tablet) that asked to get pushes: its address at the push service, and the time zone it is in,
-- so reminders arrive in the evening wherever the person is.
create table devices (
  token       text primary key,
  user_id     uuid not null references profiles (id) on delete cascade,
  platform    text not null check (platform in ('ios', 'android', 'web')),
  time_zone   text not null default 'UTC',
  created_at  timestamptz not null default now(),
  seen_at     timestamptz not null default now()
);
create index devices_user on devices (user_id, seen_at desc);

-- The outbox: one row per message that is to be pushed to one person. A row is written in the same
-- transaction as the thing it tells about, so nothing is announced that didn't happen, and a job sends the
-- rows that are due. Rows that share a batch key and aren't sent yet are one message ("3 new entries").
create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles (id) on delete cascade,
  kind        text not null check (kind in ('new_entries', 'journey_completed', 'likes', 'comment', 'reply', 'journey_follow',
                'profile_follow', 'invitation', 'friend_joined', 'reminder', 'weekly_digest', 'journey_paused')),
  batch_key   text,
  actor_id    uuid references profiles (id) on delete cascade,
  journey_id  uuid references journeys (id) on delete cascade,
  entry_id    uuid references entries (id) on delete cascade,
  count       int not null default 1,
  text        text,
  send_after  timestamptz not null default now(),
  status      text not null default 'pending' check (status in ('pending', 'sent', 'skipped')),
  attempts    int not null default 0,
  sent_at     timestamptz,
  created_at  timestamptz not null default now()
);
create unique index notifications_batch on notifications (user_id, batch_key) where status = 'pending' and batch_key is not null;
create index notifications_due on notifications (send_after) where status = 'pending';
create index notifications_done on notifications (created_at) where status <> 'pending';
create index notifications_reminders on notifications (user_id, created_at) where kind = 'reminder';

-- When a reminder should arrive, as an hour of the person's own day (19 is 7 pm).
alter table settings add column reminder_hour int not null default 19 check (reminder_hour between 0 and 23);
