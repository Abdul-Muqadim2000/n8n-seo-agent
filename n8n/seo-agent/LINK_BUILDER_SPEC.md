# Link Builder (v4.13, 2026-10-10) — getting links, not only listing them

Asked for (2026-10-10): "I think our product should add backlinks — searching backlinks, what's the use case? … do full research of
existing things and make the best backlink generator and tracker, using it in the SEO." No tool can place links on other people's sites
without spam (Google's link-spam policy names "automated programs or services to create links to your site"); what the leaders automate
is everything around the human yes: finding the right sites, the right person, the right page of ours, a personal pitch, sending it from
the customer's own mailbox, following up, reading the replies, and proving the link went live and what it did. v4.13 does all of that,
on top of the v4.10 Backlink Monitor (discovery, own link check) and the v4.12 AI Growth loop (pages AI cites).

## 1. Research (2026-10-10, five parallel studies; full notes with every source in the session log)

**Outreach platforms** (Pitchbox, BuzzStream, Respona, Postaga, Hunter Campaigns, lemlist, Instantly, Semrush Link Building Tool, Muck
Rack, Prowly, and the 2026 AI agents Outlink AI, MentionAgent, AutoBacklinks): the common pipeline is discover → qualify → contacts →
personalise → sequence from the user's mailbox → replies → verify → monitor → report. Their weak spots, which v4.13 targets:
out-of-office replies do not pause follow-ups (Hunter), links are re-checked monthly / fortnightly (Pitchbox top 100, BuzzStream) and
indexing rarely, AI e-mails "sound artificial", credits burn without a cost estimate (Respona), no history across campaigns, and reports
that do not prove value (only 40% of link builders say theirs do — Citation Labs 2025). One tool (LinkHunter) died from a single Google
change: discovery must not hang on one source.

**Benchmarks** (reply rates; there is no rigorous public study of link *win* rates):
| Study | Finding |
|---|---|
| Backlinko × Pitchbox, 12M e-mails (2019) | 8.5% reply; one follow-up +65.8%; personalised subject +30.5%, body +32.7%; a second contact at the site +93% |
| Hunter State of Cold E-mail 2026 (31M e-mails, 2025) | 4.5% average, **digital PR 13%**; 3 messages 6.8% vs 1 3.3%; hand-edited 5.2% vs 4.4%; lists of 21-50 6.2% vs 2.4% for 500+; 20-49 sends a day per mailbox best |
| Hunter 2025 (11M, 2024) | replies fall after the 3rd follow-up (unsubscribes rise); "who is the right person?" is the best follow-up |
| Instantly 2026 | 58% of replies come from the first e-mail; under ~80-130 words; keep bounces under 2% |
| Muck Rack State of Journalism 2025 (1,500 journalists) | 86% delete irrelevant pitches, 71% promotional, 50% mass-feeling; one follow-up after 3-7 days |
| Featured.com / Pangram (1.39M expert pitches, 2025-26) | journalists picked ~1 in 3 human pitches vs 1 in 10 AI-written → drafts are a start, a person edits |

**Sending from the customer's mailbox** (official docs, 2026): Gmail API reply reading needs *restricted* scopes (gmail.readonly /
metadata) → Google's CASA assessment (~$3-6k a year, weeks); gmail.send alone is only "sensitive". Password IMAP/SMTP ended for Google on
2025-03-14 except **app passwords** (2-Step Verification; may be disabled by a Workspace admin). Microsoft 365: Graph `Mail.Send` /
`Mail.ReadWrite` delegated need no CASA (publisher verification is free); SMTP AUTH with passwords goes **off by default end of December
2026**. n8n is a poor fit (credentials are fixed per node, one IMAP trigger per mailbox) → sending and reply polling live in the **app
server**. Limits: free Gmail 500/day, Workspace 2,000; Microsoft 10,000 recipients/day. At 5-30 pitches a day the Gmail / Yahoo /
Microsoft bulk-sender rules (5,000+/day) do not apply; SPF / DKIM / DMARC still decide the inbox.

**Law** (summarised, not legal advice): CAN-SPAM covers B2B and link pitches (sender identity, postal address, working opt-out honoured
within 10 business days); GDPR Art. 14 (say where the address came from, at the first contact) + legitimate interests + right to object;
UK PECR: companies may be e-mailed with identity + opt-out (sole traders count as individuals); France: B2B opt-out if job-related;
**Germany: prior consent even B2B** (UWG §7); **UAE PDPL / TDRA: consent-based**, **Saudi PDPL: consent for promotion without prior
interaction**; India: DPDP does not cover self-published data. → defaults below.

