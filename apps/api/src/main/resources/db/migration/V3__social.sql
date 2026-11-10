-- Likes, comments, following people, and when someone last looked at their Activity.

create table entry_likes (
  entry_id    uuid not null references entries (id) on delete cascade,
  user_id     uuid not null references profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (entry_id, user_id)
);
create index entry_likes_user on entry_likes (user_id);

-- One level of replies: a reply's parent is always a top-level comment.
create table comments (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null references entries (id) on delete cascade,
  author_id   uuid not null references profiles (id) on delete cascade,
  parent_id   uuid references comments (id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 500),
  created_at  timestamptz not null default now()
);
create index comments_entry on comments (entry_id, created_at);
create index comments_author on comments (author_id);

-- Following a person. Their future public journeys are followed for you automatically.
create table profile_follows (
  follower_id  uuid not null references profiles (id) on delete cascade,
  followee_id  uuid not null references profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index profile_follows_followee on profile_follows (followee_id);

-- True when the follow was made for the person because they follow the journey's creator.
alter table journey_follows add column auto boolean not null default false;

-- Everything in Activity that happened after this moment is new to the person.
alter table profiles add column activity_seen_at timestamptz not null default now();
