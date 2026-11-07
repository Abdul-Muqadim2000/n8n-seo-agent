# Review: SERP-GOTO hotfix (commit 175ff5cd, branch `hotfix/serp-goto`)

Independent adversarial review, read-only, 2026-11-08. I read the diff (v5 kits and readers, build scripts, `dfs_gate.py`, harness) before the
author's `fixes/SERP_GOTO.md`, and ran `_serp_url.js` in `node:22` against the live fixtures and the edge cases below
(scratchpad `su/t.js`). File:line refers to the worktree.

## Verdict: SHIP AFTER FIXES (H1 and H2 are small; M1 should go out in the same deploy)

The fix is a large net improvement on what production does now (false drops, google.com as a competitor, no competitor page read).
Clean answers are unchanged (checked by reading every touched path: `fixItem` returns the same object, `SC.su()` adds nothing,
`ourRank` takes its old branch, the snapshot's `x` flag only appears on approximate rows). It works in the n8n sandbox: no `URL`, no
`structuredClone`, no `defineProperty`, and the regexes run in linear time (a 50k-label host takes 1 ms, a 50k-parameter query 42 ms). It
does not make us buy more SERPs in any repeating way. One new wrong outcome (H1) and one hiding rule (H2) should be fixed before it ships.
If it must go out today, fix H1 at least: shipping the rest as it is still beats production's current state.

## Blocker
None.

## High

**H1. Cut breadcrumbs collapse to a host-only key, so different pages of one site count as the same result. That merges ladder
keywords wrongly.**
`v5/code/_serp_url.js:63` (`segs = p.cut ? [] : p.segs`) and `:111-112` (`key` = `"~host/…"`). These keys are used by
`Ladder_Clusters.js:81` and `Ladder_Plan.js:533`, and both feed `KWI` clustering (3 of the top 7 shared means one page). In the live
fixture, 4 of the 9 organic breadcrumbs are cut. All four become `~brainsphereit.com/…`, `~brainstation-23.com/…`,
`~delemontechnology.com/…` and `~singleclic.com/…`, whatever page they point to.
Failing input: the fixture's own rank 2. On Live it is `brainsphereit.com › page-tag › top-10-erp-...` and on Standard
`… › page-tag › best-erp-sof...`: two different pages with the same key. Two related keywords whose top 7 each hold a different
blog post on delemontechnology.com, brainsphereit.com and singleclic.com get 3 "shared URLs", so they are clustered and rungs are
moved off the ladder (`one_page.moved`). Before the fix nothing merged; now distinct searches merge.
Mixed answers make it noisier. DataForSEO says Live resolves about half of the goto links, so the same result can be exact on one
keyword's page and `~` on another's, and the two never match.
Fix: keep the uncut segments plus the visible stem of the cut one (`~delemontechnology.com/blog/best-erp-`) and match a stem only by
prefix with at least 8 characters. Simpler: give a partial item no key (`''`), so it neither matches nor counts toward `min_urls`.
Add a harness case with two different cut pages on one host.

**H2. The -1 rule can hide a real drop with no end date, and the host check turns more results into "unresolved" than it should.**
`_rank_serp.js:107-108`: when our site is not found and any organic result in the 50 read is unresolved, the position is -1.
`prevReading` skips -1, `Tracker_Report.js:87` makes the delta null, `posText` says "check failed", and nothing escalates. The trigger
is broad:
- `crumbHost` (`_serp_url.js:35`) needs `https?://`, and `HOST` (`:31`) is ASCII with an alphabetic TLD. In node, these all come back
  unresolved: `https://www.müller.de › shop` (Google shows IDNs in Unicode), `https://xn--mgbh0fb.xn--mgbaam7a8h › a` (the UAE's own
  IDN TLD), and the scheme-less `en.wikipedia.org › wiki › ERP`.
- Failing input: a tracked page that was #22 falls out of the top 50 on a page that also holds one Arabic IDN result. Every week
  shows "check failed": no drop, no "lost" alert. The unpublished-rung deferral at `Tracker_Plan.js:132` (only position 0 defers)
  also stops working, so those rungs are bought weekly instead of monthly. That is bounded by `max_checks_per_run`, about $1-2 a
  month across both sites.
Fix: (a) accept any dotted host before ` › ` with the scheme optional and Unicode or `xn--` labels allowed, then lower-case it;
(b) return -1 only when an unresolved item could be ours (its `website_name` or title holds one of the site's brand names or its
domain label). Otherwise return 0 with `unresolved: n` in the note. (c) Raise an ops alert after 2 consecutive -1 readings of one
keyword. Then measure the unresolved rate on the first production week.

## Medium

**M1. The app was not changed, though its mirrors must follow the engine.** CLAUDE.md says `Cadence_Plan.js` and `cadence.ts`
change together.
- `app/server/src/services/cadence.ts:210` (`prevReading`) does not skip poisoned rows. `serpHosts` therefore reads google.com from
  the 10-30 to 11-07 rows for up to 60 days, while the engine skips them, so the Pipeline queue and the engine's cadence disagree.
- `app/server/src/services/data.ts:566` shows snapshot `u` values as exact links and ignores `x: 1`. Customers would click
  `https://odooerp.ae/Home/Blog` (real page: `/en/blog/top-10-…`) and partial results land on home pages.
Fix: port `poisonedRow` to `prevReading`, and show approximate rows as the site (host) with no deep link.

**M2. Pick Top 6 reads breadcrumb page labels as the competitor's page address.** `build_v4.py:13724` skips only partial
results. A full breadcrumb made of labels (`› Home › Blog`, 1 of the 5 full ones in the live pair) becomes
`odooerp.ae/Home/Blog`, which is a 404 or a blog index. That page then goes into the term model, the length targets and the
analyst. Fix: count a breadcrumb as a path only when every segment looks like a slug (`/^[a-z0-9%._~-]+$/`, no capitals or spaces),
otherwise mark it partial. Or check that the fetched title matches the SERP title before using the page.

**M3. The cannibalisation check reports "checked: none" when it could not see.** `_rank_serp.js:133` keeps only exact results in
`own`, so `own_n` is 0 on every goto reading and `cannibal` (`:439` onwards) returns `checked: true, count: 0`. Fix: leave `own_n`
out when any of our results is approximate, so the check says it could not tell.

**M4. Approximate addresses decide the page type.** `KWI.serpPageTypes` gets `url` at `Assess_Response.js:70`, and also in
Ladder Plan / Clusters, Build Keyword Strategy and `__top10` serp_shapes. A partial result is `https://host/`, which is read as
"Homepage" when its title is neutral. A label path like `/Home/Blog` is read as "Guide". Either can tip the dominant type and the
plan-type mismatch. Fix: pass `url: ''` (judge by title only) when `url_exact === false`.

## Low

- **L1** `_serp_url.js:50`: `SOCIAL[brand]` reads the prototype chain. A result with `website_name: "Constructor"` and no breadcrumb
  gets the host `function Object() { [native code] }` (seen in node). Fix: `Object.prototype.hasOwnProperty.call(SOCIAL, brand)`.
- **L2** `_serp_url.js:55`: `(tgt.match(/^https?:\/\/([^\/?#:]+)/i) || [])[1].toLowerCase()` throws a TypeError, which crashes the
  node, when `carried()` accepts a target such as `?q=https://:a.b`. A target with userinfo (`https://u:p@host`) returns `u` as the
  host. Fix: use one host regex for both and return `''` when it does not match.
- **L3** `_rank_serp.js:81`: local-pack items are always unresolved in the live answers (no breadcrumb or website_name), so
  `local_pack.ours` is a definite `false`. A featured snippet with no breadcrumb behaves the same way. Fix: return `null` (unknown)
  when the item is unresolved.
- **L4** `Tracker_Plan.js:99,131-132`: `topHist` and `lastH` do not skip poisoned rows. An unpublished rung whose last row is the
  poisoned 0 of 11-05 is deferred until about 12-05, and the report shows that "not in top 50". This goes away only if the repair
  (step 3: set -1 on those rows) runs. Fix: filter `!RS.poisonedRow(h)`.
- **L5** `Regulatory_SERP_Candidates.js:17`: Live resolves 0 of 50 links today, so every item is excluded, and the reason given is
  "the paid search found no official or independent page". That is not what happened; the reason should say the addresses were
  hidden by Google.
- **L6 The build section 181 guard (`build_v4.py:14076-14087`) only checks** that a node calling SU carries the kit, and that
  dfs_gate-shaped `* Answers` nodes call `SU.fixAnswer(a)`. It does not look at:
  - Code nodes that read a SERP HTTP node directly or sit downstream of one through an IF node (Pick Top 6 is wired that way). A new
    reader of `SERP Top 10` would get past it.
  - Readers of stored `serp:*` rows outside `SC.lookup` (AI_Rank_Plan / Requests were patched by hand).
  - `seo_rank_history` readers outside `RS.prevReading` (L4, the app).
  - The app mirror (M1).
  Fix: add a connection-graph check. Every Code node reachable from a `serp/google/*` HTTP node before an `Answers` node must carry
  SU, or appear on a list of nodes that only read cost.

## Checked and fine
- **False positives:** these pass untouched: `support.google.com/...`, `www.google.com/maps/...`, refinement chips
  `google.com/search?...` and AI Overview references (real URLs). Hosts like `notgoogle.com/url` and `google.example.com/url` do not
  match. `/url?q=https://…` is read exactly. Only `developers.google.com/url` (not a real page) would count as a redirect.
- **Own site:** `www.` and bare hosts match, and subdomains count as before (`isOurs` `endsWith('.'+our)`). Our page is never guessed
  (`url: ''`). The Tracker Report's "Google ranks a different page" (`:218`) needs a non-empty URL, so it stays quiet. Collect Facts
  and Regulatory cite exact URLs only.
- **Poisoned rows:**
  - They are never a baseline (`prevReading` / `stableReading`), and `outranked` refuses them.
  - pack() always keeps at least `top[0]`, so the goto marker survives trimming.
  - Churn is compared by host when either side is approximate.
- **Money:**
  - SC refuses a poisoned row only on a same-day hit, and new readings are stored already fixed, so nothing is re-bought in a loop.
  - AIR re-reads the poisoned window once (about 40 fan-out reads, roughly $0.1).
  - Competitor page reads and their Claude analysis come back to their pre-10-30 cost; that is a restoration, not a blow-up.
  - The only lasting extra is H2's weekly re-checks of unpublished rungs.
- **Node crashes:** no Code node calls a method on a SERP item's `url` or `domain` that is now `null` (I scanned every generated
  workflow). There are no duplicate or conflicting `SU` declarations: 66 nodes carry it, each once.

