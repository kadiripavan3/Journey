-- Reminders are something a person asks for (requirement C6), not something they have to switch off.
-- Nothing is live yet, so the people in a test database go back to "not asked" as well.
alter table settings alter column reminders set default false;
update settings set reminders = false;
