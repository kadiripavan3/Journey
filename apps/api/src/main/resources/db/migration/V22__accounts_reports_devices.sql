-- Accounts that go away cleanly, reports that can't be piled up, and phones that are really phones.

-- An account that was deleted. Its sign-in is removed right after (and tried again until it is), and the id
-- is remembered for a while, so a token that is still good for an hour can't bring a profile back.
create table deleted_accounts (
  id                  uuid primary key,
  deleted_at          timestamptz not null default now(),
  sign_in_removed_at  timestamptz,
  attempts            int not null default 0,
  next_try_at         timestamptz not null default now()
);
create index deleted_accounts_waiting on deleted_accounts (next_try_at) where sign_in_removed_at is null;

-- One open report per person about one thing: saying it twice changes nothing.
delete from reports r using reports older
where r.status = 'open' and older.status = 'open' and r.reporter_id = older.reporter_id
  and r.target_type = older.target_type and r.target_id = older.target_id
  and (older.created_at, older.id) < (r.created_at, r.id);
create unique index reports_one_open on reports (reporter_id, target_type, target_id) where status = 'open';
-- For "how many has this person sent today", and for removing a person (the reporter's id is cleared).
create index reports_by_reporter on reports (reporter_id, created_at desc);

-- What became of a request to delete an account, for the reviewer who looks at the log later.
alter table deletion_requests add column outcome text;
create index deletion_requests_done on deletion_requests (done_at) where status = 'done';
