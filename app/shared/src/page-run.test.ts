import { describe, expect, it } from 'vitest';
import {
  DUPLICATE_REASON_MAX,
  duplicatePagesOf,
  duplicateReasonProblem,
  finalizeBody,
  finalReportPayload,
  pageRunOf,
  questionsOf,
  reviewPersonIds,
  type FinalizeResult,
} from './page-review';

// W0-B (2026-10-29, page-quality PLAN Fix 2, REVIEW_CODE H2, owner decision D2): the final version keeps every blocker of the page run.
// Finalize 3336 (the final version of production page run 3299, "ms 365 erp") was sent none of them and said "Ready" at 100. These
// fixtures are anonymised (Nova&, novaand.example), shaped like 3299's stored callback.

const BC = 'https://www.novaand.example/dynamics-365-business-central-uae';
const DUP_TEXT = `This website already has a page for the same search: ${BC}. Publish this text as an update of that page, or tell us how the new page differs`;
/** 3299's stored callback, old format: the gating fields, no `page_run` */
const ORIGINAL_3299 = {
  stage: 'content',
  request_id: '3298',
  keyword: 'ms 365 erp',
  domain: 'novaand.example',
  country: 'United Arab Emirates',
  verdict: 'GO_WITH_CHANGES',
  score: 42,
  score_withheld: false,
  markdown: '# MS 365 ERP for UAE Businesses\n\nMicrosoft 365 is not an ERP.\n\n## What to choose\n\nCompare the options.\n',
  qa_delivery_status: 'not_ready',
  qa_not_ready: true,
  qa_publishable: false,
  qa_blocking: [{ code: 'duplicate_page', text: DUP_TEXT, action: 'publish it as an update of your existing page for this search, or tell us how the new page differs' }],
  qa_grade: { score: 92, of: 100, breakdown: { structure: 25, coverage: 25, readability: 15, specificity: 10, clean_language: 10, length: 7 } },
  qa_client_questions: [],
  meta: {
    title: 'MS 365 ERP in the UAE',
    slug: 'ms-365-erp-uae',
    meta_description: 'Slug: ms-365-erp-uae',
    page_type: 'Service Page',
    originality: {
      threshold_pct: 15,
      passed: true,
      duplicate_targets: [{ url: BC, title: 'Business Central ERP Solutions in UAE | Nova', keyword_words_shared_pct: 100 }],
      top_overlaps: [{ url: 'https://www.novaand.example/insights/is-microsoft-dynamics-365-an-erp-system', overlap_pct: 0.5, passages: [{ words: 15, text: 'name you cannot place ask the vendor to map it to a specific microsoft app' }] }],
    },
  },
};
/** a page from before the blocking list was in the callback (2026-10-22, like the ranking guide of exec 949): gate fields and originality */
const BEFORE_H1 = {
  stage: 'content',
  request_id: '949',
  keyword: 'is microsoft dynamics 365 an erp system',
  markdown: '# Is Microsoft Dynamics 365 an ERP system?\n\nYes, in part.\n',
  qa_publishable: true,
  qa_not_ready: false,
  meta: { page_type: 'Guide', originality: { passed: true, duplicate_targets: [] } },
};

