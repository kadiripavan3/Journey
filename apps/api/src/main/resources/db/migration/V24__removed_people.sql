-- A person a reviewer removed for breaking the guidelines can't simply sign up again with the same address.
-- The address itself is not kept: only a fingerprint of it (a one-way hash), to compare a new sign-up with.
create table banned_sign_ins (
  email_hash  text primary key,
  banned_at   timestamptz not null default now(),
  banned_by   text not null
);