## Re-review of 36c1882a

I read the diff 175ff5cd..36c1882a: the kits, the readers, the 3 new Rank Tracker nodes and their wiring in the generated JSON, build
section 181, and app cadence.ts / data.ts / RankingsPage. I re-ran the edge-case script (scratchpad `su/t.js`) on the new kit, with
extra cases for L2, M2, H1 and Unicode-host ReDoS.

### Per finding

| Finding | State | Evidence |
|---|---|---|
| H1 | **Fixed** | `SU.key` gives `''` to cut, label and host-only results (`_serp_url.js:127-128`). Two different cut posts of delemontechnology.com both come back `""`. Live fixture: 4 keys of 9, all complete slug paths. A cluster "miss" buys nothing. Residual (Low): the same result shown exact on one page and approximate on another never matches, so clustering under goto rarely merges. That is honest, but `Ladder_Clusters.js:96` then says "carried only N ordinary result(s)" when the results were really hidden. |
| H2 (a) | **Fixed** | All of these now resolve: `müller.de`, `xn--mgbh0fb.xn--mgbaam7a8h`, `موقع.امارات`, and scheme-less `en.wikipedia.org`. These stay unresolved, correctly: `3 reactions · 1 month ago`, `v2.0 › docs`, `Wikipedia › wiki`. Unicode HOST stays linear (1-11 ms on 150k-char inputs). |
| H2 (b) | **Fixed** | -1 now comes only with `maybe_ours` (`_rank_serp.js` `hidden` / `ourRank`). Otherwise the position is 0 with `unresolved: n`. |
| H2 (c) | **Partly** | The alert works: one row, sent once (see Tracker nodes below). The "third reading says 0" rule brings back false drops (N1). |
| H2 (d) | **Fixed** | `Tracker_Plan.js:135-139` defers an unread -1 the same way as a 0, so there are no extra weekly buys. |
| M1 | **Fixed** | cadence.ts `prevReading` skips poisoned rows (same regex as the engine). `data.ts` `snapTop` shows an approximate row as its host with no link and drops bare redirects. RankingsPage renders it without a link. |
| M2 | **Fixed** | A breadcrumb is a path only when every segment is a slug. `odooerp.ae › Home › Blog` becomes `labels`, partial, and Pick Top 6 skips it. Side effect: any segment with a capital letter (`… › wiki › ERP`) also skips the page. That is conservative and acceptable. |
| M3 | **Fixed** | `own_hidden` leaves `own_n` out, and `cannibal` then says "not checked" with a reason. |
| M4 | **Fixed** | `serpPageTypes` ignores `url_exact: false` and every caller passes the flag. Side effect (Low): at today's 0/50 resolution every result is approximate, so `read: 0` and the text says "The results page was not read". A title-only vote would keep that signal. |
| L1 | **Fixed** | `website_name: "Constructor"` is now unresolved. |
| L2 | **Fixed** | `?q=https://:a.b` no longer throws (unresolved). For `?q=https://u:p@evil.com/x` the userinfo is refused and the host falls back to the breadcrumb. |
| L3 | **Fixed** | Local pack and snippet return `ours: null` when their site is hidden. The local pack now reads every listing. |
| L4 | **Fixed** | `!RS.poisonedRow(h)` on the won test and on the deferral. |
| L5 | **Fixed** | The reason now names the hidden addresses. |
| L6 | **Partly** | Checks A, B and D are good. Check C only walks HTTP nodes whose parameters literally contain `serp/google/organic`. The Rank Tracker, Site Tracker, Keyword Check, AI Growth and AI Visibility SERP calls use `={{ $json.endpoint }}`, so C never sees them. They are covered only by B and the kits, so the comment's "every live SERP HTTP node" claims too much. Fix: also match `api.dataforseo.com` endpoints built in the plan node, or name those nodes. |

