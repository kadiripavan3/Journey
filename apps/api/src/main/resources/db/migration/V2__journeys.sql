-- Photos and clips. The file itself lives in storage; storage_key says where.
create table media (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null,
  kind          text not null check (kind in ('photo', 'video')),
  content_type  text not null,
  storage_key   text not null unique,
  bytes         bigint,
  width         int,
  height        int,
  duration_s    int,
  status        text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  created_at    timestamptz not null default now()
);

alter table profiles drop column avatar_path;
alter table profiles add column avatar_media_id uuid references media (id) on delete set null;

-- A story: owned by one person, told in entries.
create table journeys (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references profiles (id) on delete cascade,
  title           text not null check (char_length(title) between 1 and 80),
  description     text not null default '' check (char_length(description) <= 300),
  category        text not null,
  template        text not null,
  label_style     text not null check (label_style in ('day', 'part')),
  visibility      text not null check (visibility in ('public', 'unlisted', 'private')),
  status          text not null default 'active' check (status in ('active', 'paused', 'completed')),
  tags            text[] not null default '{}',
  cover_media_id  uuid references media (id) on delete set null,
  start_date      date not null,
  target_days     int check (target_days between 1 and 366),
  completed_at    timestamptz,
  closing_note    text check (char_length(closing_note) <= 500),
  last_entry_at   timestamptz,
  entry_count     int not null default 0,
  follower_count  int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index journeys_owner on journeys (owner_id);
create index journeys_listed on journeys (visibility, status, last_entry_at desc);

-- One update in a journey. happened_at orders the story; happened_on is the calendar day it belongs to.
create table entries (
  id             uuid primary key default gen_random_uuid(),
  journey_id     uuid not null references journeys (id) on delete cascade,
  author_id      uuid not null references profiles (id) on delete cascade,
  happened_at    timestamptz not null,
  happened_on    date not null,
  title          text not null default '' check (char_length(title) <= 80),
  body           text not null default '' check (char_length(body) <= 2000),
  place_name     text check (char_length(place_name) <= 80),
  is_milestone   boolean not null default false,
  like_count     int not null default 0,
  comment_count  int not null default 0,
  created_at     timestamptz not null default now(),
  edited_at      timestamptz
);
create index entries_timeline on entries (journey_id, happened_at, created_at);
create index entries_recent on entries (journey_id, created_at desc);

create table entry_media (
  entry_id  uuid not null references entries (id) on delete cascade,
  media_id  uuid not null references media (id) on delete cascade,
  position  int not null,
  primary key (entry_id, media_id)
);

-- Who follows which journey. last_read_at drives "3 new since your last visit".
create table journey_follows (
  user_id       uuid not null references profiles (id) on delete cascade,
  journey_id    uuid not null references journeys (id) on delete cascade,
  last_read_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  primary key (user_id, journey_id)
);
create index journey_follows_journey on journey_follows (journey_id);
