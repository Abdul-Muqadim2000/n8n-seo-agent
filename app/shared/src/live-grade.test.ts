import { describe, expect, it } from 'vitest';
import { cutLabel, decodeEntities, interpretLiveGrade, liveGradeBody, liveGradePending, liveGradeTarget, liveGradeView, nextLiveGrade, type LiveGradeCheck } from './live-grade';

// Client reports 2026-11-11 (devaicon.com: "the card still shows the old score of the page instead of the updated one"): the grade of the
// live page. Client text is anonymised (Nova&, novaand-demo.com).
const tell = /[—–‘’“”…]/;
const check = (o: Partial<LiveGradeCheck> = {}): LiveGradeCheck => ({ id: 'c1', receivedAt: '2026-11-11T09:48:43.091Z', keyword: 'application & software development', requestId: '6453', url: 'https://novaand-demo.com/services/application-software-development', live: true, recorded: true, h1: 'Application &amp; Software Development Services', title: 'Application & Software Development Services | Nova&', ...o });
const answered = (status: number, json: Record<string, unknown>) => ({ kind: 'answered' as const, status, json });
const GRADED = {
  ok: true, grade_only: true, request_id: 'app-live-1', markdown: '# x', delivery_status: 'needs_work',
  delivery: { status: 'needs_work', label: 'Needs work: specificity — under half its points', blocking: [], advisory: [{ code: 'a', text: 'x' }, { code: 'b', text: 'y' }], next_step: '', grade: { score: 74 } },
  grade: { score: 74.4 }, client_questions: [], live_read: { ok: true, url: 'https://novaand-demo.com/services/application-software-development', title: 'Application &amp; Software', words: 1840 },
};

describe('which publish check a live page is graded from', () => {
  it('the newest check that opened the page and recorded it, by request id or keyword', () => {
    const checks = [
      check({ id: 'old', receivedAt: '2026-11-02T10:00:00Z' }),
      check({ id: 'refused', receivedAt: '2026-11-11T10:30:00Z', recorded: false }),
      check({ id: 'closed', receivedAt: '2026-11-11T10:40:00Z', live: false }),
      check({ id: 'byKeyword', receivedAt: '2026-11-11T09:48:43Z', requestId: 'app-fin-9e40', keyword: ' Application & Software Development' }),
      check({ id: 'other', receivedAt: '2026-11-11T11:00:00Z', requestId: '9999', keyword: 'engagement models' }),
    ];
    expect(liveGradeTarget({ requestIds: ['6453'], keyword: 'application & software development' }, checks)?.id).toBe('byKeyword');
    expect(liveGradeTarget({ requestIds: ['6453'], keyword: '' }, checks)?.id).toBe('old');
    expect(liveGradeTarget({ requestIds: ['1'], keyword: 'cloud' }, checks)).toBeNull();
  });
  it('pending while a check is newer than the newest attempt', () => {
    const c = check();
    expect(liveGradePending(null, c)).toBe(true);
    expect(liveGradePending('2026-11-10T09:00:00Z', c)).toBe(true);
    expect(liveGradePending(c.receivedAt, c)).toBe(false);
    expect(liveGradePending(new Date('2026-11-11T12:00:00Z'), c)).toBe(false);
    expect(liveGradePending(null, null)).toBe(false);
  });
});

