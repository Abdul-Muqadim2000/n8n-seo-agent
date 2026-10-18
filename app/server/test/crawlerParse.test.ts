import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOT_BY_KEY } from '@seo/shared';
import { clientAddress, detectFormat, lineParser, parseAnyTime, parseClfTime, type LineResult, type LogRecord } from '../src/services/crawlers/parse';
import { ipInList, isCloudflareIp, isPrivateIp, networkOf, normalizeIp, parseRangeFile, inSource } from '../src/services/crawlers/ranges';
import { Verifier, type Dns } from '../src/services/crawlers/verify';

// Log formats → records, and records → "is this really that crawler?" — against fixture logs in the vendors' real formats
// (test/fixtures/logs) and addresses from the vendors' real published lists (the dated copy in ranges.snapshot.json).

const fx = (f: string) => readFileSync(new URL(`./fixtures/logs/${f}`, import.meta.url), 'utf8');
function parseFile(text: string): { format: string; out: LineResult[] } {
  const lines = text.split('\n');
  const format = detectFormat(lines.slice(0, 20));
  const p = lineParser(format);
  return { format, out: lines.map(p) };
}
const recs = (out: LineResult[]) => out.filter((r): r is { kind: 'record'; rec: LogRecord } => r.kind === 'record').map((r) => r.rec);
const bads = (out: LineResult[]) => out.filter((r) => r.kind === 'bad');

describe('time formats', () => {
  it('CLF with offsets, ISO, unix s / ms / ns', () => {
    expect(parseClfTime('15/Oct/2026:12:10:00 +0200')!.toISOString()).toBe('2026-10-15T10:10:00.000Z');
    expect(parseClfTime('15/Oct/2026:06:25:01 -0530')!.toISOString()).toBe('2026-10-15T11:55:01.000Z');
    expect(parseClfTime('32/Foo/2026:00:00:00 +0000')).toBeNull();
    const s = parseAnyTime(1792044000)!.getTime();
    expect(parseAnyTime(1792044000000)!.getTime()).toBe(s);
    expect(parseAnyTime('1792044000000000000')!.getTime()).toBe(s);
    expect(parseAnyTime('1792044000.123')!.getTime()).toBe(s + 123);
    expect(parseAnyTime('2026-10-15T06:00:00Z')!.toISOString()).toBe('2026-10-15T06:00:00.000Z');
    expect(parseAnyTime('not a time')).toBeNull();
  });
});

describe('Nginx combined (+ request time, + X-Forwarded-For)', () => {
  const { format, out } = parseFile(fx('nginx-combined.log'));
  const r = recs(out);
  it('detects the format; reads every request line; names the unreadable ones', () => {
    expect(format).toBe('combined');
    expect(r).toHaveLength(23);
    expect(bads(out).map((b) => (b as { reason: string }).reason)).toEqual(['not an access-log line', 'unreadable request line']);
  });
  it('fields: method, path with query, status, bytes, request time in ms, IPv6 and IPv4-mapped addresses', () => {
    expect(r[0]).toMatchObject({ ip: '66.249.64.5', method: 'GET', target: '/', status: 200, bytes: 5123, ms: 42, proxied: false });
    expect(r[0].at.toISOString()).toBe('2026-10-15T06:25:01.000Z');
    expect(r[2]).toMatchObject({ ip: '2001:4860:4801:10::2a', target: '/blog/e-invoicing-uae?utm_source=x&page=2' });
    expect(r[3]).toMatchObject({ status: 301, bytes: 0 });
    expect(r[5]).toMatchObject({ status: 500, ms: 1500 });
    expect(r.find((x) => x.target === '/' && x.ip === '203.0.113.51')).toBeTruthy();
  });
  it('behind Cloudflare: the forwarded address replaces the edge; without one the line is marked proxied', () => {
    const cf = r.filter((x) => x.target === '/contact');
    expect(cf[0]).toMatchObject({ ip: '66.249.64.7', proxied: false });
    expect(cf[1]).toMatchObject({ ip: '172.70.1.6', proxied: true });
  });
  it('a forged X-Forwarded-For: only the rightmost entry the proxy appended is believed', () => {
    expect(r.find((x) => x.target === '/about')).toMatchObject({ ip: '203.0.113.9', proxied: false });
  });
});

