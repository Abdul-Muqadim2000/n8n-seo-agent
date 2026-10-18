# Alaventra — Looker Studio community connector

Puts a company's Alaventra data in Looker Studio: **one website and one table per data source**, read from the app's read API with a
company API key. The tables are the warehouse export's (`app/docs/INTEGRATIONS.md` §6, `EXPORT_TABLES` in
`app/shared/src/integrations.ts`): `rank_history`, `site_metrics`, `audit_findings`, `ai_visibility`, `backlinks`, `runs` — typed fields
with descriptions, the date range applied server-side (`since` / `until` on each table's date column).

| File | What |
|---|---|
| `Code.gs` | The connector: `getAuthType` (an API key), `setCredentials` / `isAuthValid` / `resetAuth`, `getConfig` (app address → website → table, date range required), `getSchema` (from `GET /api/v1/tables`), `getData` (pages of `GET /api/v1/websites/:id/tables/:table`) |
| `appsscript.json` | The manifest: V8, `script.external_request` only, the `dataStudio` block |
| `test/connector.test.mjs` | Runs `Code.gs` in Node with stand-ins for Apps Script and the read API: `node integrations/looker-studio/test/connector.test.mjs` |

Reference: https://developers.google.com/looker-studio/connector/build and https://developers.google.com/looker-studio/connector/reference

## What it needs

- An Alaventra address on **https** (the connector refuses anything else).
- A company API key with **only "Read"** — Company settings → API access. The key is stored in the person's own Apps Script user
  properties, never in the report; each person who adds the data source pastes their own key. Revoking the key in Alaventra stops it.
- 120 requests a minute per key (each page is 100 rows; a 20,000-row table is 200 requests — prefer the BigQuery export for big
  history, and Looker Studio's BigQuery connector on top of it).

## Deploy it (once per Alaventra installation)

1. Open https://script.google.com and create a **New project**; name it `Alaventra connector`.
2. **Project Settings** → tick **Show "appsscript.json" manifest file in editor**.
3. Replace the contents of `Code.gs` and `appsscript.json` with the two files here. In `appsscript.json`, replace
   `YOUR-ALAVENTRA-ADDRESS` with this installation's host (the logo must be a public **PNG**; export
   `app/web/public/brand/alaventra-app-icon.svg` to `alaventra-app-icon.png` and serve it, or point at any public PNG of the mark — the
   brand rules in `app/web/brand/BRAND.md` apply: the supplied mark only, never redrawn or recoloured).
4. **Deploy → Test deployments** and copy the **Head Deployment ID** (it always runs the latest code). For a frozen version, use
   **Deploy → New deployment** (type **Add-on**) and copy that deployment's id instead.
5. Open `https://lookerstudio.google.com/datasources/create?connectorId=<Deployment ID>` and authorise the script (it asks only to
   connect to an external service).
6. To let the whole company use it, share the Apps Script project with them (view access is enough for a head deployment), or create a
   versioned deployment and share its link. Publishing it in Looker Studio's public gallery is optional and needs Google's review.

## Use it

1. Looker Studio → **Create → Data source** → the Alaventra connector (or the link from step 5).
2. Paste the read-only API key when asked.
3. Fill in the **Alaventra address** (`https://…`, no path) → **Next** → choose the **website** and the **table** → **Connect**.
4. The fields arrive typed: text as dimensions, counts and rates as metrics (positions averaged, counts summed), timestamps and dates
   as date dimensions. The table's date column is the default dimension; the report's date range filters it.

## Errors it shows

| Message | Why |
|---|---|
| "Alaventra refused the API key" | unknown, revoked or expired key — create a new one |
| "Verify that you own … in the app" | the website is not verified in Alaventra yet, so its data is not readable |
| "Not found: check the website and the table" | a website of another company, or a removed one |
| "Too many requests" | the key's 120 a minute — wait a minute |

## Not built

- OAuth sign-in instead of a key (needs a registered OAuth client per installation).
- Several websites or tables in one data source: blend data sources in Looker Studio instead.
- Caching: every refresh reads Alaventra again (Looker Studio caches on its side for 12 hours by default).
