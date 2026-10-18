#!/usr/bin/env python3
"""Regenerate the dated copy of the crawler IP lists that ships with the app server.

The server refreshes these lists itself once a day (services/crawlers/ranges.ts, table bot_ip_ranges); this copy is what it uses
before the first refresh, when the refresh is switched off (BOT_RANGES_REFRESH=false) or when a vendor's list cannot be fetched.
Sources are the vendors' own published files (shared/src/crawlers.ts RANGE_SOURCES; the doc is app/docs/LOG_ANALYTICS.md).

    python3 app/scripts/refresh_bot_ranges.py            # writes app/server/src/services/crawlers/ranges.snapshot.json
"""
import datetime
import html
import json
import os
import re
import sys
import urllib.request

SOURCES = {
    'google-common': ('https://developers.google.com/static/search/apis/ipranges/googlebot.json', 'json'),
    'google-special': ('https://developers.google.com/static/search/apis/ipranges/special-crawlers.json', 'json'),
    'google-user': ('https://developers.google.com/static/search/apis/ipranges/user-triggered-fetchers.json', 'json'),
    'google-user-google': ('https://developers.google.com/static/search/apis/ipranges/user-triggered-fetchers-google.json', 'json'),
    'google-agents': ('https://developers.google.com/static/search/apis/ipranges/user-triggered-agents.json', 'json'),
    'bing': ('https://www.bing.com/toolbox/bingbot.json', 'json'),
    'apple': ('https://search.developer.apple.com/applebot.json', 'json'),
    'openai-gptbot': ('https://openai.com/gptbot.json', 'json'),
    'openai-searchbot': ('https://openai.com/searchbot.json', 'json'),
    'openai-chatgpt-user': ('https://openai.com/chatgpt-user.json', 'json'),
    'anthropic': ('https://claude.com/crawling/bots.json', 'json'),
    'perplexity-bot': ('https://www.perplexity.com/perplexitybot.json', 'json'),
    'perplexity-user': ('https://www.perplexity.com/perplexity-user.json', 'json'),
    'amazon': ('https://developer.amazon.com/amazonbot/ip-addresses/', 'html-json'),
    'commoncrawl': ('https://index.commoncrawl.org/ccbot.json', 'json'),
    'cloudflare-v4': ('https://www.cloudflare.com/ips-v4', 'text'),
    'cloudflare-v6': ('https://www.cloudflare.com/ips-v6', 'text'),
}
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'server', 'src', 'services', 'crawlers', 'ranges.snapshot.json')


def norm(p):
    p = p.strip()
    return p if '/' in p else (p + '/128' if ':' in p else p + '/32')


def parse(body, fmt):
    if fmt == 'text':
        return None, [norm(l) for l in body.splitlines() if re.match(r'^[0-9a-fA-F:.]+(/\d+)?$', l.strip())]
    if fmt == 'html-json':
        m = re.search(r'<pre><code[^>]*>(.*?)</code></pre>', body, re.S)
        if not m:
            raise ValueError('no code block')
        body = html.unescape(m.group(1))
    j = json.loads(body)
    out = [norm(x.get('ipv4Prefix') or x.get('ipv6Prefix')) for x in j.get('prefixes', []) if x.get('ipv4Prefix') or x.get('ipv6Prefix')]
    return j.get('creationTime'), out


def main():
    now = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    out = {'note': 'Dated copy of the crawler IP lists the vendors publish. Regenerate: python3 app/scripts/refresh_bot_ranges.py. '
                   'The server refreshes them daily (services/crawlers/ranges.ts).', 'fetchedAt': now, 'sources': {}}
    failed = []
    for sid, (url, fmt) in SOURCES.items():
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Alaventra-range-refresh/1.0 (+https://github.com/Abdul-Muqadim2000/n8n-seo-agent)'})
            with urllib.request.urlopen(req, timeout=30) as r:
                created, prefixes = parse(r.read().decode('utf-8', 'replace'), fmt)
            if not prefixes:
                raise ValueError('empty list')
            out['sources'][sid] = {'url': url, 'creationTime': created, 'prefixes': prefixes}
            print(f'{sid:22} {len(prefixes):5} {created}')
        except Exception as e:  # noqa: BLE001 - report and keep going
            failed.append(sid)
            print(f'{sid:22} FAILED {e}', file=sys.stderr)
    if failed:
        print('not written: ' + ', '.join(failed) + ' failed', file=sys.stderr)
        return 1
    with open(OUT, 'w') as f:
        json.dump(out, f, separators=(',', ':'))
    print('wrote', os.path.relpath(OUT), os.path.getsize(OUT), 'bytes')
    return 0


if __name__ == '__main__':
    sys.exit(main())
