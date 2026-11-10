-- Held content, the reviewer's queue, and requests made on the web to delete an account.

-- A photo the automatic check flagged is held: only its owner sees it until a reviewer has looked.
alter table media add column held boolean not null default false;
alter table media add column held_reason text;
alter table media add column screened_at timestamptz;
-- Set when the owner asks for a second look.
alter table media add column appeal_at timestamptz;
create index media_held on media (created_at) where held;
create index media_unscreened on media (created_at) where kind = 'photo' and status = 'ready' and screened_at is null;

-- Photos that are already here were never checked. They are checked the next time the nightly job runs.

-- A comment the word filter caught is held the same way: only its author sees it until a reviewer has looked.
alter table comments add column held boolean not null default false;
create index comments_held on comments (created_at) where held;

-- An entry's comment count is what readers can see, so a held comment isn't counted until it is released.
create or replace function count_comments() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if not new.held then
      update entries set comment_count = comment_count + 1 where id = new.entry_id;
    end if;
  elsif tg_op = 'DELETE' then
    if not old.held then
      update entries set comment_count = greatest(comment_count - 1, 0) where id = old.entry_id;
    end if;
  elsif new.held <> old.held then
    update entries set comment_count = greatest(comment_count + case when new.held then -1 else 1 end, 0) where id = new.entry_id;
  end if;
  return null;
end $$;
drop trigger comments_count on comments;
create trigger comments_count after insert or delete or update of held on comments
  for each row execute function count_comments();

-- What a reviewer decided about a report, and who decided it.
alter table reports add column reviewed_by text;
alter table reports add column reviewed_at timestamptz;
alter table reports add column outcome text check (outcome in ('dismissed', 'removed'));
create index reports_open_target on reports (target_type, target_id) where status = 'open';

-- Everything a reviewer does, with who and when.
create table review_log (
  id           uuid primary key default gen_random_uuid(),
  reviewer     text not null,
  action       text not null,
  target_type  text not null,
  target_id    text not null,
  note         text not null default '',
  created_at   timestamptz not null default now()
);
create index review_log_recent on review_log (created_at desc);

-- "Please delete my account", asked on the web page by someone who may not have the app any more.
create table deletion_requests (
  id          uuid primary key default gen_random_uuid(),
  email       text not null check (char_length(email) <= 254),
  username    text not null default '' check (char_length(username) <= 40),
  note        text not null default '' check (char_length(note) <= 500),
  status      text not null default 'open' check (status in ('open', 'done')),
  created_at  timestamptz not null default now(),
  done_by     text,
  done_at     timestamptz
);
create index deletion_requests_open on deletion_requests (created_at) where status = 'open';
