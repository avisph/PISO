# Piso

A Philippine personal finance tracker with **Bes** — a deadpan Gen Z money companion who
happens to know your bank balance. This is the implementation of the Claude Design handoff in
`project/Piso Mockups.dc.html` (the design bundle and its chat transcript are still in
`project/`, `chats/` and `docs/handoff-README.md`).

```bash
npm install
npm run dev          # web on :5173, api on :8787
npm test             # the finance engine and the ledger
```

Open http://localhost:5173.

### Pointing Bes at your Ollama

Use the same base URL you already use in n8n. This command checks it and lists what's
installed:

```bash
npm run ai:check
OLLAMA_HOST=http://192.168.1.20:11434 npm run ai:check    # if it's on another box
```

```
✓ Host is up with 3 models:

   qwen2.5:7b                     4.7 GB   tools ✓
   llama3.2:3b                    2.0 GB   tools ✓
   nomic-embed-text:latest        0.3 GB   no tools

Put this in your .env:

    OLLAMA_HOST=http://localhost:11434
    OLLAMA_MODEL=qwen2.5:7b
```

Copy `.env.example` to `.env` and edit it — the server reads that file at startup, so
`npm run dev` picks it up with no extra flags. A variable exported in your shell wins over
the file, which is what you want when testing a second host.

Prefer a **tool-capable** model — Bes creates the draft-confirm card by calling a
`draft_transaction` tool. Without one she still works (the server falls back to a local
text parser) but the parse is rougher. `ai:check` marks which of yours support tools.

**Reasoning models are fine.** qwen3, deepseek-r1 and other hybrids narrate before they
answer, and when a build's tool template misfires they print the tool call as text —
a `<tools>` block of raw JSON — instead of returning `message.tool_calls`. Both are
stripped before anything reaches the chat bubble, including when a tag is split across
streamed chunks. The tool block is not merely hidden: it is parsed, so the draft card
still appears. `npx tsx scripts/check-think-filter.ts` covers it.

**A draft can only restate money you just mentioned.** Asked "where did my money go?",
a local model drafted two transactions by lifting the envelope totals out of the snapshot;
confirming them would have charged those pesos a second time. The prompt forbids it and
the server enforces it — a message with no amount in it produces no draft, and one reply
may produce at most one.

Networking gotchas, in the order they usually bite:

| Situation | `OLLAMA_HOST` |
| --- | --- |
| Ollama and Piso on the same machine | `http://localhost:11434` |
| Ollama in Docker, Piso on the host | `http://localhost:11434` (publish `11434:11434`) |
| Piso in Docker, Ollama on the host | `http://host.docker.internal:11434` |
| Ollama on another box | `http://<ip>:11434` — and set `OLLAMA_HOST=0.0.0.0` **on the daemon**, otherwise it only listens on loopback |
| Behind a proxy that wants a token | add `OLLAMA_API_KEY=…` (sent as `Authorization: Bearer`) |

`OLLAMA_NUM_CTX` defaults to 8192: the persona plus the finance snapshot is ~1k tokens and
Ollama's default window is small enough to truncate it, which makes a model answer from
half a snapshot. Lower it if RAM is tight.

The server re-checks at startup and says what it found:

```
piso api on http://localhost:8787 — chat via ollama (qwen2.5:7b) at http://localhost:11434
  ✓ http://localhost:11434 has qwen2.5:7b
```

Claude is still wired up (`ANTHROPIC_API_KEY` + `PISO_MODEL`), and `PISO_AI_PROVIDER`
forces a choice: `ollama` · `anthropic` · `offline` · `auto` (the default — Ollama if
configured, then Claude, then the canned library). With no provider at all the chat still
works from a canned Taglish library and says so on screen.

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
| 1h | Onboarding step 4 — personality picker | first run |
| 1i | Month review — flow, variance, health score | `#/reports` |
| 1j | Desktop dashboard — left rail, 3 columns | `#/home` ≥ 900px |
| 2a–d | The four themes | Appearance |
| 2e | Settings → Appearance | `#/appearance` |

