# LeadGenOS – Product Blueprint

Version: 0.1  
Status: Internal Architecture Definition  
Owner: Founder  

---

# 1. Vision

LeadGenOS is a deterministic lead intelligence system built for marketing agencies.

It identifies businesses with growth potential by analyzing:
- Reputation signals
- Digital presence
- Structural gaps
- Market positioning

The system provides:
- Explainable scoring (Opportunity vs Risk)
- Clear outreach angles
- Deterministic logic (no black-box randomness)

This is NOT:
- A generic lead scraper
- A mass spam tool
- A random AI output generator

It is a structured intelligence engine.

---

# 2. Core Architecture Layers

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

---

# 3. Core Data Contracts

## Lead Contract

Lead MUST contain:

- id
- source
- sourceId
- company { name, website, address, city, country }
- metrics { rating, reviewCount, socialPresence }
- classification { primaryIndustry, subNiche, confidence }
- score {
    value
    opportunity
    readiness
    risk
    riskProfile
  }
- metadata { runId }

This shape must remain stable.

---

## Score Contract

Score is deterministic and contains:

- value (0–100)
- opportunity (0–100)
- readiness (0–100)
- risk (0–100)
- riskProfile:
    - "low_risk"
    - "mature_competitor"
    - "unstable_business"

Score must:
- Be explainable
- Never depend on random AI output
- Be reproducible from the same input

---

## Outcome Contract

Outcome tracks sales interaction:

- run_id
- lead_id
- contacted
- replied
- booked_call
- closed
- revenue
- notes

Outcomes are linked to run + lead.

---

# 4. Feature Modules

## Provider Search
Input:
- niche
- location
- socialPresence

Output:
- provider run
- raw companies stored

---

## Deterministic Scoring
Input:
- normalized company
- classification
- signals

Output:
- Score object

---

## Opportunity Signals (V2)
- Work type signals
- Resistance signals
- Primary insight extraction

Signals must be:
- Deterministic
- Ranked by strength
- Explainable

---

## Fit System
Purpose:
Measure alignment between agency capability and lead profile.

Fit contains:
- fitScore (0–100)
- matchedNeeds
- missingNeeds
- reasons

Fit is separate from Score.
Score = attractiveness.
Fit = alignment.

---

# 5. Development Rules

1. No changing Lead contract without updating this document.
2. No adding database columns without updating types.
3. No UI logic inside scoring files.
4. No "as any" unless documented.
5. No mixing async DB logic inside domain layer.
6. Every structural change must be logged below.

---

# 6. Migration Log

## v0.1
- Introduced Opportunity vs Risk scoring.
- Introduced riskProfile.
- Introduced deterministic signals V2.
- Added Fit system placeholder.

---

# 7. Long-Term Roadmap

Phase 1:
Internal deterministic intelligence engine (current stage).

Phase 2:
User authentication + RLS isolation.

Phase 3:
Multi-provider ingestion (Google Places, SERP, etc.).

Phase 4:
Agency dashboards + performance analytics.

Phase 5:
High-ticket intelligence SaaS product.

---

End of Blueprint.