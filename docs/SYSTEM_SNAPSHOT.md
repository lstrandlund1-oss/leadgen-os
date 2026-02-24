# LeadGen OS — System Snapshot (v0.2)

## What the product does (1 paragraph)
[One paragraph: who it serves, core job-to-be-done, what “done” looks like.]

## Current user flow (5–8 bullets)
- User enters: niche, location, socialPresence
- Provider run created
- Raw companies stored
- Normalization + classification loaded
- Deterministic scoring computed (score/opportunity/readiness/risk)
- Opportunity signals V2 computed (workType + resistance)
- Fit computed (fitScore + matched/missing/reasons)
- UI renders list + detail + outreach draft

## Data contracts (copy/paste the canonical types)
### Lead (canonical)
[Paste your Lead type]
### Classification (canonical)
[Paste your Classification type]

## Supabase tables in use (bullets)
- provider_runs
- companies_raw
- companies_normalized
- company_classifications
- [your new outcomes table name]
- [your fit tables if created]

## Key API routes (bullets)
- POST /api/providers/search
- GET  /api/providers/runs/[id]/leads
- GET/POST /api/outcomes
- [anything else important]

## Deterministic scoring model (4 bullets)
- opportunity = gap/upside
- readiness = viability/ability to buy + execute
- risk = resistance/instability/maturity gates
- score = blended composite (used for sorting)

## Fit model (3 bullets)
- Fit is separate from score
- Fit measures alignment with your agency capability
- Output: fitScore + matchedNeeds + missingNeeds + reasons

## Known issues / tech debt (max 7 bullets)
- [only real current problems]