describe('Apache vhost_combined with %D (microseconds)', () => {
  const { out } = parseFile(fx('apache-vhost.log'));
  const r = recs(out);
  it('reads the host and the microsecond time; "-" bytes is null', () => {
    expect(r).toHaveLength(4);
    expect(r[0]).toMatchObject({ host: 'techand.example', ip: '66.249.64.8', ms: 45 });
    expect(r[1].host).toBe('www.techand.example');
    expect(r[2].host).toBe('other.example');
    expect(r[3]).toMatchObject({ method: 'HEAD', bytes: null, ip: '17.241.208.170' });
  });
});

describe('IIS W3C extended', () => {
  const { format, out } = parseFile(fx('iis-w3c.log').replace(/\n/g, '\r\n'));
  const r = recs(out);
  it('columns from #Fields, "+" spaces in the user agent, the query joined back, time-taken in ms, CRLF endings', () => {
    expect(format).toBe('w3c');
    expect(r).toHaveLength(4);
    expect(r[0]).toMatchObject({ ip: '66.249.64.9', target: '/default.aspx', status: 200, ms: 31, bytes: null });
    // IIS writes a space as "+" and leaves a real "+" alone, so "; +http" comes back as two spaces: the crawler name survives
    expect(r[0].ua).toBe('Mozilla/5.0 (compatible; Googlebot/2.1;  http://www.google.com/bot.html)');
    expect(r[1].target).toBe('/products.aspx?id=5&sort=asc');
    expect(bads(out)).toHaveLength(1);
  });
  it('a data line before any #Fields header is refused, not guessed', () => {
    const p = lineParser('w3c');
    expect(p('2026-10-15 06:00:00 10.0.0.4 GET / - 443')).toEqual({ kind: 'bad', reason: 'no #Fields header before this line' });
  });
});

describe('Cloudflare Logpush (http_requests, NDJSON)', () => {
  const { format, out } = parseFile(fx('cloudflare-logpush.ndjson'));
  const r = recs(out);
  it('fields, RFC 3339 and unix-nanosecond times, RayID as the request id, a cut-off last line', () => {
    expect(format).toBe('json');
    expect(r).toHaveLength(7);
    expect(r[0]).toMatchObject({ ip: '66.249.64.10', host: 'www.techand.example', target: '/services', status: 200, bytes: 4100, ms: 85, requestId: 'cf:8d1f0a1b2c3d4e5f' });
    expect(r[1].ip).toBe('2a01:4f8:c17:1::1');
    expect(r[5].at.getTime()).toBe(1792044000000);
    expect(r[6].requestId).toBe(r[0].requestId);
    expect(bads(out)).toEqual([{ kind: 'bad', reason: 'unreadable JSON' }]);
  });
  it("Cloudflare's destination test file is accepted and skipped", () => {
    expect(lineParser('json')('{"content":"tests"}')).toEqual({ kind: 'skip' });
  });
});

describe('Vercel drain (JSON array) and Akamai DataStream 2', () => {
  it('Vercel: the request lives in proxy; a build log without one is skipped', () => {
    const arr = JSON.parse(fx('vercel-drain.json')) as Record<string, unknown>[];
    const p = lineParser('json');
    const a = p(JSON.stringify(arr[0]));
    expect(a.kind).toBe('record');
    expect((a as { rec: LogRecord }).rec).toMatchObject({ ip: '17.241.208.170', host: 'techand.example', target: '/guides/peppol?lang=en', status: 200, bytes: 2048 });
    expect((a as { rec: LogRecord }).rec.ua).toContain('Applebot');
    expect(p(JSON.stringify(arr[1]))).toEqual({ kind: 'skip' });
  });
  it('Akamai: seconds with decimals, path + query string, a URL-encoded user agent', () => {
    const { out } = parseFile(fx('akamai-ds2.ndjson'));
    const [rec] = recs(out);
    expect(rec).toMatchObject({ ip: '216.73.216.20', target: '/blog?page=3', status: 200, bytes: 1500, ms: 40 });
    expect(rec.ua).toContain('ClaudeBot/1.0');
  });
  it('a generic JSON line (Nginx json escape format)', () => {
    const rr = lineParser('json')('{"time_local":"15/Oct/2026:06:25:01 +0000","remote_addr":"66.249.64.5","request":"GET /x?y=1 HTTP/1.1","status":"200","body_bytes_sent":"10","http_user_agent":"Googlebot/2.1","request_time":"0.012"}');
    expect((rr as { rec: LogRecord }).rec).toMatchObject({ ip: '66.249.64.5', method: 'GET', target: '/x?y=1', status: 200, bytes: 10, ms: 12 });
  });
});

