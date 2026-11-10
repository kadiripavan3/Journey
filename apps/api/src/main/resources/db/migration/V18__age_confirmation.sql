-- Journey is for people aged 13 and over. A new profile needs the person's confirmation; this is when they gave it.
-- Profiles made before the question existed have none.
alter table profiles add column age_confirmed_at timestamptz;
