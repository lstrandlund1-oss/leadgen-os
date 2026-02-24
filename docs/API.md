# docs/API.md

# API

## POST /api/providers/search
Starts a provider run and ingests results.
Body (example):
- provider
- query
- country
- location (optional)
- socialPresence (optional)
- limit

Response:
- runId

## GET /api/providers/runs/:id/leads
Returns computed Lead[] for the run.
Response:
- runId
- count
- leads

## GET /api/outcomes?runId=:id
Returns outcomes for a run.
Response:
- outcomes: LeadOutcome[]

## POST /api/outcomes
Upserts one outcome record by (run_id, lead_id).
Body:
- runId
- leadId
- contacted?
- replied?
- bookedCall?
- closed?