**Opportunity sources** (beyond v4.10's lost / mention / list / competitor-new / gap / reclaim and v4.12's AI-cited pages): journalist
requests (HARO is back under Featured.com since 22 Apr 2025; Help a B2B Writer / MentionMatch; Qwoted; **#journorequest on Bluesky —
free public API**); **broken link building** (dead links on relevant pages; competitors' broken backlinks — DataForSEO `is_broken`; the
Wayback Machine for what the dead page covered, used only to understand it); **our own old URLs from the Wayback CDX → 301s** (free);
resource pages; podcasts (Podcast Index, free key); government / association / partner lists — techand.ai is **not** on the UAE Ministry of
Finance's pre-approved e-invoicing provider list (followed links), the best single link available if it becomes accredited. Avoid:
scholarships, pay-to-enter awards, link exchanges, sponsored posts without `rel="sponsored"`, automated submissions.

**Using links in SEO** (Google docs + correlational studies): referring domains correlate with rank (Ahrefs 2025, ρ 0.255) and almost no
page earns traffic without them, but Google says it "needs very few links"; publishers link to blog posts / guides far more than to
product pages → aim pitches at the hub / guide and pass value on with internal links ("middleman"); exact-match anchors correlate weakly
(0.14) and optimised anchors in placed links are named link spam → **request the brand or the page's title, never a keyword**; no safe
"link velocity" exists — guard against spikes of keyword anchors, not counts; 301s keep link value; Search Console's Links report has no
dates → **our own first-seen-live date is t0**; impact needs a control (pages without new links) and months (≈10 weeks per position in
the one published test) → say "likely helped" / "possibly helped" / "no measurable effect yet", never "caused". Brand mentions correlate
with AI visibility far more than links (Ahrefs: 0.66 vs 0.22) — every won link and listing also feeds the v4.9 AI numbers.

## 2. What runs

### n8n — **SEO Agent — Link Builder** (`SEOagentLinkBld1`, Monday 11:00 after the Backlink Monitor 07:30 and AI Growth 09:30; on demand
through **SEO Agent — Link Builder API** (`SEOagentLinkBAPI`, `POST /webhook/seo-link-builder`, API key header: answers 202, then starts the run)
Per site with `link_builder` on (Site Admin `monitors`; the app turns it on):
1. **New opportunities** (free unless noted): journalist requests (#journorequest on Bluesky, matched to the site's topics; deadline
   kept), **journalist digests** (L5, 2026-10-13: HARO / Source of Sources arrive in the customer's own mailbox, so the web app parses them
   — `app/shared/src/digest.ts`, the inbox poller — and writes one `digest` prospect per open request for every verified site; nothing
   arrives until a mailbox is connected), **podcast shows that take guests** (L5: monthly, free — a podcast directory is searched for the
   site's topics, every show's RSS feed is read because its `<link>` is the only place that names the show's **own** website, that website
   and its contact page are fetched, and the show is pitched only when it is on topic, still publishing, says somewhere that it takes
   guests and has a contact on its own domain; `v5/code/_podcast.js`), resource pages and broken links on relevant pages (web search for
   "useful links / resources" + topic, each page fetched, outbound links checked twice), our own old URLs from the Wayback CDX that now 404
   → redirect suggestions (type `reclaim`, origin `wayback`), competitors' broken backlinks (DataForSEO `is_broken`, monthly, ≈ $0.07),
   their **most-linked pages** (L6: `backlinks/domain_pages`, monthly, ≈ $0.02 a competitor) and the **listings checklist** (§4).
