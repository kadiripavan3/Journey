-- The rate limit's counts for changes and sign-in attempts (see RateLimit). They are kept here, not in the
-- API's memory, so every copy of the API shares them. One row per person (or address) and kind of action;
-- the library (Bucket4j) reads and writes the state, and rows that have gone quiet are removed each night.
create table rate_limits (
  id          text primary key,
  state       bytea,
  expires_at  bigint
);
create index rate_limits_expiry on rate_limits (expires_at);