Two small connectors the mockups implied but didn't draw: a **Money** hub (the planner's
own header reads "← Plan this salary", so it is entered from somewhere) and a **Settings**
list behind the desktop rail's "More".

### Onboarding steps 1–3

The board only ever drew `1h`, and it is labelled "Step 4 of 4" — so the app opened on the
last step of a wizard whose first three steps did not exist, and every number you saw
afterwards belonged to Dafhnee, the invented persona. Steps 1–3 ask for the three things
the engine cannot work without:

| Step | Asks | Feeds |
| --- | --- | --- |
| 1 | name, pay cadence, take-home per payout | the cycle, safe-to-spend, daily allowance |
| 2 | accounts and balances | available cash (savings is excluded on purpose) |
| 3 | recurring bills and their due days | upcoming obligations, the locked plan rows |

Nothing is invented on your behalf: no starter transactions, no debts, and every envelope
starts at ₱0 for the planner to assign. A bill left at ₱0 is skipped. If you would rather
look around than type, step 1 offers the demo persona instead, and **Settings → Start
over** switches between the two later.

### Changing it afterwards

Accounts, bills and debts can be added and edited from the screen they live on: Money for
accounts, Bills for bills, Debts for debts (and the debt detail's Edit). Onboarding never
asks about debts at all, so this is the only way one ever gets into the ledger.

Deleting is where money goes missing, so two deletes are refused rather than allowed to
orphan history: an **account** that transactions point at, and a **debt** with a payment
recorded against it. The reducer would still list those entries and could never move their
balances again. The sheet says which it is instead of the button quietly doing nothing.
Deleting a bill also removes the envelope that existed only to fund it, and deleting a debt
unhooks the card account and bill that referenced it.

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
  index.ts              /api/chat — picks a provider, streams events; keys never
                        reach the browser
  bes.ts                the persona prompt + the provider-neutral tool schema
  providers/ollama.ts   native /api/chat, NDJSON streaming, Bearer key
  providers/anthropic.ts  the Claude path (adaptive thinking, low effort)
  offline.ts            the canned library used when no provider is configured
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

**Tests** (`npm test`) cover the parts that can lose money quietly: centavo arithmetic and
the thousands separators a typed salary carries, payday across month ends and February and
New Year on both cadences, safe-to-spend and its breakdown, and the reducer — where a
delete has to restore every derived number exactly and a new cycle must not take the ledger
with it. Each bug that shipped during this build has a test named after what it did. They
were checked by reintroducing those bugs one at a time and confirming the suite goes red;
a suite that only ever passes has proved nothing.

**Bes's voice** lives in three places, and all three had to move together: the persona
prompt (`server/bes.ts`), the canned library used with no model (`server/offline.ts`), and
the on-screen reaction lines (`src/components/BesReaction.tsx`). Gen Z sarcastic, Taglish,
lowercase, deadpan — the joke is in the delivery, not the slang count. The prompt carries
an explicit calibration section, because "sarcastic" left undefined turns into a brand
account with three emoji per sentence. Sass level moves the sharpness, never the voice.

**Bes.** The server builds a bounded snapshot (derived numbers only — no transaction
history) and streams it to whichever provider is configured. Every provider emits the same
event stream, so the UI never learns which model answered. When you describe a transaction
the model calls a `draft_transaction` tool; the app renders that as the confirm card and
**only writes to the ledger when you press Confirm**. Health, family and emergency spending
is never joked about — that rule lives in the prompt and in the local reaction library.

Settings → "How honest should Bes be?" shows which provider, model and host are answering.

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
| `npm run ai:check` | probes your Ollama and lists tool-capable models |

## Not built yet

Supabase, auth and persistence (state lives in `localStorage`), the statement-sync flow,
goals beyond the seeded emergency fund, and the Vitest suite the blueprint asks for around
`src/lib/finance.ts`.