### Rank Tracker nodes (Ensure Ops Alerts -> Unread Alert Row -> Unread Alert? -> Save Unread Alert -> Load Open Alerts)

- **Not every run.** An alert row is written only when the current reading is -1 with `mo` and `prev_unread === 1`, i.e. once per
  streak. A run with nothing to do, or a mobile-only run, gives `{skip:true}` (`$('Parse Positions')` throws inside try/catch). The
  plan/position index pairing holds because Parse Positions maps the plan items 1:1.
- **No double send.** The row is an upsert on `alert_key` (`rank-unread|<domains>|<day>`). The B-A7 sweep sends only rows that are
  open and due, by webhook, then marks `delivered`.
- **Empty or missing ops table.** Ensure creates the table. Row and Save are `continueRegularOutput` and Save has `alwaysOutputData`.
  Load Open Alerts filters only on `last_seen_at` (it does not read `$json`) and is `executeOnce`, so either branch feeds it exactly
  one item. The tracker cannot break here.
- **Low, N3.** A second run on the same day with another keyword on the same domain hits the same key. The upsert overwrites the
  message and resets `attempts` / `next_attempt_at`, but leaves `delivered: webhook`, so the new keyword's alert is never sent. Fix:
  put the keyword set (or a hash of it) in the key. `mode` is hard-coded to `'schedule'`.

