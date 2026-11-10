-- People who signed in with Apple. Apple asks that deleting an account also ends the link between the app
-- and their Apple ID; that needs the token Apple gives when they sign in. It is kept for that one purpose
-- and outlives the profile by the moment it takes to tell Apple.
create table apple_sign_ins (
  user_id        uuid primary key,
  refresh_token  text not null,
  created_at     timestamptz not null default now()
);
