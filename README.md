# Piso

A Philippine personal finance tracker with **Bes** — a slightly judgmental conyo Taglish
money companion. This is the implementation of the Claude Design handoff in
`project/Piso Mockups.dc.html` (the design bundle and its chat transcript are still in
`project/`, `chats/` and `docs/handoff-README.md`).

```bash
npm install
npm run dev          # web on :5173, api on :8787
```

Open http://localhost:5173. To talk to Claude for real, put a key in `.env`
(see `.env.example`) before starting:

```bash
ANTHROPIC_API_KEY=sk-ant-... npm run dev
```

Without a key the chat still works — it answers from a canned Taglish response
library and says so on screen.

## What's here

Every screen from the design board, as real routes:

| Design | Screen | Route |
| --- | --- | --- |
| 1a | Home — safe-to-spend, due strip, envelopes | `#/home` |
| 1b | Quick-add sheet (keypad-first, 3 taps) | FAB / `N` |
| 1c | Allocation planner + live status bar | `#/planner` |
| 1d | Debts — trophy shelf, debt-free date | `#/debts` |
| 1e | Debt detail — ring, projection, history | `#/debts/:id` |
| 1f | Bes chat — Q&A + parse-draft confirm card | `#/chat` |
| 1g | Bills — 7/15/30 horizon, overdue first | `#/bills` |
| 1h | Onboarding — payday + personality | first run |
| 1i | Month review — flow, variance, health score | `#/reports` |
| 1j | Desktop dashboard — left rail, 3 columns | `#/home` ≥ 900px |
| 2a–d | The four themes | Appearance |
| 2e | Settings → Appearance | `#/appearance` |

Two small connectors the mockups implied but didn't draw: a **Money** hub (the planner's
own header reads "← Plan this salary", so it is entered from somewhere) and a **Settings**
list behind the desktop rail's "More".

## How it's built

```
src/
  lib/        money.ts (integer centavos), dates.ts, finance.ts (the pure engine)
  data/       seed.ts — the "Dafhnee" persona, dated relative to today
  state/      store.tsx — one reducer; every mutation moves account + envelope +
              debt + bill together, never one without the others
  styles/     tokens.css (4 themes, one semantic token set), app.css (screens)
  screens/    one file per design option
server/
  index.ts    /api/chat — streams Claude; the key never reaches the browser
  bes.ts      the persona prompt + the draft_transaction tool
  offline.ts  the canned library used when there are no credentials
```

**Theming.** Every screen paints with `--p-*` only, so a theme is nothing but a different
set of token values on `<html>`; no component knows which theme it is in. Sorbetes is the
default; "Match system light/dark" resolves to Sorbetes by day, Ube Latte by night.

**Money.** Integer centavos everywhere, rendered through one `formatMoney`. JSON numbers
are floats and are never used for money — amounts cross the wire to the chat route as
strings.

**The finance engine** (`src/lib/finance.ts`) implements the blueprint's §13 formulas as
pure functions: safe-to-spend, daily allowance, upcoming obligations, plan variance,
payoff projection, snowball/avalanche, the health score. The dashboard and Bes read the
same functions, so the number in the hero and the number in a chat answer cannot drift.

**Bes.** The server builds a bounded snapshot (derived numbers only — no transaction
history) and streams `claude-opus-5` with adaptive thinking at low effort. When you
describe a transaction she calls a `draft_transaction` tool; the app renders that as the
confirm card and **only writes to the ledger when you press Confirm**. Health, family and
emergency spending is never joked about — that rule lives in the prompt and in the local
reaction library.

## Numbers that differ from the mockup

The mockups' figures were illustrative and don't close arithmetically (₱5,240 ÷ ₱610/day
implies 9 days, but the same line says payday is Aug 15; the dashboard says "4 bills,
₱9,800" where the Bills screen lists 5 totalling ₱8,699). This app computes them instead,
from seeded data chosen to land on the design's numbers:

- Safe to spend renders **₱5,321** against the mockup's ₱5,240.
- Daily allowance, cycle progress, the debt-free date, interest-to-go and the health
  score are all derived, so they move as you use the app.

Say the word if you'd rather pin any of these to the mockup values exactly.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite (5173) + the API (8787), with `/api` proxied |
| `npm run build` | typecheck + production bundle into `dist/` |
| `npm start` | serves `dist/` and the API from one Node process |

## Not built yet

Supabase, auth and persistence (state lives in `localStorage`), the statement-sync flow,
goals beyond the seeded emergency fund, and the Vitest suite the blueprint asks for around
`src/lib/finance.ts`.