describe('addresses and lists', () => {
  it('normalizeIp', () => {
    expect(normalizeIp('::ffff:203.0.113.51')).toBe('203.0.113.51');
    expect(normalizeIp('[2001:db8::1]')).toBe('2001:db8::1');
    expect(normalizeIp('66.249.64.5:443')).toBe('66.249.64.5');
    expect(normalizeIp('-')).toBeNull();
    expect(normalizeIp('999.1.1.1')).toBeNull();
  });
  it('ranges: IPv4 and IPv6, private and Cloudflare, /24 and /48 networks', () => {
    expect(inSource('google-common', '66.249.64.5')).toBe(true);
    expect(inSource('google-common', '2001:4860:4801:10::2a')).toBe(true);
    expect(inSource('google-common', '45.133.1.21')).toBe(false);
    expect(inSource('openai-gptbot', '132.196.86.10')).toBe(true);
    expect(inSource('openai-gptbot', '45.133.1.20')).toBe(false);
    expect(inSource('anthropic', '216.73.216.15')).toBe(true);
    expect(isCloudflareIp('172.70.1.5')).toBe(true);
    expect(isPrivateIp('10.0.0.8')).toBe(true);
    expect(isPrivateIp('fd00::1')).toBe(true);
    expect(isPrivateIp('66.249.64.5')).toBe(false);
    expect(networkOf('45.133.1.20')).toBe('45.133.1.0/24');
    expect(networkOf('2a01:4f8:c17:1::1')).toBe('2a01:4f8:c17::/48');
    expect(ipInList('10.1.2.3', { v4: [[167772160, 184549375]], v6: [] })).toBe(true);
  });
  it('clientAddress takes the rightmost non-proxy entry only', () => {
    expect(clientAddress('10.0.0.1', '66.249.64.7, 198.51.100.1')).toEqual({ ip: '198.51.100.1', proxied: false });
    expect(clientAddress('10.0.0.1', '66.249.64.7, 10.0.0.2')).toEqual({ ip: '66.249.64.7', proxied: false });
    expect(clientAddress('10.0.0.1', '')).toEqual({ ip: '10.0.0.1', proxied: true });
    expect(clientAddress('198.51.100.9', '66.249.64.7')).toEqual({ ip: '198.51.100.9', proxied: false });
    expect(clientAddress(null, null)).toEqual({ ip: null, proxied: false });
  });
  it("parses the vendors' file formats (JSON, Amazon's page, Cloudflare's text)", () => {
    expect(parseRangeFile('{"creationTime":"x","prefixes":[{"ipv4Prefix":"1.2.3.0/24"},{"ipv6Prefix":"2001:db8::/32"},{"ipv4Prefix":"bad"}]}', 'json')).toEqual({ creationTime: 'x', prefixes: ['1.2.3.0/24', '2001:db8::/32'] });
    expect(parseRangeFile('<html><pre><code class="container">{\n  &quot;creationTime&quot;: &quot;y&quot;, "prefixes": [{"ipv4Prefix": "3.81.245.78"}]}</code></pre></html>', 'html-json')).toEqual({ creationTime: 'y', prefixes: ['3.81.245.78/32'] });
    expect(parseRangeFile('173.245.48.0/20\n2400:cb00::/32\n', 'text').prefixes).toEqual(['173.245.48.0/20', '2400:cb00::/32']);
    expect(() => parseRangeFile('{"prefixes":[]}', 'json')).toThrow();
    expect(() => parseRangeFile('<html>Access denied</html>', 'html-json')).toThrow();
  });
});

// a DNS that answers from a table: reverse names and their forward addresses
function fakeDns(reverse: Record<string, string[] | 'timeout' | 'nxdomain'>, forward: Record<string, string[]>): Dns & { calls: number } {
  const d = {
    calls: 0,
    async reverse(ip: string) {
      d.calls++;
      const r = reverse[ip];
      if (r === 'timeout') throw Object.assign(new Error('timeout'), { code: 'ETIMEOUT' });
      if (!r || r === 'nxdomain') throw Object.assign(new Error('nx'), { code: 'ENOTFOUND' });
      return r;
    },
    async resolve(host: string) {
      return forward[host] ?? [];
    },
  };
  return d;
}

