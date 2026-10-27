import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { consistencyWarnings, type PipelineData, type Warning } from '@seo/shared';
import { ConfirmBody, dialogDescription } from '@/components/warnings/ConfirmProvider';
import { api, DONE_INSTEAD, setConfirmHandler } from '@/lib/api';

// The remaining mismatch cases in the web (n8n/seo-agent/docs/mismatch-audit-2026-10-27/AUDIT.md §3). The production replay: techand.ai,
// 2026-10-26, "Start this ladder" on the suggestion "erp & crm software" next to the Auto ladder "dynamics 365 erp system". The click now
// opens the "Check this first" dialog with the new-ladder warning; Cancel (the focused, safe choice) starts nothing.

const SITE = { domain: 'techand.ai', country: 'United Arab Emirates', business: 'Microsoft Dynamics 365 partner' };
const PIPE = {
  activeRuns: [],
  automations: [],
  running: [],
  written: [],
  tracking: { status: 'active' },
  queue: { pagesPerWeek: 1, next: [], later: [], waiting: [] },
  ladders: [{ id: 'lad_d365', head: 'dynamics 365 erp system', pages: 6, published: 1, planned: [], keywords: ['dynamics 365 erp system'] }],
  ladderCards: [{ id: 'lad_d365', head: 'dynamics 365 erp system', mode: 'auto', status: 'climbing', counts: { total: 6, published: 1, waiting: 0, writing: 0, planned: 4 } }],
  automation: { defaultMode: 'auto', maxActiveLadders: 2, maxWaiting: 3 },
  readiness: { ready: true, profileReady: true, factsReady: true, missing: [], missingText: '' },
} as unknown as PipelineData;
const d1 = (): Warning[] =>
  consistencyWarnings('run', { mode: 'ladder', keyword: 'erp & crm software', pagesNow: 1, country: 'United Arab Emirates' }, { site: SITE, siteApi: '/api/orgs/o/sites/s', pipeline: PIPE, start: { proposal: true, admin: true, credits: 111, planCredits: 12 } });

describe('the new-ladder confirmation in the dialog', () => {
  it('says plainly what starts, what it costs and what it overlaps; Continue waits for an answer', () => {
    const html = renderToString(<ConfirmBody warnings={d1()} onDone={() => undefined} />);
    expect(html).toContain('This starts a new keyword ladder for &quot;erp &amp; crm software&quot;');
    expect(html).toContain('writes its first page now: about 111 credits in total');
    expect(html).toContain('Plan it without writing a page (about 12 credits)');
    expect(html).toContain('Start it and write the first page now (about 111 credits)');
    expect(html).toContain('Add it to &quot;dynamics 365 erp system&quot; instead');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Continue<\/button>/);
    expect(html).not.toMatch(/[—…“”]/);
  });

  it('the dialog leads with "Nothing has started yet" when credits are at stake', () => {
    expect(dialogDescription(d1())).toMatch(/^Nothing has started yet\./);
    const market = consistencyWarnings('run', { mode: 'audit', country: 'Pakistan' }, { site: SITE });
    expect(dialogDescription(market)).toMatch(/^Nothing has started or changed yet\./);
  });
});

describe('an Accept that replaces the request ("Add it to your ladder instead")', () => {
  afterEach(() => {
    setConfirmHandler(null);
    vi.unstubAllGlobals();
  });

  it('the request is not sent again; the caller gets what was done', async () => {
    const w = d1();
    let sent = 0;
    vi.stubGlobal('fetch', async () => {
      sent++;
      return new Response(JSON.stringify({ error: 'Check the warnings', code: 'confirm_needed', notices: w, warnings: w, needsAcknowledge: w.map((x) => x.id) }), { status: 409 });
    });
    setConfirmHandler(async () => ({ instead: 'Done: Add it to "dynamics 365 erp system". Nothing new was started.' }));
    await expect(api('/api/orgs/o/sites/s/keyword-proposals/p/approve', { method: 'POST', body: {} })).rejects.toMatchObject({ code: DONE_INSTEAD, message: 'Done: Add it to "dynamics 365 erp system". Nothing new was started.' });
    expect(sent).toBe(1);
  });
});
