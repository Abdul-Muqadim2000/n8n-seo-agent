import { describe, expect, it } from 'vitest';
import { CHECKS_IMPROVED_AT, CHECKS_IMPROVED_REASON, checksImprovedRecheck, generatedRowView, isFinalVersionReport } from './page-review';
import { bingSourceText } from './backlinks';
import { deriveSiteTasks } from './site-tasks';

// Client reports 2026-11-11. (1) Engine section 184 (deployed 2026-11-10 ~19:30 UTC) stopped two rules that froze final versions at 59 "Not
// ready"; a version made before then may be made again once, free. (2) techand.ai read a page and its final version as "the same content
// written again with the same score": a final version row is labelled and carries its own grade. Payloads follow devaicon's "ai automation
// services" (final 2026-11-10 15:33 UTC: not_ready 59, blockers duplicate_page + review) and techand's "crm for customers".

const frozen = (o: Record<string, unknown> = {}) => ({
  qa_delivery_status: 'not_ready',
  qa_grade: { score: 59 },
  qa_blocking: [
    { code: 'duplicate_page', text: 'This website already has a page for the same search: https://devaicon.com/ai-automation-services-pakistan.' },
    { code: 'review', text: 'A second read of the page found a problem at "Our work runs in three phases:"' },
  ],
  ...o,
});
const BEFORE = '2026-11-10T15:33:59Z';
const AFTER = '2026-11-10T19:31:00Z';

describe('a version made before our checks improved (checksImprovedRecheck)', () => {
  it('the date and the words', () => {
    expect(CHECKS_IMPROVED_AT).toBe('2026-11-10T19:30:00Z');
    expect(CHECKS_IMPROVED_REASON).toBe('Our checks improved on 10 November: make the final version again for an up-to-date grade');
    expect(CHECKS_IMPROVED_REASON).not.toMatch(/[—–‘’“”…]/);
  });
  it('made before the fix, not ready, held by the second read or the duplicate rule: may be made again', () => {
    expect(checksImprovedRecheck({ madeAt: BEFORE, payload: frozen(), isFinal: true })).toBe(true);
    // review M2: a page that never had a final version makes its first one as usual (not the free re-make)
    expect(checksImprovedRecheck({ madeAt: BEFORE, payload: frozen() })).toBe(false);
    expect(checksImprovedRecheck({ madeAt: new Date(BEFORE), payload: frozen({ qa_blocking: [{ code: 'review', text: 'A second read found a problem' }] }), isFinal: true })).toBe(true);
    expect(checksImprovedRecheck({ madeAt: BEFORE, payload: frozen({ qa_blocking: [{ code: 'duplicate_page', text: 'Same search as /x' }] }), isFinal: true })).toBe(true);
    // needs work with one of those blockers still listed
    expect(checksImprovedRecheck({ madeAt: BEFORE, payload: frozen({ qa_delivery_status: 'needs_work' }), isFinal: true })).toBe(true);
  });
  it('not when made after the fix, when already made again for free, or for any other blocker or status', () => {
    expect(checksImprovedRecheck({ madeAt: AFTER, payload: frozen(), isFinal: true })).toBe(false);
    expect(checksImprovedRecheck({ madeAt: CHECKS_IMPROVED_AT, payload: frozen(), isFinal: true })).toBe(false);
    expect(checksImprovedRecheck({ madeAt: BEFORE, payload: frozen(), used: true, isFinal: true })).toBe(false);
    expect(checksImprovedRecheck({ madeAt: null, payload: frozen(), isFinal: true })).toBe(false);
    expect(checksImprovedRecheck({ madeAt: BEFORE, payload: frozen({ qa_blocking: [{ code: 'copied', text: 'Part of the text repeats another page' }] }) })).toBe(false);
    expect(checksImprovedRecheck({ madeAt: BEFORE, payload: frozen({ qa_delivery_status: 'ready', qa_blocking: [] }) })).toBe(false);
    // needs work with no blocker (the engine's floors only): nothing the fix changed
    expect(checksImprovedRecheck({ madeAt: BEFORE, payload: frozen({ qa_delivery_status: 'needs_work', qa_blocking: [] }) })).toBe(false);
  });
});

describe('the Generated pages table (generatedRowView)', () => {
  const page = { title: 'Page: crm for customers', summary: { keyword: 'crm for customers', verdict: 'AVOID', score: 30, hasPage: true } };
  const final = { title: 'Final version: "crm for customers"', summary: { keyword: 'crm for customers', verdict: 'AVOID', score: 30, hasPage: true, grade: 78, delivery: 'needs_work', finalVersion: true } };
  it('a page shows its verdict and verdict score', () => {
    expect(generatedRowView(page)).toEqual({ finalVersion: false, verdict: 'AVOID', score: 30, scoreKind: 'verdict' });
  });
  it('a final version is labelled as one and shows its own grade, never the verdict score it copied', () => {
    expect(generatedRowView(final)).toEqual({ finalVersion: true, verdict: '', score: 78, scoreKind: 'grade' });
  });
  it('a final version from before the summary flag is known by its title', () => {
    const old = { title: final.title, summary: { ...final.summary, finalVersion: undefined } };
    expect(isFinalVersionReport(old)).toBe(true);
    expect(isFinalVersionReport(page)).toBe(false);
    expect(generatedRowView({ title: final.title, summary: { verdict: 'AVOID', score: 30 } })).toEqual({ finalVersion: true, verdict: '', score: null, scoreKind: 'grade' });
  });
});

describe('L03 (Bing Webmaster) checked right away', () => {
  it('the step says how it is checked', () => {
    const step = { key: 'ai_rank:L03:site', lever: 'L03', label: '', what: 'Add your website to Bing Webmaster Tools', why: 'ChatGPT search and Copilot read Bing', check: 'the weekly run reads Bing', url: '', actionId: 'act_L03', status: 'queued' };
    const tasks = deriveSiteTasks({ domain: 'novaand-demo.com', indexnow: null, access: null, reclaim: null, aiRank: { checkedAt: '2026-11-09T09:30:00Z', steps: [step], statusOf: {} } }, []);
    const l03 = tasks.find((x) => x.key === 'ai_rank:L03:site');
    expect(l03?.detail).toMatch(/How we check it: Add your website in Bing Webmaster Tools, add our reading account as a Read only user, then press "I've done it, check now": we ask Bing right away whether we can see your site\./);
    expect(l03?.address).toBeUndefined();
  });
  it('the words are the Backlinks page Bing card\'s, with the Read only step and the reading account when it is set', () => {
    const live = { configured: true, inAccount: false, verified: false, shareWith: 'reader@alaventra.example', checkedAt: '2026-11-11T10:00:00.000Z', message: '' };
    expect(bingSourceText(null, live).text).toMatch(/enter reader@alaventra\.example and pick Read only/);
    expect(bingSourceText(null, { ...live, shareWith: '' }).text).toMatch(/add the Alaventra reading account as a Read only user/);
  });
});