2. **Qualify** every new prospect of every type (also the monitor's and AI Growth's): the page answers, its language, signs it sells
   links (price lists, "sponsored post", casino / CBD / essay categories), hundreds of unrelated outbound domains, already linking,
   spam score, contacted in the last 90 days → `not_fit` with the reason. **Never pitched** (D13, 2026-10-12; `v5/code/_outreach_kit.js`):
   a declared competitor or a prospect whose own page sells what we sell (our service words from the site model on their page *plus* the
   signals of a vendor selling them — a list that leaves us out, a mention or a journalist request stays pitchable), a bare homepage,
   a mailbox provider (outlook.com), a contact / company database (zoominfo.com), a CDN or a statistics page, a government portal, and a
   list of accredited / approved providers while the site model's `accreditation` is empty. The business name for every pitch comes from
   the **site model** (profile → the homepage's `og:site_name` / Organization name → what the app sent), never from the domain label
   ("techand" for Tech&); with no name on file the e-mails carry `[Confirm: the business name]` and the draft gate holds them.
3. **Contacts**: the prospect's page, its author page, contact and about pages; up to 3 addresses ranked author / named person on their
   domain → editorial (editor@, news@, press@) → general (info@, hello@); a contact form is a task for a person. Never no-reply, privacy,
   abuse, jobs. The address's source page is kept (GDPR Art. 14 line).
4. **Our page and the link text** (§5): the page of ours to point to, why, and the anchor to ask for (brand / the page's title / URL).
5. **Outreach Writer** (Claude Sonnet, one call per site, ≤ 10 prospects a week by value × likelihood): a **sequence** per prospect —
   first e-mail (80-130 words, **two** subjects of 36-50 characters in different styles (L7: A names what we found, B asks the one
   question; the gate checks both and `LB Rows` hands them out in turn, A, B, A, B …, so each goes out as often as the other), one detail
   quoted from *their* page, one link, never "backlink" / "dofollow"
   / a keyword anchor / payment / link swap), follow-up 1 (+4 business days, 40-70 words, one new useful detail) and follow-up 2 (+8 more,
   the last: "who is the right person?" or an easier alternative). Journalist requests: the answer itself, one follow-up. Signed with the
   business profile's author; the compliance footer is added by the app at send time.
6. Rows: `seo_link_outreach` (one per site × prospect domain × type: status, fit, reasons, evidence, contacts, our page, anchor, the
   sequence), `seo_link_prospects` (new prospects of the new types, statuses kept), `seo_listings`, `seo_link_impact` (§6).
7. **Linkable-asset ideas** (L6, 2026-10-13): the competitors' most-linked pages are grouped into the kinds of page that earn links in
   this market — data study, free tool, template, definitive guide — and at most four ideas are offered, each with what the work is, the
   competitor pages that prove it and the referring domains they hold. An idea says what it is based on and is never a promise of links.
8. Report + callback `link_builder` (new opportunities, drafts ready, listings missing, impact reads, podcast shows, asset ideas).

The **Backlink Monitor** keeps discovery and "won"; for a site with the Link Builder on it no longer drafts e-mails (one writer).
**Facts only (D14, 2026-10-11):** the prompt always carries the facts block ("none on file" when empty) with the rule that any claim the facts do not state goes to the owner as `[Owner: …]`; the app sends `business_facts` and the business profile (`profile`: business, author, reviewer, address, phone, e-mail, service areas; `app/server/src/services/replyFacts.ts`), merged by Reply Input; Reply Result then checks every sentence of the suggested answer against the facts with `_claims.js` (`CL.check`: accredited, certified, partner, ISO, licensed, registered, approved, award, member of, founded, since, based in, numbers of years / clients / %, prices) and wraps an unsupported one in `[Owner: confirm — …]`, sets `needs_you` and lists it in `unverified`. Live 2026-10-11 the answer invented an accreditation with empty facts (execs 357-360).

**SEO Agent — Reply Reader** (`SEOagentReplyRd1`, `POST /webhook/seo-reply-read`, synchronous, Claude Haiku ≈ $0.001): reads one reply
with our e-mail → class (interested / question / says linked / wants payment / link swap / not now / declined / unsubscribe / wrong person
/ out of office / other), a one-line summary, the out-of-office return date, a referred contact, and a suggested answer; when the reply
names a URL on the prospect's site, that page is fetched and checked for our link at once (instant "won").

### App — sending, replies, the queue
- **Mailboxes** (company settings), two ways to connect:
  - **An app password**: SMTP + IMAP (Gmail / Google Workspace, Zoho, Fastmail, Microsoft 365 until December 2026, any host), tested on
    connect (SMTP login, IMAP login, Sent folder), SPF / DMARC / DKIM (common selectors) checked for the From domain; the password is
    encrypted (AES-256-GCM, `MAILBOX_KEY`), never shown again.
  - **OAuth** (L4, 2026-10-13; `app/server/src/services/mailOauth.ts`): **Microsoft 365 through Graph** (`Mail.Send` + `Mail.Read` +
    `offline_access`: sends and reads the replies) and **Gmail / Google Workspace** (`gmail.send`: sends only — reading a Gmail inbox needs
    `gmail.readonly`, which Google classes as a **restricted** scope and only grants after a CASA assessment and app verification, so the
    UI, `app/API.md` and the mailbox card say plainly that those replies are read in Gmail itself). Authorization code + PKCE on the
    provider's own consent screen; the refresh token is encrypted exactly like a password, the access token is renewed two minutes before
    it expires, and disconnecting revokes what the provider allows (Google's revoke endpoint; Microsoft has none for this flow, so the app
    names the page where the customer removes it). The OAuth apps belong to the installation (`MS_OAUTH_*` / `GMAIL_OAUTH_*` in
    `app/.env`): with a pair unset that provider is **not offered at all** — never half-offered. Sending goes through Gmail
    `messages.send` (base64url MIME) or Graph `sendMail` (base64 MIME), so our own `Message-ID`, `In-Reply-To` and `References` keep the
    thread, and both providers file their own copy in Sent.
- **Approval** (per website): *Approve each* (default) — the person reads, edits and approves the whole sequence; *Automatic* (owner
  only, off by default) — sequences with a contact and fit ≥ 0.6 are approved within the daily limits, never consent-gated recipients.
- **Sender** (every minute): per mailbox, Monday-Friday 08:00-17:00 in the mailbox's time zone; first e-mails 5 / 10 / 20 a day in
  weeks 1 / 2 / 3+ (max 30), 50 e-mails a day in all; a random 4-9 minutes between sends; one active sequence per recipient domain, at
  most 2 first e-mails per domain a week, 90 days' rest after a sequence ended without a reply; plain text, no tracking; follow-ups in
  the same thread (`In-Reply-To` / `References`, "Re: "); a copy saved to the Sent folder when the server does not; before each
  follow-up the prospect is re-read (won / rejected → the sequence stops).
- **Footer** (always): name, title, company, postal address (required before the first send) and "If you'd rather not hear from me,
  reply "no" and I won't write again."; recipients in the EU / UK also get "I found your address on <page>."
- **Consent gate** (defaults, editable): recipients in Germany, Austria and Saudi Arabia, and named-person addresses (not info@ /
  editor@ …) in the UAE need the tick "I have their consent or we already work together".
- **Replies** (IMAP every few minutes): matched by `In-Reply-To` / `References` → thread → sender address → sender domain + subject;
  bounces (delivery-status reports, mailer-daemon) → bounced + the address suppressed; auto-replies (`Auto-Submitted`, `X-Autoreply`,
  `Precedence`) → out of office: the next step moves after the return date; a person's reply → the sequence stops, the Reply Reader
  classifies it and suggests an answer, which the person can edit and **send in the same thread** from the app; "no" / unsubscribe /
  declined → suppression list (address, or the whole domain when asked); wants payment → not pursued (a paid link must be
  `rel="sponsored"` and earns no SEO value); link swap → flagged (Google: excessive link exchanges).
- **Mailbox safety**: paused at 3 hard bounces in the last 50 sends or any 5.7.x policy block; an authentication failure stops it with
  the error shown.
- The prospect's status in n8n follows: contacted (first e-mail sent), replied, rejected (declined / unsubscribe / bounce with no other
  contact), won (by the link check).

## 3. Statuses and numbers
Prospect: new → contacted → replied → won / rejected / ignored (v4.13 adds `replied`). Sequence (app): review → approved → active
(step n, next date) → replied / out of office (until) / bounced / stopped / won / finished (no reply). KPIs on the page: links won this
month and in all, e-mails sent, reply rate (people only, auto-replies excluded), positive replies, win rate (won ÷ domains contacted),
median days to link, bounce and unsubscribe rates, all split by opportunity type; cost per link (Claude + data); and (L7) the first
e-mails, replies and reply rate **per subject style**, with no verdict under 30 sends per style — the counts and "not enough sends yet"
instead of a winner (`v5/code/_ab.js`, mirrored in `app/shared/src/outreach.ts` `subjectAbStats`; the two must change together).

## 4. Links you can add yourself (listings checklist)
**Research (2026-10-10, fetched profiles and platform docs):** a plain fetch gets a bot wall (403 / challenge) on G2 (DataDome), Capterra,
Clutch, GoodFirms, TrustRadius, SourceForge, AlternativeTo, Product Hunt, Crunchbase, Trustpilot and Wellfound (Jina's free tier too);
SaaSHub and PeerSpot answer. Few profile links are followed: TrustRadius's vendor button is (UTM-tagged); Clutch, GoodFirms, SaaSHub are
nofollow; Product Hunt `ugc`; G2 has no crawlable link (a form button); Capterra's free profile has none. They still carry trust, referral
and AI weight (a vendor study rates G2 / Capterra highly for "best X software" answers; in UAE e-invoicing answers AI cites mof.gov.ae,
tax.gov.ae, YouTube, LinkedIn and providers' own guides instead). G2 now appears to run Capterra / GetApp / Software Advice. Google Business
Profile is for staffed offices or service areas only. UAE: the Ministry of Finance's accredited e-invoicing provider list links every provider
(followed) — and only accredited providers may offer e-invoicing (Peppol-certified 2 years, ISO 27001 + 22301, insurance; decision within 90
business days); techand.ai is not on it (if it works through an accredited partner, that partner's page is the target). Aggregators
(BrightLocal from $2 a citation, Yext, Semrush Listing Management) submit local citations for a fee; they are not needed for B2B software.
**The checklist** (`v5/code/_listings.js`, 28 entries): B2B software (G2, Capterra, TrustRadius, SaaSHub, AlternativeTo, Product Hunt,
Crunchbase, LinkedIn, YouTube), agencies (Clutch, GoodFirms, DesignRush), local businesses (Google Business Profile, Bing Places, Apple
Business, Facebook, Trustpilot), country entries (UAE: Yellow Pages UAE, Dubai Chambers; topic entries: the MoF provider list and the
OpenPeppol certified list for e-invoicing), and marketplaces shown only when the site names the integration (Microsoft AppSource, Zoho, Odoo,
SAP, HubSpot, Xero, QuickBooks). A consultancy that also sells software gets both the agency and the software entries. Each entry: where (profile URL pattern), why (followed link, trust, AI-cited for "best X"
questions, local), how we detect it (web search on that site for the brand / domain, then the profile page fetched: does it link to us,
followed or not), whether competitors are there, and a submission kit from the business profile (name, one-line and 100-word
descriptions, category, logo, address, phone). Statuses: linked / listed without link / missing / submitted / unknown. Nothing is
submitted automatically (the platforms forbid bots; Google names automated link creation as spam): the person submits, we verify.

### The draft gate (L2, 2026-10-12)
Every sequence the writer produces passes **LB Draft QA** (`v5/code/_draft_qa.js`) before the app may offer it: every claim checked against
the business facts on file (`CL.check` with `ours: true` — a word inside quotation marks or a URL is not a claim, and a sentence about *their*
page is not a claim about us; what the facts do not carry is wrapped `[Owner: confirm — …]`), nothing left in brackets, the address on the
prospect's own domain (a journalist request is answered at the address in the request), something really quoted from their page (three
distinctive words in a row from its title, our evidence or the dead link), exactly one link per e-mail — the page we chose, on the canonical
host —, the prospect gates of §2 again, first e-mail ≤ 120 words (press ≤ 200), follow-ups ≤ 60, a subject ≤ 70 characters, one clear ask, no
SEO / AI / hype words, and the business name as the site model has it. A draft that fails is stored as **`needs_edit`** with its reasons
(`fit_reason`): the app shows it for editing, automatic mode skips it, the report lists it, and nothing is sent. The app mirrors the same rules
(`app/shared/src/draft-qa.ts`) and runs them again on approval, on the text as the person edited it — the two files change together.
**Before the first e-mail** (L1) the recipient's domain is checked for an MX record (an A record counts); with neither, the address is
suppressed with the reason and the sequence stops (`app/server/src/services/mail.ts` `mxCheck`, cached per domain for a day).

## 5. Which page of ours, which link text (rules)
Candidates: published ladder pages (keyword, rung, page type), AI answer pages, written pages from the content log, the top Search
Console pages, the homepage. Per candidate: position (Search Console, impression-weighted, latest window; else the rank tracker), our
referring domains to it (the ledger; nofollow ½), topic fit to the prospect (distinctive shared words, IDF-weighted), page type.
- By opportunity: lost → the URL it linked to (or its redirect); mention, list, listing, journalist, AI-cited list → the homepage, brand
  link; broken → our page that replaces the dead one (fit to the dead link's text and URL); gap / competitor-new / resource / AI-cited
  article → the best-scoring guide or hub.
- Score = fit × band × need: position 4-15 → 1.0 (striking distance), 16-30 → 0.6, 1-3 → 0.3 (defend), not ranking → 0.4; referring
  domains 0 → 1.0, ≤ 5 → 0.9, ≤ 20 → 0.7, more → 0.5. Product / service pages get 0.6 for informational pitches (publishers link to
  guides; the guide links on internally).
- Pacing: ≤ 4 pitches a month to one page while it has < 20 referring domains, no page > 40% of the month's pitches.
- Link text asked for: the brand (default), the page's title (descriptive) or the URL — never a keyword. Pages whose links already carry
  > 15% keyword anchors get brand only. Paid / sponsored placements are never pursued.

## 6. Proving what a link did (`seo_link_impact`)
t0 = the date our link check first found the link live. Baseline: the target page's Search Console position (impression-weighted) and
clicks in the window before t0; reads at 6, 10 (main) and 16 weeks; **control** = the site's other pages with no new link in the window
(median change), so site-wide swings and Google updates cancel out. Effect = page change − control change. Wording: *Likely helped*
(beyond 2× the control spread, no other link to that page within ± 4 weeks), *Possibly helped*, *No measurable effect yet*, *Too early*
(< 6 weeks), *Can't tell* (no Search Console data). Never "caused". Referral visits from GA4 and the AI numbers are shown next to it.

## 7. Data
n8n tables (created by the workflow, columns in `ladder_common.py`): `seo_link_outreach`, `seo_listings`, `seo_link_impact`; new column
`seo_monitors.link_builder`. App Postgres: `mailboxes`, `outreach_sequences`, `outreach_messages`, `suppressions`; `sites.link_settings`.

## 8. Costs per site per month
| Part | Cost |
|---|---|
| Opportunity search, qualification, contacts, listings, Wayback, Bluesky, link checks, impact | free |
| Outreach Writer (≤ 10 sequences a week) | ≈ $0.25 |
| Reply Reader | ≈ $0.001 per reply |
| Competitors' broken backlinks (DataForSEO, monthly) | ≈ $0.07 |
| **Total** | **≈ $0.35** |

## 9. Tests and live checks (2026-10-11)
- **Harness S30** (`harness/fixtures_lb413.js`; 1717 node runs and assertions in all, 0 failed) on REAL responses captured from the n8n
  container — Bluesky #journorequest (100 posts), techand.ai's Wayback CDX, the UAE Ministry of Finance provider list, azdan.com's "Top 20
  UAE e-invoicing providers" (sales@ and a named person next to SAP and Deloitte addresses), flick.network, techand.ai's homepage, cleartax.com
  (403) and saashub.com/techand (404) — plus built pages for every path: plan (pages with positions / links / kinds), sources, competitors'
  broken backlinks, pages to read, contacts (author page first), qualification (gone, bot wall, sells links, other language, government,
  off-topic), evidence, our page + link text, dead links on list pages, redirects from the Wayback history, the listings checklist, impact
  with a control group, writer jobs, merged sequences (4 / 8 working days; press 3), exact table columns, the report, free-only, the
  switch off, the Backlink Monitor handing drafting over, the Reply Reader (link checked at once, an opt-out caught without the model).
- **App**: 213 unit tests (sending rules, consent gate, footer, return dates, composing, parsing replies / bounces / out-of-office);
  `scripts/outreach_e2e.py` — **31 checks, all passed** against GreenMail (a local SMTP + IMAP server; fake *.test addresses; nothing leaves
  the machine): wrong password refused before storing, mailbox connected and the password encrypted, consent gate, one conversation per
  site, nothing at weekends, one e-mail per run 10 minutes apart, the e-mail itself (edited subject, plain text, postal address, opt-out,
  the GDPR source line for a UK recipient only, List-Unsubscribe, our Message-ID), a person's reply stops the sequence, an out-of-office
  moves the next step after the return date, a hard bounce suppresses the address, "no thanks, please remove me" is an opt-out, the answer
  goes out in the same thread, follow-up 1 on the 4th working day in the same thread, numbers; smoke 67 / 67; Playwright 1440 / 390 px of the
  Link building page, the review dialog and the Mailboxes tab (no console errors, no sideways scroll).
- **Live on techand.ai** (free checks, $0; executions 299 and 303): 33 prospects qualified, 7 new (resource pages), 16 listings checked —
  the MoF provider list and OpenPeppol missing (ClearTax / Azentio there), SaaSHub missing, LinkedIn listed, the rest behind bot walls
  ("unknown"); ready with a contact on their own domain: azdan.com's list (a named person), finline.ae, invoicefatura.com, consultsynergy.ae
  and four UAE resource pages; abacco.ae refused correctly (its pages carry injected casino spam).
- **Defects found live and fixed**: (1) a workflow started from a webhook BEFORE it answered ran no node (executions 293 / 295 / 297) → a
  separate **Link Builder API** workflow (`SEOagentLinkBAPI`) that answers 202 first, then starts the run, like the API front door;
  (2) placing every outbound link re-walked the page per link (11 minutes on real list pages) → one walk (`LK.anchorPlacements`, 37 ms for 339
  links); (3) a page's other companies' addresses taken as the contact (AI Growth stored sajid@advintek.ae for the Ministry) → own domain only;
  (4) off-topic sites from the Common Crawl gap (Navan, Stripe, WEF, Libsyn) kept → refused under a 25% topic match, no contact fetches;
  (5) government sites pitched → "apply or get accredited" (the checklist); (6) links present when tracking began got a t0 → only links
  that appeared later; (7) a login portal counted as a dead resource → content links only; (8) "prices" anywhere = paid guest posts →
  the price must sit next to the offer; (9) a 5-letter prefix matched "consultancy" with "consumer" (a DoorDash request matched) → stems;
  (10) the first "deadline" in a request was read as the deadline → the one followed by a date; (11) contact URLs lost "www."; app:
  two columns named created_at, a Date passed in raw SQL, dismissed drafts coming back from the cache, out-of-office dates without the
  model, replies counted as "to answer" after an opt-out or an answer.

## 10. Open / next
- **The Reply Reader** (`SEOagentReplyRd1`) is imported but not published: each reply it reads is a paid Claude Haiku call (≈ $0.001).
  Until it is on, the app's own rules sort replies (out-of-office dates, opt-outs, bounces) and every other reply is "replied" for a person.
  Publish it with the owner's go-ahead (`n8n publish:workflow --id=SEOagentReplyRd1` + restart, or `apply_env.py` without `--except`).
- **The first paid run**: the Link Builder is on by default for new sites, but **switched off for techand.ai** (2026-10-11) until the owner's
  go-ahead: a run drafts up to 10 sequences (≈ $0.05-0.10) and, monthly, reads competitors' broken backlinks (≈ $0.05). Switch it on in the
  website's monitor settings ("Link builder") or Site Admin `monitors` `{ link_builder: true }`; free checks run any time ("Find
  opportunities now" → free check).
- techand.ai: connect its mailbox (company settings → Mailboxes) with a postal address; MoF accreditation (or the accredited partner's page).
  Until the accreditation is on file (the site model's `accreditation`), accredited-provider lists are not pitched — by design (D13 / O3).
- **Done 2026-10-13** (fix plan L4-L7, harness S61): OAuth mailboxes (Microsoft 365 sends and reads, Gmail sends), podcast guest
  opportunities, the journalist digests read from the connected mailbox, the linkable-asset ideas and the subject-line A/B. What they still
  need from the owner: an **Azure app** (`MS_OAUTH_CLIENT_ID` / `MS_OAUTH_CLIENT_SECRET`, redirect `<APP_URL>/api/mailbox-oauth/callback`)
  and / or a **Google OAuth client** (`GMAIL_OAUTH_CLIENT_ID` / `GMAIL_OAUTH_CLIENT_SECRET`, scope `gmail.send`) in `app/.env` — without
  them only app-password mailboxes are offered; and a **connected mailbox** (O4) before any digest can arrive.
- **Podcast Index** (`SEO_PODCASTINDEX_API_KEY` / `_SECRET`, placeholders in `n8n/.env.seo.example`) is not read yet: every request must
  carry `sha1(key + secret + unix time)`, which no n8n credential type can produce per request and which a node may not compute either
  (the secret would have to live in the workflow JSON, and `$env` is blocked in nodes on this instance). The free Apple directory is read
  instead; `PC.shows()` already parses both answers, so a signing step is all that is missing.
