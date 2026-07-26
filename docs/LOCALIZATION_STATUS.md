# Localization Status

Tracks which pages use the real i18n system (`lib/i18n/`) vs. which are
still hardcoded English. Started because an audit found that **only the
dashboard used i18n at all** — every other user-facing page was English-only,
which is a hard blocker for a Swedish-first beta.

## How the i18n system works

- `lib/i18n/types.ts` — the `TranslationSchema` type; every translatable
  string must have a matching key here.
- `lib/i18n/en.ts` / `lib/i18n/sv.ts` — the actual English/Swedish content.
- `lib/i18n/index.ts` — `getTranslations(language)` returns the full schema
  for that language.
- Usage pattern in a page component:
  ```ts
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window === "undefined") return "sv";
    try {
      const p = JSON.parse(localStorage.getItem("vantio_state_v1") ?? "{}");
      return p.language === "en" || p.language === "sv" ? p.language : "sv";
    } catch {
      return "sv";
    }
  });
  const t = getTranslations(language).ui.someSection;
  ```
- Default language is **Swedish** for any page a brand-new user might hit
  before they've set a language preference anywhere (onboarding, invite
  flow) — English is the fallback/toggle, not the default, since the beta
  audience is Swedish-first.

## Status by page

| Page | Status | Notes |
|---|---|---|
| `app/dashboard/page.tsx` | ✅ Fully translated | Pre-existing, before this audit |
| `app/beta/invite/[token]/page.tsx` + `BetaAcceptForm.tsx` | ✅ Fully translated | Built during the beta integration project |
| `app/beta/completed/page.tsx` | ✅ Fully translated | Built during the beta integration project |
| `app/onboarding/page.tsx` | ✅ Fully translated | Fixed as part of this audit. Also includes a language toggle since no user preference exists yet at this point. Profile type labels/descriptions/tags moved from `lib/profile/profileTypes.ts` into `lib/i18n/{en,sv}.ts` (`t.onboarding.profileTypes`) — that source file still owns the *structural* data (default capabilities, seller type) but no longer owns display text. |
| `app/login/page.tsx` | ✅ Fully translated | Fixed as part of this audit. Same language-toggle pattern as onboarding (no preference exists yet before login). |
| `app/settings/page.tsx` | ✅ Fully translated | Fixed as part of this audit. Uses the user's real saved profile language preference (not a toggle) since this page is only reachable while logged in. Fixed a real bug while translating the delete-account confirmation text: it contains the literal word "DELETE" mid-sentence, and a naive `.replace()` approach broke word order in Swedish — fixed with a proper split-and-render. |
| `app/profile/settings/page.tsx` | ✅ Fully translated | Fixed as part of this audit. Same architecture note as below — reuses `t.onboarding.capabilities`/`t.onboarding.profileTypes` for capability and profile-type labels rather than duplicating that content, and reuses `t.settings.betaBadge`/`backToDashboard` for the two identical nav strings. |
| `app/outreach/page.tsx` | ✅ Fully translated | Fixed as part of this audit — the largest page (1,100+ lines). One deliberate exception: the `REFINE_ACTIONS` *instruction* text (the actual prompt sent to Claude for "make this shorter/warmer/etc.") is intentionally left in English regardless of interface language, since it's a backend AI instruction, not UI text a user reads — only the button *label* is translated. Also fixed a real performance regression I introduced then caught: moving `CHANNEL_META`/`TONE_META`/`OBJECTIVE_META`/`GAP_CONFIG`/`REFINE_ACTIONS` inside the component (needed since they now depend on translations) meant they were being recreated on every render; wrapped all 5 in `useMemo` rather than leaving that as dead weight. |
| `app/followups/page.tsx` | ✅ Fully translated | Fixed as part of this audit — the last page. Also fixed date formatting, which was hardcoded to `en-GB` locale regardless of interface language (meant month names always showed in English even in Swedish mode) — now switches to `sv-SE` when appropriate. |

**All 6 originally-audited pages are now fully translated.** The dashboard was already done before this audit; onboarding, login, settings, profile/settings, outreach, and followups were all completed as part of it. The landing page (`app/page.tsx`) and plans page were explicitly deprioritized as pre-signup / not part of the in-app tester experience — see the audit notes for that reasoning.
| `app/outreach/page.tsx` | ❌ Not started | English-only |
| `app/followups/page.tsx` | ❌ Not started | English-only |
| `app/page.tsx` (landing page) | ❌ Not started | English-only. Lower priority — pre-signup, not part of the in-app tester experience |
| `app/plans/page.tsx` | ❌ Not started | English-only. Also has a broken checkout route — see `BETA_INTEGRATION_HANDOFF.md` / audit notes |

## Architectural note worth flagging

`app/settings/page.tsx` and `app/profile/settings/page.tsx` are two separate,
nearly-duplicate implementations of the same concept — both have Profile/
Preferences/Notifications/Account tabs, both have a delete-account flow,
both have business-info fields. They differ in a few real ways (only
`profile/settings` has capability-depth sliders and service-type selection;
only `settings` has the appearance/theme toggle), but the overlap is
substantial. This wasn't something to fix as part of translating them —
translating a page doesn't mean redesigning it — but it's worth deciding
deliberately whether both should exist long-term, since right now a change
to "how profile settings work" has to be made twice.

## Suggested order for remaining work

Matches the natural order a tester actually moves through the product:

1. `login` — first thing after the invite link
2. `settings` / `profile/settings` — referenced early, and by every user eventually
3. `outreach` — core workflow
4. `followups` — core workflow
5. `page.tsx` (landing) / `plans` — lower priority, pre-signup or not beta-relevant

## A note on shared data files

Some UI text lives in shared `lib/` files that multiple pages read from,
not directly in the page component itself. Before translating any new
page, check whether it renders text from:
- `lib/profile/profileTypes.ts` (already fixed — labels/tags/descriptions
  now come from `t.onboarding.profileTypes`, not the file itself)
- Any other shared label/definition file the page imports

Missing this is an easy way to think a page is "fully translated" when a
chunk of its visible text actually isn't.