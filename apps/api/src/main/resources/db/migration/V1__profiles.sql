-- A person's public profile. id is the id of the signed-in user (from the sign-in service).
create table profiles (
  id            uuid primary key,
  username      text not null unique check (username ~ '^[a-z0-9._]{3,20}$'),
  display_name  text not null check (char_length(display_name) between 1 and 50),
  bio           text not null default '' check (char_length(bio) <= 150),
  link          text check (char_length(link) <= 200),
  avatar_path   text,
  interests     text[] not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
