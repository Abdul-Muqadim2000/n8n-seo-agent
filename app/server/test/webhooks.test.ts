import { afterEach, describe, expect, it, vi } from 'vitest';

// G4 (app/docs/INTEGRATIONS.md §2, §5): one event POST to one endpoint, with the vendor answered by a stand-in (lib/netGuard.ts
// `transport`), and the SSRF guard itself. The queue around it (claim, backoff, switching an endpoint off) runs against a real
// Postgres in integrations.pg.test.ts.

vi.mock('../src/config', () => ({ config: { appUrl: 'https://app.example.com', brand: 'Alaventra', isProd: false, mailboxKey: 'a'.repeat(64) } }));
vi.mock('../src/db', () => ({ db: {}, schema: {} }));

const { seal } = await import('../src/lib/secretBox');
const { transport, outboundUrlOk, OutboundRefused } = await import('../src/lib/netGuard');
const { sendTo, envelope } = await import('../src/services/webhooks');
const { verifyBody } = await import('../src/services/reportDelivery');

const realSend = transport.send;
afterEach(() => {
  transport.send = realSend;
});

type Sent = { url: string; method: string; headers: Record<string, string>; body: string };
const record = (answer: { status: number; text?: string } | Error) => {
  const sent: Sent[] = [];
  transport.send = vi.fn(async (r) => {
    sent.push({ url: r.url, method: r.method, headers: r.headers ?? {}, body: String(r.body ?? '') });
    if (answer instanceof Error) throw answer;
    return { status: answer.status, headers: {}, text: answer.text ?? '' };
  });
  return sent;
};

const endpoint = (format: 'json' | 'slack' | 'teams', url: string, secret: string | null) =>
  ({
    id: 'ep-1',
    orgId: 'org-1',
    name: 'test',
    format,
    urlSealed: seal(url),
    urlHost: new URL(url).host,
    urlHint: url.slice(-4),
    secretSealed: secret ? seal(secret) : '',
    events: ['report.ready'],
    siteIds: [],
    enabled: true,
    disabledReason: '',
    consecutiveFailures: 0,
  }) as never;

const evt = envelope({ id: 'org-1', name: 'Northwind' }, { id: 'site-1', domain: 'northwind.example' }, 'report.ready', {
  report: { id: 'rep-1', title: 'Weekly site report', stageLabel: 'Weekly site report', url: 'https://app.example.com/o/org-1/reports/rep-1' },
});

describe('sendTo: one signed POST', () => {
  it('signed JSON: the envelope, HMAC-SHA256 over "<timestamp>.<body>", event and delivery ids in headers', async () => {
    const sent = record({ status: 204 });
    const res = await sendTo(endpoint('json', 'https://hooks.example.com/alaventra?token=abc', 'whsec_test_secret'), 'dlv-1', evt);
    expect(res).toEqual({ ok: true, status: 204, error: '' });
    const s = sent[0]!;
    expect([s.url, s.method]).toEqual(['https://hooks.example.com/alaventra?token=abc', 'POST']);
    expect(JSON.parse(s.body)).toMatchObject({ id: evt.id, type: 'report.ready', company: { id: 'org-1' }, website: { domain: 'northwind.example' } });
    expect(s.headers['X-Alaventra-Event']).toBe('report.ready');
    expect(s.headers['X-Alaventra-Delivery']).toBe('dlv-1');
    expect(verifyBody('whsec_test_secret', s.headers['X-Alaventra-Timestamp']!, s.body, s.headers['X-Alaventra-Signature']!)).toBe(true);
    expect(verifyBody('another secret', s.headers['X-Alaventra-Timestamp']!, s.body, s.headers['X-Alaventra-Signature']!)).toBe(false);
  });

  it('Slack: the Slack body, unsigned (the address is the credential)', async () => {
    const sent = record({ status: 200, text: 'ok' });
    await sendTo(endpoint('slack', 'https://hooks.slack.com/services/T1/B2/c3', null), 'dlv-2', evt);
    const body = JSON.parse(sent[0]!.body);
    expect(body.text).toContain('Weekly site report ready');
    expect(Array.isArray(body.blocks)).toBe(true);
    expect(sent[0]!.headers['X-Alaventra-Signature']).toBeUndefined();
  });

  it('a refusal names the host and the answer, never the address with its token', async () => {
    record({ status: 404, text: 'no_service' });
    const res = await sendTo(endpoint('slack', 'https://hooks.slack.com/services/T1/B2/secretpart', null), 'dlv-3', evt);
    expect(res).toMatchObject({ ok: false, status: 404 });
    expect(res.error).toBe('hooks.slack.com answered 404: no_service');
    record(new Error('connect ETIMEDOUT https://hooks.example.com/alaventra?token=abc'));
    const t = await sendTo(endpoint('json', 'https://hooks.example.com/alaventra?token=abc', 'whsec_x_secret'), 'dlv-4', evt);
    expect(t.ok).toBe(false);
    expect(t.error).not.toContain('token=abc');
  });
});

describe('the SSRF guard', () => {
  it('refuses private, loopback, link-local and internal names before any connection', async () => {
    for (const u of ['https://10.0.0.5/x', 'https://169.254.169.254/latest/meta-data/', 'https://metadata.google.internal/x', 'https://192.168.1.1/', 'ftp://example.com/'])
      expect(outboundUrlOk(u)).toBe(false);
    expect(outboundUrlOk('https://hooks.slack.com/services/T/B/C')).toBe(true);
  });

  it('refuses an address that only becomes private once parsed (decimal IPv4)', async () => {
    await expect(realSend({ url: 'https://2130706433/hook', method: 'POST', body: '{}' })).rejects.toBeInstanceOf(OutboundRefused);
  });

  it('refuses a public-looking name that resolves to a private address, at connect time', async () => {
    // localhost.  resolves to 127.0.0.1 — the name passes the first check only if written oddly; the lookup still refuses it
    await expect(realSend({ url: 'https://127.0.0.1.nip.io/hook', method: 'POST', body: '{}', timeoutMs: 3000 })).rejects.toThrow(/private address|ENOTFOUND|EAI_AGAIN|timed out/);
  });
});
