#!/usr/bin/env python3
"""sync_credentials.py — (re)creates the SEO Agent's n8n credentials from n8n/.env, so every secret lives in one file.

Default mode "values": the literal values from .env are written into the credential records (re-run after every .env change, or
simply run apply_env.py). Mode "expressions" writes `={{ $env.SEO_... }}` instead, which only works when the instance allows $env
access (N8N_BLOCK_ENV_ACCESS_IN_NODE=false; off by default: live finding 2026-10-02 'access to env vars denied') and never for the
trigger credentials (form login, API keys), which stay literal in both modes. To change a client's values: edit n8n/.env, then `docker compose up -d n8n` (recreate, a plain
restart does not reload .env). Mode "values" writes the literal values from .env into the credential records instead (for an instance
where $env access is blocked, N8N_BLOCK_ENV_ACCESS_IN_NODE=true); then re-run this script after every .env change.

A credential whose env variables are empty is skipped (never overwrite a working credential with an empty value). Nothing is printed
except ids and field names.

Usage: python3 sync_credentials.py [--mode expressions|values] [--only SEOcredGoogleSvc,SEOcredSmtpGmail] [--dry-run]
"""
import json, os, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
ENV_FILE = os.path.join(HERE, '..', '.env')
CONTAINER, PROJECT = 'n8n-n8n-1', 'wo1WpMiHjdduGvfl'
SCOPES = 'https://www.googleapis.com/auth/webmasters.readonly https://www.googleapis.com/auth/analytics.readonly'
# id, name, type, secret fields (field -> env var), fixed fields, optional transform per field (expression, value)
CREDS = [
    ('SEOcredDataForSE', 'DataForSEO', 'httpBasicAuth', {'user': 'SEO_DATAFORSEO_LOGIN', 'password': 'SEO_DATAFORSEO_PASSWORD'}, {}),
    ('SEOcredJinaReade', 'Jina Reader', 'httpHeaderAuth', {'value': 'SEO_JINA_API_KEY'}, {'name': 'Authorization'}),
    ('SEOcredPageSpeed', 'Google PageSpeed', 'httpHeaderAuth', {'value': 'SEO_PAGESPEED_API_KEY'}, {'name': 'X-Goog-Api-Key'}),
    ('SEOcredAnthropic', 'Anthropic (SEO Agent)', 'anthropicApi', {'apiKey': 'SEO_ANTHROPIC_API_KEY'}, {}),
    ('SEOcredFormLogin', 'SEO Form Login', 'httpBasicAuth', {'user': 'SEO_FORM_USER', 'password': 'SEO_FORM_PASSWORD'}, {}),
    ('SEOcredApiHeader', 'SEO API Key', 'httpHeaderAuth', {'value': 'SEO_API_KEY'}, {'name': 'X-API-Key'}),
    ('SEOcredApiTest01', 'SEO API Key (test)', 'httpHeaderAuth', {'value': 'SEO_API_KEY_TEST'}, {'name': 'X-API-Key'}),
    ('SEOcredSmtpGmail', 'Gmail SMTP (SEO Agent)', 'smtp', {'user': 'SEO_SMTP_USER', 'password': 'SEO_SMTP_PASSWORD', 'host': 'SEO_SMTP_HOST'}, {'port': 465, 'secure': True, 'disableStartTls': False}),
    ('SEOcredImapGmail', 'Gmail IMAP (SEO Agent)', 'imap', {'user': 'SEO_IMAP_USER', 'password': 'SEO_IMAP_PASSWORD', 'host': 'SEO_IMAP_HOST'}, {'port': 993, 'secure': True, 'allowUnauthorizedCerts': False}),
    ('SEOcredGoogleSvc', 'Google Service Account (SEO Agent)', 'googleApi', {'email': 'SEO_GOOGLE_SA_EMAIL', 'privateKey': 'SEO_GOOGLE_SA_PRIVATE_KEY'}, {'region': 'global', 'inpersonate': False, 'delegatedEmail': '', 'httpNode': True, 'scopes': SCOPES}),
    ('SEOcredWordPress', 'WordPress (SEO Agent)', 'wordpressApi', {'url': 'SEO_WORDPRESS_URL', 'username': 'SEO_WORDPRESS_USER', 'password': 'SEO_WORDPRESS_APP_PASSWORD'}, {}),
]
PREFIX = {('SEOcredJinaReade', 'value'): 'Bearer '}   # header value = 'Bearer ' + key
# Trigger authentication (webhook header auth, form basic auth) is checked outside an execution context, where n8n does not resolve
# {{ $env }} expressions (live finding 2026-10-02: 'No authentication data defined on node'). These are always written as literal values.
TRIGGER_IDS = {'SEOcredApiHeader', 'SEOcredApiTest01', 'SEOcredFormLogin'}

def load_env(path):
    env = {}
    for line in open(path, encoding='utf-8'):
        line = line.rstrip('\n')
        if not line or line.lstrip().startswith('#') or '=' not in line: continue
        k, v = line.split('=', 1); k = k.strip(); v = v.strip()
        if len(v) >= 2 and v[0] == v[-1] and v[0] in '"\'': v = v[1:-1]
        env[k] = v
    return env

def main():
    args = sys.argv[1:]; mode = 'values'; only = None; dry = '--dry-run' in args   # values: n8n blocks $env in nodes by default (live finding 2026-10-02: 'access to env vars denied')
    if '--mode' in args: mode = args[args.index('--mode') + 1]
    if '--only' in args: only = set(args[args.index('--only') + 1].split(','))
    assert mode in ('expressions', 'values'), 'mode must be expressions or values'
    env = load_env(ENV_FILE)
    out, skipped = [], []
    for cid, name, ctype, secrets, fixed in CREDS:
        if only and cid not in only: continue
        missing = [v for v in secrets.values() if not env.get(v)]
        if missing: skipped.append((cid, missing)); continue
        data = dict(fixed)
        for field, var in secrets.items():
            pre = PREFIX.get((cid, field), '')
            if mode == 'expressions' and cid not in TRIGGER_IDS: data[field] = "={{ " + (repr(pre) + " + " if pre else '') + "$env." + var + " }}"
            else: data[field] = pre + env[var]
        out.append({'id': cid, 'name': name, 'type': ctype, 'data': data, '_mode': 'values' if (mode == 'values' or cid in TRIGGER_IDS) else 'expressions'})
    for cid, missing in skipped: print('skip', cid, '(empty in .env:', ', '.join(missing) + ')')
    if not out: print('nothing to import'); return
    print('credentials to import:', ', '.join(c['id'] + ':' + c.pop('_mode') for c in out))
    if dry: return
    fd, path = tempfile.mkstemp(suffix='.json'); os.write(fd, json.dumps(out).encode('utf-8')); os.close(fd); os.chmod(path, 0o644)   # the n8n CLI runs as user node inside the container
    try:
        subprocess.run(['docker', 'cp', path, CONTAINER + ':/tmp/seo_creds.json'], check=True)
        r = subprocess.run(['docker', 'exec', CONTAINER, 'sh', '-c', 'n8n import:credentials --input=/tmp/seo_creds.json --projectId=' + PROJECT + ' 2>&1 | tail -1'], capture_output=True, text=True)
        print(r.stdout.strip())
        subprocess.run(['docker', 'exec', '-u', 'root', CONTAINER, 'rm', '-f', '/tmp/seo_creds.json'])
    finally:
        os.unlink(path)
    print('done. If .env changed since the container started: cd n8n && docker compose up -d n8n   (recreate; a restart does not reload .env)')

if __name__ == '__main__': main()
