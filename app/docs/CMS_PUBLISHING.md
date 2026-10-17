# CMS publishing (gap G2, 2026-10-17)

Market benchmark gap #4 (`n8n/seo-agent/docs/system-review-2026-10-17/MARKET_BENCHMARK.md` §5): the weekly cadence writes pages
that sit unpublished — the Content Cadence's pile-up guard then stops writing — while Profound, Search Atlas and Semrush push the
page into the customer's CMS. This is the app path that does it: a written page goes from its report to **WordPress**, **Webflow**,
**Contentful** or **any other stack through a signed webhook**, as a draft by default, and the engine is told when it goes live.

It **supersedes the n8n WordPress sub-workflow** (`SEOagentWordPres`, inactive since v4.2). That workflow stays in n8n untouched; nothing
calls it, and new work goes here because the app holds the per-company credentials, the roles and the audit trail the engine does not.

## 1. What it does

1. An admin connects a CMS for one website (Website settings → **Publishing**): kind, address, credentials, the field mapping, and the
   address pattern of a live page. **Test connection** checks the credentials, reads what the CMS offers (WordPress: the user's
   capabilities and the SEO plugin's REST fields; Webflow: the collection's fields; Contentful: the content type's fields and the
   default locale) and stores it for the mapping.
2. On a page report the **Publish to your CMS** panel lists what blocks publishing (§3). When nothing does, a member sends it **as a
   draft**; an owner or admin may **publish it live** after ticking an explicit confirmation.
3. The CMS item is remembered per connection and slug: sending again (the same report, or a newer page for the same slug) **updates
   the same item** — never a second post.
4. Every attempt is recorded — who, when, where, draft or live, the remote id and address, the outcome, and every refusal with its
   reasons — and shown on the report, on the Content page and in the Pipeline's *Needs you*.
5. When a page **goes live** (published from the app, or a draft later published in the CMS and found by **Check if it is live**),
   the app starts the engine's *I published a page* run (`mode: published`, free): the engine reads the live page, writes the content
   log row as published, marks the ladder row, and the pile-up guard counts one page fewer.

## 2. Threat model and failure modes

| Risk | What stops it |
|---|---|
| A page the run did not stand behind reaches a live site (QA failed, DRAFT, refused, could not be checked) | `cmsReadiness()` (shared) calls the delivery rule `deliveryDecision()` of `report-delivery.ts` unchanged, adds `meta.publishable === false`; **no override exists**, for drafts or live, for any role |
| Unfinished text reaches a live site (`[Confirm: …]`, `[Owner: …]`, `[Price]`, `[Author Name]`, `[Image: …]`) | every bracket the engine's Content QA counts (`PH_RE`) **plus** the labelled forms with a colon, in the HTML, title, H1, meta description and author; each one listed with its count; blocks draft and live |
| A quality check that never ran | draft allowed with a warning; **live refused** |
| Someone without the right publishes live | draft: member+; live: admin/owner **and** `confirmLive: true` in the body; the server checks both, the UI only mirrors them |
| SSRF through a typed CMS address (`https://169.254.169.254/…`, `https://10.0.0.5`, DNS rebinding) | `https://` only, host refused by name (`cmsUrlOk`), and the connection's DNS lookup is pinned to public addresses (`publicLookup` of `services/verify.ts` — the address checked is the address connected to); redirects are not followed |
| Credentials leak | sealed with AES-256-GCM under `MAILBOX_KEY` (`lib/secretBox.ts`, the mailbox key); never returned to the browser (`hasSecret` only), never logged, never in a record or error; without the key no connection can be saved |
| Double click / two tabs create two posts | per item a lease (`lock_until`, 2 minutes) taken by an atomic update; the second request gets a 409. Before creating, each connector looks the slug up in the CMS and **adopts** an item that already carries it — so a lost database write cannot create a duplicate either |
| One company reaches another's connection, report or item | every query is scoped by `org_id`, the connection by `site_id`; a report of website A cannot be sent through website B's connection; ids that are not the caller's are 404 |
| The CMS answers slowly or with nonsense | 30 s timeout, 5 MB response cap, JSON parsed defensively; the attempt is recorded `failed` with the CMS's own status and a short reason; nothing in the engine changes |
| CSRF | the app-wide `X-Requested-With: fetch` guard on every state-changing route |
| The engine is not told | recorded on the attempt (`engineRunId` or `engineNote`); "Check if it is live" retries it; the weekly Site Tracker's publish detection still finds the page |

## 3. The publishing rule

