-- Reading a story, a journey card and a comment thread through indexes that hold them in the order they are shown.
set local statement_timeout = 0;

-- 1. A story's order is when things happened, then when they were written down, then the id to settle exact
--    ties. The index now holds all three, so a page of a story starts exactly after the last entry of the
--    page before, and an entry's place in the story is counted from the index alone. It replaces the index
--    without the id.
create index entries_story on entries (journey_id, happened_at, created_at, id);
drop index if exists entries_timeline;

--    A story's big moments, in story order, for "Jump to" on the journey's page. Few entries are milestones,
--    so this index is small, and the page no longer looks at every entry to find them.
create index entries_milestones on entries (journey_id, happened_at, created_at, id) where is_milestone;

-- 2. The days a journey has entries for. Every journey card shows "Day 14": the latest day is now the last
--    row of this index, not a look at every entry. The row of ticks on a challenge and the reminder's "is
--    today done?" read it too.
create index entries_days on entries (journey_id, happened_on);

-- 3. Comments are shown thread by thread: threads in the order they were started, each followed by its
--    replies. Every comment now carries its thread (the comment it answers, or itself) and when that thread
--    started, so a page is read in that order from an index and starts after the last comment of the page before.
alter table comments add column thread_id uuid, add column thread_at timestamptz;
update comments c
set thread_id = coalesce(c.parent_id, c.id),
    thread_at = coalesce((select p.created_at from comments p where p.id = c.parent_id), c.created_at);
alter table comments alter column thread_id set not null, alter column thread_at set not null;

-- Whoever writes the comment (the API, the sample data, a script), the database places it in its thread.
-- A reply is always later than the comment it answers, so it can never be listed before it.
create function place_comment_in_thread() returns trigger language plpgsql as $$
declare
  started timestamptz;
begin
  if new.parent_id is null then
    new.thread_id := new.id;
    new.thread_at := new.created_at;
  else
    select p.created_at into started from comments p where p.id = new.parent_id;
    new.thread_id := new.parent_id;
    new.thread_at := coalesce(started, new.created_at);
    if new.created_at <= new.thread_at then
      new.created_at := new.thread_at + interval '1 microsecond';
    end if;
  end if;
  return new;
end $$;
create trigger comments_thread before insert on comments
  for each row execute function place_comment_in_thread();

create index comments_threads on comments (entry_id, thread_at, thread_id, created_at, id);
drop index if exists comments_entry;

-- 4. Room on each page for a changed row to stay on it. A journey's counts change with every entry and
--    every follow, and an entry's with every like and comment. When the new version of the row fits on the
--    same page and no indexed column changed, no index has to be touched at all. (This applies to pages
--    written from now on, which is every page: nothing is live yet.)
alter table journeys set (fillfactor = 85);
alter table entries set (fillfactor = 90);
