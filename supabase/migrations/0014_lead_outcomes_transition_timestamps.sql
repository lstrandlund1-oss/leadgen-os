-- 0014_lead_outcomes_transition_timestamps.sql
--
-- Week 1 of the core rebuild: event/snapshot foundation. lead_outcomes
-- only ever stored current-state booleans (contacted, replied,
-- booked_call, closed) with no record of WHEN each stage was reached —
-- meaning "Contacted: Aug 12 -> Replied: Aug 14 -> Meeting: Aug 17" (the
-- rebuild spec's own example of what the product should be able to show)
-- was structurally impossible to reconstruct.
--
-- Each _at timestamp is set once, the first time its corresponding
-- boolean becomes true, and never overwritten afterward — see
-- app/api/outcomes/route.ts, which also fixes a related bug found while
-- building this: the POST handler defaulted any field missing from a
-- given save to false/null instead of merging with the existing row,
-- meaning a save that only touched `closed` could silently reset
-- `contacted`/`replied` back to false.

alter table lead_outcomes add column if not exists contacted_at timestamptz;
alter table lead_outcomes add column if not exists replied_at timestamptz;
alter table lead_outcomes add column if not exists booked_call_at timestamptz;
alter table lead_outcomes add column if not exists closed_at timestamptz;