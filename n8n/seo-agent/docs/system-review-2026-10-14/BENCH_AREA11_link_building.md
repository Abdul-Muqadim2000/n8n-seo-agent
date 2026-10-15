# Benchmark area 11 — link building (getting links, not listing them)

**Written 2026-10-15** under `BENCHMARK_PROGRAM.md`. Score on the books: **6.5** (`../system-review-2026-10-13/SCORECARD.md`) —
given **before** L1–L7, R21 and R27 landed, so it is not a description of what the Link Builder does today. Frozen rubric:
`../system-review-2026-10-11/CRITERIA_technical_tracking_reporting_ai_links.md` §4C, criteria **4C.1–4C.9**. That file is
untouched.

Scope: **getting links** — opportunities, qualification, the pitch, the sequence, sending, replies, verification, impact, and the
law. Backlink *monitoring* is area 10 and was finished today; nothing here re-opens it.

> **Read the code, not the scorecard.** Everything in §3 was read in `v5/code/LB_Plan.js`, `LB_Page_Requests.js`,
> `LB_Assemble.js`, `LB_Rows.js`, `LB_Report.js`, `LB_Draft_QA.js`, `_outreach_kit.js`, `_draft_qa.js`, `_ab.js`, `_drafts.js`,
> `_listings.js`, `Reply_Result.js` and the generated Link Builder, and in `app/shared/src/outreach.ts`,
> `app/server/src/services/linkBuilder.ts`, `mail.ts`, `mailOauth.ts`, `outreachJobs.ts` and
> `app/web/src/pages/site/LinkBuildingPage.tsx`, as they stood this morning. The live evidence is `LINK_BUILDER_SPEC.md` §9
> (executions **299** cancelled at the one-hour limit and **303** complete, 2026-10-11) and exec **561** (2026-10-14,
> `RESULTS.md` §2.7). Every competitor claim carries a URL opened in this pass; the list is in §7.

---

## 1. The leader today — and the rubric names two tools, one of which no longer exists in that form

**The rubric names Pitchbox / Respona. Pitchbox is still the right comparison. Respona is not — it stopped being an outreach
tool.** Checking the leaders was not a formality here: of the eight names in `LINK_BUILDER_SPEC.md` §1's research, **one has
pivoted out of the category, one is dead, and one has withdrawn its documentation**.

