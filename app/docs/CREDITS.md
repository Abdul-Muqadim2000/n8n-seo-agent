# Credits — what customers see and pay

Built 2026-10-19. Customers never see what their work costs Alaventra at the providers (Claude, DataForSEO). They see **credits**.
This file is the rule book: the customer-facing rules, the numbers, where each rule lives in the code, and what is still the owner's.

## 1. The rules

| Rule | Value (default) | Where it is set |
|---|---|---|
| A credit's list price | **$0.05** | /admin → Settings (`creditValueUsd`) |
| Markup on the provider cost | **3×** (the cost plus a 2× margin) | /admin → Settings (`markup`) |
| Credits a piece of work uses | `cost × 3 ÷ $0.05` = **60 credits per $1 of provider cost** | `shared/src/billing.ts` `creditRate` |
| A new company | **200 welcome credits**, valid 90 days; credits **enforced** | /admin → Settings |
| Packs (list price, no discount) | 500 = $25 · 2,000 = $100 · 5,000 = $250 · 20,000 = $1,000 | /admin → Settings (`creditPacks`, discount per pack) |
| A pack lasts | **12 months** | /admin → Settings (`packExpiryMonths`) |
| A plan's monthly credits | granted on the 1st; unused ones **roll over one month**, then expire | /admin → company → Plan (`planMonthlyCredits`); rollover in Settings |
| Refunds, corrections | never expire | — |
| Order credits are used in | **soonest-expiring first**, then oldest | `services/admin/credits.ts` `applyToLots` |

A discount on a pack lowers the margin below 3× for those credits (a 10% discount = 2.7×). The defaults have none.

### Two kinds of spending

- **Autopilot** — a website's schedules: the weekly site report, AI visibility, the daily AI pulse, AI growth, the backlink monitor,
  link building, the monthly technical audit, the blog posts of the content cadence. Each website shows its **forecast in credits a
  month** from its settings (`shared/src/autopilot.ts`, the same rows the settings card shows), and what it used this month.
- **On-demand** — analyses someone starts in the app, through the API / MCP, and keyword checks.

Every usage entry in the ledger records which it was (`ref.origin`), so the Credits page, the activity and the CSV split them.

### On-demand: quoted, held, charged

