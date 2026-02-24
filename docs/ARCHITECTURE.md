# docs/ARCHITECTURE.md

# Architecture

## High-level flow
1) Search intent → provider run
2) Provider ingestion → companies_raw
3) Normalization → companies_normalized
4) Classification → company_classifications
5) Scoring + signals → lead response (computed at read-time)
6) UI renders + exports
7) Outcomes saved per run + lead_id

## Key properties
- Idempotent ingestion: same run doesn’t create duplicates
- Deterministic scoring: same inputs yield same outputs
- “Read-time compute” for fast iteration (signals/score can evolve)

## Modules
- `/app/api/providers/search` — starts runs + ingestion
- `/app/api/providers/runs/[id]/leads` — returns computed leads
- `/lib/mappers/*` — raw → lead
- `/lib/scoring/*` — opportunity/risk/readiness + signals
- `/lib/fit/*` — needs mapping + fit scoring
- `/app/api/outcomes` — outcome CRUD (per run + lead)

## Tech
- Next.js (app router)
- Supabase (Postgres + storage + auth later)
- TypeScript everywhere

# Core Architecture Layers

## UI Layer
Responsible for:
- Input forms
- Lead display
- Sorting and filtering
- Outreach script rendering
- Outcome tracking UI

UI does NOT:
- Calculate core scoring logic
- Modify database contracts
- Contain business rules

---

## API Layer
Responsible for:
- Provider ingestion
- Run orchestration
- Fetching leads for runs
- Returning stable Lead objects

API must:
- Respect type contracts
- Never reshape Lead arbitrarily
- Be deterministic

---

## Domain Layer (Business Logic)

Includes:
- Scoring logic
- Opportunity vs Risk modeling
- Signal detection
- Fit scoring
- Classification logic

Rules:
- No UI code
- No database calls
- Pure logic only

---

## Data Layer (Supabase)

Tables include:
- companies_raw
- companies_normalized
- company_classifications
- provider_runs
- outcomes

Database rules:
- Data shapes must match TypeScript contracts
- No silent schema changes
- All changes logged in migration log

# Feature Modules

## Provider Search
Input:
- niche
- location
- socialPresence

Output:
- provider run
- raw companies stored