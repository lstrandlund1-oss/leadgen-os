-- 0004_beta_discount_deadline_nullable.sql
-- redemption_deadline was declared NOT NULL, but it's defined as "30 days
-- from official launch" — a date that doesn't exist yet pre-launch.
-- Inventing a placeholder date now would be actively wrong once a real
-- launch date is set, so this becomes nullable: NULL means "earned, exact
-- deadline to be set when the launch date is known." Application code
-- treats NULL as "not yet determined, will be announced" rather than
-- treating it as unlimited or already-expired.

alter table beta_discount_grants alter column redemption_deadline drop not null;