`cmsReadiness({ stage, status, payload, siteDomain })` in `shared/src/cms.ts` (unit-tested) returns `blockers`, `warnings`,
`draftAllowed`, `liveAllowed` and the normalised page package. Blockers (both modes):

- not a written page (`stage !== 'content'` or no HTML / Markdown);
- **the delivery rule refuses it** (`deliveryDecision`: rejected, not ready / QA failed, refused, could not be checked, interim);
- the package says `publishable: false` (the `-DRAFT` file the engine names that way carries the same flag);
- **placeholders left** — listed with counts;
- no title or no slug; the page was written for another domain than the website.

Live only: the quality check did not run (`qa_publishable == null` and no "passed" summary).

## 4. Connectors

`server/src/services/cms/connectors/` — one module per CMS behind one interface, so AEM, Sanity, Shopify or HubSpot add a file and a
kind, nothing else:

```ts
interface CmsConnector {
  kind: CmsKind;
  test(c: ConnCtx): Promise<CmsTestResult>;                       // credentials + what the CMS offers (fields, plugin, locale)
  find(c: ConnCtx, page: CmsPage): Promise<RemoteItem | null>;     // adopt an existing item with the slug
  push(c: ConnCtx, page: CmsPage, o: PushOptions): Promise<PushResult>;  // create or update; draft or live
  status(c: ConnCtx, remoteId: string): Promise<RemoteItem | null>; // is it live now?
}
```

All HTTP goes through `cms/http.ts` (`cmsRequest`), the only place that opens a socket; tests replace it.

### WordPress (REST API + Application Passwords)
- Auth: HTTP Basic with the user name and an **Application Password** (WordPress 5.6+) —
  https://developer.wordpress.org/rest-api/using-the-rest-api/authentication/#basic-authentication-with-application-passwords,
  https://make.wordpress.org/core/2020/11/05/application-passwords-integration-guide/
- Test: `GET /wp-json/wp/v2/users/me?context=edit` (who, capabilities incl. `unfiltered_html`, `publish_posts`) —
  https://developer.wordpress.org/rest-api/reference/users/ ; `OPTIONS /wp-json/wp/v2/posts` (or `/pages`) for the registered `meta`
  keys (Yoast `_yoast_wpseo_title` / `_yoast_wpseo_metadesc` / `_yoast_wpseo_focuskw`, Rank Math `rank_math_title` /
  `rank_math_description` / `rank_math_focus_keyword` — only when the site exposes them with `show_in_rest`).
- Find: `GET /wp-json/wp/v2/{posts|pages}?slug=<slug>&status=publish,future,draft,pending,private&context=edit` —
  https://developer.wordpress.org/rest-api/reference/posts/#list-posts
- Create / update: `POST /wp-json/wp/v2/{posts|pages}` and `POST …/{id}` with `title`, `content`, `excerpt`, `slug`,
  `status` (`draft` | `publish`), `categories`, `tags` (posts only), `featured_media`, `meta` —
  https://developer.wordpress.org/rest-api/reference/posts/#create-a-post, https://developer.wordpress.org/rest-api/reference/pages/
- Categories / tags by name: `GET /wp-json/wp/v2/categories?search=…`, `POST /wp-json/wp/v2/categories {name}` (same for `tags`) —
  https://developer.wordpress.org/rest-api/reference/categories/, https://developer.wordpress.org/rest-api/reference/tags/
- Images: `POST /wp-json/wp/v2/media` with the bytes, `Content-Type: image/webp` and `Content-Disposition: attachment;
  filename="…"`, then `POST /wp-json/wp/v2/media/{id}` with `alt_text` and `caption` — https://developer.wordpress.org/rest-api/reference/media/ .
  The hero becomes `featured_media`; the `src` of every uploaded image in the article is rewritten to the media URL. An image already
  uploaded for this item is not uploaded twice (its media id is kept on the item).
- SEO fields: with the plugin's fields exposed → `meta`; without → the meta description goes into the **excerpt** and the record says
  so (with the guide to expose the fields or paste them).
- Structured data: appended as `<script type="application/ld+json">` **only** when the user has `unfiltered_html` (otherwise WordPress
  strips it); otherwise the record says to add it through the SEO plugin.

### Webflow (Data API v2, CMS)
- Auth: `Authorization: Bearer <site API token>` with `cms:read`, `cms:write` —
  https://developers.webflow.com/data/reference/authentication/site-token
- Test: `GET https://api.webflow.com/v2/collections/{collection_id}` (fields: `slug`, `displayName`, `type`, `isRequired`) —
  https://developers.webflow.com/data/reference/cms/collections/get