describe('Verifier', () => {
  const bot = (k: string) => BOT_BY_KEY.get(k)!;
  it('on the vendor list → verified, no DNS; off a list-only vendor → spoofed', async () => {
    const dns = fakeDns({}, {});
    const v = new Verifier(dns);
    expect(await v.verify(bot('gptbot'), '132.196.86.10')).toBe('verified');
    expect(await v.verify(bot('gptbot'), '45.133.1.20')).toBe('spoofed');
    expect(await v.verify(bot('gptbot'), '2a01:4f8:c17:1::1')).toBe('spoofed');
    expect(await v.verify(bot('googlebot'), '2001:4860:4801:10::2a')).toBe('verified');
    expect(await v.verify(bot('chatgpt-user'), '104.208.184.200')).toBe('verified');
    expect(await v.verify(bot('perplexity-user'), '44.208.221.197')).toBe('verified');
    expect(dns.calls).toBe(0);
  });
  it('forward-confirmed reverse DNS: the vendor domain AND the name resolves back', async () => {
    const dns = fakeDns(
      { '40.77.170.1': ['msnbot-40-77-170-1.search.msn.com'], '45.133.1.21': ['crawl-66-249-66-1.googlebot.com'], '45.133.1.22': ['crawl.googlebot.com.evil.example'], '45.133.1.23': 'nxdomain', '45.133.1.24': 'timeout' },
      { 'msnbot-40-77-170-1.search.msn.com': ['40.77.170.1'], 'crawl-66-249-66-1.googlebot.com': ['66.249.66.1'], 'crawl.googlebot.com.evil.example': ['45.133.1.22'] },
    );
    const v = new Verifier(dns);
    expect(await v.verify(bot('bingbot'), '40.77.170.1')).toBe('verified');
    // a PTR the attacker controls pointing at googlebot.com, but googlebot.com does not point back
    expect(await v.verify(bot('googlebot'), '45.133.1.21')).toBe('spoofed');
    // the name resolves back but is not Google's
    expect(await v.verify(bot('googlebot'), '45.133.1.22')).toBe('spoofed');
    expect(await v.verify(bot('googlebot'), '45.133.1.23')).toBe('spoofed');
    // no answer is not evidence
    expect(await v.verify(bot('googlebot'), '45.133.1.24')).toBe('unchecked');
  });
  it('claimed when the vendor publishes no check; unchecked without an address, behind a proxy, or past the DNS budget', async () => {
    const dns = fakeDns({ '198.51.100.1': 'nxdomain', '198.51.100.2': 'nxdomain' }, {});
    const v = new Verifier(dns, 1);
    expect(await v.verify(bot('bytespider'), '110.249.201.9')).toBe('claimed');
    expect(await v.verify(bot('meta-externalagent'), null)).toBe('claimed');
    expect(await v.verify(bot('googlebot'), null)).toBe('unchecked');
    expect(await v.verify(bot('googlebot'), '172.70.1.6', true)).toBe('unchecked');
    expect(await v.verify(bot('googlebot'), '10.0.0.8')).toBe('unchecked');
    expect(await v.verify(bot('googlebot'), '198.51.100.1')).toBe('spoofed');
    expect(await v.verify(bot('googlebot'), '198.51.100.2')).toBe('unchecked');
    expect(v.dnsLookups).toBe(1);
  });
  it('verifyAll asks DNS once per (crawler, address), however many lines share it', async () => {
    const dns = fakeDns({ '40.77.170.9': ['msnbot-40-77-170-9.search.msn.com'] }, { 'msnbot-40-77-170-9.search.msn.com': ['40.77.170.9'] });
    const v = new Verifier(dns);
    const items = Array.from({ length: 50 }, () => ({ bot: bot('bingbot'), ip: '40.77.170.9', proxied: false }));
    const out = await v.verifyAll(items);
    expect(new Set(out)).toEqual(new Set(['verified']));
    expect(dns.calls).toBe(1);
  });
});