### New findings

- **N1, Medium (bordering High): the settled 0 is stored and reported as an ordinary "not in the top 50", a false drop.**
  - `Parse_Positions.js:18` turns the third consecutive maybe-ours -1 into `position: 0`. `settled_after_unread` is not written to
    the row or the snapshot.
  - `Tracker_Report.js:87` then computes delta -100 against the last real position: "dropped out of the top 50", plus the lost alert
    and the app chart.
  - `maybe_ours` means the hidden result carries our own label in its name, title or breadcrumb, so it is most likely ours. The rule
    tells the client their page fell when it probably did not. That is the incident class this hotfix exists to fix.
  - The alert text (`Unread_Alert_Row.js:19`) promises "reported as 'not found among the results we could read'", but nothing
    renders that.
  - The streak counts readings, not weeks (`Tracker_Plan.js:136`). A scheduled run plus a catch-up plus an app re-check can settle
    within days, so the warning week the alert was meant to give is lost.
  - The Site Tracker (`Parse_Site_SERP.js:16`) settles on the 2nd reading, and counts a stored -1 of any cause, including a failed
    API read, as the first.
  - Fix: write a marker (`st: 1`) to the snapshot. Have Tracker Report and Site Metrics show "not found among the results we could
    read" with delta null and no lost alert. Count the streak over readings at least 6 days apart, and use the same rule in the Site
    Tracker.
  - Exposure: in the worst case it lands on the 3rd weekly reading after deploy, only on keywords with a hidden maybe-ours result.
    The alert fires one reading earlier.
- **N2, Low.** A client with an IDN domain: Google's breadcrumb shows the host in Unicode, the stored domain is (probably) punycode,
  or the reverse. `isOurs` fails and `couldBe` cannot match an `xn--` label, so the result is a false 0. There is no IDN client
  today.
- **N4, Low.** `pack()`'s last-resort `{trimmed:'overflow'}` drops `mo` / `ur`. For that keyword the streak, the deferral and the
  alert then quietly stop.

### Final verdict: SHIP

There is no Blocker and no open High. H1 and every M/L except L6 are fixed. The new tracker nodes are safe: they do not fire every
run, do not double-send, and do not break on an empty table. N1 should be fixed (marker + no -100 delta + a weekly streak) before
the second weekly Rank Tracker cycle after deploy, which is the earliest a settled 0 can reach a client. Or ship with the settle rule
switched off (keep the alert, keep the -1) until it is fixed.
