// W0-C (2026-10-29, page-quality PLAN Fix 3): the grade as the client sees it. "95+" from 95 (never 100), and "Needs work: <part>" when a
// part of the grade is under half its points while nothing blocks the page: never "Ready to publish", still publishable.
import { describe, expect, it } from 'vitest';
import { deliveryOf, finalReportPayload, gradeDisplay, publishableStatus, REVIEW_STAGE_LABEL, REVIEW_STAGE_TONE, reviewStage, type FinalizeResult } from './page-review';

const FLOORS = {
  ok: false,
  failing: [{ dim: 'sources', label: 'sources', points: 0, max: 15, fix: 'Cite an official body, a research house, major press or vendor documentation for "1,284 companies use it"' }],
  waived: [{ dim: 'fit', why: 'your choice: low search demand (you chose to write it anyway)' }],
  shadow: [],
};
const GRADE_NW = { score: 71, display: '71', of: 100, breakdown: { structure: 18, coverage: 15, readability: 10, specificity: 10, clean_language: 10, sources: 0, fit: 8, length: 0 }, floors: FLOORS, ready: false };
const PAGE_NW = {
  keyword: 'ms 365 erp',
  html: '<h1>MS 365 ERP</h1>',
  qa_delivery_status: 'needs_work',
  qa_label: 'Needs work: sources',
  qa_next_step: 'Nothing stops you publishing this page, but one part is under half marks (sources). Cite an official body. Change it in the editor and make the final version, or approve it as it is.',
  qa_grade: GRADE_NW,
  qa_blocking: [],
  qa_advisory: [{ code: 'meta_desc', text: 'Meta description is short' }],
  qa_publishable: true,
  qa_not_ready: false,
};

describe('W0-C: the grade as shown', () => {
  it('a grade of 100 (or anything from 95) renders "95+", below it the number, nothing for no grade', () => {
    expect(gradeDisplay(100)).toBe('95+');
    expect(gradeDisplay(95)).toBe('95+');
    expect(gradeDisplay(94.6)).toBe('95+');
    expect(gradeDisplay(94)).toBe('94');
    expect(gradeDisplay(59)).toBe('59');
    expect(gradeDisplay(null)).toBe('');
    expect(gradeDisplay(undefined)).toBe('');
  });
  it('an older report that said 100 now shows "95+" (the number itself is kept)', () => {
    const d = deliveryOf({ html: '<p>x</p>', qa_delivery_status: 'ready', qa_grade: { score: 100 } });
    expect(d.grade).toBe(100);
    expect(d.gradeLabel).toBe('95+');
    expect(d.status).toBe('ready');
    expect(d.needsWork).toEqual([]);
  });
});

describe('W0-C: "Needs work" is not "Ready", and stops nothing', () => {
  const d = deliveryOf(PAGE_NW);
  it('the status, the headline naming the part, and what to do', () => {
    expect(d.status).toBe('needs_work');
    expect(d.headline).toBe('Needs work: sources');
    expect(d.headline).not.toMatch(/ready/i);
    expect(d.detail).toMatch(/Nothing stops you publishing it/);
    expect(d.needsWork).toEqual([{ code: 'needs_work', text: 'Sources scored 0 of 15, under half its points', action: FLOORS.failing[0]!.fix }]);
    expect(d.nextStep).toMatch(/under half marks/);
    expect(d.blocking).toEqual([]);
    expect(d.gradeLabel).toBe('71');
  });
  it('is publishable (only "not ready" stops a page), with its own stage, label and tone on the content board', () => {
    expect(publishableStatus('needs_work')).toBe(true);
    expect(publishableStatus('not_ready')).toBe(false);
    const stage = reviewStage({ delivery: { status: 'needs_work' }, openQuestions: 0, finalize: { status: 'none' }, isFinal: false, approved: false, publish: 'not_published' });
    expect(stage).toBe('needs_work');
    expect(REVIEW_STAGE_LABEL[stage]).toBe('Needs work, you can still publish it');
    expect(REVIEW_STAGE_TONE[stage]).toBe('warning');
    expect(reviewStage({ delivery: { status: 'needs_work' }, openQuestions: 0, finalize: { status: 'none' }, isFinal: false, approved: true, publish: 'not_published' })).toBe('approved');
  });
  it('a waived floor (the client chose to write it anyway) is not a part that needs work', () => {
    const d2 = deliveryOf({ ...PAGE_NW, qa_delivery_status: 'ready', qa_grade: { ...GRADE_NW, floors: { ...FLOORS, ok: true, failing: [] }, ready: true } });
    expect(d2.status).toBe('ready');
    expect(d2.needsWork).toEqual([]);
  });
  it('what the client reads is plain (no em dash, curly quote or ellipsis character)', () => {
    expect(JSON.stringify(d)).not.toMatch(/[—–…‘’“”]/);
  });
});

describe('W0-C: the final version keeps "Needs work"', () => {
  const result: FinalizeResult = {
    ok: true,
    request_id: 'app-fin-nw',
    markdown: '# MS 365 ERP\n\nText.\n',
    applied: [],
    sections_rewritten: [],
    changes: [],
    delivery_status: 'needs_work',
    delivery: { status: 'needs_work', label: 'Needs work: sources', blocking: [], advisory: [], next_step: 'Nothing stops you publishing this page, but one part is under half marks (sources).', grade: GRADE_NW },
    client_questions: [],
    grade: GRADE_NW,
    cost: { claude_usd: 0, dfs_usd: 0, estimated: false, model_calls: 0 },
  };
  const p = finalReportPayload({ keyword: 'ms 365 erp', html: '<p>x</p>', meta: {} }, result, { originalReportId: 'rep-1', requestId: 'app-fin-nw' });
  it('stored as needs_work, publishable, not "not ready", with the next step and the grade kept', () => {
    expect(p.qa_delivery_status).toBe('needs_work');
    expect(p.qa_publishable).toBe(true);
    expect(p.qa_not_ready).toBe(false);
    expect(p.qa_label).toBe('Needs work: sources');
    expect(String(p.qa_next_step)).toMatch(/under half marks/);
    const d = deliveryOf(p);
    expect(d.status).toBe('needs_work');
    expect(d.needsWork.length).toBe(1);
  });
});
