-- 0016_company_duplicate_tracking.sql
--
-- Deduplication upgrade (Week 1 of the core rebuild): the existing dedup
-- (source, source_id) only merges records from the SAME provider — the
-- same real business found via Google Places AND SerpApi (both actively
-- used, see app/api/search/discover/route.ts) currently creates two
-- entirely separate companies_raw/companies_normalized rows, shown to
-- the user as two different leads for the same company.
--
-- This adds domain-based fuzzy matching on top, without touching the
-- existing per-provider raw records at all — deliberately additive,
-- per the rebuild spec's explicit instruction: "Maintain provenance...
-- Do not destroy useful source-specific data during normalization."
-- Every raw record from every provider is still kept; this only adds a
-- pointer so the read side can collapse duplicates for display while the
-- underlying provenance stays intact and queryable.
--
-- Phone-number matching is a deliberately separate, deferred piece — it
-- would require requesting a new field from Google Places that likely
-- shifts billing tier, a real cost decision not made here.

alter table companies_normalized add column if not exists duplicate_of_raw_id bigint;
alter table companies_normalized add column if not exists normalized_domain text;

create index if not exists idx_companies_normalized_duplicate_of on companies_normalized(duplicate_of_raw_id);
create index if not exists idx_companies_normalized_domain on companies_normalized(normalized_domain);