1. Before it starts, every analysis is **quoted** in whole credits: its estimate (the engine's own calibrated figure) × the rate,
   rounded up. The form shows it ("12 credits").
2. While it runs it **holds** its quote: a second analysis cannot spend the same credits.
3. When it settles it is **charged what it really used** (exactly 3× its provider cost) and **never more than its quote**. When it
   used more, the difference is ours (`ref.absorbed` on the entry, visible to the platform admin).
4. A run that **fails is not charged**; credits taken before it failed are given back once (`failed:<run id>`).

### The checks before on-demand work starts (402, credits only)

| Reason | When | Applies to |
|---|---|---|
| `on_demand_limit` | the company's own on-demand limit for the month would be passed | every company (its own spending control) |
| `balance` | the balance minus what running analyses hold cannot cover the quote | companies with credits enforced |
| `reserve` | it would use credits the schedules still need this month ("Keep credits for autopilot", on by default) | companies with credits enforced |

The schedules' need for the rest of the month = their monthly forecast × the share of the month left (capped by the autopilot limit).
A company held by its credits is not also held by the old dollar budget (`monthlyBudgetUsd` is now the platform admin's guard for
companies without credits, and its message names no amount). The platform's daily ceiling still applies to everyone.

### The guard (every 10 minutes, `services/billing.ts` `creditGuardTick`; `CREDIT_GUARD=false` stops it)

- grants each plan's credits once per calendar month (`plan:<org>:<YYYY-MM>`);
- empties expired lots into an `expire` entry (`expire:<lot id>`);
- **out of credits** (enforced, balance ≤ 0) or **autopilot limit reached** → pauses the company's schedules through the engine's
  Site Admin `pause` (every schedule skips a paused site) and marks the website `credits_paused_at`; when credits are added / the
  limit is raised / a new month starts → resumes them. A pause by a person is never undone by the guard, and a person's resume or
  pause clears the guard's mark;
- tells the owners and admins once per level, by e-mail: **low** (lasts under 7 days at the current burn), **critical** (under 3
  days), **empty**, **paused**, and **resumed**. Burn = the schedules' forecast ÷ 30 + the last 30 days' on-demand ÷ 30.

Debits arrive from the cost sync (every 10 minutes), so a balance can dip a little below zero before the schedules pause; the next
credits pay that debt first.

### Buying credits

There is no card payment yet. **Buy credits** on the Credits page sends a request for a pack (owner / admin; at most 3 waiting); the
platform admins get an e-mail; the Alaventra team sends the payment details and, once paid, confirms it in /admin → company, which adds
the pack (12 months), records the payment as revenue and **issues the invoice** (below). The customer can cancel a waiting request.

### Invoices and credit e-mails (`services/invoices.ts`, migration 0017)

- **Every grant that records a payment (`paidUsd > 0`) issues an invoice**, with or without a request, in the same transaction as its
  ledger entry: a paid grant never exists without its invoice. Numbered per calendar year with no gaps, `ALV-2026-0001`, allocated
  under a platform-wide lock (`invoices.year` + `seq`, unique). Everything printed (company name, billed-to addresses, the seller, the
  line) is copied onto the row, so the PDF reads the same after a rename or a settings change. The ledger entry carries
  `ref.invoice = { id, number }`.
- **The PDF** (pdf-lib, A4, standard Helvetica, the e-mail logo PNG): seller, billed to (company + its owners and admins), number,
  issue / payment date, one line (credits, unit price, amount), totals, "PAID", balance due $0.00. Characters Helvetica cannot draw
  (a name in Arabic script) print as "?"; the e-mail body carries the real name.
- **E-mails** (the account transport, `ACCOUNT_EMAILS`): a paid grant e-mails "Payment received: invoice …" with the PDF attached
  to every owner and admin (not those switched off by SCIM); a free grant, a refund or a correction up sends a short "credits added"
  note with the new balance; a correction down sends nothing. The admin dialog's **"E-mail the company"** tick (default on, off for
  adjustments) skips it; the invoice is issued either way. `ref.notified` records who got it, or why nobody did.
- The customer sees **Invoices** on the Credits page (any member; PDF download). The admin sees them on the company page, downloads
  them and **sends one again** to today's owners and admins.
- Seller details: `INVOICE_ISSUER_NAME` (default Alaventra), `INVOICE_ISSUER_ADDRESS` (lines separated by `|`), `INVOICE_TAX_ID`
  (empty = none printed, and the invoice says no tax was charged), `INVOICE_EMAIL` (empty = `SUPPORT_EMAIL`), `INVOICE_PREFIX` (ALV).
- Not covered: plan credits granted on the 1st (no payment is recorded with them, so no invoice and no e-mail), tax / VAT
  calculation, credit notes for a refunded payment.

### Companies that existed before credits (migration 0016, `alignExistingCompanies`)

On the first server start after the deploy, every company that existed before credits is brought onto them exactly as a company
signing up today is, once (`platform_settings.credits_aligned_at`):

