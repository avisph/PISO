# Piso — Personal Finance Tracker
## Complete Product & Technical Architecture Blueprint

**Version 1.0 — July 2026**
**Prepared for:** Dafhnee
**Working title:** "Piso" (placeholder — any name works; the architecture doesn't care)

---

## 1. Executive Summary

Piso is a mobile-first personal finance tracker for one person (initially you), built around a single question: **"Where does my money stand right now, and what do I do with my next salary?"**

It is not accounting software. There are no ledgers, no debits and credits, no reconciliation. There are five ideas the whole app is built on:

1. **Money you have** (accounts: cash, bank, e-wallets)
2. **Money you owe** (debts: cards, loans, installments, money borrowed from people)
3. **Money that's leaving soon** (bills and due dates)
4. **A plan for each salary** (allocation before spending)
5. **A sarcastic AI companion** that reacts, answers questions, and turns "spent 350 on Grab" into a saved transaction

The recommended architecture is deliberately boring: a **Next.js modular monolith on Vercel, with Supabase (Postgres + Auth + Row Level Security) as the entire backend, and the Anthropic API for the three AI features that actually need a model**. One repo, one database, no microservices, no queues, no self-hosted anything. One person can build and maintain it.

Two opinionated decisions shape everything else in this document:

- **All financial math is deterministic application code**, unit-tested, never delegated to the AI. The AI receives pre-computed summaries and explains them; it never calculates your balance.
- **Most "sarcastic reactions" don't call an AI at all.** They come from a local response library (hundreds of pre-written lines, selected by rules). This makes reactions instant, free, and safe. The LLM is reserved for the two things that need it: parsing natural-language entries and answering open-ended questions.

The honest critique (Section 29) flags where your spec is over-scoped for an MVP, and the phased plan (Section 26) gets a usable daily-driver app into your hands at the end of Phase 2, not Phase 6.

---

## 2. Product Vision

**One sentence:** A finance app that feels like a slightly judgmental best friend who is genuinely good with money.

**The problem it solves.** Most people with debts, installments, and a semi-monthly salary don't need accounting — they need *situational awareness*: how much do I actually have, what's due before my next payday, and how much can I spend tonight without wrecking the plan. Existing tools fail in opposite directions: spreadsheets are flexible but demand discipline and give no feedback; banking apps show balances but no plan; budgeting apps (YNAB, etc.) are powerful but demand you learn a methodology.

**The wedge.** Piso's wedge is the **salary allocation ritual**: the moment money lands, you split it across obligations before you can mentally spend it. Everything else — safe-to-spend, debt-free dates, the AI's commentary — derives from that ritual plus fast expense logging.

**Product values, in priority order:**

1. **Truth at a glance** — the dashboard never lies and never requires interpretation.
2. **Three-second entry** — if logging an expense takes more than a few seconds, the app dies. This is the #1 existential risk (see Section 29).
3. **Kind honesty** — the sarcasm punches at the *purchase*, never at the *person*.
4. **No shame architecture** — debt is displayed as a solvable problem with a countdown, not a red wall of failure.
5. **The user is always the authority** — every AI suggestion is editable, every auto-action is confirmable.

---

## 3. Target User and Main Use Cases

**Primary persona: "Dafhnee, 20s–30s, employed in the Philippines."**
Salaried (often paid semi-monthly on the 15th/30th), banks with BPI/BDO plus GCash/Maya e-wallets, has 2–6 concurrent debts of mixed formality (a credit card, a Shopee/BNPL installment, maybe a salary loan, money borrowed from a sibling), sends money to family, and has tried and abandoned a budgeting spreadsheet at least once. Comfortable with chat interfaces. Allergic to anything that looks like Excel or a bank portal.

**Explicitly NOT the target (for MVP):** couples/households sharing budgets, freelancers with complex invoicing, investors tracking portfolios, small businesses, accountants.

**Main use cases, ranked by frequency:**

| # | Use case | Frequency | Success criterion |
|---|----------|-----------|-------------------|
| 1 | Log an expense | Several times daily | ≤ 3 taps or one chat message; ≤ 5 seconds |
| 2 | Check "how much can I spend?" | Daily | Answer visible without any tap (dashboard hero) |
| 3 | Check upcoming bills | Weekly | 7/15/30-day view in one glance |
| 4 | Allocate a salary | 2×/month | ≤ 2 minutes using a saved template |
| 5 | Record a debt payment | 2–6×/month | Payment auto-updates debt balance and bill status |
| 6 | Ask the AI a question | Weekly | Answer grounded in real data, assumptions labeled |
| 7 | Add/edit a debt | Monthly | Works even with no interest rate (utang from a person) |
| 8 | Review the month | Monthly | Plan-vs-actual per category, one screen |

---

## 4. MVP Scope

The MVP is the smallest app you would actually use every day for a full salary cycle. Everything in this list survives the critique in Section 29; the cut list is in Section 5.

**In scope:**

- **Auth & profile** — email/password + Google sign-in via Supabase Auth; PHP currency; payday schedule (semi-monthly default); AI personality setting.
- **Accounts** — manual cash, bank, e-wallet, savings, credit card accounts with running balances. No bank connections.
- **Transactions** — income, expense, transfer, debt payment, goal contribution. Quick-add form, natural-language chat entry (with confirmation), copy-previous, recurring templates.
- **Categories** — the 14 suggested categories seeded as system defaults; user can add/rename/archive.
- **Salary allocation** — create a plan per salary (amount or percentage based), reusable templates, one suggested plan generated by deterministic priority rules, under/exact/over indicator with hard warning on over-allocation.
- **Debts** — all 8 debt types including informal no-interest debts; payment history; payoff projection; snowball vs avalanche comparison; estimated debt-free date.
- **Bills** — recurring obligations with due dates and 8 statuses; the 7/15/30-day upcoming view; paying a bill from a debt (e.g., credit card due) links the two.
- **Goals & savings** — target amount/date, progress, required monthly contribution, simple on-track/behind indicator. Emergency fund is a goal with a special badge.
- **Dashboard** — hero numbers (available cash, safe-to-spend), debt total, due-soon strip, allocation progress, plan-vs-actual highlights, plain-language summary lines.
- **AI companion** — (a) NL expense parsing with confirm-before-save, (b) financial Q&A over pre-computed summaries, (c) reactions from the local response library with Gentle/Balanced/Savage settings.
- **Notifications** — in-app only: due dates, overdue, low balance, overspend, unallocated salary, milestones.
- **Reports** — the 8 listed in Section 28-scope: income vs expenses, category spending, cash flow, debt progress, upcoming payments, plan vs actual, savings progress, month-over-month. Each is one screen, minimal charts.
- **Data export** — CSV + JSON of everything. Account deletion.
- **Dark/light mode, mobile-first responsive UI.**

---

## 5. Features Excluded from the MVP (and why)

| Feature | Why it's excluded | When |
|---|---|---|
| Bank/e-wallet API integrations | No reliable open-banking API in PH; scraping is fragile and a security liability. Manual entry + NL chat is good enough. | v2+, revisit when BSP open finance matures |
| Push/email/SMS notifications | Requires a scheduler + delivery infra + user tokens. In-app on open covers 90% of value for a daily-use app. | v1.1 (Vercel Cron + email is a small step) |
| Receipt scanning (OCR) | Cool demo, marginal real value vs a 3-second quick-add. Adds a vision-model dependency. | v2 |
| Shared/household budgets | Doubles the data model complexity (invites, roles, split ownership) for a single-user MVP. | v2 |
| Multi-currency | Touches every money field, every formula, every report. Design for it (currency column exists), don't build it. | v2 |
| Voice entry | NL chat entry already gives the same path; voice is just a dictation layer the OS keyboard provides for free. | Never as custom code — OS dictation into chat suffices |
| Investment tracking | Different domain (market data, cost basis). Scope trap. | v3 or never |
| Drag-and-drop allocation | Sliders + steppers are simpler to build and *more* precise on mobile. Drag-and-drop is desktop-thinking. | Polish phase, only if sliders feel bad |
| Budgets as a separate module | Your spec lists both "budgets" and "salary allocation plans." They're the same job done twice. The allocation plan **is** the budget (see Section 14). A separate monthly budget module is cut. | Only if real usage shows plans ≠ budgets |
| "Likelihood of reaching goal" as a probability | A real probability model needs history you won't have. MVP shows a deterministic on-track/behind/ahead status with the required monthly amount. | Cosmetic upgrade later |
| Financial health score (full version) | Composite scores are opaque and easy to distrust. MVP ships a simplified 3-factor version with the math shown (Section 13.9). | Expand factors in v1.1 |
| Automated AI reactions via LLM | Cost, latency, and repetition risk. Local response library instead (Section 20). | LLM-generated one-liners only if the library feels stale |

---

## 6. Recommended Technology Stack

Your suggested stack is assessed honestly: **it is the right stack**, with two small adjustments. It is not just "acceptable" — for a solo builder shipping a secure CRUD-plus-AI app, it is close to optimal in 2026.

| Layer | Choice | Why this and not something simpler |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript** | One codebase for UI + API. Server Components keep financial data server-side by default. The alternative "simpler" option — a Vite SPA + Supabase client-only — is *less* secure (all logic in the browser, RLS as the only wall) and makes the AI proxy awkward. Next.js is justified. |
| Styling | **Tailwind CSS + shadcn/ui (Radix)** | shadcn gives accessible primitives (dialogs, sheets, tabs) you'd otherwise hand-build. Copy-paste ownership model = no library lock-in. |
| Backend | **Supabase: Postgres 15, Auth, RLS, Storage** | Auth + database + row-level isolation + backups as a managed service. The alternative (own Node API + Prisma + hosted Postgres + own auth) is strictly more code for a solo dev with no benefit at this scale. |
| ORM/data | **Supabase JS client + generated types; raw SQL migrations via Supabase CLI** | Skip Prisma/Drizzle for MVP: the schema is small, RLS policies live in SQL anyway, and `supabase gen types` gives end-to-end typing. One less tool. |
| Money math | **`decimal.js-light` in app code; `NUMERIC(14,2)` in Postgres** | Never floats. Section 12 and 30 make this a hard rule. |
| AI | **Anthropic API — Claude Haiku for NL parsing, Claude Sonnet for Q&A** | Haiku is fast/cheap enough for per-message parsing; Sonnet only for the weekly "give me a plan" questions. Both behind a server route — the key never touches the client. |
| Charts | **Recharts** (3–4 chart types max) | Minimal chart needs; no D3 custom work. |
| Validation | **Zod** | One schema definition validates forms, API inputs, and AI outputs (the parser's JSON is Zod-validated before it ever reaches the confirm screen). |
| State | **TanStack Query** for server state; React state for UI. No Redux. | Caching + optimistic updates for the 3-second entry goal. |
| Hosting | **Vercel** (free/hobby tier is fine initially) | Zero-ops deploys, preview URLs, cron later. |
| Testing | **Vitest** (finance engine), **Playwright** (E2E), **pgTAP or SQL scripts** (RLS tests) | Section 24. |
| Rate limiting | **Upstash Redis (free tier) or Vercel WAF rules** on AI routes | Only the AI routes need it at MVP scale. |

**What was considered and rejected:**

- **Microservices / separate AI service:** rejected — nothing here needs independent scaling; a second deployable doubles ops for zero benefit.
- **React Native / Expo now:** rejected for MVP — a responsive PWA (installable, home-screen icon, offline-tolerant shell) delivers the mobile feel; the service layer (Section 9) is designed so a native app can be added later without rewriting logic.
- **Local-first (SQLite/CRDT sync):** genuinely attractive for a finance app (privacy, offline), but sync engines are a multi-month project by themselves. Postponed; the export feature keeps your data yours meanwhile.
- **Firebase:** Firestore's document model fights relational finance data (joins, aggregates, constraints). Postgres wins.

**Verdict: modular monolith on Next.js + Supabase + Vercel + Anthropic. No simpler stack does the job without giving up security or the AI features.**

---

## 7. High-Level System Architecture

```
┌─────────────────────────── User's phone / desktop browser ───────────────────────────┐
│  Next.js PWA (React Server Components + client islands)                              │
│  • Dashboard, forms, chat UI          • TanStack Query cache, optimistic updates     │
└──────────────┬───────────────────────────────────────────────┬──────────────────────┘
               │ HTTPS (Supabase JS: auth session, reads)      │ HTTPS (app API routes)
               ▼                                               ▼
┌──────────────────────────────┐          ┌────────────────────────────────────────────┐
│  SUPABASE (managed)          │          │  NEXT.JS SERVER (Vercel)                   │
│  • Postgres 15 + RLS         │◄────────►│  Modular monolith:                         │
│  • Auth (JWT sessions)       │  service │  • /modules/finance   (all money math)     │
│  • Row Level Security on     │  role,   │  • /modules/ai        (parse, Q&A, react)  │
│    every table               │  server- │  • /modules/notify    (in-app alerts)      │
│  • Nightly backups + PITR    │  side    │  • /app/api/* route handlers + server      │
│  • Storage (export files)    │  only    │    actions (Zod-validated)                 │
└──────────────────────────────┘          └───────────────┬────────────────────────────┘
                                                          │ HTTPS, server-side key only
                                                          ▼
                                          ┌────────────────────────────────────────────┐
                                          │  ANTHROPIC API                             │
                                          │  • Haiku: NL transaction parsing           │
                                          │  • Sonnet: financial Q&A / plan drafting   │
                                          │  (receives summaries, never raw history)   │
                                          └────────────────────────────────────────────┘
```

**Three rules govern this diagram:**

1. **Reads can go client → Supabase directly** (fast, cached, RLS-protected). Simple writes may too, but **every financial mutation with side effects** (debt payments, transfers, allocation saves, deletes that restore balances) goes through the Next.js service layer so business rules (Section 12.20) run in one place, inside a DB transaction, with an audit log entry.
2. **The AI never touches the database.** The server builds a bounded context snapshot (Section 21), sends it out, validates what comes back.
3. **One deployable, one database.** "Modular" means module folders with enforced import boundaries (ESLint rules), not separate services.

---

## 8. Frontend Architecture

**Directory shape (App Router):**

```
/app
  /(auth)/login, /signup, /onboarding
  /(main)/home            ← dashboard (default route)
  /(main)/transactions    ← list + filters
  /(main)/plan            ← allocation planner + plan vs actual
  /(main)/debts           ← list, detail/[id], simulator
  /(main)/chat            ← AI companion
  /(main)/more/...        ← accounts, bills, goals, categories, settings, export
  /api/ai/parse, /api/ai/chat, /api/export, ...
/components/ui            ← shadcn primitives
/components/finance       ← MoneyText, ProgressRing, DueChip, AllocationBar, DebtCard...
/modules/finance          ← pure TS: engine.ts, allocation.ts, payoff.ts, healthscore.ts
/modules/ai               ← contextBuilder.ts, prompts.ts, responseLibrary.ts, guards.ts
/modules/notify           ← ruleEngine.ts
/lib                      ← supabase clients (server/browser), zod schemas, money.ts
```

**Key frontend decisions:**

- **Server Components by default.** Dashboard numbers are computed server-side and rendered as HTML — no financial data waterfall in the client, fast first paint on mobile.
- **Client islands** only where interactivity demands: quick-add sheet, allocation sliders, chat, charts.
- **Optimistic updates for expense entry.** The quick-add writes to the TanStack Query cache instantly, syncs in background, rolls back with a toast on failure. This is how entry *feels* like 1 second.
- **The Quick-Add Sheet is the most important component in the app.** Floating action button → bottom sheet → amount keypad (large), category grid (8 most-used first), account chips, optional note. Save on 3 taps. It is reachable from every screen.
- **Money is always rendered by one component** (`<MoneyText>`) that handles ₱ formatting, sign, color semantics (never raw red/green alone — icons + text for color-blind users), and privacy blur mode (tap to hide amounts in public).
- **All amounts cross the wire as strings** (`"1250.50"`), converted to decimals at the service boundary — JSON numbers are floats and are banned for money.
- **PWA:** manifest + service worker for shell caching and home-screen install. Full offline queueing is postponed; the shell tolerates flaky connections gracefully (skeletons + retry).

---

## 9. Backend Architecture

**Pattern: modular monolith with a pure functional core.**

```
/modules/finance/
  engine.ts        ← pure functions: (data in) → (numbers out). No I/O. 100% unit-tested.
  allocation.ts    ← suggested-plan generator, over/under checks
  payoff.ts        ← snowball/avalanche simulators, debt-free date
  services/        ← orchestration with I/O: recordPayment(), saveAllocation(),
                     deleteTransaction(), transfer() — each runs in ONE db transaction,
                     enforces business rules, writes audit_logs
```

- **The pure core is the crown jewel.** Every formula in Section 13 lives in `engine.ts`/`payoff.ts` as a pure function over plain data. Tests hammer these without any database. The same functions run server-side for the dashboard and can later be shipped to a native app unchanged.
- **Service functions are the only write path for anything with side effects.** Example: `recordDebtPayment()` does — validate (Zod) → begin transaction → insert transaction row → decrease debt balance (clamped, rule 12.20-B) → decrease source account balance → mark linked bill instance paid/partial → write audit log → commit → return fresh snapshot. If any step fails, everything rolls back.
- **Postgres does what Postgres is best at:** `CHECK` constraints as backstops (amount > 0, balances ≥ 0 where applicable), foreign keys, RLS on every table, a few generated columns. **No business logic in triggers** — one person maintaining trigger-based magic six months later is how finance bugs are born. The service layer is the single source of behavior; constraints are the safety net.
- **Derived numbers are computed, not stored** (available cash, safe-to-spend, variances) — at this scale (thousands of rows per user, not millions) Postgres aggregates in single-digit milliseconds and you eliminate an entire class of "cached value drifted" bugs. The two exceptions, cached for UX: `debts.current_balance` and `goals.saved_amount`, both maintained exclusively by service functions and re-derivable from transaction history by a repair script.
- **Recurring generation is lazy, not scheduled (MVP):** on app open, a service materializes any bill instances / expected transactions due within the horizon (next 45 days) that don't exist yet. Idempotent by unique key `(template_id, due_on)`. This removes the need for any cron in MVP; Vercel Cron can take over in v1.1 for pre-open notification generation.

---

## 10. AI Assistant Architecture

Three capabilities, three very different implementations — this separation is the most important AI decision in the blueprint:

| Capability | Engine | Latency | Cost | Why |
|---|---|---|---|---|
| **A. Reactions** ("Character development.") | **Local response library** — no LLM | 0 ms | ₱0 | Reactions fire on *every* transaction. An LLM here means paying and waiting for a one-liner, plus repetition/tone drift risk. A curated library with variation pools and cooldowns is instant, free, on-brand, and safe by construction. |
| **B. NL transaction parsing** ("spent 350 on grab") | **Claude Haiku**, structured JSON output, Zod-validated | ~1 s | tiny | Real language understanding needed (amounts, merchants, Taglish, installment phrasing). Output is a *draft* — the user always confirms before save (rule 12.20-K). |
| **C. Financial Q&A / planning** ("what should I pay first?") | **Claude Sonnet** over a server-built context snapshot | 2–4 s | small | Needs reasoning + tone. Receives pre-computed numbers (Section 21), never raw tables, never write access. |

**Request flow for B and C:**

```
user text → POST /api/ai/* (auth required, rate-limited)
  → guards.ts: length caps, injection screening, strip control chars
  → contextBuilder.ts: assemble minimal snapshot for THIS request type (Section 21)
  → Anthropic API (system prompt = fixed template; user text always in a data slot)
  → validate: Zod-parse JSON (B) / scan response (C)
  → B: return draft → user edits/confirms → normal service-layer write path
  → C: render answer; any "log this?" suggestion becomes a confirmable draft, never an auto-write
```

**Hard guarantees:**

- The AI has **no tools, no DB access, no write path**. It returns text/JSON; only the user's confirmation triggers the same service functions a manual form would.
- The AI **never computes balances**. If a question needs math, `contextBuilder` computes it deterministically and includes the result; the model narrates.
- Every response that includes advice carries the standing disclaimer framing (Section 20: "not a licensed adviser") and labeled assumptions.
- Per-user rate limits (e.g., 60 parses + 30 chat messages/day at MVP) cap worst-case spend to pocket change.

---

## 11. Data Flow (key scenarios)

**11.1 Quick-add expense (the 3-second path)**
Tap FAB → sheet opens with keypad → amount, category, account (defaults to last used) → Save → optimistic insert in UI → server action validates → insert transaction, decrement account balance (one tx) → reaction line from local library appears under the toast → dashboard queries invalidate.

**11.2 Natural-language entry**
Chat: "new shopee installment, 1200 monthly for 6 months" → `/api/ai/parse` → Haiku returns `{intent: "create_installment", monthly: "1200", months: 6, merchant: "Shopee", ...}` → Zod validates → confirm card shows: creates 1 debt (₱7,200, installment) + recurring bill (₱1,200/mo × 6) → user taps Confirm (or edits) → service creates both in one transaction → reaction fires.

**11.3 Salary lands**
User logs income (or recurring salary template proposes it) → "Allocate this?" prompt → planner opens with last template pre-filled → adjust sliders → status bar shows Under/Exact/Over live → over-allocation shows blocking warning (override requires an explicit checkbox, rule 12.20-D) → save plan → dashboard flips to new cycle: safe-to-spend recomputed, allocation progress bars reset.

**11.4 Debt payment**
From debt detail or from a due bill → "Pay ₱2,500 from BPI account" → service: transaction row + debt balance −2,500 (clamped at 0) + account −2,500 + bill instance → paid + audit log → UI: debt progress bar animates, payoff date recalculates, library fires a "character development" line; if the debt hits zero, milestone notification + celebration state.

**11.5 AI question: "can I afford this ₱3,000 thing?"**
`/api/ai/chat` → contextBuilder computes: safe-to-spend today, days to payday, upcoming 14-day obligations, discretionary remaining → Sonnet answers in persona, e.g. "Technically yes, ₱3,000 fits inside your ₱5,200 safe-to-spend — but rent eats you alive on the 30th, so 'afford' is doing a lot of work here" → assumptions listed → nothing is written anywhere.

**11.6 Opening the app (read path)**
Server components run: lazy-materialize recurring instances → compute dashboard snapshot (one round of aggregate queries) → evaluate notification rules → render. Client hydrates islands; TanStack Query keeps subsequent navigation instant.

---

## 12. Database Schema

**Conventions used throughout:**
All primary keys are `uuid` (default `gen_random_uuid()`). Every user-owned table has `user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE` with RLS policy `user_id = auth.uid()` for all operations, and an index starting with `user_id`. All money fields are `NUMERIC(14,2)` — never float (rule 12.20-L). All tables have `created_at timestamptz DEFAULT now()`; mutable tables add `updated_at`. Soft-archive via `is_archived`/`status` rather than deleting reference data.

**One deliberate simplification vs your requested table list:** your spec asks for separate `income_entries`, `expense_transactions`, `debt_payments`, and `goal_contributions` tables. This blueprint uses **one `transactions` table with a `type` column** and optional link columns. Reasons: every report ("cash flow", "money in vs out") needs all money movements in one query; the quick-add and NL parser share one write path; and four near-identical tables means four sets of RLS policies, indexes, and bugs. `debt_payments` and `goal_contributions` are provided as SQL **views** over `transactions` so the requested shapes still exist. `user_preferences` is folded into `profiles` (single-row-per-user tables joined on every request are pure overhead). `budgets` is intentionally absent — the allocation plan is the budget (Sections 5, 14).

### 12.1 `profiles`
**Purpose:** one row per user; identity, locale, payday rhythm, AI personality. Extends `auth.users` (Supabase-managed).

| Field | Type | Req | Notes |
|---|---|---|---|
| id | uuid PK | ✔ | = `auth.users.id` (FK, cascade) |
| display_name | text | ✔ | |
| currency | char(3) | ✔ | default `'PHP'`; multi-currency later |
| timezone | text | ✔ | default `'Asia/Manila'` |
| payday_rule | jsonb | ✔ | e.g. `{"kind":"semimonthly","days":[15,30]}` or `{"kind":"monthly","day":25}` — drives "days until payday" |
| ai_personality | text | ✔ | `gentle` \| `balanced` \| `savage`, default `balanced` |
| ai_reactions_enabled | bool | ✔ | default true — full opt-out exists |
| safe_to_spend_buffer | numeric(14,2) | ✔ | default 500.00 (Section 13.2) |
| privacy_blur_default | bool | ✔ | default false |
| onboarded_at | timestamptz | ✖ | null = show onboarding |

Validation: personality in enum; buffer ≥ 0. Index: PK only.

### 12.2 `accounts`
**Purpose:** every place money lives (or is owed, for credit cards).

| Field | Type | Req | Notes |
|---|---|---|---|
| id / user_id | uuid PK / FK | ✔ | |
| name | text | ✔ | "BPI Payroll", "GCash", "Wallet cash" |
| type | text | ✔ | `cash` \| `bank` \| `ewallet` \| `savings` \| `credit_card` |
| current_balance | numeric(14,2) | ✔ | For credit_card this is **amount owed** (≥ 0), not an asset. Maintained only by service layer. |
| credit_limit | numeric(14,2) | ✖ | credit_card only; enables utilization % |
| linked_debt_id | uuid FK→debts | ✖ | credit_card only — the card's debt record (see 12.6 note) |
| icon, color | text | ✖ | UI |
| sort_order | int | ✔ | default 0 |
| is_archived | bool | ✔ | default false |

Validation: `CHECK (current_balance >= 0 OR type <> 'credit_card')`; credit_limit only when type=credit_card. Indexes: `(user_id, is_archived)`.

### 12.3 `categories`
**Purpose:** classification for transactions and allocation items. 14 system defaults seeded per user at signup (so users can rename/archive freely without shared-row complexity).

| Field | Type | Req | Notes |
|---|---|---|---|
| id / user_id | uuid PK / FK | ✔ | |
| name | text | ✔ | |
| kind | text | ✔ | `expense` \| `income` |
| icon, color | text | ✖ | |
| is_essential | bool | ✔ | default per seed (Housing/Utilities/Food/Transpo/Health/Family/Debt = true) — feeds safe-to-spend and suggested allocation |
| is_archived | bool | ✔ | |
| sort_order | int | ✔ | |

Validation: unique `(user_id, kind, lower(name))`. Index: `(user_id, kind, is_archived)`.

### 12.4 `transactions`
**Purpose:** the spine of the app — every money movement of any kind.

| Field | Type | Req | Notes |
|---|---|---|---|
| id / user_id | uuid PK / FK | ✔ | |
| type | text | ✔ | `income` \| `expense` \| `transfer` \| `debt_payment` \| `goal_contribution` \| `adjustment` |
| amount | numeric(14,2) | ✔ | `CHECK (amount > 0)` — direction comes from `type`, never sign |
| account_id | uuid FK→accounts | ✔ | source (expense/transfer/payment) or destination (income) |
| transfer_account_id | uuid FK→accounts | ✖ | required iff type=transfer; `CHECK (transfer_account_id <> account_id)` |
| category_id | uuid FK→categories | ✖ | required for income/expense; null for transfer (rule 12.20-E) |
| debt_id | uuid FK→debts | ✖ | required iff type=debt_payment |
| goal_id | uuid FK→goals | ✖ | required iff type=goal_contribution |
| bill_instance_id | uuid FK→bill_instances | ✖ | set when this payment settles a bill |
| allocation_item_id | uuid FK→allocation_items | ✖ | which envelope this spend draws from (auto-matched by category, user-overridable) |
| merchant | text | ✖ | "Grab", "Meralco" |
| note | text | ✖ | |
| occurred_on | date | ✔ | user-facing date (backdating allowed) |
| source | text | ✔ | `manual` \| `quick_add` \| `ai_chat` \| `recurring` \| `copy` |
| recurring_template_id | uuid FK | ✖ | provenance |

Validation: conditional-requirement CHECKs per type (as above). Indexes: `(user_id, occurred_on DESC)`, `(user_id, type, occurred_on DESC)`, `(user_id, category_id)`, partial on `debt_id`, `goal_id`, `bill_instance_id` where not null.
**Views:** `debt_payments` = transactions where type='debt_payment'; `goal_contributions` = type='goal_contribution'; `income_entries` = type='income'.

### 12.5 `recurring_templates`
**Purpose:** definitions that generate expected future transactions (salary, rent, subscriptions, installment charges).

| Field | Type | Req | Notes |
|---|---|---|---|
| id / user_id | uuid PK / FK | ✔ | |
| name | text | ✔ | "Salary", "Netflix" |
| kind | text | ✔ | `income` \| `expense` \| `transfer` \| `debt_payment` |
| amount | numeric(14,2) | ✔ | expected amount (editable at confirm time) |
| account_id / category_id / debt_id / goal_id | FKs | ✖ | same conditional rules as transactions |
| schedule | jsonb | ✔ | `{"freq":"monthly","day":30}` \| `{"freq":"semimonthly","days":[15,30]}` \| `{"freq":"weekly","weekday":5}` |
| next_due_on | date | ✔ | advanced by the materializer |
| end_on | date | ✖ | e.g., installment end; null = open-ended |
| remaining_count | int | ✖ | alternative to end_on for "6 payments left" |
| auto_post | bool | ✔ | default **false** — generates *expected* items requiring one-tap confirm; true auto-posts (for things like fixed rent) |
| is_active | bool | ✔ | |

Index: `(user_id, is_active, next_due_on)`. Validation: end_on/remaining_count not both set.

### 12.6 `debts`
**Purpose:** everything owed — formal and informal.

| Field | Type | Req | Notes |
|---|---|---|---|
| id / user_id | uuid PK / FK | ✔ | |
| name | text | ✔ | "BPI Amore card", "Utang kay Kuya" |
| lender | text | ✔ | institution or person's name |
| debt_type | text | ✔ | `credit_card` \| `personal_loan` \| `salary_loan` \| `bnpl` \| `installment` \| `borrowed_from_person` \| `informal` \| `other` |
| original_amount | numeric(14,2) | ✔ | > 0 |
| current_balance | numeric(14,2) | ✔ | `CHECK (current_balance >= 0)`; service-maintained cache (rule 12.20-A/B/C) |
| interest_rate_monthly | numeric(6,4) | ✖ | **nullable — informal debts have none.** Stored monthly (PH norm: cards quote ~3%/mo); annual shown as derived |
| min_payment | numeric(14,2) | ✖ | null for informal |
| payment_frequency | text | ✖ | `monthly` \| `semimonthly` \| `weekly` \| `one_time` \| `flexible` |
| due_day | int | ✖ | 1–31, null for flexible informal debts |
| start_date | date | ✔ | |
| expected_end_date | date | ✖ | |
| late_fee | numeric(14,2) | ✖ | flat penalty, for projection realism |
| status | text | ✔ | `active` \| `paid_off` \| `archived` |
| notes | text | ✖ | |

Indexes: `(user_id, status)`. Relationship: a `credit_card` **account** links here via `accounts.linked_debt_id` — the account tracks the running card balance for purchases (rule 12.20-F/G) and the debt record carries terms and payoff math. Card purchases increase both in one service call; **totals always read card debt from this one linked pair once** to prevent double counting.

### 12.7 `bills` (recurring obligations) and 12.8 `bill_instances`
**Purpose:** `bills` defines the obligation ("Meralco, ~₱2,500, due 18th"); `bill_instances` is each month's concrete occurrence with its own status and payments.

`bills`:

| Field | Type | Req | Notes |
|---|---|---|---|
| id / user_id | uuid PK / FK | ✔ | |
| name | text | ✔ | |
| expected_amount | numeric(14,2) | ✔ | variable bills get updated at instance level |
| category_id | uuid FK | ✔ | |
| debt_id | uuid FK | ✖ | set for loan/card payment bills — paying the bill pays the debt |
| default_account_id | uuid FK | ✖ | usual payment source |
| schedule | jsonb | ✔ | same format as 12.5 |
| next_due_on | date | ✔ | |
| is_active | bool | ✔ | |

`bill_instances`:

| Field | Type | Req | Notes |
|---|---|---|---|
| id / user_id / bill_id | uuid PK / FKs | ✔ | unique `(bill_id, due_on)` — makes lazy generation idempotent |
| due_on | date | ✔ | reschedulable (rescheduled_from keeps original) |
| amount_due | numeric(14,2) | ✔ | copied from bill, editable ("Meralco is ₱3,100 this month") |
| amount_paid | numeric(14,2) | ✔ | default 0; service-maintained from linked transactions |
| status | text | ✔ | stored: `open` \| `paid` \| `partial` \| `skipped` \| `rescheduled`. Display statuses `upcoming/due_soon/due_today/overdue` are **derived** from `due_on` vs today at read time — storing them means midnight-rollover bugs. |
| rescheduled_from | date | ✖ | |

Index: `(user_id, status, due_on)`.

### 12.9 `allocation_plans` and 12.10 `allocation_items`
**Purpose:** the salary plan — where each income lands before it's spent. Items are the envelopes; this doubles as the budget.

`allocation_plans`:

| Field | Type | Req | Notes |
|---|---|---|---|
| id / user_id | uuid PK / FK | ✔ | |
| source_transaction_id | uuid FK→transactions | ✖ | the salary income row it allocates |
| name | text | ✔ | "July 30 salary" |
| total_amount | numeric(14,2) | ✔ | = income amount |
| period_start / period_end | date | ✔ | this plan governs spending until next payday |
| is_template | bool | ✔ | templates are plans with no source transaction, reusable |
| status | text | ✔ | `draft` \| `active` \| `closed` |
| acknowledged_over_allocation | bool | ✔ | default false — the explicit override flag (rule 12.20-D) |

`allocation_items`:

| Field | Type | Req | Notes |
|---|---|---|---|
| id / user_id / plan_id | uuid PK / FKs | ✔ | plan_id cascade |
| label | text | ✔ | "Rent", "Food", "Extra to BPI card" |
| planned_amount | numeric(14,2) | ✔ | ≥ 0 |
| category_id | uuid FK | ✖ | links spending for plan-vs-actual matching |
| debt_id / goal_id / bill_id | uuid FKs | ✖ | targeted envelopes |
| is_essential | bool | ✔ | inherited from category, overridable |
| sort_order | int | ✔ | |

`spent_amount` is **derived** (sum of transactions matched via `allocation_item_id` or category within the plan period), not stored. Index: `(plan_id)`, `(user_id, category_id)`.

### 12.11 `goals`
**Purpose:** savings targets including emergency fund.

| Field | Type | Req | Notes |
|---|---|---|---|
| id / user_id | uuid PK / FK | ✔ | |
| name | text | ✔ | |
| goal_type | text | ✔ | `emergency_fund` \| `travel` \| `gadget` \| `home` \| `debt_payoff` \| `education` \| `investment` \| `custom` |
| target_amount | numeric(14,2) | ✔ | > 0 |
| target_date | date | ✖ | null = open-ended |
| saved_amount | numeric(14,2) | ✔ | cached, service-maintained, re-derivable from contributions |
| linked_account_id | uuid FK | ✖ | where the money physically sits (e.g., a savings account) |
| icon, color | text | ✖ | |
| status | text | ✔ | `active` \| `reached` \| `paused` \| `archived` |

Validation: withdrawals (negative contributions are modeled as transfer-out transactions with goal_id) may not push saved_amount < 0. Index: `(user_id, status)`.

### 12.12 `notifications`
**Purpose:** in-app alert inbox, generated by the rule engine.

| Field | Type | Req | Notes |
|---|---|---|---|
| id / user_id | uuid PK / FK | ✔ | |
| notif_type | text | ✔ | `bill_due` \| `bill_overdue` \| `low_balance` \| `overspend` \| `salary_received` \| `unallocated_salary` \| `savings_milestone` \| `debt_milestone` \| `subscription_renewal` |
| title / body | text | ✔ | plain language |
| severity | text | ✔ | `info` \| `warning` \| `critical` |
| entity | jsonb | ✖ | `{"bill_instance_id": "..."}` for deep links |
| dedupe_key | text | ✔ | unique `(user_id, dedupe_key)` — e.g. `bill_due:INSTANCEID:7d` so re-evaluation never duplicates |
| read_at / dismissed_at | timestamptz | ✖ | |

Index: `(user_id, created_at DESC) WHERE dismissed_at IS NULL`.

### 12.13 `ai_conversations` and 12.14 `ai_messages`
**Purpose:** chat history for the companion.

`ai_conversations`: id, user_id, title (auto from first message), created_at, last_message_at. Index `(user_id, last_message_at DESC)`.

`ai_messages`:

| Field | Type | Req | Notes |
|---|---|---|---|
| id / user_id / conversation_id | uuid PK / FKs | ✔ | |
| role | text | ✔ | `user` \| `assistant` |
| content | text | ✔ | length-capped (2,000 chars user input) |
| kind | text | ✔ | `chat` \| `parse_draft` \| `reaction` — reactions are logged here too so the chat screen shows them in-line |
| draft | jsonb | ✖ | the parsed transaction proposal; `draft_status`: `pending` \| `confirmed` \| `edited` \| `discarded` |
| tokens_in / tokens_out | int | ✖ | cost tracking |

### 12.15 `audit_logs`
**Purpose:** immutable trail of every financial mutation — debugging, trust, and the "deleted payment restored the balance" proof.

| Field | Type | Req | Notes |
|---|---|---|---|
| id / user_id | uuid PK / FK | ✔ | |
| action | text | ✔ | `create` \| `update` \| `delete` |
| entity_type / entity_id | text / uuid | ✔ | |
| before / after | jsonb | ✖ | snapshots |
| context | text | ✖ | service function name |

Insert-only (no UPDATE/DELETE policies at all — not even for the owner). Index: `(user_id, created_at DESC)`, `(entity_type, entity_id)`.

**Entity relationship summary:**

```
profiles 1─* accounts, categories, transactions, recurring_templates, debts,
             bills, allocation_plans, goals, notifications, ai_conversations, audit_logs
accounts(credit_card) 1─1 debts(credit_card)        [accounts.linked_debt_id]
bills 1─* bill_instances *─* transactions            [via transactions.bill_instance_id]
debts 1─* transactions(type=debt_payment)
goals 1─* transactions(type=goal_contribution)
allocation_plans 1─* allocation_items 1─* transactions [allocation_item_id]
recurring_templates 1─* transactions / bill materialization
ai_conversations 1─* ai_messages
```

### 12.20 Business Rules → Implementation

| # | Rule (from spec) | Implementation |
|---|---|---|
| A | Expense linked to a debt updates the balance | `recordDebtPayment()` service: transaction insert + `debts.current_balance −= amount` in one DB transaction. Payments never go through the plain-expense path. |
| B | Payment can't push a debt below zero | Service clamps: if amount > balance, offer "pay off (₱X)" or "record overpayment as credit"; DB `CHECK (current_balance >= 0)` as backstop. |
| C | Deleting a payment restores the balance | `deleteTransaction()` reverses all side effects it caused (debt +, account +, bill_instance amount_paid −, status recomputed) in one transaction; audit log records before/after. Same for edits: reverse old, apply new. |
| D | Allocation can't exceed income without a strong warning | UI shows live Over state (red, shaking total, explicit copy); save requires `acknowledged_over_allocation = true` checkbox; server rejects over-allocated plans without the flag. Never silently blocked, never silently allowed. |
| E | Transfers are not expenses | type=transfer has no category, excluded from all spending aggregates by every formula in Section 13 (they filter on type). |
| F | Card purchases increase card balance | Expense with account.type=credit_card: service increments card account balance AND linked debt balance together. |
| G | Card payments reduce card balance | debt_payment to the linked debt decrements both, funded from a real-money account. |
| H | Savings transfers aren't spending by default | goal_contribution is its own type — excluded from "money out" unless the user recategorizes it as an expense. |
| I | Recurring → expected upcoming transactions | Lazy materializer (Section 9); auto_post=false items appear as "expected — confirm?" chips, one tap to post. |
| J | Editing history recalculates summaries | Because summaries are derived at read time (Section 9), edits are automatically reflected; the only caches (debt balance, goal saved) are adjusted by the edit service. A `rebuildCaches(userId)` repair function re-derives both from transaction history. |
| K | AI transactions confirmed before saving | `draft_status` flow in 12.14; there is no code path from the AI to the write services without a user confirmation event. |
| L | Decimal-safe money | `NUMERIC(14,2)` everywhere; app uses decimal.js; API transmits strings; ESLint rule bans arithmetic on money-typed fields outside `lib/money.ts`. |

---

## 13. Financial Calculation Logic

All formulas live in `/modules/finance/engine.ts` as pure, unit-tested functions. Each is stated in plain language first, then as a formula. **None of these run inside AI prompts** — the AI only receives their outputs.

### 13.1 Available Cash
*Plain language:* money you could actually touch right now — everything in cash, bank, and e-wallet accounts. Savings accounts are shown separately by default so goal money doesn't look spendable; credit cards never count (they're debt, not money).

```
available_cash = Σ balance of accounts where type ∈ {cash, bank, ewallet} and not archived
spendable_display = available_cash          (savings shown as its own line)
```

### 13.2 Safe-to-Spend
*Plain language:* what's left after you set aside everything that must leave your hands before the next salary — unpaid bills due before payday, remaining essential envelope money, and a small cushion. This is the hero number and the most dangerous one to get wrong: it must **understate, never overstate**.

```
obligations_before_payday = Σ (amount_due − amount_paid) of open/partial bill_instances
                              with due_on < next_payday
                          + Σ min_payment of active debts due before next_payday
                              and not already covered by a bill_instance above
essential_remaining       = Σ max(0, planned − spent) over active plan items where is_essential
buffer                    = profiles.safe_to_spend_buffer   (default ₱500)

safe_to_spend = available_cash − obligations_before_payday − essential_remaining − buffer
```

Display: if ≤ 0, show ₱0 with the shortfall explained ("You're ₱1,200 short of covering bills before payday — here's what's due"), never a negative "safe" number. Each subtraction is tappable so the math is inspectable — trust comes from visible arithmetic.

### 13.3 Remaining Salary Allocation
```
allocated_total  = Σ planned_amount of items in the active plan
unallocated      = plan.total_amount − allocated_total
status           = unallocated > 0 → UNDER  |  = 0 → EXACT  |  < 0 → OVER (warning state)
```

### 13.4 Monthly Cash Flow
*Plain language:* money in minus money out for a calendar month. Transfers and goal contributions are excluded from both sides (they're movements, not flow); debt payments count as money out (they truly leave you).

```
cash_flow(month) = Σ income − ( Σ expense + Σ debt_payment )      [transactions in month]
```

### 13.5 Debt Balance & Progress
```
total_debt        = Σ current_balance of active debts        (card debt counted once, via the linked pair)
monthly_debt_load = Σ min_payment (or scheduled installment) of active debts
progress(debt)    = 1 − current_balance / original_amount
utilization(card) = card_balance / credit_limit               (shown per card and overall)
```

### 13.6 Debt Payoff Projection (single debt)
*Plain language:* simulate month by month: add interest (if any), subtract the planned payment, count months until zero. Informal debts skip the interest step entirely.

```
simulate(debt, monthly_payment):
  balance = current_balance; months = 0; total_interest = 0
  while balance > 0 and months < 600:
    interest = balance × (interest_rate_monthly or 0)
    total_interest += interest
    balance = balance + interest − monthly_payment
    months += 1
  if payment ≤ average interest → return NEVER (surface as a warning, not an error)
  return { months, debt_free_date, total_interest }
```

### 13.7 Debt Snowball vs Avalanche
*Plain language:* both strategies pay minimums on everything; the extra money goes to one target debt. **Snowball** targets the smallest balance (motivation: quick wins). **Avalanche** targets the highest interest (math: least total interest). When a debt dies, its payment "rolls" into the next target.

```
simulate_strategy(debts, extra_budget, order_fn):
  order = order_fn(debts)         # snowball: balance asc, no-interest ties last
                                  # avalanche: interest desc, no-interest debts last (0%)
  each month: accrue interest → pay minimums → pour extra + freed-up minimums into order[0]
              → retire finished debts, advance target
  return { debt_free_date, total_interest, per-debt payoff timeline }
```

The app runs both and shows them side by side: "Avalanche saves you ₱4,310 in interest; Snowball clears your first debt 3 months sooner." The user picks; the choice just re-sorts suggested payments — it's advisory, never automatic. Informal zero-interest debts get a nudge: "No interest here — mathematically last, but relationships aren't math. Pay Kuya when it matters."

### 13.8 Savings & Goal Progress
```
progress          = saved_amount / target_amount
months_remaining  = months between today and target_date
required_monthly  = max(0, (target_amount − saved_amount) / months_remaining)
on_track          = saved_amount ≥ target_amount × elapsed_fraction   → ahead/on-track/behind badge
withdrawal_effect = recompute required_monthly with the withdrawal applied; show delta
                    ("Taking ₱3,000 out means saving ₱750 more per month to still make June.")
```
No fake probabilities — a deterministic badge plus the required-monthly delta is honest and actionable.

### 13.9 Financial Health Score (simplified, transparent)
*Plain language:* a 0–100 monthly pulse from three visible components. Every point is explainable on tap; the breakdown is always shown with it. This is a **compass, not a grade** — copy never scolds.

```
bills_on_time   (0–40): 40 × (instances paid on-or-before due / instances due this month)   (no bills due → full marks)
debt_pressure   (0–30): 30 × clamp(1 − monthly_debt_load / monthly_income, 0..1)
                        (debt payments eat <10% of income → ~27+; >50% → single digits)
saving_habit    (0–30): 30 × clamp(savings_rate / 0.20, 0..1)
                        where savings_rate = (goal_contributions + net savings inflow) / income
health_score    = round(bills_on_time + debt_pressure + saving_habit)
```

### 13.10 Budget (Plan) Variance
```
variance(item)   = spent − planned        (positive = overspent)
variance_pct     = spent / planned − 1    ("18% more on food than planned")
plan_variance    = Σ over items; dashboard surfaces the top 2 worst offenders only
```

### 13.11 Upcoming Obligations (7/15/30-day strips)
```
upcoming(days) = Σ (amount_due − amount_paid) of open/partial instances with due_on ≤ today + days
overdue        = same with due_on < today  (always shown first, always red)
```

### 13.12 Daily Spending Allowance
```
daily_allowance = safe_to_spend / max(1, days_until_next_payday)
```
Recomputed every day — spend nothing today and tomorrow's allowance rises. Shown as "₱610/day until Aug 15."

### 13.13 Remaining Discretionary Budget
```
discretionary_remaining = Σ max(0, planned − spent) over active plan items where NOT is_essential
```
This is the "how much can I blow this weekend" number the AI quotes for affordability questions.

---

## 14. Salary Allocation Logic

**The model: one plan per salary event, items as envelopes, the plan IS the budget.**

**Flow:**

1. Income of a type flagged as salary (or any income the user chooses) triggers "Plan this money?"
2. Planner opens pre-filled from: the user's default **template** if one exists, else the **suggested plan** (below), else blank.
3. User adjusts via amount steppers or percentage mode (percentages are display sugar — stored values are always amounts, recomputed from % of total when in % mode; rounding remainder goes to the last-touched item so the sum stays exact).
4. Live status bar: **Under** ("₱2,300 not yet assigned — park it in savings or leave it free"), **Exact** (satisfying full-bar state), **Over** (blocking warning: "You're assigning ₱1,500 you don't have. Fix the plan or tick 'I know — expecting other money'"). Server enforces the same rule (12.20-D).
5. Save → plan becomes `active` for the period; the previous plan closes; dashboard progress bars now track spend per envelope.

**Suggested allocation (deterministic priority waterfall):**

```
input: income_amount, unpaid bills, debts, active goals, category history (last 2 cycles)
pool = income_amount
1. Overdue bill instances                     → fund fully (or flag impossible)
2. Bills due before next payday               → fund fully
3. Minimum debt payments due this period      → fund fully
4. Essential category envelopes               → median actual spend of last 2 cycles
                                                (no history → seeded PH-sensible defaults, editable)
5. Emergency fund                             → 10% of income (capped so pool stays ≥ 0)
6. Other goals                                → required_monthly per goal, pro-rated if short
7. Discretionary ("Fun money")                → whatever remains
if pool went negative at any step → stop, show exactly which step broke and by how much
```

Every suggested line is editable; the suggestion explains itself ("Food ₱6,000 — your usual"). If the waterfall can't clear step 1–3, the app says so plainly and offers the shortfall scenario tool.

**Scenario tools (all pure functions over plan + debts, all non-destructive sandboxes):**

- *Extra payment:* "₱3,000 extra to BPI card" → re-run 13.6 → "debt-free 4 months sooner, ₱2,100 interest saved."
- *Lower salary:* re-run waterfall with the smaller amount → show which envelopes shrink or vanish, in reverse priority order.
- *What can I cut:* rank non-essential envelopes by size with recent examples ("Shopping ₱2,400 — mostly Shopee").
- *Which debt first:* the 13.7 side-by-side.
- *Weekend spend:* quote 13.13 minus planned near-term spending.

---

## 15. Debt Repayment Logic

**Recording payments.** A payment is `type=debt_payment` funded from a real account. Paths that converge on the same service: debt detail → "Add payment"; a due bill linked to the debt → "Pay"; NL chat ("paid 5000 toward BPI card") → confirm → same service. Partial payments update `amount_paid` and set instance status `partial`; the remainder stays visible.

**Balance integrity.** The debt's `current_balance` changes **only** through: payment (−), payment deletion/edit (reverse), card purchase on linked card (+), manual adjustment (audit-logged, requires a note). Rule 12.20-B clamps at zero with the "pay off exactly / record credit" choice.

**Interest handling — honest and minimal.** MVP does **not** try to replicate each bank's exact interest posting; that's unwinnable without statement data. Instead: projections (13.6/13.7) use the stated monthly rate as an estimate and are labeled "estimate — your statement is the source of truth." The user syncs reality monthly by editing the balance to match the statement ("statement sync" adjustment, one tap, audit-logged). This is the single most important honesty decision in the debt module — a tracker that pretends to know your exact card interest will drift and lose trust.

**Installments** are debts with `debt_type=installment`, no interest field (price is fixed), `remaining_count` on a linked recurring bill. "1,200 × 6" creates debt ₱7,200 + 6 scheduled instances; each payment decrements both money and count. Progress reads "2 of 6 paid."

**Informal debts** ("utang kay Kuya"): no rate, no due day required, `flexible` frequency. They appear in totals and the payoff list but never generate overdue nagging unless the user sets a promise date. The tone rules (Section 20) explicitly protect family-debt contexts.

**Debt-free date (headline number):** run 13.7 with the user's current strategy and current extra-payment level; display month-year ("Debt-free: March 2028") with the assumption line underneath ("assuming ₱4,500/month toward debts"). Recomputes on every payment — watching the date move closer is the retention loop.

---

## 16. Page and Navigation Structure

Your proposed 5-tab bottom nav is kept — it's already the right shape. One refinement: the center slot is the **Quick-Add button**, not a tab, because logging money is the most frequent action and deserves the thumb's best real estate.

```
Mobile bottom bar:   [ Home ]  [ Money ]  [ (+) ]  [ Debts ]  [ Chat ]
                                  │          │
                     "Money" = transactions + plan (two segments in one tab —
                     spending and the plan governing it belong together)
                     (+) = quick-add sheet: Expense | Income | Transfer | Pay debt
```

**Page hierarchy:**

```
/home                     Dashboard
/money                    Segmented: Transactions | Plan
  /money/plan/new         Allocation planner (also opened by salary prompt)
  /money/plan/scenarios   What-if tools
/debts                    Debt list + totals + debt-free date
  /debts/[id]             Detail: balance, history, projection, pay button
  /debts/simulator        Snowball vs avalanche
/chat                     AI companion (conversation list + thread)
/more                     Profile & everything secondary:
  /more/accounts          Accounts & balances
  /more/bills             Bills calendar + list
  /more/goals             Goals & savings
  /more/reports           The 8 reports
  /more/categories        Manage categories
  /more/notifications     Alert inbox (bell icon on Home also opens this)
  /more/settings          Profile, payday, AI personality, buffer, dark mode
  /more/export            CSV/JSON export
  /more/security          Password, sessions, delete account
```

Desktop: same pages, bottom bar becomes a left rail, dashboard becomes a 2–3 column grid, quick-add becomes a persistent top-bar button + `N` keyboard shortcut. No desktop-only features — one mental model.

---

## 17. Detailed User Journeys

**J1 — First run (target: under 5 minutes to a live dashboard).**
Sign up → 4-step onboarding, each skippable: (1) "When do you get paid?" chips: 15th & 30th / end of month / custom → (2) "Where's your money?" add 1–3 accounts with rough balances — copy says *estimates are fine* → (3) "Owe anything?" add debts now or a "later" card → (4) pick AI personality with a live sample line for each of the three levels. Land on dashboard already showing real numbers; empty slots use playful empty states that are actually CTAs.

**J2 — Daily expense (the retention loop).**
FAB → keypad "180" → tap Food (grid is ranked by personal frequency) → account already on last-used → Save. Toast + reaction line ("Coffee again. Bold choice for someone with a Shopee installment."). Dashboard numbers visibly tick down. Total: ~4 seconds, 3 taps.

**J3 — Payday ritual.**
Salary notification ("₱25,000 landed. Plan it before it plans itself.") → planner pre-filled from template → user bumps Food +500, adds "extra ₱2,000 to card" → status: Exact → Save → dashboard flips: fresh envelopes, new safe-to-spend, "Next 15 days: 4 bills, ₱9,800."

**J4 — Overspend moment.**
Food envelope hits 105% mid-cycle → warning notification + amber envelope bar → user opens Chat: "what can I cut?" → assistant lists the 3 biggest remaining non-essential envelopes with concrete recent purchases, deadpan but kind → user moves ₱800 from Shopping to Food in the planner (rebalancing between envelopes is 2 taps and not shameful — plans are living documents).

**J5 — New installment via chat.**
"new shopee installment 1200 monthly for 6 months" → confirm card: debt ₱7,200 + 6 monthly bills of ₱1,200 starting Aug 30 → Confirm → reaction: "Another installment? Your future salary has officially been booked before it even arrived." → Debts tab now shows it with a 0/6 progress track.

**J6 — Paying off a debt (the payoff moment).**
Final payment → clamp flow offers "Pay off exactly ₱1,850" → confirm → full-screen celebration state (confetti, restrained), debt moves to a "Paid off 🏁" section that is **never deleted** — the trophy shelf — and the debt-free date recalculates for the rest.

**J7 — Month-end review.**
Notification on the 1st: "July's story is ready." → /more/reports month view: cash flow, top variances, debt progress delta, health score with breakdown → one screen, 60 seconds, ends with one suggested tweak to next cycle's template ("Food ran over twice — raise the envelope to ₱6,500?" — one tap applies it).

---

## 18. Suggested Wireframes (text)

**Home / Dashboard (mobile):**

```
┌────────────────────────────────────┐
│ Hi Dafhnee 👋                 🔔 ● │
│                                    │
│ SAFE TO SPEND                      │
│ ₱ 5,240        [tap: see the math] │
│ ₱610/day until Aug 15              │
│                                    │
│ ┌────────────┐  ┌────────────────┐ │
│ │ Cash & bank│  │ You owe        │ │
│ │ ₱ 18,320   │  │ ₱ 46,900  ▼2% │ │
│ └────────────┘  └────────────────┘ │
│                                    │
│ DUE SOON                    see all│
│ ⚡ Meralco    ₱2,500   in 3 days   │
│ 💳 BPI card   ₱3,200   in 5 days   │
│ ▸ next 15 days: ₱9,800 total       │
│                                    │
│ THIS CYCLE'S PLAN           73% ── │
│ Food      ████████░░  ₱4.2k/₱6k    │
│ Transpo   ██████░░░░  ₱1.5k/₱2.5k  │
│ Fun       ████████▓▓  over by ₱300 │
│                                    │
│ "You spent 18% more on food than   │
│  planned. The meal plan was more   │
│  of a creative suggestion."        │
│                                    │
│ [Home] [Money]  (+)  [Debts] [Chat]│
└────────────────────────────────────┘
```
One hero number, two summary cards, one list, one progress cluster, one line of commentary. No charts on Home at all.

**Quick-Add Sheet:** slides from bottom; segmented Expense/Income/Transfer/Pay-debt; giant amount display with custom keypad; 2×4 category icon grid (frequency-ranked, "more" expands); account chips; collapsed-by-default note/date row; full-width Save. Landing keyboard-first: the keypad is live the instant the sheet opens.

**Debts list:** total-owed header with debt-free date ("March 2028 at current pace"); cards per debt — name, lender icon, progress bar (paid portion filled), balance big, "min ₱1,200 · due 15th" small; informal debts show a person avatar instead of a bank icon; footer button "Compare payoff strategies."

**Debt detail:** balance hero + progress ring; Pay button; projection strip ("6 payments left → done Jan 2027, ~₱780 interest to go — estimate"); payment history list; edit/statement-sync in overflow menu.

**Allocation planner:** income amount pinned top; envelope rows (icon, label, stepper, mini progress showing last cycle's actual as a ghost bar for reference); sticky bottom status bar — green "₱0 left to assign ✓" / blue "₱2,300 unassigned" / red "₱1,500 over — fix or acknowledge"; "Use template ▾" and "Suggest for me" buttons top-right.

**Chat:** standard thread; assistant messages carry a small persona avatar; parse-drafts render as inline confirm cards (editable fields, Confirm/Discard); suggestion chips above the input: "Can I afford…", "What's due soon?", "Where did my money go?", "Plan my salary". Reactions from elsewhere in the app appear here in-line, so the thread reads as a running commentary on your financial life.

**Empty states (samples):** Transactions: "Nothing logged yet. Your money is currently a mystery novel. Add the first clue →". Debts: "No debts tracked. Either you're doing great or we're in denial together →". Goals: "Zero goals. Even 'survive until payday' counts →".

**Error / warning states:** over-allocation (red bar + checkbox override); payment > balance (choice dialog); AI parse failure ("Didn't catch that — logging it manually takes two taps →" with pre-filled quick-add); offline ("Can't reach your data. It's safe — retrying…" with cached read-only view).

**Loading:** skeleton cards mirroring the layout; numbers never "pop in" after content shifts (reserved space). **Confirmations:** destructive deletes always show consequences ("Deleting this payment puts ₱2,500 back on your BPI card balance. Delete anyway?" — rule C made visible).

---

## 19. UI Component Inventory

**Primitives (shadcn/Radix):** Button, Input, Sheet (bottom), Dialog, Tabs/Segmented, DropdownMenu, Toast, Switch, Checkbox, Badge, Skeleton, Progress, Avatar, Calendar/date picker.

**Finance components (custom, the real design system):**

| Component | Job |
|---|---|
| `MoneyText` | The only way money is rendered: ₱ format, size variants, semantic color + icon (not color alone), privacy-blur |
| `MoneyKeypad` | Custom numeric pad for quick-add (system keyboards are slow for money) |
| `StatCard` | Dashboard summary cards with label, hero MoneyText, trend chip |
| `SafeToSpendHero` | Hero number + daily allowance + "see the math" expandable breakdown |
| `EnvelopeBar` | Plan item progress: planned vs spent, ghost bar of last cycle, over-state styling |
| `AllocationStatusBar` | Sticky under/exact/over indicator with live totals |
| `DebtCard` / `DebtProgressRing` | List card and detail ring with paid-fraction fill |
| `DueChip` | "in 3 days" pill with severity color ramp (≥7d neutral → today amber → overdue red) |
| `BillRow` | Bill instance with status, partial-pay progress, Pay button |
| `GoalCard` | Target, saved, on-track badge, required-monthly line |
| `TransactionRow` | Icon, merchant/category, account, MoneyText, swipe actions (edit/delete/copy) |
| `ConfirmDraftCard` | AI parse result with editable fields, Confirm/Discard |
| `ReactionBubble` | Companion one-liners (toast-adjacent, dismissible, respects opt-out) |
| `HealthScoreDial` | Score + always-visible 3-part breakdown |
| `TrendChart` / `CategoryDonut` / `CashflowBars` | The only three chart types in the app (Recharts) |
| `EmptyState` | Illustration + playful copy + single CTA |
| `CelebrationOverlay` | Debt payoff / goal reached moment |

**Design tokens:** 16px base font floor (numbers 28–40px); 12–16px card radius; 4px spacing grid; light and dark themes from one token set; motion limited to 150–250ms ease transitions + the two celebration moments; color system = one calm brand hue + semantic set (green/amber/red used with icons and words, never alone). Palette direction: warm neutrals + one saturated accent — playful via copy and iconography, not neon.

---

## 20. Sarcastic AI Personality Guidelines

**Persona in one line:** your funniest friend who happens to be scarily good with money — roasts the *purchase*, backs *you*.

**Voice rules:**

1. Sarcasm targets **behavior and objects**, never identity. "That milk tea had main-character energy" ✔; anything implying *you are* bad with money ✘.
2. Every roast carries an implicit "and here's the way out" — the joke lands, then the useful fact: "…anyway, Fun money has ₱700 left."
3. Numbers quoted are always real (computed by the engine, injected into the line as variables).
4. Wins are celebrated *bigger* than losses are roasted — the emotional ledger of the app must run positive.
5. Reactions are frequency-capped: max ~1 sass line per 3 routine events; milestones always react. Repetition rule: a line used in the last 20 reactions of its trigger is ineligible (cooldown tracked per user).

**Personality dial:**

| | Gentle | Balanced | Savage |
|---|---|---|---|
| Overspend | "Food's a bit over plan — ₱1,500. Want to rebalance?" | "Food budget exceeded by ₱1,500. The meal plan was apparently a creative suggestion." | "₱1,500 over on food. The budget didn't fail you — it was never consulted." |
| New debt | "New installment added. I'll track the 6 payments for you." | "Another installment? Your future salary just got pre-booked." | "Installment #4. Your salary now arrives pre-spent. Efficient, honestly." |
| Debt paid | "Nice — ₱2,500 down. Balance is now ₱8,700." | "Look at you making responsible decisions. Character development." | "A payment?? Who ARE you. (₱8,700 to go — keep it weird.)" |

**Hard safety lines (all modes, enforced by library curation AND runtime rules):**
Never mock: medical or emergency expenses, family support, tuition/education, funeral/etc. (categories `Health`, `Family`, `Emergency` are **reaction-blocked** — supportive-neutral lines only: "Family stuff. No jokes — logged and handled."). Never shame hardship, low income, or debt existence itself. Never encourage risky behavior (loans to invest, skipping payments, gambling). Never claim to be a licensed adviser — recurring soft framing: "financially practical, not financially licensed." Never comment on transaction *notes* content (private context the user didn't offer for commentary).

**Response library structure (`responseLibrary.ts`):**

```ts
{ trigger: 'overspend_category',           // 12 trigger types matching notification/event types
  conditions: { severity: 'mild' },         // optional matchers (magnitude bands, category class)
  variants: {
    gentle:   [ ...6+ template strings... ],
    balanced: [ ...8+ ... ],
    savage:   [ ...8+ ... ],
  } }
// templates use {amount}, {category}, {days_to_payday}, {remaining} variables
// selection = eligible variants (mode + conditions) minus cooldown list → seeded pick → render
```

Initial library: ~250 lines across 12 triggers × 3 modes. Writing these is a content task, not an engineering task — batch-draft with Claude, then **hand-curate every line** (curation is the safety mechanism).

---

## 21. AI Prompt Architecture

**Three prompt templates, versioned in code (`prompts.ts`), never concatenated with raw user text into instructions.**

**21.1 Parser (Haiku).** System: "Extract transaction intent from casual Filipino/English money talk. Today is {date}, currency PHP, user's categories: {list}, accounts: {list}, active debts: {names}. Return ONLY JSON per schema; set `confidence`; set `needs_clarification` if ambiguous." User content: the raw text, delimited as data. Output Zod schema: `intent` (expense | income | transfer | debt_payment | new_debt | new_installment | unknown), amount fields as **strings**, category/account/debt as *names matched from provided lists* (never invented ids — server resolves names → ids). Low confidence or `unknown` → app falls back to pre-filled manual form, never guesses silently.

**21.2 Q&A (Sonnet).** System: persona (Section 20 voice + safety lines) + mode + "You are given computed financial facts. You must not perform arithmetic beyond simple comparison; quote provided numbers. Label anything not in the facts as an assumption. You cannot execute actions; you may propose a draft the user confirms. You are not a licensed financial adviser." Facts block (data role): the **context snapshot** — a bounded JSON built per question type:

```
snapshot (always):    available_cash, safe_to_spend + its breakdown, days_to_payday,
                      total_debt, monthly_debt_load, active plan summary (items: planned/spent),
                      upcoming_30d bills (name, amount, due), goals (name, target, saved, on_track)
question-type extras: affordability → discretionary_remaining, daily_allowance
                      spending analysis → category totals this + last month (top 8)
                      debt strategy → per-debt terms + both 13.7 simulations, pre-run
capped:               ≤ ~3,000 tokens; never raw transaction rows; merchant names only in
                      spending-analysis mode and only top-N aggregates; never notes; never
                      other users' anything (impossible anyway — snapshot is built from
                      auth.uid()-scoped queries)
```

Last 6 chat turns included for continuity; older history summarized to one line or dropped.

**21.3 Reaction fallback (optional, off by default).** If the library has no eligible line, MVP behavior is *silence* (a missing joke is fine). A Haiku one-liner generator behind a flag exists for later, with the same safety system prompt.

**Injection defense in depth:** (1) user text is always data, never appended to system instructions; (2) guards.ts strips control/zero-width chars, caps length, and refuses inputs matching instruction-override patterns *inside parse drafts* (e.g., a "note" that says "ignore previous instructions" just becomes a literal note); (3) the model has no tools — the worst a successful injection can do is produce a weird draft the user sees and discards; (4) confirm-before-save covers the rest. This is why the no-tools architecture matters more than any prompt-hardening cleverness.

---

## 22. Privacy and Security Controls

| Concern | Control |
|---|---|
| Authentication | Supabase Auth: email/password (bcrypt server-side, breach-resistant defaults) + Google OAuth. Email verification on. Optional app-lock PIN/biometric via PWA later. |
| Sessions | Supabase JWT (short-lived access + rotating refresh), httpOnly cookies via `@supabase/ssr`. "Sign out everywhere" in /more/security. |
| User isolation | **RLS on every table, no exceptions**: `USING (user_id = auth.uid())` for select/insert/update/delete (audit_logs: insert-only). RLS is enabled before the first deploy, tested in CI (Section 24). The service-role key exists only in server env and is used only by service functions that still scope every query by the authenticated user's id. |
| Encryption | TLS everywhere (Vercel/Supabase default); Postgres encryption at rest (Supabase default). App-layer field encryption skipped for MVP — honest trade-off: it breaks server-side aggregation and RLS already provides the isolation the threat model needs. |
| Secrets | Vercel env vars: `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` server-only; only the anon key + URL are public. `.env` git-ignored; keys rotated if ever exposed. |
| API surface | Every route handler/server action: auth check → Zod parse → service call. No dynamic SQL; Supabase client parameterizes everything. |
| Rate limiting | AI routes: per-user daily caps (60 parse / 30 chat) + per-minute burst limit (Upstash). Auth endpoints rely on Supabase's built-in limits. |
| AI data minimization | Section 21: bounded snapshots, no raw rows, no notes, aggregates only. Anthropic API (not consumer products) does not train on API data by default; still, minimum-necessary is the design rule. |
| Cross-user AI leakage | Structurally impossible rather than policy-prevented: snapshots are built from `auth.uid()`-scoped queries in the request context; there is no code path that queries another user. |
| Prompt injection | Section 21 defense-in-depth: data-slot user text, no tools, confirm-before-save, guards. |
| Audit logging | Every financial mutation writes `audit_logs` (12.15) inside the same transaction. |
| Export | /more/export → server streams CSV per table + one JSON bundle. Your data is never hostage. |
| Deletion | Two-step (type-to-confirm + 7-day grace with cancel email). Cascade wipes all rows (FK cascade from profiles) + Supabase auth user. Export offered first. |
| Backups | Supabase automated daily backups (+ PITR on paid tier when real users exist). Restore procedure documented and rehearsed once before launch. |

---

## 23. Error and Edge-Case Handling

**Money edge cases:** backdated transactions (allowed; summaries derive correctly per 12.20-J); editing a salary that has an allocation plan (plan flags mismatch, prompts rebalance); deleting an account with history (blocked — archive instead; balances preserved); transfer to same account (blocked by CHECK); zero/negative amounts (blocked, `amount > 0`); very large amounts (soft warn > ₱1M "just checking — is this right?"); paying a bill from a credit card (allowed — becomes card debt, both effects applied); overlapping allocation plans (previous auto-closes); salary earlier/later than payday_rule (actual income dates always win; payday_rule is only a default horizon).

**Debt edge cases:** payment > balance (clamp choice, 12.20-B); interest-only or insufficient payment (projection returns NEVER → warning UI: "at ₱500/month this never ends — minimum to make progress is ~₱X"); statement drift (statement-sync adjustment, Section 15); debt with no due date (excluded from due strips, included in totals); paid-off debt receiving a payment (blocked with friendly copy).

**Recurring edge cases:** Feb 30 problem (day 29–31 → last day of month); user skips an instance (status `skipped`, excluded from overdue math); template amount changed (applies to future instances only); installment count exhausted (template deactivates, debt should be ~0 — if not, mismatch card prompts reconciliation).

**AI edge cases:** unparseable text (fallback to pre-filled manual form); multiple transactions in one message ("grab 350 and coffee 180" → two draft cards); ambiguous amount ("paid the electric bill" → parser sets needs_clarification, app asks "how much?"); Anthropic outage (chat degrades gracefully: "Brain's offline. Buttons still work." — quick-add unaffected because it never needed AI); rate-limit hit (clear message with reset time).

**Sync/infra:** double-tap save (idempotency via client-generated transaction UUID — insert is upsert-on-conflict-do-nothing); flaky network (optimistic update rolls back with retry toast); Supabase down (read-only cached shell + status message).

---

## 24. Testing Strategy

Priorities are ruthless: the finance engine and RLS get near-total coverage; UI gets happy-path E2E; everything else gets what's left.

1. **Engine unit tests (Vitest) — the big investment.** Every Section-13 function: table-driven cases + edge cases (zero balances, no-interest debts, NEVER projections, Feb 30, semi-monthly boundaries). **Property-based tests (fast-check)** for invariants: debt balance never negative; delete(payment) ∘ record(payment) = identity on all balances; allocation item sum classification matches status; snowball and avalanche always produce equal-or-later dates when extra budget decreases; cash_flow(month) = Σ parts. Target: 100% branch coverage on `engine.ts`, `allocation.ts`, `payoff.ts`.
2. **Service integration tests** against local Supabase (CLI `supabase start`): each service function's side-effect bundle commits atomically; forced mid-transaction failure leaves no partial state; audit rows written.
3. **RLS tests (non-negotiable, in CI):** SQL scripts create users A and B, insert as A, assert every table returns zero rows and rejects writes as B — including views and the audit log.
4. **AI eval set:** ~60 fixture phrases (English/Taglish/typos: "gcash 250 load", "sweldo na 25k", "binayaran ko na si kuya 2000") with expected parse JSON; run against Haiku in CI weekly and on prompt changes; alert if accuracy < 90%. Injection fixtures assert drafts stay inert.
5. **E2E (Playwright, mobile viewport):** signup→onboard→dashboard; quick-add; salary→allocate→over-allocation warning→fix→save; record debt payment→balance drops→delete→balance restored; chat parse→confirm→row exists.
6. **Manual pre-launch checklist:** Lighthouse mobile ≥ 90; dark mode sweep; color-blind sim on all semantic states; VoiceOver/TalkBack on quick-add; export/delete round-trip; restore-from-backup rehearsal.

---

## 25. Deployment Architecture

```
GitHub repo (main + PR branches)
  → Vercel: preview deploy per PR, production on main merge
  → CI (GitHub Actions): typecheck, lint (incl. money-math ESLint rule), Vitest,
    RLS tests + service tests against supabase-in-docker, Playwright on preview URL
Supabase: one project for prod, one free project for dev/preview
  Migrations: /supabase/migrations/*.sql via CLI — applied to dev automatically,
  to prod by explicit `supabase db push` step gated on CI green (never auto on merge)
Monitoring (MVP-appropriate): Vercel logs + Sentry free tier (frontend + API);
  a simple /api/health; Anthropic spend alert at $10/mo
Environments: local (supabase start + .env.local) → preview → prod
Cost at MVP scale: ~$0–5/month until Supabase Pro ($25) is warranted by real backups/users
```

Future native app slot-in: the service layer + engine are importable packages; a React Native client would talk to the same Supabase project and the same /api/ai routes — no backend changes.

---

## 26. Recommended MVP Development Phases

Your 6-phase plan is close; two resequencing changes and their reasons: **bills move up into Phase 2** (due-date awareness is core value, not polish, and debts depend on bill instances for minimum-payment tracking) and **a walking-skeleton step starts Phase 1** (deploy the empty authenticated shell to production on day one — deployment problems are cheapest when the app is trivial).

| Phase | Scope | Est. solo effort |
|---|---|---|
| **1 — Foundation & skeleton** | Repo, CI, Supabase project, migrations for profiles/accounts/categories, RLS + tests, auth flows, onboarding, app shell (nav, dark mode), empty dashboard deployed to prod | 1.5–2 wks |
| **2 — Money in/out + bills** | Transactions (all types incl. transfers), quick-add sheet, transaction list, recurring templates + lazy materializer, bills + instances + due strips, live dashboard numbers (13.1, 13.4, 13.11) | 2–3 wks |
| **3 — Salary planning** | Allocation plans/items/templates, planner UI, suggested-plan waterfall, over-allocation guard, safe-to-spend + daily allowance (13.2/13.12/13.13), plan-vs-actual bars | 2 wks |
| **4 — Debt management** | Debts CRUD (all 8 types), payment service + bill linkage, card account↔debt pairing, projections + snowball/avalanche simulator (13.6/13.7), debt-free date, statement sync | 2 wks |
| **5 — AI companion** | Response library + reaction engine, /api/ai/parse + confirm-draft flow, /api/ai/chat + context builder, personality settings, rate limits, eval set | 2 wks |
| **6 — Insights & polish** | 8 reports, notification rule engine + inbox, health score, celebrations/empty states, export, account deletion, accessibility + performance pass, security review checklist | 2 wks |

**~11–13 weeks part-time solo.** The app is your daily driver from the end of Phase 2 — use it while building 3–6; nothing validates a finance tracker like your own salary cycle.

## 27. Acceptance Criteria per Phase

**P1:** New user signs up, onboards, sees themed empty dashboard on the production URL. User B can read nothing of user A (CI-proven). CI green gates.
**P2:** Log an expense in ≤ 3 taps / ≤ 5 s; balances update instantly and correctly after income/expense/transfer (transfer changes no totals); recurring rent appears as an expected item on the right date; Meralco instance shows "due in 3 days" and flips overdue correctly at midnight Manila time; all engine tests pass.
**P3:** Salary → plan from template in < 2 min; over-allocating triggers the blocking warning and server rejects without the acknowledge flag; safe-to-spend visibly decomposes into its four parts and never overstates in test scenarios; envelope bars track spending live.
**P4:** Recording a ₱2,500 payment updates debt, account, and linked bill atomically; deleting it restores all three (property test + E2E); over-balance payment triggers clamp choice; snowball vs avalanche shows correct comparative dates/interest on fixture portfolios (hand-verified against a spreadsheet); informal no-interest debt fully usable.
**P5:** ≥ 90% on the parse eval set; every AI draft requires confirmation (no write path without it — code-reviewed + tested); injection fixtures produce inert drafts; reactions respect mode, blocked categories, cooldowns, and opt-out; rate limits enforce.
**P6:** All 8 reports match engine numbers exactly; notifications generate once per dedupe key; export re-imports cleanly into a spreadsheet; deletion wipes verifiably; Lighthouse mobile ≥ 90; dark mode complete.

---

## 28. Future Roadmap (post-MVP, in order of value)

1. **v1.1 — Scheduled notifications:** Vercel Cron + email digests ("3 bills due this week"); push via PWA.
2. **v1.2 — Library refresh + AI reaction fallback** behind a flag; monthly AI "financial recap" narrative.
3. **v1.3 — Receipt photo entry** (Claude vision → same draft-confirm flow).
4. **v2.0 — Native mobile app** (React Native/Expo, reusing engine + services).
5. **v2.1 — Shared households** (invite one partner; role model kept to owner/member).
6. **v2.2 — Multi-currency** (currency column already exists; add FX snapshot table + display conversion).
7. **v2.3 — Bank/e-wallet import**: start with CSV statement import (works today, zero API risk), graduate to open-finance APIs as the PH BSP framework matures.
8. **Ideas parked indefinitely:** investments, voice UI, gamified streaks (risk: turns money anxiety into engagement farming — needs careful thought before ever building).

---

## 29. Risks and Recommended Controls — including honest criticism of the concept

**R1 — The graveyard risk: manual entry fatigue (existential).** Every manual finance tracker dies the same death: week 3, entries stop. Your spec's mitigation (fast entry, NL chat) is right but insufficient alone. Controls: 3-tap quick-add as the sacred path; recurring auto-materialization so routine entries are one-tap confirms; *recovery UX* — after a gap, "3 quiet days — want to batch-add roughly what you spent?" with a lump "catch-up" entry (imperfect data beats abandoned app); the app must stay useful even with lazy logging (bills/debts/salary still work).

**R2 — Scope. Your spec is a v2 spec wearing an MVP costume.** Honestly: the full feature list is 4–6 months of solo work, and half the modules serve the other half's data. This blueprint's cuts (Section 5) are the control. The single most important discipline: **ship Phase 2 and live on it before touching Phase 4–5 design details.** If you build all six phases before first daily use, you will build the wrong Phase 3–6.

**R3 — Sarcasm is a loaded feature.** The same line that's funny after buying a gadget is cruel after a hospital bill. A finance app roasting a struggling user in a bad month can cause real harm and instant churn. Controls: category blocklist, magnitude awareness, wins-over-losses ratio, frequency caps, hand-curated library, prominent personality dial + full opt-out, and one more this blueprint adds: **hardship mode** — if overdue count ≥ 3 or safe-to-spend has been ₱0 for a full cycle, reactions automatically soften to supportive-practical regardless of dial setting. The user opted into Savage on a good day; the app should notice bad weeks.

**R4 — Trust in numbers.** One wrong balance and the app is deleted. Controls: pure tested engine, property-based invariants, visible math (every hero number decomposes on tap), statement-sync as an embraced feature rather than pretending perfect interest simulation, audit log, repair function.

**R5 — Safe-to-spend overstatement.** The formula's failure mode is telling you ₱5,000 is safe when a forgotten bill exists. Controls: conservative construction (buffer, essentials reserved), onboarding pushes bill setup, unknown-bill honesty ("based on the bills you've told me about").

**R6 — AI cost/abuse.** Controls: library-not-LLM reactions (eliminates ~90% of would-be calls), Haiku for parsing, caps, spend alert. Worst case at MVP usage: under $3/month.

**R7 — Sensitive-data breach.** Controls: Section 22 stack; the honest statement: Supabase+RLS+TLS is strong for a personal tool and early users; if this becomes a multi-thousand-user product, budget a real security review, secrets scanning, and dependency audit before scaling marketing.

**R8 — Solo-maintainer bus factor / burnout.** Controls: boring stack, one deployable, no triggers-magic, migrations in git, this document as the living spec.

**Concept criticisms worth stating plainly:** (1) The health score is the weakest feature in the spec — composite scores are astrology for money unless every point is explainable; it ships only in its transparent 3-factor form and would be the first thing cut under time pressure. (2) "Automatic payment priority" must never auto-move money or auto-mark payments — it only *suggests order*; anything more is a trust and correctness trap. (3) The AI chat will be asked things it must not answer ("should I take a loan to buy crypto?") — the refusal templates in the persona are as important as the jokes. (4) Percentage-based allocation + amount-based allocation + templates + suggestions + scenarios is four planning UIs for one job; MVP ships amounts + templates + one suggest button, and the scenario tools are chat-invoked rather than separate screens — fewer surfaces, same power.

---

## 30. Final Recommendation

**Architecture (one paragraph):** Build a single Next.js 15 + TypeScript application on Vercel with Supabase as the entire backend (Postgres + Auth + RLS + backups), a pure deterministic finance engine in `/modules/finance` as the only source of financial truth, a thin service layer as the only write path (one DB transaction + audit log per mutation), and the Anthropic API behind two server routes for exactly two jobs — parsing casual text into confirmable drafts (Haiku) and answering questions over pre-computed snapshots (Sonnet) — while all sarcastic reactions come from a curated local response library. No microservices, no ORM, no cron (lazy materialization), no bank integrations, no floats.

**Exact MVP feature list:** auth + onboarding; manual accounts (5 types); unified transactions with quick-add, copy, recurring, transfers; 14 seeded categories; bills with instances, 8 statuses, 7/15/30 strips; salary allocation plans with templates, suggest waterfall, over-allocation guard; safe-to-spend + daily allowance with visible math; debts (8 types incl. informal), payments with full side-effect integrity, snowball/avalanche, debt-free date, statement sync; goals with on-track badges; dashboard per Section 18; AI parse-with-confirm, Q&A, library reactions with 3 modes + hardship mode + opt-out; in-app notifications; 8 reports; export; deletion; dark mode; PWA shell.

**Build order:** exactly Section 26 — skeleton-first, bills early, live on it from Phase 2, AI second-to-last, polish last.

**Biggest risks (ranked):** entry fatigue (R1) > scope (R2) > number trust (R4) > sarcasm misfire (R3) > safe-to-spend overstatement (R5). Everything else is manageable noise.

**Postponed:** bank integrations, push/email/SMS, receipt OCR, shared budgets, multi-currency, voice, investments, drag-and-drop, probabilistic goal forecasts, LLM-generated reactions, native apps.

---

## 31. Handoff Brief (paste-ready for Claude Code or any dev agent)

> **Project:** "Piso" — mobile-first personal finance PWA for a Philippine user. Full blueprint in `BLUEPRINT.md` (this document) — it is the spec; follow its section numbers.
> **Stack:** Next.js 15 App Router + TypeScript strict + Tailwind + shadcn/ui; Supabase (Postgres, Auth, RLS) via `@supabase/ssr` + generated types; Zod everywhere; decimal.js-light for money (JSON money = strings; DB money = NUMERIC(14,2)); TanStack Query; Recharts; Vitest + fast-check + Playwright; deployed on Vercel, migrations via Supabase CLI in `/supabase/migrations`.
> **Architecture rules (non-negotiable):** (1) modular monolith — `/modules/finance` pure engine with zero I/O, service functions as the only write path, each service = one DB transaction + audit_log row; (2) RLS `user_id = auth.uid()` on every table from migration #1, tested in CI with a two-user fixture; (3) no business logic in DB triggers; (4) AI routes (`/api/ai/parse`, `/api/ai/chat`) are the only Anthropic touchpoints, server-side key, bounded context snapshots per Blueprint §21, no tools, every AI-proposed transaction requires user confirmation before any write; (5) no floating-point arithmetic on money — ESLint-enforced.
> **Schema:** implement Blueprint §12 verbatim (16 tables + 3 views); unified `transactions` table; `debts.interest_rate_monthly` nullable (informal debts); bill display statuses derived, not stored; over-allocation requires `acknowledged_over_allocation`.
> **Financial logic:** implement §13 formulas as pure functions with the stated property-based invariants; safe-to-spend must never overstate; payment delete/edit must fully reverse side effects (§12.20-C).
> **Build order:** §26 phases 1→6; acceptance criteria §27 gate each phase; deploy the authenticated empty shell to production in week 1.
> **UX:** §16 nav (5-slot bottom bar, center FAB quick-add), §18 wireframes, §19 components; quick-add expense ≤ 3 taps; plain language only (money in/out, safe to spend — no accounting jargon); dark+light from one token set.
> **AI personality:** §20 — library-based reactions (~250 curated lines, 12 triggers × gentle/balanced/savage), category blocklist (Health/Family/Emergency), cooldowns, hardship mode, full opt-out; Q&A persona per §21.2 with "not a licensed adviser" framing.
> **Definition of done for MVP:** all §27 criteria pass; Lighthouse mobile ≥ 90; RLS CI suite green; parse eval ≥ 90%; export and account-deletion round-trips verified.

---

*End of blueprint. Sections 1–11: product & system design · 12: schema & rules · 13–15: money logic · 16–19: UX · 20–21: AI · 22–25: security, testing, deployment · 26–28: plan & roadmap · 29–31: risks, recommendation, handoff.*
