# F1a: who an AI answer names (2026-10-23)

Fixer F1a of the AI-visibility fix wave. Scope: brand, competitors, sources and the entity model behind them.
Findings: ENGINE_AUDIT **E3, E4, E5, E8, E10, E16** and the PROD_STATE.md section 5 spot-check (one business counted 2-3 times, platforms
and directories counted as rivals, "Tech &" missed, our rank stored 4 where the truth was 2).

Branch `worktree-agent-a804d8a11c4d85446`, on top of `99fdd055`. Not pushed, not deployed.

## What changed

### The kit: `v5/code/_ai_entities.js` (new, `AIE`)

Inlined by `build_monitors.py:52` (placeholder `/*__AI_ENTITIES__*/`) into Parse AI Answers (weekly and pulse), Apply Analysis,
Analyst Jobs, AI Cache Rows, Prompt Rows, AI Plan and Pulse Plan.

- **One entity per business** (`dir`, line 145; `read`, line 228). The id is the registrable domain of its main site.
  - Subdomains fold in: europe.thomsonreuters.com becomes thomsonreuters.com.
  - Country and brand variants of one distinctive label fold in: cleartax.com + cleartax.in, edicom.com + edicomgroup.com,
    advintek.ae + advintekglobal.com, cygnet.one + cygnet.ae. The rule is the same core label; generic cores never merge.
  - Every spelling of one learned name is one key: "EDICOM" and "Edicom" are the same.
  - A name joins the domain its spelling names (ClearTax -> cleartax.com).
  - An ownership phrase in the answer joins two names: "X (formerly Y)", "Y, now part of X", "acquired by", "(a X company)"
    (`OWN_PHRASE`, line 227).
  - A list item's leading name joins the website on its line, or under it until the next item (Gemini's "### 1. Name … Website:").
  - A name inside a longer name of another business is not a mention ("Oracle" inside "Oracle NetSuite").
  - The id of a group is the owner's configured competitor, else the domain most names point to, else a .com, then the shortest.