- Find: `GET /v2/collections/{id}/items?slug=<slug>` (exact slug filter) —
  https://developers.webflow.com/data/reference/cms/collection-items/staged-items/list-items
- Create: `POST /v2/collections/{id}/items` with `{ isArchived: false, isDraft, fieldData: { name, slug, …mapped } }` —
  https://developers.webflow.com/data/reference/cms/collection-items/staged-items/create-item ;
  update: `PATCH /v2/collections/{id}/items/{item_id}` —
  https://developers.webflow.com/data/reference/cms/collection-items/staged-items/update-item
- Live: `isDraft: false`, then `POST /v2/collections/{id}/items/publish { itemIds: [id] }` —
  https://developers.webflow.com/data/reference/cms/collection-items/staged-items/publish-item
- Mapping: `name` ← title and `slug` ← slug always; body HTML → a *Rich text* field; SEO title, meta description, excerpt, keyword,
  author → *Plain text* fields, chosen from the collection's own fields after the test. Images: not uploaded (Webflow imports images
  from a public URL; the app's files are private) — the record says to add the hero in Webflow.

### Contentful (Content Management API)
- Auth: `Authorization: Bearer <CMA token>`, `Content-Type: application/vnd.contentful.management.v1+json`, base
  `https://api.contentful.com` — https://www.contentful.com/developers/docs/references/content-management-api/ ,
  https://www.contentful.com/developers/docs/references/authentication/
- Test: `GET /spaces/{space}/environments/{env}/content_types/{ct}` (fields: `id`, `name`, `type`) and `GET …/locales` (the default
  locale) — https://www.contentful.com/developers/docs/references/content-management-api/#/reference/content-types ,
  https://www.contentful.com/developers/docs/references/content-management-api/#/reference/locales
- Find: `GET /spaces/{space}/environments/{env}/entries?content_type={ct}&fields.{slugField}={slug}` —
  https://www.contentful.com/developers/docs/references/content-management-api/#/reference/entries/entries-collection
- Create: `POST …/entries` with `X-Contentful-Content-Type: {ct}` and `{ fields: { <id>: { <locale>: value } } }`; update: `PUT
  …/entries/{id}` with `X-Contentful-Version: <sys.version>`; publish: `PUT …/entries/{id}/published` with `X-Contentful-Version` —
  https://www.contentful.com/developers/docs/references/content-management-api/#/reference/entries/entry ,
  https://www.contentful.com/developers/docs/references/content-management-api/#/reference/entries/entry-publishing
- Mapping: title, slug and the body are required; the body goes to a *Text* (long text, Markdown) or *Symbol* field. A *RichText*
  field is refused with the reason (see §8). Status: `sys.publishedVersion` present and `== sys.version - 1` → live.

### Generic signed webhook (any other stack, a Git pull-request bot)
- `POST <your https URL>` with the page package as JSON (`cmsWebhookBody()`), headers `X-Ascentra-Timestamp`,
  `X-Ascentra-Signature: sha256=<hex HMAC-SHA256 over "<timestamp>.<body>">` (the same scheme as report delivery), `Idempotency-Key:
  <item id>` (the same for every send of the same item) and `X-Ascentra-Event: cms.publish`.
- The signing secret is generated by the app when the connection is made and **shown once**.
- A `2xx` answer is success; a JSON body `{ "id", "url", "status": "draft" | "published" }` is stored as the remote item. Anything else
  is a failure with the status code.

## 5. Data model (migration `0009_cms_publishing`)

- `cms_connections` — one row per connection of a website: `kind`, `label`, `base_url`, `username`, `secret` (sealed), `settings`
  (jsonb, non-secret: post type, categories, tags, collection / space / environment / content type, field map, locale, the fields the
  last test read, the address pattern), `status` (`untested` | `ok` | `error`), `status_reason`, `last_tested_at`, `created_by`.
- `cms_items` — one per connection × slug (unique): `remote_id`, `remote_url`, `remote_status` (`draft` | `published`), `keyword`,
  `last_report_id`, `media` (uploaded image ids), `lock_until`, `engine_told_at`.
- `cms_publishes` — the log: one row per attempt or refusal — `report_id`, `connection_id`, `item_id`, `user_id`, `mode`, `status`
  (`sent` | `failed` | `blocked`), `remote_id`, `remote_url`, `target` (host / CMS label — never a secret), `error`, `notes`,
  `blockers`, `engine_run_id`, `created_at`. Kept when the connection is removed (`set null`), so the history survives.

