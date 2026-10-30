import { describe, expect, it } from 'vitest';
import { cmsPage } from './cms';
import { cleanMetaDescription, META_DESCRIPTION_MISSING_NOTE, metaDescriptionProblem, metaDescriptionView, usableMetaDescription } from './meta-description';
import { finalizeBody, finalReportPayload, type FinalizeResult } from './page-review';

// W0-A (2026-10-29, n8n/seo-agent/docs/page-quality-2026-10-29/PLAN.md Fix 1): production page 3299 stored "Slug: ms-365-erp-uae" as its
// meta description and the app sent it back to make the final version (finalize 3336). Anonymised: Nova&, novaand.example.
const GOOD = 'MS 365 ERP explained for UAE firms: pick Business Central or Finance and SCM, check VAT and e-invoicing needs, then book a consultation.';
const REBUILT = 'MS 365 ERP usually means Microsoft Dynamics 365, not Microsoft 365. Microsoft 365 is the productivity suite with Outlook, Teams and Excel.';
const payload = (desc: string) => ({
  stage: 'content',
  keyword: 'ms 365 erp',
  domain: 'novaand.example',
  request_id: '3299',
  markdown: '# MS 365 ERP for UAE businesses\n\nText.\n',
  meta: { title: 'MS 365 ERP in the UAE', meta_description: desc, slug: 'ms-365-erp-uae', h1: 'MS 365 ERP for UAE businesses', page_type: 'Service Page' },
});

describe('the meta description field rule (the same as the engine\'s PF.meta)', () => {
  it('names why a stored description cannot be used', () => {
    expect(metaDescriptionProblem('')).toBe('missing');
    expect(metaDescriptionProblem('Slug: ms-365-erp-uae')).toBe('label');
    expect(metaDescriptionProblem('Meta Description: x')).toBe('label');
    expect(metaDescriptionProblem('A short guide.')).toBe('short');
    expect(metaDescriptionProblem(`${GOOD}\nSlug: x`)).toBe('multi_line');
    expect(metaDescriptionProblem(GOOD)).toBe('');
    expect(metaDescriptionProblem('x'.repeat(200))).toBe('');   // long: the engine shortens it
  });
  it('a usable description is kept word for word; anything else is empty', () => {
    expect(usableMetaDescription(`  ${GOOD} `)).toBe(GOOD);
    expect(usableMetaDescription('Slug: ms-365-erp-uae')).toBe('');
    expect(usableMetaDescription(null)).toBe('');
    expect(cleanMetaDescription('A short guide.')).toBe('A short guide.');   // shown and published, only not sent back to the engine
    expect(cleanMetaDescription('Slug: x')).toBe('');
  });
  it('a report shows a broken description as missing, with what to do', () => {
    expect(metaDescriptionView('Slug: ms-365-erp-uae')).toEqual({ text: '', note: META_DESCRIPTION_MISSING_NOTE });
    expect(metaDescriptionView(GOOD)).toEqual({ text: GOOD, note: '' });
    expect(META_DESCRIPTION_MISSING_NOTE).not.toMatch(/[—–“”…]/);
  });
});

describe('finalizeBody drops a broken description (acceptance: the 3336 request)', () => {
  const body = (desc: string) =>
    finalizeBody({ requestId: 'app-fin-meta', domain: 'novaand.example', siteId: 'site_novaand-example', payload: payload(desc), markdown: '# MS 365 ERP\n\nText.\n', clientEdited: false, questions: [], answers: {}, businessFacts: '', facts: {} });
  it('"Slug: ms-365-erp-uae" is not sent back: the engine writes one from the page', () => {
    expect(body('Slug: ms-365-erp-uae').meta).toEqual({ title: 'MS 365 ERP in the UAE', meta_description: '', slug: 'ms-365-erp-uae', h1: 'MS 365 ERP for UAE businesses' });
  });
  it('an under-70-character description is not sent either; a good one is', () => {
    expect(body('MS 365 ERP for UAE firms.').meta.meta_description).toBe('');
    expect(body(GOOD).meta.meta_description).toBe(GOOD);
  });
});

describe('the final version keeps the description the engine checked', () => {
  const result: FinalizeResult = {
    ok: true,
    request_id: 'app-fin-meta',
    markdown: '# MS 365 ERP for UAE businesses\n\nText of the final version.\n',
    applied: [],
    sections_rewritten: [],
    changes: [],
    delivery_status: 'ready',
    delivery: { status: 'ready', label: 'Ready to publish', blocking: [], advisory: [], next_step: '', grade: { score: 88 } },
    client_questions: [],
    grade: { score: 88 },
    cost: { claude_usd: 0, dfs_usd: 0, estimated: false, model_calls: 0 },
    meta: { title: 'MS 365 ERP in the UAE', meta_description: REBUILT, slug: 'ms-365-erp-uae' },
  };
  it('the engine\'s rebuilt description replaces the broken stored one', () => {
    const p = finalReportPayload(payload('Slug: ms-365-erp-uae'), result, { originalReportId: 'rep-3299', requestId: 'app-fin-meta' });
    expect((p.meta as Record<string, unknown>).meta_description).toBe(REBUILT);
    expect((p.meta as Record<string, unknown>).meta_description_length).toBe(REBUILT.length);
  });
  it('an older engine (no meta in its answer): a broken stored description is not carried over, a good one is kept as it was', () => {
    const { meta: _drop, ...old } = result;
    const broken = finalReportPayload(payload('Slug: ms-365-erp-uae'), old, { originalReportId: 'rep-3299', requestId: 'x' });
    expect((broken.meta as Record<string, unknown>).meta_description).toBe('');
    const good = finalReportPayload(payload(GOOD), old, { originalReportId: 'rep-1', requestId: 'x' });
    expect((good.meta as Record<string, unknown>).meta_description).toBe(GOOD);
    expect((good.meta as Record<string, unknown>).meta_description_length).toBeUndefined();
  });
});

describe('a CMS never publishes "Slug: ..." as the description', () => {
  it('a broken stored description is published as none; a good one as it is', () => {
    expect(cmsPage(payload('Slug: ms-365-erp-uae')).metaDescription).toBe('');
    expect(cmsPage(payload(GOOD)).metaDescription).toBe(GOOD);
    expect(cmsPage(payload('Find your phase and deadline.')).metaDescription).toBe('Find your phase and deadline.');   // short but the page's own: kept
  });
});
