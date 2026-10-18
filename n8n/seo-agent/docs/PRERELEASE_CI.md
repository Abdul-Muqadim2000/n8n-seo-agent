# Pre-release check in CI (B5-7)

`POST /webhook/seo-prerelease` (workflow **SEO Agent — Pre-release Check**, `SEOagentPreRel1`) reads the key pages of a release candidate and
answers with a verdict a build can act on. It is **free** (one plain GET per page plus `/robots.txt` per host, nothing rendered, nothing paid)
and **writes nothing** (`writes: "none"`).

The workflow must be active in n8n, and the caller needs the API key (credential **SEO API Key**, header `X-API-Key`). Keep the key in your CI
secret store, never in the repository.

## Request

```json
{
  "base_url": "https://staging.example.com",
  "paths": ["/", "/pricing", "/services/erp"],
  "live_host": "example.com",
  "fail_on": "high",
  "expected": [
    "/pricing:canonical",
    { "path": "/old-offer", "check": "page_answers", "reason": "page retired in this release, redirect ships next sprint" }
  ]
}
```

| Field | Meaning |
|---|---|
| `base_url` + `paths`, or `urls` | what to check (at most 25 pages) |
| `live_host` | the address the pages get in production; with it the canonical is judged and a staging `noindex` / robots disallow is a warning that names the live page |
| `staging` | `false` makes `noindex` and a robots disallow fail (use it against the live host) |
| `fail_on` | `any` (default: every failure fails) · `low` · `medium` · `high` · `critical`: only failures of that severity or above fail the build. The others come back in `below_threshold`; nothing is hidden |
| `expected` | the changes this release makes **on purpose**. `"/path"` accepts every failure on that page, `"/path:check"` one check (`page_answers`, `no_redirect`, `indexable`, `robots_allows`, `canonical`, `title`, `h1`, `description`). Objects take an optional `reason`. Matching failures come back in `expected_changes` with the reason; an entry that matched nothing comes back in `expected_unused` (the change did not happen, or the list is stale: delete it) |

Severities: a page that does not answer 200 or redirects is `critical`; a missing / duplicated canonical, title or H1 is `high`; `medium` and
`low` are the lighter checks (a canonical to another page, a missing description). The check list is in the response (`checks_run`).

## Response

`{ ok, verdict, exit_code, summary, fail_on, counts, failures, expected_changes, below_threshold, expected_unused, warnings, not_checked, pages }`

* `exit_code` **0** pass · **1** fail · **2** the check could not be done (a bad request, or none of the pages could be read: CI must not treat
  "nothing was checked" as "fine").
* `counts.failed` is what fails the build; `counts.expected_changes` and `counts.below_threshold` are shown next to it.
* `not_checked` always says what a release candidate cannot be asked (index coverage, real-user speed, positions) and why.

## GitHub Actions

```yaml
name: seo-prerelease
on:
  pull_request:
    branches: [main]
jobs:
  seo:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check the release candidate
        env:
          SEO_URL: ${{ secrets.SEO_AGENT_URL }}      # e.g. https://your-n8n.example.com
          SEO_KEY: ${{ secrets.SEO_AGENT_KEY }}
        run: |
          code=$(curl -sS -o result.json -w '%{http_code}' \
            -H "X-API-Key: $SEO_KEY" -H 'Content-Type: application/json' \
            -d @seo-release.json "$SEO_URL/webhook/seo-prerelease")
          jq -r '.summary' result.json
          jq -r '.failures[] | "FAIL \(.severity) \(.url) \(.label): \(.detail)"' result.json
          jq -r '.expected_unused[]? | "STALE expected entry \(.path) \(.check)"' result.json
          # 200 with exit_code 0 passes; exit_code 1 (fail) and 2 (not checked) both stop the job
          test "$code" = 200 && jq -e '.exit_code == 0' result.json >/dev/null
      - uses: actions/upload-artifact@v4
        if: always()
        with: { name: seo-prerelease, path: result.json }
```

`seo-release.json` is the request body above, kept in the repository next to the release. Update its `expected` list in the same pull request
that makes the intended change, and remove entries once the change has shipped.

## Any shell

```sh
curl -s -H "X-API-Key: $SEO_KEY" -H 'Content-Type: application/json' -d @seo-release.json "$SEO_URL/webhook/seo-prerelease" \
  | jq -e '.exit_code == 0'
```

## What this does not do

It reads the pages it is given, once, at the moment you call it. It does not diff against production and does not know what changed: the
`expected` list is how you tell it. It does not render JavaScript (the audit's response-versus-render check does), and it never asks Google.
