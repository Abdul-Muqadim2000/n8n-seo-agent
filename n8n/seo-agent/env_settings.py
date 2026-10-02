"""Reads n8n/.env (the SEO_* settings) for the builders: brand, sender, ops address and the Google service-account e-mail are baked into
the generated workflows at build time (n8n blocks $env access in nodes by default, so the workflows carry literals). Run
`python3 apply_env.py` after editing .env: it rebuilds, syncs the credentials and re-imports."""
import os
HERE = os.path.dirname(os.path.abspath(__file__)); ENV_FILE = os.path.join(HERE, '..', '.env')
def load_env(path=ENV_FILE):
    env = {}
    if not os.path.exists(path): return env
    for line in open(path, encoding='utf-8'):
        line = line.rstrip('\n')
        if not line or line.lstrip().startswith('#') or '=' not in line: continue
        k, v = line.split('=', 1); k = k.strip(); v = v.strip()
        if len(v) >= 2 and v[0] == v[-1] and v[0] in '"\'': v = v[1:-1]
        env[k] = v
    return env
ENV = load_env()
BRAND = ENV.get('SEO_BRAND') or 'Dev SEO'
SENDER = ENV.get('SEO_MAIL_FROM') or 'Dev SEO <kinnngahmed@gmail.com>'
OPS_EMAIL = ENV.get('SEO_OPS_EMAIL') or 'kinnngahmed@gmail.com'
SA_EMAIL = ENV.get('SEO_GOOGLE_SA_EMAIL') or ''