| Tool | Status checked 2026-10-15 | Source opened |
|---|---|---|
| **Pitchbox** | **Alive, selling, and the only one in the set that still publishes its outreach mechanism in detail.** Pro $300/mo (annual $210), Advanced $600, Scale $1,200; 2,000 / 5,000 / 25,000 outreach e-mails a month; *"all plans require a commitment of one year, regardless of billing frequency"*; implementation add-on $2,000–$4,000 | [pitchbox.com/pricing](https://pitchbox.com/pricing/), [help.pitchbox.com](https://help.pitchbox.com/) |
| **Respona** | **Alive as a company, gone as an outreach tool.** It now sells *"done-for-you placements"* at a price per placement set by the host site's Ahrefs DR: **$100 (DR 20+) → $500 (DR 60+)**. Its own words: *"The biggest difference is that you are not using software to manage outreach yourself"*, *"the Respona team handles the actual outreach process for you."* Its help centre has **no articles at all** on mailboxes, sequences, deliverability or sending — only Orders, Placements, Billing, Settings, FAQ | [respona.com/pricing](https://respona.com/pricing/), [the process doc](https://help.respona.com/en/articles/13575093-our-link-building-process), [how it differs](https://help.respona.com/en/articles/5671057-how-is-respona-different-from-similar-platforms) |
| **Postaga** | **Dead.** `postaga.com`, `www.postaga.com` and `/pricing/` all answer **HTTP 404** with a WP Engine holding page: *"This domain is successfully pointed at WP Engine, but is not configured for an account on our platform"* | postaga.com (404) |
| **Semrush Link Building Tool** | **Documentation withdrawn.** `semrush.com/features/link-building/` **301s to `/features/backlink-analysis/`**; KB 737 and 738 (the outreach articles) both resolve to the generic `/kb/806-seo-toolkit`, which mentions outreach in one clause and lists only Backlinks Tool and Backlink Audit under link building. **No first-party description of its outreach mechanism could be found** | [kb/806](https://www.semrush.com/kb/806-seo-toolkit) |
| **BuzzStream** | Alive. Starter $49/mo … Custom from $999; its pricing page shows **two conflicting plan sets** and reconciles neither. Four of the help articles that matter (sequences, follow-ups, monitored links, unsubscribe) render client-side and returned only a title to both a fetch and raw `curl` — **not verified** | [buzzstream.com/plans-pricing](https://www.buzzstream.com/plans-pricing/) |
| **Hunter Campaigns** | Alive, $0 / $49 / $149 / $299 a month. **The deepest published deliverability stack in the set** (see §2), and the only one with a 2026 dataset behind its numbers | [hunter.io/pricing](https://hunter.io/pricing), [help.hunter.io send-emails](https://help.hunter.io/en/collections/2534613-send-emails) |
| **Muck Rack / Featured.com** | Both alive. Muck Rack is quote-only. Featured is $0 / $29 / $79 a month for access to journalist requests — the expert pays a **subscription**, not a fee per published answer | [muckrack.com/pricing](https://muckrack.com/pricing), [featured.com/pricing](https://featured.com/pricing) |

**Three corrections to the rubric's own evidence** (programme rule 1 — the old statement stays, the CRITERIA file is unchanged):

- **"Pitchbox × Backlinko, 12M e-mails: 8.5% reply rate" is a 2019 study.** The page says *"Last updated on Apr. 16, 2019."*
  It is still the most-cited number in link building, and **no 2025–2026 link-building-specific outreach study from Pitchbox or
  Respona could be found**. The page also contradicts itself twice (24.6% vs 32.7% for long subject lines; 8.2% vs 9.8% for
  social links). Keep using it, dated.
- **"Hunter 2026, 31M e-mails: 4.5%" holds, and the denominator is the whole story.** Three large recent datasets, all opened:
  Hunter **4.5%** (31M e-mails sent in 2025, per recipient), Saleshandy **4.5%** (30.3M e-mails, replies ÷ delivered), Smartlead
  **0.74%** (850M+ e-mails, **median across senders**, ≥500 e-mails each). Same industry, **6× apart**, because one is a mean per
  e-mail and one is a median per sender. Any reply-rate target that does not name its denominator means nothing — which is
  exactly what B11-1 below is about.
- **"No public study of win rates exists" — still true in October 2026, and now checked hard.** BuzzStream's 12,000-campaign
  study measured placement rates "on a representative subset" and **published them only inside chart images, never in text**.
  Ahrefs reports *"515 outreach emails", "17.55% reply rate", "5.75% conversion rate"* but **never defines "conversion"**.
  Authority Hacker's widely-quoted "292 e-mails per placed link" **does not appear on the page it is attributed to**. The
  "3.1% link placement rate, Pitchbox Data 2025" in circulation matches no Pitchbox publication. The only funnel with its
  arithmetic shown is Hunter's own: 1,000 prospects → ~50 replies → ~13 links, **1.3% prospect-to-backlink**, with no sample
  size disclosed. A product that measured its own placed-links-per-e-mail on real volume would be publishing a number the
  industry does not have.

---

## 2. What the leaders do, mechanism by mechanism

**Sequencing.** Pitchbox: up to 3 steps below Advanced, up to 10 above; gaps are **set by the user with no published default**;
*"Sending stops as soon as you receive a reply"*; it walks **one contact at a time**, *"cycles through your first, second, and
third attempts to the first contact in line"*, then moves to the next. Out-of-office handling is **not built in** — it is an
Automation Builder trigger on higher plans, assembled by the user, and *"each firing uses one action credit"*; **nothing parses a
return date**. Bounces stopping a sequence are not documented at all; the bounce article only locates the log. Hunter detects
auto-replies by scanning the *"first 500 characters"* for seven phrases, tags them, **excludes them from the reply rate** — and
then asks the user to choose *"Pause follow-ups"* or *"Resume follow-ups"*; **it does not reschedule to a return date either.**

**Deliverability — this is where the leaders are genuinely strong.** Pitchbox monitors every connected mailbox **continuously**:
*"all active email accounts are automatically monitored by MXRight"*, producing a health report over **DNS, SMTP, SPAM, DKIM and
SpamAssassin**, with a published pass mark (*"a score of B and higher"*) and remediation steps naming *"invalid or missing MX,
SPF, DKIM, or DMARC records"*. Hunter generates and verifies SPF/DMARC, runs a Domain Health Check, and ramps sending
**automatically** — *"Increase your daily sending limit progressively and automatically over time"*, 2–3/day in days 1–3 up to
the target, stepping up only when the previous day's limit was reached **and** the bounce rate stays under a safety threshold.
Pitchbox's ramp is the same shape but **manual** — a campaign the user builds. Both send from the customer's own mailbox.

**Open tracking is the clearest published split in the set.** Pitchbox **refuses**: *"we've made a deliberate decision not to
include open rate tracking in outreach campaigns"*, because pixels change how *"Gmail, Outlook, and Yahoo"* treat the message and
because *"These systems can sometimes trigger tracking pixels without the recipient actually opening the email."* BuzzStream
offers it with a warning. Hunter offers it, off by default, **with no deliverability warning at all** — while its own 2026 data
says *"open tracking off → 7.4% reply; on → 4.4%"*.

**Unsubscribe.** Pitchbox follows *"RFC 8058, the standard for one-click unsubscribe headers"* — but it is **opt-in per template**
and *"One-Click Unsubscribe is not mandatory for outreach."* Google requires one-click only of **bulk senders**, defined as *"any
email sender that sends close to 5,000 messages or more to personal Gmail accounts within a 24-hour period"* — and the status, once
earned, is **permanent**: *"Senders who meet the above criteria at least once are permanently considered bulk senders."* Of
**every** sender Google asks only *"Set up SPF **or** DKIM email authentication for your sending domains"*, valid forward and
reverse DNS, TLS, RFC 5322 and a spam rate *"below 0.3%"* (the page's own Spam rate section says **0.10%** is the target and 0.30%
the cliff). Gmail *"is ramping up its enforcement on non-compliant traffic"* from **November 2025**.

**Personalisation.** Pitchbox scrapes *"The specific page Pitchbox found for the opportunity"* by default and generates AI custom
fields on a bring-your-own-model basis (*"OpenAI and Anthropic," plus "Pitchbox AI"*; *"AI usage costs are billed by your AI
provider"*). Its only published quality gate is a **prompt-clarity score**, 0–100% — the article *"does not describe content
guardrails"* for the generated text. **Neither Pitchbox nor any other tool in the set picks your target page or your anchor
text**: Pitchbox's link-placement record stores *"the type of placement, the URL (if it's a link), any costs accrued, the overall
value, and notes"*, and anchor text is not a field in it.

**Reporting.** Pitchbox's Win Rate is *"opportunities that were marked as Won"* ÷ *"the number of opportunities that changed
Milestone within a given timeframe"* — a denominator that flatters the number against any per-e-mail rate. It re-checks won links
**monthly**, for the *"top 100 backlinks"*, reporting Not Linking / Follow / No Follow / 301 / 404 / 200 — so rel attributes are
checked, **anchor changes are not**. Its Client Report is white-label and exports to PDF and CSV, and contains Found /
Personalized / Emailed / Won plus charts — **and nothing about traffic or rankings**. No leader proves impact. Respona's
re-verification is the customer's job: *"If one of your delivered links is broken or no longer live, contact our support team"*,
with **no published guarantee of how long a placement stays live**.

**What they refuse.** Pitchbox refuses tracking pixels — and that is the whole list. Its Terms of Service is a **website** ToS
with **no clause** on unsolicited e-mail, CAN-SPAM, GDPR, purchased lists or link buying; its legal index has **no DPA, no
acceptable-use policy and no anti-spam policy**; its privacy policy says *"Pitchbox is not responsible for the privacy or
security practices of our customers."* **No postal-address footer, no "where we got your address" disclosure and no
consent-by-country gate is documented in any tool in this set.** Its AI Agents, meanwhile, send replies with no human in the loop
and will *"Negotiate pricing within your defined limits"* — the worked example is *"Do not agree to more than $150."*

**And the compliance question the rubric asks, answered against Google's own text** (spam policies, *"Last updated 2026-08-28"*).
Google's bullets include *"Using automated programs or services to create links to your site"* and *"Advertorials or native
advertising where payment is received for articles that include links that pass ranking credit, or links with optimized anchor
text in articles, guest posts, or press releases distributed on other sites."* The only exemption offered is the attribute:
*"It's not a violation of our policies to have such links as long as they are qualified with a rel="nofollow" or
rel="sponsored" attribute value."* **Respona's published mechanism — money per placement, scaled by the host's DR, for a guest
post the vendor writes carrying the customer's chosen anchor, exact match offered — is a textual match to that second bullet, and
Respona nowhere mentions `rel="sponsored"`, `rel="nofollow"` or disclosure.** Its only published defence is a quality filter:
*"We only place content on real sites with genuine traffic… No spammy networks, no PBNs."* Google's policy has no "real site"
exemption. **The defensible reading of the first bullet — that automating the *request* is not automating the *link*, because a
human editor decides — is the position our product is built on, and no vendor in this set makes that argument in writing.**

---

## 3. What we do, from the live evidence

| Surface | Evidence |
|---|---|
| Weekly Link Builder (Mon 11:00) + on demand | execs **299** (cancelled at the 1-hour limit by a per-link page walk) and **303** (complete), 2026-10-11, both free; exec **561** (2026-10-14, paid, 91 s, $0.047 Claude) |
| What 561 produced | 8 qualified (6 `ready`, 2 `needs_contact`), 23 `not_fit`, **9 drafts held** by the draft gate, a rendered PDF, 2 listings missing, 1 podcast show |
| What has never happened | **not one e-mail has been sent.** No mailbox is connected (O4); G16 — the first live send — is the owner's decision |

**At or above the leaders already** (read in the code, seen in the runs):

- **Nine opportunity sources, none load-bearing alone** (4C.1): journalist requests on Bluesky, journalist digests read from the
  customer's own mailbox, podcast shows, resource pages, dead links on list pages, our own 404s from the Wayback CDX,
  competitors' broken backlinks, their most-linked pages, and the listings checklist. The research's own cautionary tale —
  LinkHunter died from one Google change — is designed out.
- **A deterministic gate on every draft before a human sees it** (4C.4), which **no leader publishes**: `LB Draft QA` checks every
  claim against the business facts on file, refuses a bracket left to fill, requires the address to be on the prospect's own
  domain, requires three distinctive words really quoted from their page, allows exactly one link — our chosen page on the
  canonical host — and enforces length, one clear ask, the business name from the site model and a banned-words list. A draft
  that fails is **held** with its reasons and cannot be sent. Exec 561: **9 of 9 held**, with reasons like *"needs you: [Your
  name]"* and *"the first e-mail quotes nothing that is on their page"*. Pitchbox's only published gate scores the **prompt**.
- **We pick the target page and the anchor, and the leaders do not** (4C.8): topic match × position band × links needed, paced
  (≤ 4 pitches a month to a page under 20 referring domains, no page over 40% of the month), and the anchor asked for is the
  brand, the page's title or the URL — **never a keyword**, with brand-only forced where a page's links already carry > 15%
  keyword anchors. This is the single biggest capability gap in our favour.
- **Out-of-office reschedules itself to the return date** (4C.5). The spec's research named this as the leaders' weak spot and it
  still is: Pitchbox needs a user-built automation on a higher plan that burns an action credit; Hunter asks the user to press
  pause. We read the date and move the next step past it, with the app's own parser when the Reply Reader is off.
- **Impact with a control group** (4C.9) — t0 = our own first sighting, the site's other pages as control, reads at 6/10/16
  weeks, graded *likely helped* … *can't tell* and **never "caused"**. **No leader proves impact at all.** Pitchbox's client
  report has no traffic or ranking data in it.
- **Compliance built into the message** (4C.6): identity, a working opt-out, the GDPR Art. 14 source line for EU/UK recipients,
  a consent tick for Germany, Austria, Saudi Arabia and named people in the UAE, plain text, no tracking pixels, MX checked
  before the first send, one conversation per domain, ≤ 2 first e-mails per domain a week, 90 days' rest. **No tool in the set
  documents any of this.**

**What was wrong this morning** — four things, and three of them are the same mistake in different clothes: *a number or a record
that outlived the evidence for it*.

1. **A link won was proven once and never looked at again.** The Reply Reader fetches the page a reply names, finds the link, and
   the prospect becomes `won`. Nothing ever read that page again. The Backlink Monitor re-checks the **ledger**, and a page no
   crawler indexes — the normal case for a small site's first links — never enters the ledger, so **the link the customer worked
   hardest for was the one link nobody verified twice**, while "Links won" counted it for ever. Criterion 4C.7 is "confirmed live
   by our own check, **then monitored**"; about a third of monitored links are gone within a year.
2. **Every outreach rate was printed from whatever sample existed.** `kpisOf` divided by any non-zero denominator: a reply rate of
   **33.3%** off one reply in three, a **win rate** off a single contacted site, and a red warning badge reading **"50.0%
   bounced"** off one bounce in two e-mails — the badge fires above 2%, so the first bounce in a new account raises a
   deliverability alarm that cannot mean anything. All of it sat on the same screen as `subjectAbStats`, which **refuses to name
   a better subject under 30 first e-mails per style**. The discipline existed in one corner of the page and nowhere else. The
   bounce rate was also counted over **conversations**, not e-mails, which is not the denominator the 2% limit is defined on.
3. **The postal address went out on the first e-mail only.** `footerLines` gated it on `firstEmail`, and a server test asserted
   the absence, so **two of every three e-mails we would send carry no postal address**. CAN-SPAM's requirements are written per
   **message** — *"Your message must include your valid physical postal address"* — and *"Each separate email in violation of the
   CAN-SPAM Act is subject to penalties of up to $53,088."*
4. **SPF, DKIM and DMARC were a gate on the way in and nothing on the way out.** `dnsCheck` runs when a mailbox is connected,
   edited or manually tested; the result is stored on the row and **never read again, and never gates anything**. A DMARC record
   removed or a domain moved to another provider left the mailbox sending behind a green tick from months earlier. Pitchbox
   monitors exactly this continuously. INVARIANTS rule 2: *a read path that trusts storage is a gate that does not exist.*

Two smaller things, left as open rows: the **cost per link** that `LINK_BUILDER_SPEC.md` §3 promises is on the page is computed
**nowhere** (and the Link Builder's ledger settle has no measured figure, so half its inputs do not exist either — B11-5); and the
consent gate has **no sole-trader handling**, though the ICO states plainly that *"Sole traders and some partnerships are treated
as individuals"* under PECR (B11-6).

---

## 4. The gap

| # | What the leader does | What we did (before this pass) | Does it change the customer's outcome? | Criterion |
|---|---|---|---|---|
| 1 | Pitchbox re-checks won links **monthly**, top 100; Linkody (area 10's comparison) every 24 h | **Never.** A link won through outreach was verified once, at the reply | **Yes.** ~1 in 3 links is gone within a year, and the count said otherwise for ever | **4C.7** |
| 2 | Pitchbox monitors mailbox authentication **continuously** (MXRight: DNS, SMTP, SPAM, DKIM) | Once, at connect, and it gated nothing | **Yes.** Google asks SPF **or** DKIM of every sender and began enforcing in Nov 2025 | **4C.6** |
| 3 | Hunter excludes auto-replies from its rate and ramps on a bounce threshold; everyone publishes a denominator | Rates from any sample; bounce over conversations | **Yes.** "50% bounced" and "33% reply" are alarms and promises made of noise | **4C.5** |
| 4 | Nobody — no tool in the set has a postal-address footer at all | First e-mail only | **Yes**, and it is the one item with a published per-message penalty | 4C.6 |
| 5 | Hunter warms up **automatically** to a target, stepping only when bounces stay low | Fixed 5 / 10 / 30 by week, no bounce input | Mildly. Ours is simpler and safe; theirs adapts | 4C.5 |
| 6 | Pitchbox ESP matching: first e-mail from a mailbox on the recipient's own provider | Not done (one mailbox per company) | No — unmeasured even by them (*"better odds"*, no figure) | — |
| 7 | We pick the target page and the anchor, and pace them | **We do; they do not** | No — **ahead**, and it is the SEO half of the job | 4C.8 |
| 8 | A deterministic quality gate on the e-mail text | **We do; Pitchbox scores the prompt** | No — **ahead**. 9 of 9 drafts held on exec 561 | 4C.4 |
| 9 | Impact with a control group | **We do; nobody else does** | No — **ahead** | 4C.9 |
| 10 | Out-of-office pauses to a parsed return date | **We do; Pitchbox needs an automation credit, Hunter asks the user** | No — **ahead** | 4C.5 |
| 11 | Compliance in the message (identity, postal address, Art. 14 source line, consent by country) | **We do; no tool in the set documents any of it** | No — **ahead** | 4C.6 |
| 12 | Cost per link | Not published by Pitchbox either; **promised by our own spec and computed by nobody** | Mildly | — |

---

## 5. What to build

### (a) In reach now — **built in this pass** (build section 83, harness S93, app tests)

| Row | What | Size | State |
|---|---|---|---|
| **B11-2** | **A link won is read again, and a reading that failed is not a loss.** `LB Page Requests` queues every won link the ledger does **not** carry (12 a run, oldest reading first, a row that already missed once first, free GETs, never a page the Backlink Monitor already fetches); `LB Assemble` verifies with the same `LK.verify` and runs the state machine — found → `live`, miss count back to 0; missing or gone → a miss, **one** miss is `at_risk` and never a loss, **two in a row** are `lost`; blocked, JavaScript-only or a fetch error → `not_checked` **with the miss count untouched**. Only a proven loss takes the prospect off `won`, keeping the date it was won. The reading rides `checks_json`: **no new Data Table column, nothing to sync** | M | **done** |
| **B11-1** | **An outreach rate is measured or it is withheld.** `outreachRate()` with derived floors — bounce **50** (one bounce in 50 *is* 2%, the limit it is judged against, so below that the rate cannot land on its own threshold), reply **20** (the smallest list size the published data separates), win **25** with Hunter's 1.3% prospect-to-backlink funnel printed beside it. Under the floor the counts show with how many more are needed, and the percentage is `null`, so the existing tiles fall back to "–" by themselves. The bounce rate now counts **e-mails sent**, not conversations | S | **done** |
| **B11-3** | **The postal address rides every commercial message.** `footerLines` no longer gates it on the first e-mail; the Art. 14 source line stays first-contact-only, where the Article puts it (*"at the latest at the time of the first communication"*). Both tests that asserted the old behaviour were rewritten with the reason | XS | **done** |
| **B11-4** | **The authentication gate runs on the read path too.** `mailAuthGate` re-reads SPF/DKIM/DMARC when the stored reading is more than 7 days old, persists it, and **refuses to start a new conversation** from a domain publishing **neither SPF nor DKIM** — Google's own rule for every sender, and deliberately no wider: a weak SPF, a `p=none` DMARC or a missing DMARC are notes, never a refusal, and DKIM "unknown" alone never refuses because we find it by guessing selectors. **Follow-ups in open threads are never blocked.** The mailbox pauses with the reason, and the Link building page says the same thing before anyone approves a pitch | S | **done** |

Measured effect on exec 561's own screen: *"Reply rate **33.3%**"* and a red *"**50.0% bounced**"* become *"1 of 3 conversations
so far — too few to read a rate from (20 needed)"* and *"1 bounced of 2 sent"*; the weekly report gains *"Links you won — are they
still there? · Still live 1 · Gone once 1 · Not checked 1"* with *"an index that could not read the page proves nothing"* under it;
and the two follow-ups of every sequence gain the postal address they legally needed.

### (a) In reach now — **not built in this pass**

| Row | What | Size | Why not now |
|---|---|---|---|
| **B11-5** | **Cost per link, which the spec already promises is on the page.** It needs the Link Builder's ledger settle to report a measured DataForSEO figure (it passes `measured=''`, so it falls back to its $0.05 estimate) plus the Claude figure B-F1 now counts | S–M | It is the cost pipeline, which area 13 owns this week; doing it here would collide |
| **B11-6** | **Sole traders are treated as individuals under PECR** — the ICO says so plainly, and our consent gate has no notion of them, so a one-person consultancy in the UK is e-mailed as a corporate subscriber | S | A data question (how do we know?), not a code question; belongs with the site model |
| **B11-7** | **Bounce rate should feed the warm-up**, as Hunter's does: the ramp steps up only while bounces stay under the threshold. Ours ramps on the calendar alone | S | Needs B11-1's denominator to exist first, which it now does |

### (b) Needs money or an owner decision

| Row | What | Cost | Who decides |
|---|---|---|---|
| **G16** | **The first live send.** Everything above is machinery with nothing through it: no mailbox is connected, 9 drafts are held, and not one e-mail has ever been sent. Until then every rate in §5(a) is `unavailable` by construction | $0 in API spend; needs a mailbox with a postal address, and techand.ai's business profile so the held drafts can be edited | **Owner** (listed, not done, per the brief) |
| **B11-8** | **Saudi Arabia may need more than our consent tick.** PDPL Art. 25 requires *"the prior consent of the targeted recipient"*; **Art. 26 additionally requires marketing data to be "collected directly from the Data Subject"**, which a scraped address is not. And SDAIA has **draft amendments out for consultation 6 Oct – 5 Nov 2026** that would require controllers to retain evidence of consent | Legal review | **Owner** |
| **B11-9** | **The UAE default is stricter than anything that could be read.** No official English PDPL text is published on the government portal, and the best source opened (DLA Piper, Jan 2025) says there are *"no general laws in the UAE law covering electronic marketing"*. Our gate asks for a consent tick for named people anyway. Whether the Executive Regulations have been issued **could not be established** | Legal review | **Owner** |
| **B11-10** | **Microsoft 365 SMTP basic auth: the spec's December 2026 date is correct and now confirmed.** Microsoft's revised timeline (27 Jan 2026): unchanged until then, **disabled by default for existing tenants end of December 2026**, unavailable for new tenants after, final removal announced in H2 2027. The Azure OAuth app (`MS_OAUTH_*`) is the mitigation and is still unset | $0 | **Owner** (a diary date, not a decision) |

### (c) Deliberately not worth it

| What | Why not |
|---|---|
| **Pay-per-placement links, Respona's new business** | $100–$500 a placement for a vendor-written guest post carrying a customer-chosen, optionally exact-match anchor. Google's policy names *"Advertorials … where payment is received for articles that include links that pass ranking credit, or links with optimized anchor text in articles, guest posts"* and offers one exemption — `rel="sponsored"` — which removes the ranking value the money was for. We would be selling the customer a penalty risk |
| **An AI agent that answers replies and sends on its own** | Pitchbox's does, and will *"Negotiate pricing within your defined limits"*. Ours drafts, holds what fails its gate, and waits for a person — and journalists pick human pitches 1 in 3 against 1 in 10 for AI-written ones (Featured / Pangram, 1.39M pitches). Automating the yes is the one thing that turns outreach into spam |
| **Open and click tracking** | Pitchbox refuses it on deliverability grounds and Hunter's own 2026 data gives the number: **7.4% reply with tracking off, 4.4% with it on**. We send plain text with no pixel and no redirect, and we will keep doing so |
| **RFC 8058 one-click unsubscribe** | It binds **bulk senders** — *"close to 5,000 messages or more to personal Gmail accounts within a 24-hour period"* — and the status, once earned, is **permanent and has no expiry**. At ≤ 50 e-mails a day across all mailboxes we are two orders of magnitude below it, and a `mailto:` `List-Unsubscribe` (which we already send) is what Yahoo calls *"acceptable"*. Adding the POST route would buy nothing and the header we have already lands the opt-out in the poller |
| **A win-rate target** | Nobody has published one with a real sample (§1). Printing a target we cannot source would be the exact failure the programme warns against |

---

## 6. The single change that would most improve the customer's outcome

**Send the first e-mail.** Every mechanism in this area — the gate that held 9 of 9 drafts, the sequence, the consent rules, the
reply reader, the impact test with its control group, and the four fixes above — has never had one real message through it, so the
product's whole link-building half is machinery with the power off; and the second most valuable change is the one this pass made,
because the moment links do start arriving, a link won once was being counted for ever by a system that had read the page exactly
one time.

---

## 7. Sources opened in this pass

[pitchbox.com/pricing](https://pitchbox.com/pricing/) ·
[help.pitchbox.com 109 (sequence)](https://help.pitchbox.com/article/109-campaign-settings-templates-email-sequence) ·
[94 (sequence explained)](https://help.pitchbox.com/article/94-automated-outreach-sequence-explained) ·
[112 (schedule)](https://help.pitchbox.com/article/112-campaign-settings-outreach-schedule) ·
[274 (sending limit)](https://help.pitchbox.com/article/274-email-sending-limit) ·
[212 (warm-up)](https://help.pitchbox.com/article/212-warming-up-email-accounts-organically-in-pitchbox) ·
[246 (MXRight)](https://help.pitchbox.com/article/246-mxright) ·
[257 (open rates)](https://help.pitchbox.com/article/257-open-rates-vs-response-rates) ·
[235 (one-click unsubscribe)](https://help.pitchbox.com/article/235-one-click-unsubscribe) ·
[166 (bounces)](https://help.pitchbox.com/article/166-how-do-i-check-my-email-bounces-and-unsubscribes) ·
[29 (AI personalization)](https://help.pitchbox.com/article/29-ai-personalization) ·
[275 (AI agents)](https://help.pitchbox.com/article/275-ai-agents-in-pitchbox) ·
[31 (link placements)](https://help.pitchbox.com/article/31-how-do-i-add-a-link-placement-in-pitchbox) ·
[167 (win rate)](https://help.pitchbox.com/article/167-how-does-pitchbox-calculate-win-rate) ·
[34 (link monitoring)](https://help.pitchbox.com/article/34-what-is-link-monitoring) ·
[33 (monitoring codes)](https://help.pitchbox.com/article/33-link-monitoring-codes-and-errors) ·
[176 (client report)](https://help.pitchbox.com/article/176-client-report-in-pitchbox) ·
[pitchbox.com/terms](https://pitchbox.com/terms/) · [privacy](https://pitchbox.com/privacy-policy/) ·
[respona.com/pricing](https://respona.com/pricing/) ·
[help.respona.com (process)](https://help.respona.com/en/articles/13575093-our-link-building-process) ·
[(glossary)](https://help.respona.com/en/articles/13574029-glossary-dr-traffic-anchor-types-placements-pre-approval) ·
[(how it differs)](https://help.respona.com/en/articles/5671057-how-is-respona-different-from-similar-platforms) ·
[(lost link)](https://help.respona.com/en/articles/13576701-how-do-i-report-a-broken-or-lost-link) ·
[(refunds)](https://help.respona.com/en/articles/13575450-refund-policy) ·
[buzzstream.com/plans-pricing](https://www.buzzstream.com/plans-pricing/) ·
[(send schedules)](http://help.buzzstream.com/en/articles/4456804-how-send-schedules-work) ·
[(click tracking)](http://help.buzzstream.com/en/articles/4239555-can-using-click-tracking-impact-email-deliverability) ·
[(12,000 campaigns)](https://www.buzzstream.com/blog/buzzstream-data-the-outperforming-outreach-tactics-we-learned-from-analyzing-12000-campaigns/) ·
[hunter.io/pricing](https://hunter.io/pricing) ·
[(sequence sending)](https://help.hunter.io/en/articles/3811035-how-email-sequences-sending-works-in-hunter) ·
[(auto-reply detection)](https://help.hunter.io/en/articles/12783247-auto-reply-detection-for-replies-in-email-sequences) ·
[(mailbox permissions)](https://help.hunter.io/en/articles/8915546-understanding-the-permissions-needed-to-integrate-an-email-account-in-sequences) ·
[(progressive sending)](https://help.hunter.io/en/articles/13907400-progressive-sending-gradually-increase-sending-in-sequences) ·
[(tracking)](https://help.hunter.io/en/articles/8218065-tracking-open-or-link-click-rate-for-email-sequences) ·
[(unsubscriptions)](https://help.hunter.io/en/articles/8486539-manage-unsubscriptions-in-sequences) ·
[hunter.io/the-state-of-cold-email](https://hunter.io/the-state-of-cold-email) ·
[hunter.io link-building funnel](https://hunter.io/blog/link-building-outreach-guide/) ·
[semrush.com/kb/806](https://www.semrush.com/kb/806-seo-toolkit) ·
[muckrack.com/pricing](https://muckrack.com/pricing) · [featured.com/pricing](https://featured.com/pricing) ·
[Google spam policies](https://developers.google.com/search/docs/essentials/spam-policies) ·
[Google sender guidelines](https://support.google.com/a/answer/81126) ·
[Google sender FAQ](https://support.google.com/a/answer/14229414) ·
[Yahoo sender requirements](https://senders.yahooinc.com/best-practices/) ·
[Microsoft high-volume senders](https://techcommunity.microsoft.com/blog/microsoftdefenderforoffice365blog/strengthening-email-ecosystem-outlooks-new-requirements-for-highvolume-senders/4399730) ·
[Outlook.com postmaster policies](https://substrate.office.com/ip-domain-management-snds/Postmaster/Policies) ·
[M365 SMTP AUTH revised timeline](https://techcommunity.microsoft.com/blog/exchange/updated-exchange-online-smtp-auth-basic-authentication-deprecation-timeline/4489835) ·
[Gmail API scopes](https://developers.google.com/gmail/api/auth/scopes) ·
[Google restricted-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification) ·
[Gmail app passwords](https://support.google.com/mail/answer/185833) ·
[FTC CAN-SPAM guide](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business) ·
[FTC 2026 penalty freeze (govinfo)](https://www.govinfo.gov/content/pkg/FR-2026-09-15/html/2026-18853.htm) ·
[GDPR Art. 14](https://gdpr-info.eu/art-14-gdpr/) ·
[UWG § 7 (official English)](https://www.gesetze-im-internet.de/englisch_uwg/englisch_uwg.html) ·
[DLA Piper — Germany](https://www.dlapiperdataprotection.com/index.html?t=electronic-marketing&c=DE) ·
[DLA Piper — UAE](https://www.dlapiperdataprotection.com/index.html?t=electronic-marketing&c=AE) ·
[SDAIA PDPL (English PDF)](https://sdaia.gov.sa/en/SDAIA/about/Documents/Personal%20Data%20English%20V2-23April2023-%20Reviewed-.pdf) ·
[Clyde & Co — draft PDPL amendments, Oct 2026](https://www.clydeco.com/en/insights/2026/10/sdaia-publishes-draft-amendments-to-the-pdpl) ·
[ICO — electronic mail marketing](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/electronic-and-telephone-marketing/electronic-mail-marketing/) ·
[u.ae — data protection laws](https://u.ae/en/about-the-uae/digital-uae/data/data-protection-laws) ·
[Backlinko × Pitchbox (2019)](https://backlinko.com/email-outreach-study) ·
[Saleshandy statistics](https://www.saleshandy.com/blog/cold-email-statistics/) ·
[Belkins reply rates](https://belkins.io/blog/cold-email-response-rates) ·
[Smartlead benchmarks](https://www.smartlead.ai/benchmarks) ·
[Ahrefs link outreach](https://ahrefs.com/blog/link-outreach) ·
[Ahrefs link rot study](https://ahrefs.com/blog/link-rot-study) ·
[Linkody link-building statistics 2026](https://blog.linkody.com/seo/link-building-statistics-2026-2)

**Could not be opened:** `postaga.com` (404 — a finding, not a failure); Semrush's link-building feature page and KB 737/738
(redirected away); four BuzzStream help articles whose bodies render client-side and returned only a title to a fetch **and** to
raw `curl`; the UAE legislation portal (403 both ways, so **no first-hand UAE PDPL article text**); EUR-Lex (bot challenge — GDPR
Art. 14 was read from gdpr-info.eu's verbatim reproduction); eCFR 16 CFR 1.98 (bot wall — the $53,088 figure rests on the FTC's
own guide plus the Federal Register freeze notice, not on the CFR text); the TDRA Unsolicited Electronic Communications
Regulation (404); `learn.microsoft.com/.../high-volume-sender-requirements` (**the article does not exist**); and Backlinko's
"Study methods PDF", so the 12M-e-mail study's methodology is unread.

**Tooling note for anyone re-verifying:** a plain fetch of Google's spam-policies page silently truncates every quote at 125
characters. The verbatim bullets in §2 were obtained with `curl` and extracted from the `#link-spam` section directly.

**Could not be found:** any published link-building **win rate** (links placed ÷ e-mails sent) with a disclosed sample and
methodology, from any vendor, in any year.

---

## 8. Proposed register rows (for `FIX_PLAN.md` §3.14 — the orchestrator moves these; this file does not edit the register)

| ID | Title | Impact | Where | Fix | Status |
|---|---|---|---|---|---|
| B11-1 | **Every outreach rate was printed from whatever sample existed.** A reply rate of 33.3% off one reply in three, a win rate off one contacted site, and a red warning badge reading "50.0% bounced" off one bounce in two e-mails — the badge fires above 2%, so the first bounce in a new account raised a deliverability alarm that could not mean anything. All of it on the same screen as `subjectAbStats`, which refuses to name a better subject under 30 first e-mails per style: the discipline existed in one corner of the page and nowhere else. The bounce rate was also counted over conversations, not e-mails, which is not the denominator the 2% limit is defined on. Published reply rates differ by **6×** on denominator alone (Hunter 4.5% per e-mail, 31M; Smartlead 0.74% median per sender, 850M) | **High** (INVARIANTS rule 1; 4C.5) | `app/shared/src/outreach.ts`, `app/server/src/services/linkBuilder.ts`, `app/web/src/pages/site/LinkBuildingPage.tsx` | `outreachRate()` with derived floors — bounce **50** (one bounce in 50 *is* 2%, the limit it is judged against), reply **20** (the smallest list size the published data separates), win **25**, with Hunter's 1.3% prospect-to-backlink funnel printed beside it. Under the floor the percentage is `null` and the counts show with how many more are needed; the bounce rate counts e-mails sent | fixed 2026-10-15 (app, 5 new shared tests); not deployed |
| B11-2 | **A link won through outreach was proven once and never looked at again.** The Reply Reader fetched the page a reply named, found the link, set the prospect `won` — and nothing read that page again. A page no crawler indexes never enters `seo_backlinks`, so the Backlink Monitor's weekly re-check never reached it: the link the customer worked hardest for was the one link nobody verified twice, while "Links won" counted it for ever. Pitchbox re-checks the top 100 monthly; Respona asks the customer to notice; about a third of monitored links are gone within a year (Linkody, 865,000 links, June 2026) | **High** (4C.7, INVARIANTS rule 4) | `v5/code/LB_Page_Requests.js`, `LB_Assemble.js`, `LB_Report.js`; build §83 | `LB Page Requests` queues every won link the ledger does not carry (12 a run, oldest first, free GETs, never a page the monitor already fetches); `LB Assemble` verifies with `LK.verify` and runs the state machine — found → `live` and the miss count resets; missing/gone → a miss, **one** is `at_risk` and never a loss, **two in a row** are `lost`; blocked / JS-only / fetch error → `not_checked` with the miss count **untouched** (rule 3). Only a proven loss takes the prospect off `won`. The reading rides `checks_json`: no new column, nothing to sync. The report prints the four states apart, states the refusal rule, and puts the decay base rate beside a loss | fixed 2026-10-15 (build section 83, S93); not deployed |
| B11-3 | **The postal address went out on the first e-mail only**, so two of every three e-mails in a sequence would carry none — and a server test asserted that absence, so it was deliberate. CAN-SPAM's requirements are written per **message** ("Your message must include your valid physical postal address"), and "Each separate email in violation of the CAN-SPAM Act is subject to penalties of up to $53,088" (FTC; the figure is frozen for 2026 by the FTC notice of 15 Sept 2026) | Medium (4C.6) | `app/shared/src/outreach.ts` `footerLines` | the address rides every message; the GDPR Art. 14 source line stays first-contact-only, where Art. 14(3)(b) puts it. Both tests rewritten with the reason | fixed 2026-10-15 (app); not deployed |
| B11-4 | **SPF / DKIM / DMARC were a gate on the way in and nothing on the way out.** `dnsCheck` ran when a mailbox was connected, edited or manually tested; the answer was stored on the row, never read again, and **gated nothing at all** — a DMARC record removed or a domain moved left the mailbox sending behind a green tick from months earlier. Pitchbox monitors exactly this continuously ("all active email accounts are automatically monitored by MXRight"), and Google asks SPF **or** DKIM of *every* sender, with enforcement ramping from November 2025 | Medium (4C.6, INVARIANTS rule 2) | `app/server/src/services/mail.ts`, `outreachJobs.ts`, `linkBuilder.ts` | `mailAuthGate` re-reads the record when the stored one is over 7 days old and persists it; a From domain publishing **neither SPF nor DKIM** cannot START a conversation (follow-ups in open threads always go, and a weak SPF or missing DMARC is a note, never a refusal — DKIM is found by guessing selectors, so "unknown" alone proves nothing). The mailbox pauses with the reason; `canSend` says the same thing before anyone approves | fixed 2026-10-15 (app, 5 new server tests); not deployed |
| B11-5 | **Cost per link is promised by `LINK_BUILDER_SPEC.md` §3 and computed by nobody.** The Link Builder's ledger settle passes `measured=''`, so its DataForSEO figure is the $0.05 reservation rather than the cost of the tasks it sent (`RESULTS.md` §4 for exec 561) | Low | `build_monitors.py` §5 `L.run_ledger`, `LB_Assemble.js` | sum the `cost` of this site's own DFS tasks in `LB Assemble` and pass it as the settle's `measured` node; divide by links won over the period, refusing under a floor as B11-1 does | **open** (in reach, ~S — it is the cost pipeline area 13 owns this week) |
| B11-6 | **Sole traders are treated as individuals under PECR and our consent gate has no notion of them**, so a one-person UK consultancy is e-mailed as a corporate subscriber. The ICO: "Sole traders and some partnerships are treated as individuals" | Low (4C.6) | `app/shared/src/outreach.ts` `consentGate` | a data question before a code one — a signal in the site model for "this prospect is a person trading as a business"; until it exists, say so in the UI rather than implying the gate covers it | **open** (~S) |
| B11-7 | **The warm-up ramps on the calendar alone.** Hunter's steps up only when the previous day's limit was reached *and* the bounce rate stays under a safety threshold; ours is 5 / 10 / 30 by week whatever the bounces do | Low (4C.5) | `app/shared/src/outreach.ts` `warmupCap` | feed B11-1's bounce rate into the cap and hold the ramp while it is above the limit | **open** (~S, now unblocked) |
| B11-8 | **Saudi Arabia may need more than a consent tick.** PDPL Art. 25 requires "the prior consent of the targeted recipient"; **Art. 26 additionally requires marketing data to be "collected directly from the Data Subject"** — which a scraped address is not. SDAIA's draft amendments were out for consultation 6 Oct – 5 Nov 2026 and would require evidence of consent to be retained | Medium | consent defaults | legal review of whether a tick can cure a scraped address in KSA at all, or whether the country should be off by default | **owner decision** |
| B11-9 | **The UAE default is stricter than any text that could be read.** No official English PDPL text is published on the government portal (the legislation portal answers 403), and DLA Piper (Jan 2025) says there are "no general laws in the UAE law covering electronic marketing". Our gate asks for a consent tick for named people anyway. Whether the Executive Regulations have been issued **could not be established**: 2026 sources conflict and none cites a gazette reference | Low | consent defaults | keep the conservative default, record in the UI that it is ours and not a cited rule, and revisit when the Regulations are published | **owner decision** |
| B11-10 | **Microsoft 365 SMTP basic auth: the spec's "end of December 2026" is correct, and now confirmed first-hand.** Microsoft's revised timeline (27 Jan 2026): unchanged until then; **disabled by default for existing tenants end of December 2026**; unavailable for new tenants after; final removal announced in H2 2027. The Azure OAuth app (`MS_OAUTH_CLIENT_ID` / `_SECRET` / `_TENANT`) is the mitigation and is still unset in `app/.env` | Low | `app/.env` | a diary date: set the Azure app before December 2026, or Microsoft 365 app-password mailboxes stop | **owner decision** |
| G16 | **The first live send** — unchanged, and it is this area's binding constraint: no mailbox is connected, 9 drafts are held, and not one e-mail has ever been sent, so every rate above is `unavailable` by construction | **High** | owner | connect a mailbox with a postal address and fill techand.ai's business profile | **owner decision** (listed, not done) |
