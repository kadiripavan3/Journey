-- Sending the same thing twice makes it once. The app gives everything it creates an id of its own
-- (client_id); if the answer gets lost and the app sends it again, the API finds the first one.
alter table journeys add column client_id uuid;
alter table entries add column client_id uuid;
alter table comments add column client_id uuid;
create unique index journeys_client on journeys (owner_id, client_id) where client_id is not null;
create unique index entries_client on entries (author_id, client_id) where client_id is not null;
create unique index comments_client on comments (author_id, client_id) where client_id is not null;

-- Lookups that had no index: a person's entries and uploads (profiles, deleting an account), answers to a
-- comment, and journeys by tag.
create index entries_author on entries (author_id);
create index media_owner on media (owner_id);
create index comments_parent on comments (parent_id) where parent_id is not null;
create index journeys_tags on journeys using gin (tags);
create index journey_follows_unread on journey_follows (user_id, journey_id, last_read_at);

-- Search matches words anywhere in a title or a name ("%asia%"). Trigram indexes make that fast.
create extension if not exists pg_trgm;
create index journeys_title_trgm on journeys using gin (title gin_trgm_ops);
create index journeys_description_trgm on journeys using gin (description gin_trgm_ops);
create index profiles_username_trgm on profiles using gin (username gin_trgm_ops);
create index profiles_display_name_trgm on profiles using gin (display_name gin_trgm_ops);

-- Jobs that run on a schedule (the weekly digest, tidying up uploads) write a row here first. With more than
-- one copy of the API running, only the copy that gets the row does the work.
create table job_runs (
  job         text not null,
  period      text not null,
  started_at  timestamptz not null default now(),
  primary key (job, period)
);
