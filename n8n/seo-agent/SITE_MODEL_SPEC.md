# One site model — spec (G19, v4.15, 2026-10-12)

Every feature used to invent its own facts about a site: its own host (`'https://' + domain`), its own idea of the business name, no
page inventory and no business facts, so the advice contradicted itself (system review 2026-10-11, SCORECARD §4 "Incoherence"; defects
D5, D10, D11, D15, D22). **One model now holds those facts, one kit reads them, two resolvers keep them fresh.**

This file is the contract for the items built on it: **D15** (canonical host everywhere), **D11** (page inventory), **D10** (publishable
page), **D22** (site description from several pages). §6 lists exactly what each must call.

---

## 1. Storage

### `seo_sites` — 12 new columns (`ladder_common.py` `SITES_COLS`)

| Column | What it holds |
|---|---|
| `canonical_host` | the host every URL we emit uses (`www.techand.ai` or `techand.ai`), no scheme, no slash |
| `business_name` | the name to call the business |
| `logo_url` | absolute logo URL |
| `nap_json` | JSON: `{business_name, street_address, city, region, postal_code, country_code, phone, public_email, price_range, source}` |
| `services_json` | JSON array of service names |
| `nav_pages_json` | JSON array `[{url, title}]` — the header / nav pages (D22 reads and extends this) |
| `business_facts` | the facts the owner allows us to state (from the app / the form) |
| `cta` | the main call to action |
| `brand_names` | comma-separated (the site's own names, from `seo_monitors` + the profile) |
| `competitors` | comma-separated bare domains |
| `accreditation` | short free text (e.g. "UAE MoF accredited service provider — unconfirmed") |
| `model_updated_at` | ISO timestamp — the model's age, which decides reuse |

### `seo_pages` — new table (`PAGES_TABLE` / `PAGES_COLS`)

`site_id`, `url`, `title`, `h1`, `source` (`sitemap` / `gsc` / `ai_pages` / `detected`), `lastmod`, `queries_json`
(`[{query, impressions, clicks, position}]`), `updated_at`. **Empty today — D11 fills it.** The table is created by the Site Tracker
(*Ensure Pages Table (Site)*) and by the main workflow (*Ensure Pages Table (Model)*).

> **Deploy:** "Ensure … Table" nodes never add a column to an existing table. After importing, run `python3 sync_tables.py` (or
> `apply_env.py`, which runs it) to add the 12 `seo_sites` columns to the live table; `seo_pages` is created on first use.

---

## 2. The kit — `v5/code/_site_model.js`

One `const SM` object, inlined by the builders wherever a node's source contains the marker `/*__SITE_MODEL__*/`
(`build_v4.py` `rd`, `build_site_tracker.py` `rd`). Add the marker to any node that needs it — nothing else.
Harness: `code_v4/_site_model.js` is a runnable shim written by `build_v4.py` section 30 (`run('_site_model', [{ json: { site_row,
extras, path, keyword } }])`).

| Call | Answers |
|---|---|
| `SM.from(siteRow, extras)` | the model (see §3) — `siteRow` is a `seo_sites` row (or a `SM.toRow` value from `seo_cache`), `extras` is what this run knows |
| `SM.stored(row)` | the model exactly as stored, with its own `model_updated_at` (`null` when the row holds no model) |
| `SM.siteUrl(model, path)` | `https://<canonical_host><path>` — one slash, no double slash; an absolute URL is returned unchanged. **Every URL we emit goes through this** |
| `SM.apiTarget(model)` | the **bare** domain — DataForSEO, Bing and the other APIs keep taking this |
| `SM.name(model)` | the business name (falls back to the bare domain) |
| `SM.nap(model)` | the NAP object (always every key, empty strings when unknown) |
| `SM.services(model)` | `string[]` |
| `SM.pages(model)` | the page inventory `[{url, title, h1, source, lastmod, queries}]` |
| `SM.facts(model)` | `{business_facts, cta, accreditation, pricing, timeline}` — `pricing` / `timeline` say whether price or timeline facts exist at all |
| `SM.matchPage(model, keyword)` | the page that already answers the keyword, or `null` (see §5) |
| `SM.withPages(model, pages)` | a copy of the model with more inventory rows merged in (deduplicated by path) |
| `SM.toRow(model)` | exactly the `seo_sites` columns the model owns (+ `site_id`, `domain`) — ready to merge into a site row or to store as a cache value |
| `SM.pageRows(model)` | exactly the `seo_pages` columns, one row per inventory page |
| `SM.isFresh(model, days?)` / `SM.ageDays(model)` / `SM.FRESH_DAYS` (7) | reuse decisions |
| `SM.COLUMNS`, `SM.MATCH_MIN` (0.75) | the column list and the match threshold |
| `SM.helpers` | `bare`, `normHost`, `hostOf`, `siteIdFor`, `termsOf`, `pathOf`, `orgFromHtml`, `navFromHtml` |

`extras` (everything optional): `html` (the homepage as a browser gets it), `final_url`, `canonical_host` / `probe` (*Analyze Probes*),
`seen_hosts` (the site's own live URLs), `profile` (a `seo_profiles` row), `homepage_org` (*Entity Check*'s parsed Organization),
`gbp` (the Google Business Profile listing), `request` (the normalised request: `business_facts`, `cta`, `business_name`, …),
`monitors` (a `seo_monitors` row: `brand_names`, `competitors`), `services`, `description` (the Site Describer's answer), `nav_pages`,
`pages` (inventory rows), `accreditation`, `site_id`, `domain`, `updated_at`.

### Examples

```js
/*__SITE_MODEL__*/                                  // the builder inlines the kit here
const model = SM.from(siteRow, { html, profile, request: $('Rate Limit').first().json });
SM.siteUrl(model, '/erp-software-uae/');            // https://www.techand.ai/erp-software-uae/
SM.apiTarget(model);                                // techand.ai
SM.name(model);                                     // Tech&
SM.nap(model).city;                                 // Dubai
SM.matchPage(model, 'uae e invoicing penalties');   // { url, title, source, matched_by: 'slug', score: 1 }
return [{ json: { ...siteRow, ...SM.toRow(model) } }];
```

---

## 3. The model

```js
{ site_id, domain, canonical_host, host_source, home_url,
  business_name, name_source, logo_url, logo_source,
  nap: { business_name, street_address, city, region, postal_code, country_code, phone, public_email, price_range, source },
  services: [], nav_pages: [{ url, title, path }], pages: [{ url, title, h1, source, lastmod, queries }],
  business_facts, cta, brand_names: [], competitors: [], accreditation,
  model_updated_at, sources: { profile, homepage_schema, gbp, app, html } }
```

**Canonical host** (first that answers): *Analyze Probes*' `canonical_host` → the homepage's own `rel=canonical` (ignored when it points
at another domain) → where the homepage request landed → the host the site's own live URLs use → the stored value → the bare domain.
`host_source` says which. The n8n sandbox has no `URL` constructor, so hosts are parsed with regexes.

**Name / logo / NAP precedence:** `seo_profiles` → the homepage `Organization` / `LocalBusiness` JSON-LD → Google Business Profile →
what the app sent → the stored row. Field by field, so a profile without a phone still takes the phone from the homepage schema;
`nap.source` names the source of the street address (or of the phone when there is no address).

---

## 4. Where the resolvers run

**Weekly — Site Tracker** (`build_site_tracker.py`): `Any Sites?` → **Model Targets (Site)** (which sites have a model older than
7 days) → **Need Homepage (Site)?** → **Fetch Homepage (Site)** (one plain GET, redirects followed, free) → **Site Model (Site)**
(one item per site: `{site_id, domain, model, rebuilt, homepage_status, age_days}`) → the publish detection as before.
New loads feed it: *Load Profiles (Site)*, *Load Monitors (Site)*; *Ensure Pages Table (Site)* creates `seo_pages`.
**Site Metrics** reads `$('Site Model (Site)')`, merges `SM.toRow(model)` into `site_row` (upserted into `seo_sites` by *Save Sites*)
and publishes `json.site` (`canonical_host`, `home_url`, `business_name`, `services`, `nav_pages`, `nap`, `pages_known`).
**Brief Input** passes that on as `facts.website`, and `v5/prompts/site_brief.txt` tells the brief to use it.

**On demand — main workflow** (`build_v4.py` section 30, before *Route Mode*, so every mode has it): *Use Cached Description* →
*Ensure Sites Table (Model)* → *Ensure Pages Table (Model)* → *Load Site Row (Model)* → *Load Profile (Model)* → **Site Model Plan**
(reuse or rebuild) → *Need Homepage (Model)?* → *Fetch Homepage (Model)* → **Site Model** → *Model Cache Row* → *New Site Model?* →
*Save Site Model* → *Restore Site Model* → *Need Site Read?*.
The stored model comes from the `seo_sites` row **and** from `seo_cache` `model:<site_id>` (one more condition on the existing
*Load Site Cache* node, so it is still one cache read per run). A model younger than 7 days is reused; a rebuilt one is written to
**`seo_cache` only** — never to `seo_sites`, because a row there would start the weekly paid runs for a site nobody registered.

Every later node reads it as **`$('Site Model').first().json.site_model`** (the item itself also carries `site_model`,
`site_model_reused`, `site_model_source`).

---

## 5. `SM.matchPage(model, keyword)` — the page a keyword already has

A page matches when **either**

1. it already gets impressions for the exact query (`queries_json`, `impressions > 0`) → `matched_by: 'query'`, or
2. **≥ 75 %** of the keyword's *meaningful* words are in its slug or in its title / H1 → `matched_by: 'slug' | 'title'`.

Meaningful = longer than one character and not a stop word. That one rule keeps the S26 false-match pair apart: *"e invoicing uae
penalties"* against `/uae-e-invoicing-fta-rules/` ("UAE e-invoicing: FTA rules explained") scores 2 of 3 (`invoicing`, `uae`; not
`penalties`) and does **not** match, while *"uae e invoicing penalties"* finds
`/insights/the-cost-of-non-compliance-uae-e-invoicing-penalties-mitigation-costs` with 3 of 3.
The best-scoring page wins; the answer is `{url, title, source, matched_by, score, impressions}` or `null`.
**The inventory is empty until D11 fills `seo_pages`** — the rule is already here and tested (S35).

---

## 6. Hooks — what the next items call

**D15 (canonical host everywhere).** Replace every `'https://' + domain` with `SM.siteUrl(model, path)`; keep `SM.apiTarget(model)` for
API payloads. The model reaches a node either as `$('Site Model').first().json.site_model` (main workflow),
`$('Site Model (Site)').all()` (Site Tracker) or, in the monitor workflows, by `SM.stored(siteRow)` on the `seo_sites` row the run
already loads (`_monitor_sites.js` sites carry every column). Add `/*__SITE_MODEL__*/` to the node's source and the kit is inlined.
The build-time lint for `'https://' + domain` belongs to D15, not here.

**D11 (page inventory).** Build the rows in the Site Tracker from the sitemap, the Search Console pages and `seo_ai_pages`, then
`SM.withPages(model, rows)` and `SM.pageRows(model)` → upsert into `seo_pages` (`PAGES_TABLE` / `PAGES_COLS`, keys `site_id` + `url`).
Consumers (Ladder Plan, discovery, Tracker Report, Site Metrics advice, the cadence) ask `SM.matchPage(model, keyword)`: a hit means
`improve` / "refresh the existing page" with `match.url`, never "publish it". Load the rows wherever the model is built and pass them as
`extras.pages` (or `SM.withPages`).

**D10 (publishable page).** `SM.name(model)` and `SM.nap(model)` for the schema and the NAP block (precedence profile → homepage
schema → GBP, so a site without a profile still gets its real name); `SM.facts(model).pricing` / `.timeline` to allow a cost or timeline
angle only when such facts exist; `SM.facts(model).business_facts` / `.cta` for the brief. `SM.siteUrl(model, slug)` for `pageUrl` /
`home`.

**D22 (site description from several pages).** `model.nav_pages` holds the header / nav pages found on the homepage (same host, max 12,
with their link text): use them as the pages to read beside the homepage, then pass the result back as `extras.services` /
`extras.nav_pages` so the model (and `services_json`) carries the full service list. The critic gets `SM.services(model)`: a claim in
that list is not "invented".

---

## 7. Tests

Harness **S35** (`harness/scenarios_v5.js`, 36 assertions): `SM.siteUrl` on www / bare / trailing slash / absolute, the canonical-host
precedence (canonical tag, live URLs, stored, another domain ignored), name / logo / NAP precedence through all four sources,
`SM.facts` pricing + timeline, services and nav pages, `matchPage` (the D11 positive, the S26 false-match pair, a query match, no
match), `SM.toRow` / `SM.pageRows` against the live column lists (`harness/table_cols.json`, written by the build), the weekly resolver
(stale site read, fresh one reused, the `seo_sites` row with exactly the table columns, registration fields untouched, the brief's
`facts.website`), and the on-demand resolver (first run reads the homepage, the cache row, reuse at 3 days, rebuild at 9 days, no
website = no request). `2363 node runs and assertions, 0 failed` on 2026-10-12.

## 8. Cost

One extra plain HTTP GET per site per week (Site Tracker) and at most one per on-demand run on a site whose model is older than a
week. No paid API, no AI call. **$0.**
