-- The smaller versions of a photo are made once, when its upload finishes, and stored next to it.
-- This says whether that has happened. Photos uploaded before this existed get theirs the next time the API starts.
alter table media add column sized boolean not null default false;
create index media_unsized on media (created_at) where kind = 'photo' and status = 'ready' and not sized;