describe('the request', () => {
  it('the finalize body of the newest version with no answers, plus grade_only and the live address with its decoded heading', () => {
    const original = { keyword: 'application & software development', request_id: '6453', markdown: '# Delivered', meta: { title: 'T', h1: 'H', slug: 's', page_type: 'Service Page' }, qa_blocking: [], qa_client_questions: [{ id: 'q1' }] };
    const final = { ...original, markdown: '# Final version', finalized_from: 'r0', request_id: 'app-fin-1' };
    const b = liveGradeBody({ requestId: 'app-live-1', domain: 'novaand-demo.com', siteId: 'site_novaand-demo-com', payload: final, original, businessFacts: 'Facts', facts: {}, check: check() });
    expect(b.mode).toBe('finalize');
    expect(b.answers).toEqual([]);
    expect(b.markdown).toBe('# Final version');
    expect(b.client_edited).toBe(false);
    expect(b.content_request_id).toBe('6453');
    expect(b.grade_only).toBe(true);
    expect(b.grade_live).toEqual({ url: 'https://novaand-demo.com/services/application-software-development', h1: 'Application & Software Development Services', title: 'Application & Software Development Services | Nova&' });
    expect(liveGradeBody({ requestId: 'x', domain: 'd.com', siteId: 's', payload: original, original, businessFacts: '', facts: {}, check: check({ h1: undefined, title: undefined }) }).grade_live).toEqual({ url: check().url, h1: '', title: '' });
  });
  it('entities decoded', () => {
    expect(decodeEntities('A &amp; B &#39;x&#x27; &quot;y&quot;  &nbsp;z')).toBe('A & B \'x\' "y" z');
  });
});

describe('the engine answer', () => {
  it('a live grade is stored with its score, status, plain label and blockers', () => {
    const o = interpretLiveGrade(answered(200, { ...GRADED, delivery: { ...GRADED.delivery, blocking: [{ code: 'bracket', text: 'A bracket left in the text — [Price]' }] } }));
    expect(o.kind).toBe('graded');
    if (o.kind !== 'graded') return;
    expect(o.grade).toMatchObject({ score: 74, status: 'needs_work', advisory_count: 2, words: 1840, title: 'Application & Software', url: GRADED.live_read.url });
    expect(o.grade.blocking).toEqual([{ code: 'bracket', text: 'A bracket left in the text: [Price]' }]);
    expect(o.grade.label + o.grade.blocking[0]!.text).not.toMatch(tell);
  });
  it('a live page that could not be read (400 grade_live) is a failed read; anything else stores nothing', () => {
    expect(interpretLiveGrade(answered(400, { ok: false, error: 'grade_live: the live page could not be read: the page reader answered 403; keyword is required' }))).toEqual({ kind: 'read_failed', error: 'the live page could not be read: the page reader answered 403' });
    expect(interpretLiveGrade(answered(400, { ok: false, error: 'unknown field grade_only' }))).toMatchObject({ kind: 'skip', pause: 'page' });
    // an engine from before live grading answers a normal final version: never the live grade, and the job pauses
    expect(interpretLiveGrade(answered(200, { ...GRADED, grade_only: undefined, live_read: undefined }))).toMatchObject({ kind: 'skip', pause: 'engine' });
    expect(interpretLiveGrade(answered(200, { ...GRADED, live_read: { ok: false } }))).toMatchObject({ kind: 'skip', pause: 'engine' });
    expect(interpretLiveGrade(answered(404, {}))).toMatchObject({ kind: 'skip', pause: 'engine' });
    expect(interpretLiveGrade(answered(502, {}))).toMatchObject({ kind: 'skip', pause: 'page' });
    expect(interpretLiveGrade({ kind: 'timeout', status: 0, json: {} })).toMatchObject({ kind: 'skip', pause: 'page' });
  });
  it('a failed read keeps the previous grade and says so; a new grade clears it', () => {
    const g = interpretLiveGrade(answered(200, GRADED));
    if (g.kind !== 'graded') throw new Error('graded expected');
    const first = nextLiveGrade(null, g, { publishedReportId: 'c1', url: 'u', at: '2026-11-11T10:00:00Z' });
    expect(first).toMatchObject({ score: 74, published_report_id: 'c1', checked_at: '2026-11-11T10:00:00Z', read_failed: null });
    const failed = nextLiveGrade(first, { kind: 'read_failed', error: 'no answer' }, { publishedReportId: 'c2', url: 'u', at: '2026-11-12T10:00:00Z' });
    expect(failed).toMatchObject({ score: 74, published_report_id: 'c1', checked_at: '2026-11-11T10:00:00Z', read_failed: { at: '2026-11-12T10:00:00Z', published_report_id: 'c2' } });
    const never = nextLiveGrade(null, { kind: 'read_failed', error: 'no answer' }, { publishedReportId: 'c2', url: 'u', at: '2026-11-12T10:00:00Z' });
    expect(never.score).toBeNull();
    expect(liveGradeView(never, '2026-11-12T09:00:00Z')).toMatchObject({ score: null, checkedAt: null, readFailed: { publishedReportId: 'c2' } });
    expect(liveGradeView(nextLiveGrade(failed, g, { publishedReportId: 'c3', url: 'u', at: '2026-11-13T10:00:00Z' }), '2026-11-13T09:00:00Z')).toMatchObject({ score: 74, readFailed: null, publishedReportId: 'c3', checkedAt: '2026-11-13T10:00:00Z', attemptedAt: '2026-11-13T09:00:00.000Z' });
    expect(liveGradeView(null, null)).toBeNull();
  });
});

