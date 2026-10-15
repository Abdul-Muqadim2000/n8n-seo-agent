"""A stand-in for the n8n public API (Data Tables), for the B-R2 browser pass and for running the smoke test in a git worktree.

A worktree has no `n8n/.env` (it is gitignored), so the app has no n8n API key: every dashboard answers 503 and four smoke checks
fail on "N8N_API_KEY is not configured". This serves the endpoints the app uses — list the tables, read, insert, update, upsert and
delete rows, and executions — from memory, so the app can be exercised without the engine and without touching anybody's real data.

It is never part of the product, it is never deployed, and nothing in the app imports it: it is started by hand and stopped
afterwards. It starts with one `seo_profiles` row, for the one test domain in PROFILE_DOMAIN, so a shared report's brand is read
from a real profile row rather than mocked.

    docker run -d --name br2-stub --network seo-platform-dev_default \
      -e PROFILE_DOMAIN=br2-demo.example-shop.com -e PROFILE_NAME="Northwind Trading" \
      -e PROFILE_LOGO=https://brand.example-shop.com/northwind-logo.png \
      -v "$PWD/scripts":/srv:ro python:3.12-alpine python3 -I /srv/stub_n8n.py

then point the dev server at it (an override file beside compose.dev.yml, or N8N_BASE_URL / N8N_API_KEY in the environment):

    services: { server: { environment: { N8N_BASE_URL: http://br2-stub:8099, N8N_API_KEY: anything } } }

Stop it with `docker rm -f br2-stub` and recreate the server from `compose.dev.yml` alone when you are done.
"""
import json, os, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

TABLES = [
    'seo_ladders', 'seo_rank_history', 'seo_sites', 'seo_site_metrics', 'seo_query_history', 'seo_content_log', 'seo_trends',
    'seo_cadence', 'seo_console_alerts', 'seo_console_checkins', 'seo_profiles', 'seo_pages', 'seo_case_studies', 'seo_monitors',
    'seo_ai_prompts', 'seo_ai_answers', 'seo_ai_visibility', 'seo_ai_daily', 'seo_ai_pages', 'seo_ai_targets', 'seo_ai_growth',
    'seo_backlink_snapshots', 'seo_link_prospects', 'seo_backlinks', 'seo_link_imports', 'seo_link_graph', 'seo_audits',
    'seo_audit_findings', 'seo_page_watch', 'seo_ladder_settings', 'seo_ops_alerts', 'seo_run_ledger', 'seo_link_outreach',
    'seo_listings', 'seo_link_impact',
]
IDS = {name: str(1000 + i) for i, name in enumerate(TABLES)}
BY_ID = {v: k for k, v in IDS.items()}

DOMAIN = os.environ.get('PROFILE_DOMAIN', '')
ROWS = {name: [] for name in TABLES}
LOCK = threading.Lock()
SEQ = [1]

if DOMAIN:
    ROWS['seo_profiles'].append({
        'id': SEQ[0], 'site_id': 'stub', 'domain': DOMAIN,
        'business_name': os.environ.get('PROFILE_NAME', ''), 'logo_url': os.environ.get('PROFILE_LOGO', ''),
        'business_type': 'Organization', 'phone': '+000 0 000 0000', 'public_email': 'hello@' + DOMAIN,
        'street_address': '1 Example Street', 'author_name': 'Test Author', 'author_bio': 'Written for the browser pass',
        'updated_at': '2026-10-15T00:00:00Z',
    })
    SEQ[0] += 1

OPS = {'eq': lambda a, b: a == b, 'neq': lambda a, b: a != b, 'gt': lambda a, b: a > b, 'gte': lambda a, b: a >= b,
       'lt': lambda a, b: a < b, 'lte': lambda a, b: a <= b,
       'like': lambda a, b: str(b).strip('%').lower() in str(a).lower(), 'ilike': lambda a, b: str(b).strip('%').lower() in str(a).lower()}


def matches(row, filters):
    for f in filters or []:
        op = OPS.get(f.get('condition'), OPS['eq'])
        try:
            if not op(row.get(f.get('columnName')), f.get('value')):
                return False
        except TypeError:
            return False
    return True


def filters_of(q):
    raw = (q.get('filter') or [''])[0]
    if not raw:
        return []
    try:
        return json.loads(raw).get('filters', [])
    except Exception:
        return []


class H(BaseHTTPRequestHandler):
    def _send(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header('content-type', 'application/json')
        self.send_header('content-length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _body(self):
        n = int(self.headers.get('content-length') or 0)
        if not n:
            return {}
        try:
            return json.loads(self.rfile.read(n) or b'{}')
        except Exception:
            return {}

    def _parts(self):
        u = urlparse(self.path)
        return [p for p in u.path.split('/') if p], parse_qs(u.query)

    def _table(self, parts):
        return BY_ID.get(parts[3], '') if len(parts) >= 4 and parts[2] == 'data-tables' else ''

    def do_GET(self):
        parts, q = self._parts()
        if len(parts) == 3 and parts[2] == 'data-tables':
            return self._send({'data': [{'id': i, 'name': n} for n, i in IDS.items()], 'nextCursor': None})
        if len(parts) == 5 and parts[4] == 'rows':
            t = self._table(parts)
            with LOCK:
                data = [r for r in ROWS.get(t, []) if matches(r, filters_of(q))]
            return self._send({'data': data, 'nextCursor': None})
        if parts[:3] == ['api', 'v1', 'executions']:
            return self._send({'data': [], 'nextCursor': None})
        return self._send({'data': [], 'nextCursor': None})

    def do_POST(self):
        parts, _ = self._parts()
        t = self._table(parts)
        body = self._body()
        if not t:
            return self._send({'message': 'no such table'}, 404)
        rows = body.get('data') or []
        if isinstance(rows, dict):
            rows = [rows]
        with LOCK:
            if parts[-1] == 'upsert':
                fs = (body.get('filter') or {}).get('filters', [])
                hit = [r for r in ROWS[t] if matches(r, fs)]
                if hit:
                    for r in hit:
                        r.update(body.get('data') or {})
                    return self._send({'count': len(hit)})
                rows = [body.get('data') or {}]
            for r in rows:
                row = dict(r)
                row['id'] = SEQ[0]
                SEQ[0] += 1
                ROWS[t].append(row)
        return self._send({'count': len(rows)})

    def do_PATCH(self):
        parts, _ = self._parts()
        t = self._table(parts)
        body = self._body()
        fs = (body.get('filter') or {}).get('filters', [])
        with LOCK:
            hit = [r for r in ROWS.get(t, []) if matches(r, fs)]
            for r in hit:
                r.update(body.get('data') or {})
        return self._send({'count': len(hit)})

    def do_DELETE(self):
        parts, q = self._parts()
        t = self._table(parts)
        fs = filters_of(q)
        with LOCK:
            keep = [r for r in ROWS.get(t, []) if not matches(r, fs)]
            n = len(ROWS.get(t, [])) - len(keep)
            ROWS[t] = keep
        return self._send({'count': n})

    def log_message(self, *a):
        pass


ThreadingHTTPServer(('0.0.0.0', 8099), H).serve_forever()