- it gets the **welcome credits** (200, valid 90 days) — never twice (the same `signup:<company>` key a new company's grant uses),
  never for an agency's client workspace or a disabled company (as for new ones); credits it already had are kept and never expire;
- it is **enforced** — but only when it starts with credits (balance > 0 after its welcome credits). A company that would start at or
  below zero (heavy usage counted before) or a client workspace with no credits of its own is **left counted only**, so its schedules
  are not paused by surprise; each is named in the admin activity log ("credits.aligned") for the platform admin to top up and enforce;
- it follows the platform settings as they are: welcome credits 0 → none granted; new companies not enforced → nobody enforced.

`POST /api/admin/credits/align` runs the same pass again at any time (idempotent: nothing is granted or changed twice).

## 2. What the customer sees

- **Settings → Credits**: balance, available now, held, kept for autopilot, status and runway ("lasts about N days", "runs out on
  …"), this month autopilot vs on-demand, the forecast per website, usage by feature and by day, credit lots with their expiry,
  packs and requests, the company's limits, and the activity (filter, CSV).
- Every price on every form, card, settings breakdown, pipeline, ladder and run page is in credits.
- No dollar figure of provider cost, no Claude / DataForSEO split, no engine cost basis text reaches a customer screen, export,
  webhook, API / MCP answer or error message. Only the platform admin panel shows costs, revenue and margin.

## 3. API

| Endpoint | Who | What |
|---|---|---|
| `GET /api/orgs/:orgId/billing` | viewer + | `BillingOverview` |
| `GET /api/orgs/:orgId/billing/activity?origin=all\|autopilot\|on_demand\|account&cursor=` | viewer + | `CreditActivityPage` |
| `GET /api/orgs/:orgId/billing/activity.csv` | admin + | the same as CSV |
| `PUT /api/orgs/:orgId/billing/limits` | owner | `CreditLimits` |
| `POST /api/orgs/:orgId/billing/requests` `{ packId, note }` | admin + | a pack request |
| `DELETE /api/orgs/:orgId/billing/requests/:id` | admin + | cancel a waiting request |
| `GET /api/orgs/:orgId/costs` | viewer + | adds `creditRate` (credits per unit of the cost figures) |
| `PATCH /api/admin/companies/:id` `{ planMonthlyCredits }` | platform admin | the plan (a new plan's first month is granted at once) |
| `POST /api/admin/credits/align` · `POST /api/admin/credits/guard` | platform admin | bring companies not on credits onto them (idempotent) · run the guard now |
| `POST /api/admin/companies/:id/credits` `{ kind: 'grant', credits, paidUsd, expires: 'pack'\|'never'\|days, requestId? }` | platform admin | fulfils a request when `requestId` is given |
| `GET /api/admin/credit-requests?status=pending\|all`, `POST /api/admin/credit-requests/:id/cancel` | platform admin | the requests |
| `GET /api/orgs/:orgId/billing/invoices/:id/pdf` | viewer + | the company's own invoice as a PDF (list: `BillingOverview.invoices`) |
| `GET /api/admin/companies/:id/invoices` · `GET /api/admin/invoices/:id/pdf` · `POST /api/admin/invoices/:id/send` | platform admin | the invoices, a PDF, send one again |

## 4. Data (migrations 0015, 0016)

`credit_lots` (one per positive ledger entry: source, credits, remaining, expires_at), `credit_purchase_requests`,
`organizations.credit_limits / plan_monthly_credits / plan_granted_month / credit_alert_level / credit_alert_at`,
`sites.credits_paused_at / credits_paused_reason`, `runs.quoted_credits`, `platform_settings.credit_packs / pack_expiry_months /
plan_rollover / signup_expiry_days / credits_aligned_at` (0016: when the companies from before credits were brought onto them). The ledger (`credit_ledger`) stays the one record; the balance is its sum; per company,
balance = Σ lots' remaining − debt.

## 5. Open — the owner's

- **Card payments** (Stripe Checkout + auto top-up): the request flow is the stand-in. Auto top-up needs a card on file.
- ~~Plan prices~~ **decided 2026-10-19** (the owner): **Starter $39 / month = 780 credits**, **Growth $299 / month = 5,980 credits**,
  no annual discount (a credit is $0.05 however it is paid, so every plan credit is exactly 3× its provider cost). Sized from the measured
  autopilot (`autopilotRows`): Starter (1 website, tracking + monthly audit + 1 page a week) uses ≈ 231 a month, leaving ≈ 550 for
  analyses; Growth (3 websites with everything on, the 50-question panel and the daily pulse, 3 pages a week) uses ≈ 5,254, leaving
  ≈ 720. A bigger AI panel, more pages or more websites use extra credits (packs). The admin sets a company's plan credits in /admin →
  company → Plan (780 or 5,980). Still placeholders: the done-for-you service prices and some per-plan feature limits.
- **Pack discounts** (0% now — exactly 3×), welcome credits and their expiry, pack expiry.
- ~~Receipts / invoices~~ **built 2026-10-20** (section "Invoices and credit e-mails"). Still the owner's: the seller's legal name,
  address and tax / VAT number on the invoice (`INVOICE_*` in `app/.env`; until set it prints "Alaventra" with no address), and whether
  VAT must be charged (the invoice then needs a tax line).
