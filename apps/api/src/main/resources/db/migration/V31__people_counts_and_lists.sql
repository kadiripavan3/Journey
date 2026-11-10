-- A profile's follower and following numbers are kept by the database, like a journey's counts, and the lists
-- of followers are read through an index, newest first.
set local statement_timeout = 0;

-- 1. The two numbers on a profile. They used to be counted from profile_follows every time a profile was
--    opened or a person appeared in search, which is every row of someone with many followers.
alter table profiles
  add column follower_count int not null default 0,
  add column following_count int not null default 0;

update profiles p
set follower_count = (select count(*) from profile_follows f where f.followee_id = p.id),
    following_count = (select count(*) from profile_follows f where f.follower_id = p.id);

-- They move with the rows they count, whoever changes them: the API, a block, or a cascade when an account is
-- deleted. The triggers run once per statement, not once per row, so deleting an account that follows a
-- thousand people is one update. The profiles are locked in the order of their ids first, so two people
-- following each other at the same moment can't end up waiting for each other.
create function count_profile_follows() returns trigger language plpgsql as $$
begin
  perform 1 from profiles p
  where p.id in (select followee_id from changed union select follower_id from changed)
  order by p.id for no key update;

  update profiles p
  set follower_count = greatest(p.follower_count + d.followers, 0),
      following_count = greatest(p.following_count + d.following, 0)
  from (
    select x.id, sum(x.followers)::int as followers, sum(x.following)::int as following
    from (
      select followee_id as id, tg_argv[0]::int as followers, 0 as following from changed
      union all
      select follower_id, 0, tg_argv[0]::int from changed
    ) x
    group by x.id
  ) d
  where p.id = d.id;
  return null;
end $$;

create trigger profile_follows_added after insert on profile_follows
  referencing new table as changed for each statement execute function count_profile_follows('1');
create trigger profile_follows_removed after delete on profile_follows
  referencing old table as changed for each statement execute function count_profile_follows('-1');

-- 2. "Followers" and "Following", newest first, one page at a time. Each index holds a person's rows in the
--    order the list shows them, so a page is read from where the last one stopped. The first replaces the
--    plain index on followee_id.
create index profile_follows_followers on profile_follows (followee_id, created_at, follower_id);
create index profile_follows_following on profile_follows (follower_id, created_at, followee_id);
drop index if exists profile_follows_followee;

-- 3. A person's entries, journey by journey: the entry count on a profile is read from this index alone.
--    It replaces the plain index on author_id.
create index entries_by_author on entries (author_id, journey_id);
drop index if exists entries_author;
