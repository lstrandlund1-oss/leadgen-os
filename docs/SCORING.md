# docs/SCORING.md

# Scoring

## Purpose
Separate:
- Opportunity (upside / gap)
- Readiness (ability to buy + execute)
- Risk (likelihood of wasting time / hard displacement)

Composite score is for sorting, not truth.

## Current inputs
- website presence
- rating
- review count
- social presence
- classification boost (isGoodFit + confidence)

## Outputs
- score.value (0–100)
- score.opportunity (0–100)
- score.readiness (0–100)
- score.risk (0–100)
- score.riskProfile (mature_competitor | unstable_business | null)

## Design rules
- Opportunity can be high while risk is high — that’s real life.
- Risk gates cap overall score (prevents misleading “Easy Win”).
- Deterministic always.

## Signals
- WorkType signals (opportunity-flavored)
- Resistance signals (risk/friction-flavored)
Primary insights are chosen deterministically.

# Feature Modules

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