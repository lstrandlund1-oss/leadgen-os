# docs/DATA_MODEL.md

# Data Model

## Tables (conceptual)
- provider_runs
- provider_run_items (run → raw ids)
- companies_raw
- companies_normalized
- company_classifications
- lead_outcomes

## Key IDs
- raw company: `companies_raw.id` (number)
- lead id: `${source}:${sourceId}` (string, stable)
- run id: `provider_runs.id` (number)

## Lead shape (contract)
Lead is the API contract. The UI should treat it as canonical.

Fields:
- company (name, website, city, country)
- metrics (rating, reviewCount, socialPresence)
- classification (primaryIndustry, confidence)
- score (value, opportunity, readiness, risk, riskProfile)
- metadata (runId)

## Notes
- Avoid duplicating computed score columns in DB unless needed for analytics.
- Computed fields should be derived in `/runs/[id]/leads` for now.

# Core Data Contracts

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