describe('the page-run context (PRC) of a stored report', () => {
  it('reads the gating fields of an old-format report (3299): its blocking list, the duplicate page, the verdict, the length it measured', () => {
    const pr = pageRunOf(ORIGINAL_3299);
    expect(pr.missing).toEqual([]);
    expect(pr.qa_blocking?.map((b) => b.code)).toEqual(['duplicate_page']);
    expect(pr.duplicate_targets).toEqual([{ url: BC, title: 'Business Central ERP Solutions in UAE | Nova', keyword_words_shared_pct: 100 }]);
    expect(pr).toMatchObject({ verdict: 'GO_WITH_CHANGES', score: 42, score_withheld: false, page_type: 'Service Page', verdict_acknowledged: false, length_points: 7, content_request_id: '3298', copied_passages: [] });
    expect(pr.length_band).toBeUndefined();
  });
  it('a report from before the blocking list: nothing blocked it when it passed and no duplicate was found (the ranking guide is never held back)', () => {
    const pr = pageRunOf(BEFORE_H1);
    expect(pr.missing).toEqual([]);
    expect(pr.qa_blocking).toEqual([]);
    expect(pr.length_points).toBeNull();
    expect(pr.verdict).toBeNull();
    expect(pr.score).toBeNull();
  });
  it('before the blocking list, the duplicate page and copied text found by the originality check still block', () => {
    const pr = pageRunOf({ ...BEFORE_H1, meta: { page_type: 'Guide', originality: { passed: false, threshold_pct: 15, duplicate_targets: [{ url: BC, title: 'BC' }], top_overlaps: [{ url: 'https://other.example/a', overlap_pct: 31, passages: [{ text: 'a passage of eight words or more copied from elsewhere' }] }] } } });
    expect(pr.qa_blocking?.map((b) => b.code)).toEqual(['duplicate_page', 'copied']);
    expect(pr.copied_passages).toEqual(['a passage of eight words or more copied from elsewhere']);
  });
  it('a report with no blocking list, no gate and no originality check: both blocking gating fields are missing (never Ready)', () => {
    expect(pageRunOf({ stage: 'content', markdown: '# x' }).missing).toEqual(['duplicate_targets', 'qa_blocking']);
  });
  it('the grading fields come from the callback\'s page_run; a final version keeps its copy', () => {
    const pr = pageRunOf({ ...ORIGINAL_3299, page_run: { prc: 1, length_band: { low: 900, high: 2400, source: 'page_type', target: 1500 }, terms: [{ term: 'business central', min_count: 6 }], serp_shapes: null, content_request_id: '3298' } });
    expect(pr.length_band).toEqual({ low: 900, high: 2400, source: 'page_type', target: 1500 });
    expect(pr.terms).toEqual([{ term: 'business central', min_count: 6 }]);
    expect('serp_shapes' in pr).toBe(false);
    const kept = pageRunOf({ qa_blocking: [{ code: 'not_checked', text: 'the final version\'s own list' }], page_run_context: pr });
    expect(kept).toEqual(pr);
  });
  it('wave 0.5: the second read\'s advice travels with the page run, so the final version keeps its deduction while the words are there', () => {
    const advice = [{ severity: 'high', kind: 'source', location: 'Business Central publishes per-user licence tiers' }];
    const pr = pageRunOf({ ...ORIGINAL_3299, page_run: { prc: 1, second_read: advice, content_request_id: '3298' } });
    expect(pr.second_read).toEqual(advice);
    expect(pr.missing).toEqual([]);
    expect('second_read' in pageRunOf({ ...ORIGINAL_3299, page_run: { prc: 1, second_read: null } })).toBe(false);
  });
  it('wave 0.6: what the page run took out of the page travels with it, so the final version keeps the cap while those sections are missing', () => {
    const removed = { sections: 6, words: 0, words_before: 2407, h2_before: 7, h2_removed: 0, h2_delivered: 3, by_edits: 0, share_pct: 0, capped: true,
      list: [{ heading: 'Which Dynamics 365 ERP fits your UAE business?', topic: 'Dynamics GP and SL', words: 0, level: 2, why: 'a topic the verdict said to leave out' }] };
    const pr = pageRunOf({ ...ORIGINAL_3299, page_run: { prc: 1, sections_removed: removed, content_request_id: '3298' } });
    expect(pr.sections_removed).toEqual(removed);
    expect(pr.missing).toEqual([]);
    // a report from before the field: nothing is invented (the engine says "not checked")
    expect('sections_removed' in pageRunOf({ ...ORIGINAL_3299, page_run: { prc: 1 } })).toBe(false);
    // the final version's copy keeps it, so a second finalize still caps
    const kept = pageRunOf({ qa_blocking: [], page_run_context: pr });
    expect(kept.sections_removed).toEqual(removed);
  });
});

