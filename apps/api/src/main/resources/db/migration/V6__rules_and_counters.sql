-- Authors follow their own journeys, and the database keeps the counts.

-- 1. The owner and the friends who joined a journey get a follow row marked "author". It gives them the same
--    "new since your last visit" as any follower, so an owner hears about a friend's entries. Authors are not
--    counted as followers.
alter table journey_follows add column author boolean not null default false;

-- Friends who joined used to be counted as followers; take them out of the count before they are marked.
update journeys j
set follower_count = greatest(j.follower_count - (
  select count(*) from journey_members m join journey_follows f on f.journey_id = m.journey_id and f.user_id = m.user_id
  where m.journey_id = j.id and m.status = 'joined'), 0);

insert into journey_follows (user_id, journey_id, author, auto)
select owner_id, id, true, true from journeys
on conflict (user_id, journey_id) do update set author = true;

insert into journey_follows (user_id, journey_id, author, auto)
select m.user_id, m.journey_id, true, true from journey_members m where m.status = 'joined'
on conflict (user_id, journey_id) do update set author = true;

-- 2. Counts move with the rows they count, whoever changes them: the API, a cascade when an account or a
--    journey is deleted, or a script. They go up and down by one, so numbers set by hand (the sample data's
--    follower counts) keep their head start.
create function count_journey_follows() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if not new.author then
      update journeys set follower_count = follower_count + 1 where id = new.journey_id;
    end if;
  elsif tg_op = 'DELETE' then
    if not old.author then
      update journeys set follower_count = greatest(follower_count - 1, 0) where id = old.journey_id;
    end if;
  elsif new.author <> old.author then
    update journeys set follower_count = greatest(follower_count + case when new.author then -1 else 1 end, 0) where id = new.journey_id;
  end if;
  return null;
end $$;
create trigger journey_follows_count after insert or delete or update of author on journey_follows
  for each row execute function count_journey_follows();

create function count_entries() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update journeys
    set entry_count = entry_count + 1,
        last_entry_at = greatest(coalesce(last_entry_at, new.created_at), new.created_at)
    where id = new.journey_id;
  else
    update journeys
    set entry_count = greatest(entry_count - 1, 0),
        last_entry_at = (select max(e.created_at) from entries e where e.journey_id = old.journey_id)
    where id = old.journey_id;
  end if;
  return null;
end $$;
create trigger entries_count after insert or delete on entries
  for each row execute function count_entries();

create function count_entry_likes() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update entries set like_count = like_count + 1 where id = new.entry_id;
  else
    update entries set like_count = greatest(like_count - 1, 0) where id = old.entry_id;
  end if;
  return null;
end $$;
create trigger entry_likes_count after insert or delete on entry_likes
  for each row execute function count_entry_likes();

create function count_comments() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update entries set comment_count = comment_count + 1 where id = new.entry_id;
  else
    update entries set comment_count = greatest(comment_count - 1, 0) where id = old.entry_id;
  end if;
  return null;
end $$;
create trigger comments_count after insert or delete on comments
  for each row execute function count_comments();
