-- A journey's follower count is moved once per statement, not once per row.
--
-- When someone with many followers starts a public journey, all of them follow it in one statement. The old
-- trigger then rewrote the journey's row once for every follower, in the middle of that person's request.
-- Now the rows a statement added or removed are counted per journey and each journey is updated once. The
-- journeys are locked in the order of their ids first, so two statements that touch the same journeys (an
-- account being deleted, a block) can't end up waiting for each other.
drop trigger journey_follows_count on journey_follows;
drop function count_journey_follows();

create function count_journey_follows() returns trigger language plpgsql as $$
begin
  perform 1 from journeys j
  where j.id in (select journey_id from changed where not author)
  order by j.id for no key update;

  update journeys j
  set follower_count = greatest(j.follower_count + d.n, 0)
  from (
    select journey_id, tg_argv[0]::int * count(*)::int as n
    from changed where not author group by journey_id
  ) d
  where j.id = d.journey_id;
  return null;
end $$;

create trigger journey_follows_added after insert on journey_follows
  referencing new table as changed for each statement execute function count_journey_follows('1');
create trigger journey_follows_removed after delete on journey_follows
  referencing old table as changed for each statement execute function count_journey_follows('-1');

-- Becoming an author (a friend joins) or stopping being one (they leave) changes one row at a time, and only
-- then is this asked: marking a journey as read changes the same table far more often and must not pay for it.
create function count_journey_follow_role() returns trigger language plpgsql as $$
begin
  if new.author <> old.author then
    update journeys
    set follower_count = greatest(follower_count + case when new.author then -1 else 1 end, 0)
    where id = new.journey_id;
  end if;
  return null;
end $$;
create trigger journey_follows_role after update of author on journey_follows
  for each row execute function count_journey_follow_role();
