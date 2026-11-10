-- Push delivery in three short steps instead of one long one.

-- A message is taken ("sending") before the push service is called, and marked sent after it answered, so no
-- database connection is held while the API waits for another company's server. A message that stays
-- "sending" (the API stopped in between) is put back after a while.
alter table notifications drop constraint notifications_status_check;
alter table notifications add constraint notifications_status_check
  check (status in ('pending', 'sending', 'sent', 'skipped'));
alter table notifications add column claimed_at timestamptz;
create index notifications_sending on notifications (claimed_at) where status = 'sending';

-- What the push service gave back for each push it accepted. A while later it can say what became of it;
-- that is how the API learns a phone no longer exists (the app was removed), and stops pushing to it.
create table push_tickets (
  id          text primary key,
  token       text not null,
  created_at  timestamptz not null default now()
);
create index push_tickets_age on push_tickets (created_at);