- **A role per entity in each answer.**
  - `self`.
  - `competitor`: configured by the owner, or offered as an option.
  - `platform`, in one of three cases:
    - the client's services, topics or facts name it (`clientPlatforms`, line 138). techand.ai is a Dynamics 365 partner, so Microsoft
      is its platform;
    - every mention sits in an integration or partner context (`platformBefore` / `PLAT_AFTER`, line 215: "connectivity with your
      existing ERP (e.g., SAP, Oracle…)", "a Microsoft Dynamics 365 integrator", "plug into SAP");
    - the owner's configured competitors are never re-read as platforms.
  - `source`, in one of three cases:
    - cited and never named;
    - a government body, free zone, media site, directory, review site or research firm (`GOV` and the lists, line 55; name words
      such as Ministry, Authority, Free Zone, Yellow Pages);
    - quoted as a source ("according to X", "X reports").
  - `other`: search engines, social networks and AI assistants that are named but not cited.
- **Short names are found, and only as words** (`nameRe`, line 91). A name of up to 4 letters is case-sensitive: its capitals as written,
  or all capitals. So SAP, Zoho, Xero, Sage, BDO and Odoo are found, and "asap", "Sapient", "Zohoor" and "sage advice" are not.
  Longer names are matched case-insensitively, with Unicode word boundaries.
- **Arabic names** are matched with their attached one-letter prefixes (و ب ل ف ك, ال), so "ورواد التقنية" names رواد التقنية.
- **The text a reader sees** (`visible`, line 115). Link targets and footnotes (`[[1]](url)`) are citations, so they are dropped
  before names are read, and anchors are kept. "small business" is never business.com: no `indexOf` remains. A framework domain
  (ASP.NET) is not a business.
- **Brand names** (`brandNames`, line 122; `ownNames`, line 130). The brand names are the domain, the business name and the owner's
  brand names. The domain label counts only when it is a name: 5 or more letters, and not a common or category word, and not made
  only of such words ("payroll" no, "techand" yes).
  - A name ending in a symbol ("Tech&") may be written with a space ("Tech &"), but not when another capitalised word follows it
    ("Tech & Co Ltd" is another company).
  - The parser also drops a stale common-word label from an older plan.
- **E10 gate** (`vendorIn`, line 335). It finds the first company a question names, unless that company is the client or the client's
  own platform.
- **E16 claim identity** (`sameClaim` / `claimKey`, line 353). Two claims are the same claim when:
  - they contradict the same fact (the fact-sheet label is dropped: "City: Dubai" = "Dubai"; Jaccard >= 0.6 on the fact's stems), and
  - their stems overlap (Jaccard >= 0.5, with location and company filler words dropped).

### Where it is used

- `Parse_AI_Answers.js:52-70`, weekly, and the pulse through the same file. Every answer is read by `AIE.read`.
  - `competitors` now lists competitor entities only.
  - `brands` lists the client, its competitors and platforms, in order.
  - The excerpt comes from the visible text.
  - The parser reads the learned book from `$('Load Cache (AI)')` (the `ai_entities:<site>` row).
- `Apply_Analysis.js` (rewritten). The Answer Analyst's `role` is merged into the parser's entities instead of replacing them, and the
  E3 blind merge-back is gone.
  - The owner's configured competitors stay competitors.
  - Government bodies, directories and media stay sources.
  - The client's position is counted among the client and its competitors in the analyst's order. A competitor only the parser found
    is slotted in by its place in the text.
  - E16: each wrong claim is stored in the wording last week's report used (or the first wording earlier in this run, or in an
    earlier part of a split run). AI Metrics keys issues by text, so a reworded claim is no longer `new` and raises no High alert.
- `answer_analyst.txt`. The prompt asks for a `role` per brand (competitor, platform or source), for one entry per business, and
  passes "Platforms this business works with". The agent schema has `role` (`build_monitors.py:372`).
- `Analyst_Jobs.js:44` sends the analyst:
  - `known_competitors`: the owner's configured list only, because an auto rival may be a platform;
  - `platforms`: the client's own platforms.
- `AI_Cache_Rows.js` (rewritten).
  - Learned names point to an entity: `ai_brands:<site>` maps name -> canonical entity id. "EDICOM" and "Edicom" now point to one id,
    and europe.thomsonreuters.com is stored as thomsonreuters.com.
  - Names of entities this run read as a **platform or source** leave `ai_brands`, which AI Metrics' rival set and the fit gate read
    as rivals.
  - They go to a new cache row, `ai_entities:<site>` = `{ id: { r: role, n: [names], d: [domains], k: times seen } }`. The parser
    reads that row back.
  - The row order is kept, and new rows are appended.
- `AI_Plan.js:50` and `Pulse_Plan.js:102` each make one kit call for brand names (E5).
  - The pulse now includes the business name, as the weekly run does. Before, it passed no business name, so "Tech&" was not a pulse
    brand name.
  - The pulse plan also carries `services: AIE.servicesOf(s)` and `business_facts`, so the pulse knows the client's platforms
    (`Pulse_Plan.js:118`).
- `Prompt_Rows.js:70-73` (E10). A writer question that names another vendor is stored `refused`, and its `fit_note` names the vendor.
  Vendors include:
  - the owner's competitors, at any name length;
  - learned competitor names;
  - the big platforms the client does not declare;
  - the brands the AI-answer database names for the discovered questions ("AI names …").

  The client's own platform passes, and the owner's own questions never pass through this node.
- `ai_prompts.txt`: the writer must name no company or product at all, comparisons included. A build assertion in `build_monitors.py`
  checks this rule and the gate.

## The answer-row contract (agreed with F1b)

Every parsed answer row carries:

| field | meaning |
|---|---|
| `named` | boolean: the brand is named in the visible text, or by the engine's own brand list |
| `cited` | boolean: a URL of the client's site is cited (unchanged) |
| `mentioned` | `named` OR `cited`, kept for the app and existing readers |
| `position` | 1-based place of the client among self + competitor entities, in order of first mention (the analyst's order when it read the answer); `null` when not named |
| `rank` | `position \|\| 0` (compatibility) |
| `entities` | in memory on *Parse AI Answers* rows: `[{ id, name, role: self\|competitor\|platform\|source\|other, position\|null, cited }]` |
| `entities_json` | the same list as JSON (max 16), stored |
| `competitors` | competitor entity ids only (comma list, max 12) |

The *Apply Analysis* output, which is the stored row, has exact table columns. It carries `entities_json` but no `entities` array. Read
it with `AIE.entitiesOf(row)`, which takes either form. `AIE.sameEntity(a, b)` tells whether two ids are one business (registrable
domain or the same distinctive core label). F1b can use it to merge counts across answers.

## New columns (sync_tables.py adds them; `deploy_engine.py` runs it)

`seo_ai_answers` (in `ladder_common.py:187`):
- `named` boolean
- `position` number
- `entities_json` string

Old rows have none of these, so a reader must fall back to `mentioned` / `rank` / `competitors`. Production has no AI rows yet
(PROD_STATE section 3).

The new `seo_cache` key `ai_entities:<site_id>` needs no column change (the kind is `ai`).

## Accuracy (`harness/accuracy/ai_entities.json`, scorer `accuracy/score_ai_entities.js`, harness AIENT)

The set has 60 answers labelled entity by entity:
- **6 real** DataForSEO answers: the PROD_STATE section 5 set, `fixtures_live/scraper|r_gemini|r_perplexity|r_claude|aio|aimode.json`,
  with techand.ai's real plan from exec 623.
- **32 tuning** cases, one finding each.
- **22 hold-out** cases, written and committed (`d361b228`) before any code. They were scored once, at the end, and never tuned on.

| | before F1a (parser at 99fdd055) | after: tuning + real (38) | after: **hold-out (22)** | after: all 60 |
|---|---|---|---|---|
| competitor precision | 51.7% (56 false) | 100% | **100%** | 100% |
| competitor recall | 78.9% | 100% | **95.8%** | 98.7% |
| client named | 98.3% | 100% | **100%** | 100% |
| client cited | 100% | 100% | **100%** | 100% |
| client position exact | 61.7% | 100% | **95.5%** | 98.3% |
| platform / source roles | 16% | 100% | **100%** | 100% |

The only miss is **H03**, a hold-out case: "Payroll software options: Deel, Bayzat (bayzat.com), and Gulf Payroll Services." A business
named inline, with no website, no list item and no engine brand list, is not found. Recall loses Deel, and the client's position reads
2 instead of 3. It is the ratchet's one known miss.

**Bar, from the measured result:**
- precision >= 95, recall >= 95 and position >= 95 on all 60 cases;
- client named and client cited at 100;
- roles >= 95;
- weekly and pulse parser copies both scored.

**Ratchet:** a new miss fails the build, and so does H03 once it is fixed (remove it from `KNOWN_MISSES` in `scenarios_f1a.js`).

On the six real answers the client's flags were already right (none names techand.ai). The competitor lists change as follows:

| Answer | Before | After |
|---|---|---|
| ChatGPT | 7 competitors (EDICOM twice) | 6 |
| Gemini | 11 (cleartax.com and cleartax.in, EDICOM twice, microsoft.com, theinvoicinghub.com, uaeasp.ae) | 6; Microsoft is a platform, the hub and the ASP list are sources |
| Perplexity | 12 (Advintek twice, plus yellowpages, uaeasp, finline, azdan, thomsonreuters, all cited only) | 6 |
| Claude | 9 (Thomson Reuters three times, EDICOM twice) | 6 |
| AI Overview | 5 (meydanfz.ae among them) | 0: it names no business; every host is a footnote |
| AI Mode | 8 (SAP, Oracle, Microsoft, Zoho as integration targets; finline, citytech, flick cited only) | 1 (EDICOM); 4 platforms |

## Harness

- New file `harness/scenarios_f1a.js`, wired at the end of `scenarios_v5.js`. It holds these scenarios:

| Scenario | What it checks |
|---|---|
| AIENT | the labelled set and the ratchet, weekly and pulse |
| F1A-FINDINGS | each finding's labelled cases (tuning and real); every group has cases that miss on the code before F1a, except Arabic, which passed before and is kept as a control |
| F1A-CONTRACT | the row contract, and Apply Analysis's exact columns |
| F1A-E5 | AI Plan and Pulse Plan brand names; the pulse parser with an old plan on the audit's payroll.ae proof (it was mentioned, rank 1; now not named) |
| F1A-E3-METRICS | the audit's p_sources proof through AI Metrics: the review site is not a competitor and not a rival source, it is a PR source, and share of voice is 100 (it was 33.3) |
| F1A-E10 | the audit's three questions (all stored active before) are refused with the vendor named; Daftra from the AI-answer database is refused; the client's platform and a vendor-free question are kept |
| F1A-E16 | two rewordings are stored in last week's wording |
| F1A-LEARN | aliases are canonicalised, platforms and sources leave `ai_brands`, and the next pulse resolves from the book |

- Updated **S19 and S44** to the new truth:
  - "Zoho Books" is zoho.com, with "Zoho Books" kept in `brands`;
  - the new columns;
  - the third cache row.
- In `fixtures_monitors.js`, the writer's "Odoo or Business Central…" question is now vendor-free, because E10 refuses it by design.
- Build exit 0 (`--no-env`). Full harness: **11247 passed, 0 failed** (baseline 11008).

## Not done / for others

- **F1b (AI_Metrics.js / Pulse_Metrics.js, not edited here):**
  1. Add `'named', 'position', 'entities_json'` to `Pulse_Metrics.js` COLS (line 7), and to `ANS` in `scenarios_v5.js:2258`, so that
     pulse answer rows store them. Today the pulse rows are cut to the old columns.
  2. AI Metrics' `learned` map (around line 133) still learns every analyst brand with a domain as a rival (`addRival`). It should
     skip brands whose `role` is platform or source. AI Cache Rows already keeps them out of the stored `ai_brands`, but the
     in-memory rival set of the same run still takes them.
  3. Use `named` for "Named in" and `answerScore` (E7).
  4. Optionally count competitors per entity with `AIE.sameEntity` across answers. The ids are canonical per site, but two unknown
     variants met in separate answers can still differ.
- **A business named inline without a website** (H03): the parser finds names only from list items, the engine's brand list, known
  names, domains and the analyst. The weekly analyst covers it; the pulse does not.
- An auto rival from an earlier run that the client's services name is now read as a platform. That is intended, but the first week
  after deploy will show a lower competitor count. ENGINE_AUDIT deploy note: mark that week "measurement rule changed".