No separate audit log exists in this branch; `cms_publishes` is the audit trail of publishing, and connection changes are stamped
(`created_by`, `updated_at`). When a company audit log lands, `services/cms/service.ts` `audit()` is the one place to forward to.

## 6. API (also in `app/API.md`)

| Method | Path | Role | |
|---|---|---|---|
| GET | `/api/orgs/:org/sites/:site/cms/connections` | viewer | list (no secrets) |
| POST | `/api/orgs/:org/sites/:site/cms/connections` | admin | connect (webhook: answers the signing secret once) |
| PATCH | `/api/orgs/:org/sites/:site/cms/connections/:id` | admin | change; `secret` left out keeps it |
| DELETE | `/api/orgs/:org/sites/:site/cms/connections/:id` | admin | remove (the history stays) |
| POST | `/api/orgs/:org/sites/:site/cms/connections/:id/test` | admin | test, read fields, store the status |
| GET | `/api/orgs/:org/sites/:site/cms/state` | viewer | items and the latest attempts of the website (Content page) |
| GET | `/api/orgs/:org/reports/:report/cms` | viewer | readiness, connections, this page's items, its history |
| POST | `/api/orgs/:org/reports/:report/cms/publish` | member (draft), admin (live) | `{ connectionId, mode, confirmLive }` |
| POST | `/api/orgs/:org/reports/:report/cms/refresh` | member | `{ connectionId }`: read the CMS status; live → tell the engine |

Rate limits: publish 10 / minute, test 10 / minute per user.

## 7. UI

- Website settings → **Publishing** (`/o/:org/sites/:site/settings/publishing`): connection cards (status, last test, what it
  publishes to), **Connect a CMS** dialog per kind with a *Show me how* guide (`wordpress-application-password`,
  `webflow-api-token`, `contentful-cma-token`, `cms-webhook`), Test, field mapping from the fields the test read, defaults.
- Page report → **Publish to your CMS** panel: the blockers with their placeholders, warnings, **Send as draft**, **Publish live**
  (admins, with a confirmation that names the CMS and the address), the item's state with its link, **Check if it is live**, the history.
- Content page: each written page shows *Draft in WordPress* / *Live in Webflow* with the link.
- Pipeline → *Needs you*: a page waiting to be published says when a draft is already in the CMS and offers **Send to your CMS** (opens
  the report) when a connection exists.

## 8. Limits and what is deliberately not built

- **No override** of a block — the same stance as report delivery (B-R1).
- **No scheduled or automatic publishing.** Every send is a person's click; automatic CMS drafts from the cadence are a later option
  once the owner decides (it would change who is accountable for what appears on the site).
- **No HTML → Contentful Rich Text conversion.** Rich Text is a JSON document model; a lossy converter would silently drop tables and
  structured data. Map the body to a long-text (Markdown) field.
- **No Webflow image upload.** The Assets API needs a two-step presigned upload and the item field imports from a public URL; the
  app's files are private. The hero's alt text and file name are in the record to add by hand.
- **No unpublish / delete in the CMS.** The app never removes content from a customer's site; "Unpublish" on the Content page stays
  an engine-side bookkeeping action.
- AEM, Sanity, Shopify, HubSpot: the connector interface is ready; each needs its own credential model and is a file in
  `connectors/` plus a kind in `CMS_KINDS`.
- Plain `http://` and private addresses are refused. `CMS_ALLOW_PRIVATE_HOSTS=true` lifts that for a local WordPress in development
  only (ignored when `NODE_ENV=production`).

## 9. Tests

- `shared/src/cms.test.ts` — the rule (each blocker, each warning, live vs draft), placeholder detection incl. the colon forms and
  Markdown links, the package, the URL check, field-map validation, the webhook body.
- `server/test/cmsConnectors.test.ts` — the request shapes of each vendor against a recorded fake transport: WordPress (find, create,
  update, media, categories, Yoast meta vs excerpt, JSON-LD only with `unfiltered_html`), Webflow (create draft, update, publish),
  Contentful (create with the content-type header, update with the version, publish), webhook (signature verifies, idempotency key).
- `server/test/cmsRoutes.test.ts` — against a real Postgres (`DATABASE_URL`; skipped without one): roles (viewer / member / admin),
  cross-company isolation (404 for another company's site, connection, report), CSRF, the block (QA failed, placeholders), draft by
  member, live refused without `confirmLive` and for members, idempotent re-publish (same remote id, update not create), the lease
  (409), the engine told after live only, secrets never in a response, SSRF refusal of private hosts.