describe('review M1: a failed live read is tried again', () => {
  it('three attempts for one check, 12 hours apart; a refused address is final', async () => {
    const m = await import('./live-grade');
    const g = (attempts: number, error = 'the page reader answered 402', at = '2026-11-11T10:00:00Z') => ({ score: 70, status: 'needs_work', label: '', blocking: [], advisory_count: 0, url: 'u', title: '', words: 1, published_report_id: 'c1', checked_at: 'x', read_failed: { at, published_report_id: 'c1', error, attempts } }) as never;
    const t0 = Date.parse('2026-11-11T12:00:00Z');
    expect(m.liveReadSettled(g(1), 'c1')).toBe(false);
    expect(m.liveReadWaiting(g(1), 'c1', t0)).toBe(true);
    expect(m.liveReadWaiting(g(1), 'c1', t0 + 11 * 3_600_000)).toBe(false);
    expect(m.liveReadSettled(g(3), 'c1')).toBe(true);
    expect(m.liveReadSettled(g(1, 'grade_live: the live address must be a page of devaicon.com'), 'c1')).toBe(true);
    expect(m.liveReadSettled(g(1), 'c2')).toBe(true);
  });
});

// Production review 2026-11-12 (S2-05): the stored label was cut at 160 characters in the middle of a sentence ("... Publish this text as an").
describe('cutLabel', () => {
  const LONG = 'Not ready to publish yet: this website already has a page for the same search: https://www.novaand-demo.com/dynamics-365-business-central-uae. Publish this text as an update of that page, or tell us how the new page differs';
  it('ends at the last full sentence inside the limit, never mid-sentence', () => {
    const l = cutLabel(LONG, 160);
    expect(l.length).toBeLessThanOrEqual(160);
    expect(l.endsWith('business-central-uae.')).toBe(true);
    expect(l).not.toMatch(/as an$/);
  });
  it('a short label is unchanged; with no sentence end it stops at a clause or a whole word', () => {
    expect(cutLabel('Ready to publish', 160)).toBe('Ready to publish');
    const words = cutLabel('Needs work: ' + 'specificity readability sources '.repeat(10), 60);
    expect(words.length).toBeLessThanOrEqual(60);
    expect(words).toMatch(/^Needs work/);
    expect(words).not.toMatch(/[,;: ]$/);
    const w2 = cutLabel('word '.repeat(40), 30);
    expect(w2.length).toBeLessThanOrEqual(30);
    expect(w2.endsWith('word')).toBe(true);
  });
  it('the stored grade carries the cut label', () => {
    const o = interpretLiveGrade(answered(200, { ...GRADED, delivery: { ...GRADED.delivery, status: 'not_ready', label: LONG } }));
    expect(o.kind).toBe('graded');
    if (o.kind === 'graded') expect(o.grade.label.endsWith('business-central-uae.')).toBe(true);
  });
});
