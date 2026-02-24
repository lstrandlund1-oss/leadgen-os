# docs/RUNBOOK.md

# Runbook

## Dev commands
- Install: `npm i`
- Dev: `npm run dev`
- Typecheck: `npm run typecheck` (if you have it)
- Lint: `npm run lint`

## When something breaks
1) Read the error carefully (first red line + stack trace)
2) Identify: type mismatch vs runtime vs DB/API
3) Fix at the source of truth (types → API → UI)
4) Refresh run + verify deterministic outputs

## Common failure patterns
- UI expects fields not returned by API
- Types drift between `/lib/types.ts` and route payloads
- Legacy fields still referenced (strength, old insight naming)
- RunId types: string vs number mismatches

## Release discipline
- If API contract changes: update `/docs/API.md` and `/lib/types.ts` in the same commit.

## Development Rules

1. No changing Lead contract without updating this document.
2. No adding database columns without updating types.
3. No UI logic inside scoring files.
4. No "as any" unless documented.
5. No mixing async DB logic inside domain layer.
6. Every structural change must be logged below.