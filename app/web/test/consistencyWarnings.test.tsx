import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { consistencyWarnings, type Warning } from '@seo/shared';
import { Warnings, openWarnings } from '@/components/warnings/Warnings';
import { ConfirmBody } from '@/components/warnings/ConfirmProvider';
import { api, resendBody, setConfirmHandler } from '@/lib/api';

// MKT (2026-10-27, n8n/seo-agent/docs/mismatch-audit-2026-10-27/AUDIT.md §2.2): the web side of the one mismatch mechanism. One way to show a
// warning (Callout + Accept + "... anyway"), one dialog for a 409 confirm_needed from any request, and the request sent again with the
// person's answers. The devaicon.com facts of production are the fixture (a Pakistan website, a run sent for the UAE).

const SITE = { domain: 'devaicon.com', country: 'Pakistan', business: 'Software for companies' };
const warnings = (): Warning[] => consistencyWarnings('run', { mode: 'ladder', keyword: 'ai automation services lahore', country: 'United Arab Emirates' }, { site: SITE });

describe('the Warnings component (forms, dialog, banner)', () => {
  it('shows each warning with its Accept and its "... anyway" tick, in plain words', () => {
    const w = warnings();
    expect(w.map((x) => x.code)).toEqual(['market.run_country', 'market.keyword_place']);
    const html = renderToString(<Warnings warnings={w} acked={[]} onToggle={() => undefined} onAccept={() => undefined} />);
    expect(html).toContain('This runs for United Arab Emirates, but your website&#x27;s market is Pakistan');
    expect(html).toContain('Use Pakistan');
    expect(html).toContain('Run it for United Arab Emirates anyway');
    expect(html).toContain('Keep &quot;ai automation services lahore&quot;');   // measured in the UAE, Lahore is another market
    expect(html).not.toMatch(/[—…“”]/);
  });

  it('a warning holds until it is accepted or ticked; information never holds', () => {
    const w = warnings();
    expect(openWarnings(w, [])).toHaveLength(2);
    expect(openWarnings(w, [w[0]!.id], [w[1]!.id])).toEqual([]);
    const info = consistencyWarnings('site_standing', {}, { site: { ...SITE, domain: 'devaicon.ae' } });
    expect(info.every((x) => x.tone === 'info')).toBe(true);
    expect(openWarnings(info, [])).toEqual([]);
  });

  it('an accepted warning shows as done, without its tick', () => {
    const w = warnings();
    const html = renderToString(<Warnings warnings={w} acked={[]} accepted={[w[0]!.id]} onToggle={() => undefined} onAccept={() => undefined} />);
    expect(html).toContain('Done');
    expect(html).not.toContain('Run it for United Arab Emirates anyway');
  });

  it('the 409 dialog lists the warnings with Cancel and Continue (Continue waits for every answer)', () => {
    const html = renderToString(<ConfirmBody warnings={warnings()} onDone={() => undefined} />);
    expect(html).toContain('Cancel');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Continue<\/button>/);
    expect(html).toContain('Accept the correction or tick');
  });
});

describe('a 409 confirm_needed from any request', () => {
  afterEach(() => {
    setConfirmHandler(null);
    vi.unstubAllGlobals();
  });

  it('the request is sent again with the accepted fields and the acknowledged ids', () => {
    expect(resendBody({ mode: 'ladder', keyword: 'ai automation solutions gcc', acknowledge: ['old'] }, { acknowledge: ['market.run_country:AE:PK'], set: { keyword: 'ai automation solutions' } })).toEqual({
      mode: 'ladder',
      keyword: 'ai automation solutions',
      acknowledge: ['old', 'market.run_country:AE:PK'],
    });
  });

  it('api() asks the dialog, then resends; Cancel keeps the 409 for the caller', async () => {
    const w = warnings();
    const sent: unknown[] = [];
    vi.stubGlobal('fetch', async (_url: string, init: { body?: string }) => {
      const body = JSON.parse(init.body ?? '{}');
      sent.push(body);
      const ok = Array.isArray(body.acknowledge) && body.acknowledge.length === 2;
      return new Response(JSON.stringify(ok ? { id: 'run-1' } : { error: 'Check the warnings', code: 'confirm_needed', notices: w, warnings: w, needsAcknowledge: w.map((x) => x.id) }), { status: ok ? 200 : 409 });
    });
    setConfirmHandler(async (ws) => ({ acknowledge: ws.map((x) => x.id), set: {} }));
    expect(await api('/api/orgs/o/runs', { method: 'POST', body: { mode: 'ladder' } })).toEqual({ id: 'run-1' });
    expect(sent).toHaveLength(2);
    setConfirmHandler(async () => null);
    await expect(api('/api/orgs/o/runs', { method: 'POST', body: { mode: 'ladder' } })).rejects.toMatchObject({ status: 409, code: 'confirm_needed' });
  });
});
