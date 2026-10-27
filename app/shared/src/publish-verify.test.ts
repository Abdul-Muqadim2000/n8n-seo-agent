import { describe, expect, it } from 'vitest';
import { buildN8nPayload } from './payload';
import { publishVerifyPrefill, publishVerifyShort, publishVerifyState } from './publish-verify';
import { RUN_SCHEMAS } from './schemas';

// 2026-10-27 (techand.ai on production): "I published it" refuses a page that is not the page that was written, and lets the person
// send the right address or confirm it is the right page. The report, the summary line and the form read the callback through these.
const base = {
  stage: 'published',
  keyword: 'ms 365 erp',
  published_url: 'https://www.techand.ai/dynamics-365-business-central-uae',
  content_request_id: '5101',
  live: true,
  recorded: false,
  verify: 'not_the_draft',
  verify_message: 'This page does not look like the page written for "ms 365 erp".',
  verify_missing: ['the keyword "ms 365 erp" in the title, the main heading or the text'],
  verify_evidence: { title: 'Business Central ERP Solutions in UAE | Tech&', h1: 'Certified Microsoft Dynamics 365 Business Central Partner in UAE', keyword_in_text: 0, used_by: [] },
  confirmable: true,
};

describe('publishVerifyState', () => {
  it('a page that did not match: the warning, the evidence and both ways on', () => {
    const s = publishVerifyState(base)!;
    expect(s.outcome).toBe('not_the_draft');
    expect(s.title).toMatch(/^Not marked published/);
    expect(s.evidence.map((e) => e.label)).toEqual(['Title on the page', 'Main heading on the page']);
    expect(s.evidence[0].value).toContain('Business Central ERP Solutions in UAE');
    expect(s.missing).toHaveLength(1);
    expect(s.confirmable).toBe(true);
    expect(publishVerifyPrefill(s, false)).toEqual({ keyword: 'ms 365 erp', publishedUrl: '', contentRequestId: '5101' });
    expect(publishVerifyPrefill(s, true)).toEqual({ keyword: 'ms 365 erp', publishedUrl: base.published_url, contentRequestId: '5101', confirmMismatch: true });
  });
  it('an update not live yet, and an address that belongs to another keyword (never confirmable)', () => {
    expect(publishVerifyState({ ...base, verify: 'refresh_not_live', verify_evidence: { ...base.verify_evidence, refresh_of: 'https://www.techand.ai/insights/x' } })!.evidence.at(-1)).toEqual({ label: 'Page the update is for', value: 'https://www.techand.ai/insights/x' });
    const used = publishVerifyState({ ...base, verify: 'address_used_by_other_keyword', confirmable: true, verify_evidence: { ...base.verify_evidence, used_by: ['business central erp uae'] } })!;
    expect(used.confirmable).toBe(false);
    expect(used.evidence.at(-1)).toEqual({ label: 'Already the page of', value: 'business central erp uae' });
  });
  it('nothing to warn about: recorded, older reports, a page that did not answer', () => {
    expect(publishVerifyState({ ...base, recorded: true, verify: 'ok' })).toBeNull();
    const { recorded: _r, verify: _v, ...older } = base;
    expect(publishVerifyState(older)).toBeNull();
    expect(publishVerifyState({ ...base, live: false, verify: 'not_live' })).toBeNull();
  });
  it('a bad request id is not carried into the form', () => {
    expect(publishVerifyState({ ...base, content_request_id: 'a b' })!.contentRequestId).toBe('');
  });
  it('the short line', () => {
    expect(publishVerifyShort(base)).toBe('Not marked published: check the address');
    expect(publishVerifyShort({ ...base, recorded: true, confirmed: true, verify: 'not_the_draft' })).toMatch(/^Marked published on your word/);
    expect(publishVerifyShort({ ...base, recorded: true, verify: 'ok' })).toBe('');
  });
  it('no em dash, curly quotes or ellipsis character in the titles', () => {
    for (const v of ['not_the_draft', 'refresh_not_live', 'refresh_other_address', 'address_used_by_other_keyword'])
      expect(publishVerifyState({ ...base, verify: v })!.title).not.toMatch(/[—…“”‘’]/);
  });
});

describe('published: confirmed after the warning', () => {
  const SITE_ID = '00000000-0000-4000-8000-000000000001';
  const site = { domain: 'northwind-erp.com', country: 'United Arab Emirates', business: '', customers: '', goal: '', tone: '', cta: '', businessFacts: '', competitors: [], brandNames: [], ga4PropertyId: '' };
  const delivery = { callbackUrl: 'https://app.example.com/api/hooks/n8n/x', email: '' };
  const input = { mode: 'published', siteId: SITE_ID, keyword: 'erp dubai', publishedUrl: 'https://northwind-erp.com/erp-dubai/', contentRequestId: '4127' };
  it('sends confirm_mismatch only when confirmed, after the head', () => {
    const b = buildN8nPayload(RUN_SCHEMAS.published.parse({ ...input, confirmMismatch: true }), site, delivery) as Record<string, unknown>;
    expect(b.confirm_mismatch).toBe(true);
    expect(Object.keys(b).indexOf('confirm_mismatch')).toBeGreaterThan(Object.keys(b).indexOf('published_url'));
    expect(buildN8nPayload(RUN_SCHEMAS.published.parse(input), site, delivery)).not.toHaveProperty('confirm_mismatch');
    expect(RUN_SCHEMAS.published.parse(input).confirmMismatch).toBe(false);
  });
});
