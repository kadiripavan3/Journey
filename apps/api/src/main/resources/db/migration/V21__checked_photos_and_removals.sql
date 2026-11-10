-- Photos and clips: what is shown is what was checked, and what is removed is really removed.

-- One "complete" at a time works on an upload. The claim is given up after a few minutes, so an upload whose
-- completion died half-way can be completed again.
alter table media add column claimed_at timestamptz;

-- How often the automatic check tried and couldn't look. After a few tries a person looks instead.
alter table media add column screen_attempts int not null default 0;

-- Clips are checked as well (by their still frames), so "not checked yet" is no longer only about photos.
drop index media_unscreened;
create index media_unscreened on media (screen_attempts, created_at) where status = 'ready' and screened_at is null;

-- The smaller versions are made when the upload completes; there are no photos without them any more.
drop index media_unsized;

-- When a file was first put on an entry, a journey (as its cover) or a profile (as its picture).
-- Uploads that never were are removed after a while; files that were, and no longer are, are removed at once.
alter table media add column attached_at timestamptz;
update media m set attached_at = m.created_at
where exists (select 1 from entry_media em where em.media_id = m.id)
   or exists (select 1 from journeys j where j.cover_media_id = m.id)
   or exists (select 1 from profiles p where p.avatar_media_id = m.id);
create index media_never_used on media (created_at) where attached_at is null;
create index media_owner_recent on media (owner_id, created_at desc);
drop index media_owner;

-- Files whose last use just went away (the entry, the journey or the account was deleted, or the photo was
-- taken off). A job looks at each: if nothing uses the file any more, its record goes and the file is queued
-- for removal.
create table media_orphan_checks (
  media_id   uuid primary key,
  queued_at  timestamptz not null default now()
);

-- Files to remove from storage or from the video service. A row is written in the same transaction that
-- deletes the record, and stays until the file is really gone, so a failed delete is tried again instead of
-- leaving a file nobody knows about.
create table removed_files (
  id              bigint generated always as identity primary key,
  kind            text not null check (kind in ('photo', 'video')),
  storage_key     text not null,
  video_asset_id  text,
  queued_at       timestamptz not null default now(),
  attempts        int not null default 0,
  next_try_at     timestamptz not null default now()
);
create index removed_files_due on removed_files (next_try_at);

-- The column that names the file is given where each trigger is made (entry_media.media_id,
-- journeys.cover_media_id, profiles.avatar_media_id), so one pair of functions serves all three tables.
create function media_put_to_use() returns trigger language plpgsql as $$
declare used uuid := (to_jsonb(new) ->> tg_argv[0])::uuid;
begin
  if used is not null then
    update media set attached_at = now() where id = used and attached_at is null;
  end if;
  return null;
end $$;

create function media_use_ended() returns trigger language plpgsql as $$
declare was uuid := (to_jsonb(old) ->> tg_argv[0])::uuid;
begin
  if was is not null then
    insert into media_orphan_checks (media_id) values (was) on conflict do nothing;
  end if;
  return null;
end $$;

create trigger entry_media_use after insert on entry_media
  for each row execute function media_put_to_use('media_id');
create trigger entry_media_use_ended after delete on entry_media
  for each row execute function media_use_ended('media_id');

create trigger journeys_cover_use after insert or update of cover_media_id on journeys
  for each row when (new.cover_media_id is not null) execute function media_put_to_use('cover_media_id');
create trigger journeys_cover_changed after update of cover_media_id on journeys
  for each row when (old.cover_media_id is distinct from new.cover_media_id) execute function media_use_ended('cover_media_id');
create trigger journeys_cover_gone after delete on journeys
  for each row when (old.cover_media_id is not null) execute function media_use_ended('cover_media_id');

create trigger profiles_avatar_use after insert or update of avatar_media_id on profiles
  for each row when (new.avatar_media_id is not null) execute function media_put_to_use('avatar_media_id');
create trigger profiles_avatar_changed after update of avatar_media_id on profiles
  for each row when (old.avatar_media_id is distinct from new.avatar_media_id) execute function media_use_ended('avatar_media_id');
create trigger profiles_avatar_gone after delete on profiles
  for each row when (old.avatar_media_id is not null) execute function media_use_ended('avatar_media_id');