describe('the finalize request carries the page run of the ORIGINAL report', () => {
  const finalVersion = { ...ORIGINAL_3299, qa_blocking: [], qa_delivery_status: 'ready', finalized_from: 'rep-3299' };
  const body = (payload: Record<string, unknown>, original?: Record<string, unknown>, decision?: { choice: 'differs'; reason: string } | null) =>
    finalizeBody({ requestId: 'app-fin-2', domain: 'novaand.example', siteId: 'site_novaand-example', payload, markdown: String(payload.markdown), clientEdited: false, questions: questionsOf(payload), answers: {}, businessFacts: '', facts: {}, original, duplicateDecision: decision ?? null });
  it('qa_blocking comes from the original report, not from the version being improved', () => {
    const b = body(finalVersion, ORIGINAL_3299);
    expect(b.page_run.qa_blocking?.map((x) => x.code)).toEqual(['duplicate_page']);
    expect(b.page_run.duplicate_targets?.[0]?.url).toBe(BC);
    expect(b.content_request_id).toBe('3298');
    expect('duplicate_decision' in b).toBe(false);
  });
  it('the original itself when no original is passed (a first finalize)', () => {
    expect(body(ORIGINAL_3299).page_run.qa_blocking?.map((x) => x.code)).toEqual(['duplicate_page']);
  });
  it('the client\'s decision on the duplicate is sent', () => {
    const reason = 'This page is about the Microsoft 365 apps we license, not Business Central projects.';
    expect(body(ORIGINAL_3299, ORIGINAL_3299, { choice: 'differs', reason }).duplicate_decision).toEqual({ choice: 'differs', reason });
  });
  it('a second finalize carries the page-run context: the final version keeps it, and a finalize from it still sends the original\'s blockers', () => {
    const result: FinalizeResult = {
      ok: true, request_id: 'app-fin-1', markdown: '# MS 365 ERP for UAE Businesses\n\nMicrosoft 365 is not an ERP system.\n', applied: [], sections_rewritten: [], changes: [],
      delivery_status: 'not_ready', delivery: { status: 'not_ready', label: 'Not ready', blocking: [{ code: 'duplicate_page', text: DUP_TEXT }], advisory: [], next_step: 'x', grade: { score: 92 } },
      client_questions: [], grade: { score: 92 }, cost: { claude_usd: 0.02, dfs_usd: 0, estimated: true, model_calls: 1 },
    };
    const first = body(ORIGINAL_3299);
    const finalPayload = finalReportPayload(ORIGINAL_3299, result, { originalReportId: 'rep-3299', requestId: 'app-fin-1', pageRun: first.page_run });
    expect(finalPayload.page_run_context).toEqual(first.page_run);
    // the original report is gone: the final version is its own original, and its copy still carries the page run's blockers
    const second = body(finalPayload, finalPayload);
    expect(second.page_run).toEqual(first.page_run);
    // and without the explicit copy, finalReportPayload derives it from the payload it builds on
    expect(finalReportPayload(ORIGINAL_3299, result, { originalReportId: 'rep-3299', requestId: 'app-fin-1' }).page_run_context).toEqual(first.page_run);
  });
  it('an update decision gives the final version the address and slug of the page it replaces', () => {
    const result: FinalizeResult = {
      ok: true, request_id: 'app-fin-1', markdown: '# MS 365 ERP\n\nText.\n', applied: [], sections_rewritten: [], changes: [], delivery_status: 'ready',
      delivery: { status: 'ready', label: 'Ready to publish', blocking: [], advisory: [], next_step: '', grade: { score: 90 } }, client_questions: [], grade: { score: 90 },
      cost: { claude_usd: 0, dfs_usd: 0, estimated: true, model_calls: 0 }, meta: { title: 't', meta_description: '', slug: 'dynamics-365-business-central-uae', target_url: BC },
      decision: { code: 'duplicate_page', choice: 'update', url: BC, reason: '', pages: [BC] },
    };
    const p = finalReportPayload(ORIGINAL_3299, result, { originalReportId: 'rep-3299', requestId: 'app-fin-1' });
    expect(p.meta).toMatchObject({ target_url: BC, suggested_url: BC, slug: 'dynamics-365-business-central-uae' });
    expect(p.finalize_decision).toMatchObject({ choice: 'update', url: BC });
  });
});

describe('the duplicate page and the client\'s reason (D2)', () => {
  it('the website\'s page while the blocker is open, none otherwise', () => {
    expect(duplicatePagesOf(ORIGINAL_3299)).toEqual([{ url: BC, title: 'Business Central ERP Solutions in UAE | Nova' }]);
    expect(duplicatePagesOf(BEFORE_H1)).toEqual([]);
    expect(duplicatePagesOf({ ...ORIGINAL_3299, qa_blocking: [] })).toEqual([]);
    expect(duplicatePagesOf({ ...ORIGINAL_3299, meta: { ...ORIGINAL_3299.meta, originality: { passed: true } } })).toEqual([{ url: BC, title: '' }]);
  });
  it('a reason is 20 to 600 characters of plain text', () => {
    expect(duplicateReasonProblem('it is different')).toMatch(/at least 20 characters/);
    expect(duplicateReasonProblem('This page is for buyers of the apps, the other for ERP projects.')).toBe('');
    expect(duplicateReasonProblem('x'.repeat(DUPLICATE_REASON_MAX + 1))).toMatch(/under 600/);
    expect(duplicateReasonProblem('This page is for <b>buyers</b> of the apps, the other is not.')).toMatch(/plain text/);
  });
  it('the person who gave the reason is named, never shown by id', () => {
    const ids = reviewPersonIds({ approval: null, clientVersion: null, answers: {}, questions: [], duplicate: { pages: [{ url: BC, title: '' }], decision: { choice: 'differs', reason: 'r'.repeat(25), at: '2026-10-29T10:00:00.000Z', by: 'user-7' }, rewrite: { keyword: 'ms 365 erp', pageType: 'Service Page', country: '' } } });
    expect(ids).toEqual(['user-7']);
  });
});
