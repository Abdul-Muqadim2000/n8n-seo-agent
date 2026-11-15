import { describe, expect, it } from 'vitest';
import { cutLabel, decodeEntities, deliveredGradeOf, deliveredImageNames, interpretLiveGrade, liveGradeBody, liveGradePending, liveGradeTarget, liveGradeView, nextLiveGrade, type LiveGradeCheck, type PageLiveGrade } from './live-grade';

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

// Client reports 2026-11-16 (devaicon.com: "the version we delivered 95+/100, the live page 84, why?"). An engine answer shaped like the
// production live grade of that day (execution 13659), with synthetic text: the client's own rewrite (0 of 161 of our sentences), readability
// 3 of 10, structure 14 of 20, sources 12 of 15.
const LIVE_1116 = {
  ...GRADED,
  delivery_status: 'needs_work',
  delivery: {
    status: 'needs_work', label: 'Needs work: readability', blocking: [],
    advisory: [{ code: 'kw_count', text: 'Primary keyword used only 2 time(s)' }, { code: 'style', text: 'Hard to read (Flesch 22.9, average sentence 21.8 words): shorten sentences and use plainer words' }],
    needs_work: [{ code: 'needs_work', dim: 'readability', text: 'Readability scored 3 of 10, under half its points', action: 'Use shorter sentences and plainer words' }],
    next_step: 'Your live page has one part under half marks (readability). Use shorter sentences and plainer words. Change it on your website, then press Re-check.',
    grade: { score: 84 },
  },
  grade: { score: 84, breakdown: { structure: 14, coverage: 15, readability: 3, specificity: 10, clean_language: 10, sources: 12, fit: 20, length: 0 }, max: { structure: 20, coverage: 15, readability: 10, specificity: 10, clean_language: 10, sources: 15, fit: 20, length: 0 } },
  live_read: { ok: true, url: 'https://novaand-demo.com/services/agents-uae', title: 'Agents in the UAE', words: 1007, kept_pct: 0, kept_sentences: 0, delivered_sentences: 161, tables: 1, table_rows_restored: 0 },
  live_parts: [
    { dim: 'structure', label: 'structure', points: 14, max: 20, reasons: ['The main search phrase "agents uae" appears 2 times (3 or more)'], fix: '' },
    { dim: 'readability', label: 'readability', points: 3, max: 10, reasons: ['Reading ease 22.9 out of 100 (40 or more, with sentences of 22 words or fewer, scores full marks); sentences average 21.8 words; 7 sentences are over 28 words'], fix: 'Use shorter sentences and plainer words' },
    { dim: 'sources', label: 'sources', points: 12, max: 15, reasons: ['The page cites no outside source'], fix: 'Cite an official body, a research house, major press or vendor documentation' },
    { dim: 'fit', label: 'fit with the search', points: 20, max: 20, reasons: [], fix: '' },
  ],
  readability: { flesch: 22.9, avg_sentence_words: 21.8, long_sentences: 7, longest: [{ text: 'Comprehensive operational visibility across distributed organisational entities necessitates considerable integration planning.', words: 41 }] },
  live_adjustments: [{ code: 'direct_answer', text: 'Your page opens with a direct answer (66 words) without a "Quick answer" label: we count it as the direct answer' }],
};

describe('client reports 2026-11-16: what the live grade says beside its number', () => {
  it('keeps the parts, why each lost points, the readability, how much of our text is on the page and what was not counted', () => {
    const o = interpretLiveGrade(answered(200, LIVE_1116));
    expect(o.kind).toBe('graded');
    if (o.kind !== 'graded') return;
    const g = o.grade;
    expect(g).toMatchObject({ score: 84, label: 'Needs work: readability', kept_pct: 0, kept_sentences: 0, delivered_sentences: 161 });
    expect(g.breakdown).toMatchObject({ readability: 3, structure: 14, sources: 12 });
    expect(g.max).toMatchObject({ readability: 10, structure: 20 });
    expect(g.parts!.map((p) => [p.dim, p.points, p.max])).toEqual([['structure', 14, 20], ['readability', 3, 10], ['sources', 12, 15], ['fit', 20, 20]]);
    expect(g.parts![1]!.reasons[0]).toMatch(/^Reading ease 22\.9 out of 100/);
    expect(g.readability).toEqual({ flesch: 22.9, avg_sentence_words: 21.8, long_sentences: 7, longest: [{ text: LIVE_1116.readability.longest[0]!.text, words: 41 }] });
    expect(g.needs_work).toEqual([{ dim: 'readability', text: 'Readability scored 3 of 10, under half its points', action: 'Use shorter sentences and plainer words' }]);
    expect(g.advisory).toHaveLength(2);
    expect(g.next_step).toMatch(/on your website, then press Re-check/);
    expect(g.adjustments).toEqual([{ code: 'direct_answer', text: LIVE_1116.live_adjustments[0]!.text }]);
    expect(JSON.stringify(g)).not.toMatch(tell);
    // the view the screens read
    const v = liveGradeView({ ...g, published_report_id: 'pub1', checked_at: '2026-11-13T09:32:00Z', delivered: { score: 98, breakdown: { readability: 10, structure: 18, sources: 15 }, images: 3 } }, '2026-11-13T09:29:00Z')!;
    expect(v).toMatchObject({ keptPct: 0, keptSentences: 0, deliveredSentences: 161, nextStep: LIVE_1116.delivery.next_step, delivered: { score: 98, images: 3 } });
    expect(v.parts).toHaveLength(4);
    expect(v.readability).toMatchObject({ flesch: 22.9, avgSentenceWords: 21.8, longSentences: 7 });
    expect(v.adjustments).toHaveLength(1);
  });

  it('a grade stored before (no parts, no readability, no kept share) still renders, with empty values', () => {
    const old = { score: 84, status: 'needs_work', label: 'Needs work: readability', blocking: [], advisory_count: 7, url: 'https://novaand-demo.com/x', title: 'X', words: 989, published_report_id: 'pub1', checked_at: '2026-11-13T09:32:00Z', read_failed: null } as PageLiveGrade;
    const v = liveGradeView(old, '2026-11-13T09:29:00Z')!;
    expect(v).toMatchObject({ score: 84, label: 'Needs work: readability', advisoryCount: 7, parts: [], readability: null, keptPct: null, adjustments: [], nextStep: '', delivered: null });
    // an engine from before section 191 answers without the new fields: the grade is stored as before
    const o = interpretLiveGrade(answered(200, GRADED));
    expect(o.kind === 'graded' && o.grade.parts).toEqual([]);
    expect(o.kind === 'graded' && o.grade.kept_pct).toBeNull();
  });

  it('the delivered version: its exact grade (98, not "95+"), its parts and its images; their file names for the publish check', () => {
    const payload = { qa_grade: { score: 98, breakdown: { structure: 18, readability: 10 } }, images: [{ fileName: 'agents-hero.webp', $file: 'f1' }, { fileName: 'agents-matrix.webp' }, { fileName: 'notes.txt' }],
      meta: { images: [{ path: 'images/agents-hero.webp', width: 1200, height: 675 }, { path: 'images/agents-flow.webp', width: 1000, height: 600 }] } };
    expect(deliveredGradeOf(payload)).toEqual({ score: 98, breakdown: { structure: 18, readability: 10 }, images: 3 });
    expect(deliveredGradeOf({})).toBeNull();
    expect(deliveredImageNames(payload)).toEqual(['agents-hero.webp', 'agents-matrix.webp', 'agents-flow.webp']);
  });

  it('the request carries the page\'s tables and their rows from the publish check (a flattened table is put back), only when known', () => {
    const base = { requestId: 'app-live-1', domain: 'novaand-demo.com', siteId: 'site_novaand-demo-com', payload: { markdown: '# x', keyword: 'k' }, original: {}, businessFacts: '', facts: {} as never };
    const b = liveGradeBody({ ...base, check: { url: 'https://novaand-demo.com/x', h1: 'X', title: 'X | Nova&', tables: 2, tableRows: ['Criterion Weight What to ask for', 'Partner status High Their listing'] } });
    expect(b.grade_live).toEqual({ url: 'https://novaand-demo.com/x', h1: 'X', title: 'X | Nova&', tables: 2, table_rows: ['Criterion Weight What to ask for', 'Partner status High Their listing'] });
    const old = liveGradeBody({ ...base, check: { url: 'https://novaand-demo.com/x', h1: 'X', title: 'X' } });
    expect(old.grade_live).toEqual({ url: 'https://novaand-demo.com/x', h1: 'X', title: 'X' });
  });
});

describe('review of 2026-11-16: the live description and the version compared', () => {
  it('M3: the live page\'s own meta description goes with the request when the check read it (also an empty one), never when it did not', () => {
    const base = { requestId: 'app-live-1', domain: 'novaand-demo.com', siteId: 'site_novaand-demo-com', payload: { markdown: '# x', keyword: 'k', meta: { meta_description: 'Ours, delivered.' } }, original: {}, businessFacts: '', facts: {} as never };
    expect(liveGradeBody({ ...base, check: { url: 'https://novaand-demo.com/x', h1: 'X', title: 'X', metaDescription: 'Theirs &amp; live' } }).grade_live.meta_description).toBe('Theirs & live');
    expect(liveGradeBody({ ...base, check: { url: 'https://novaand-demo.com/x', h1: 'X', title: 'X', metaDescription: '' } }).grade_live.meta_description).toBe('');
    expect('meta_description' in liveGradeBody({ ...base, check: { url: 'https://novaand-demo.com/x', h1: 'X', title: 'X' } }).grade_live).toBe(false);
  });
  it('L10: the delivered grade compared is the version the card names now (passed in), else the one stored with the grade; read as the card reads it', () => {
    const g = { score: 84, status: 'needs_work', label: 'Needs work: readability', blocking: [], advisory_count: 0, url: 'u', title: 't', words: 900, published_report_id: 'p', checked_at: '2026-11-13T09:32:00Z', delivered: { score: 97, breakdown: { readability: 10 }, images: 3 } } as PageLiveGrade;
    expect(liveGradeView(g, null)!.delivered).toEqual({ score: 97, breakdown: { readability: 10 }, images: 3 });
    expect(liveGradeView(g, null, { score: 91, breakdown: { readability: 8 }, images: 3 })!.delivered).toEqual({ score: 91, breakdown: { readability: 8 }, images: 3 });
    // an older report keeps its grade under qa_quality: the same number as the card's "version we delivered"
    expect(deliveredGradeOf({ qa_quality: { grade: { score: 88, breakdown: { structure: 16 } } } })).toEqual({ score: 88, breakdown: { structure: 16 }, images: 0 });
  });
  it('L6: a read that could not be compared keeps its reason', () => {
    const o = interpretLiveGrade(answered(200, { ...LIVE_1116, live_read: { ...LIVE_1116.live_read, kept_pct: null, kept_sentences: 0, kept_note: 'the live page was read with too little text to compare it with the text we delivered' } }));
    expect(o.kind === 'graded' && o.grade.kept_pct).toBeNull();
    expect(o.kind === 'graded' && liveGradeView({ ...o.grade, published_report_id: 'p', checked_at: 'x' }, null)!.keptNote).toMatch(/too little text/);
  });
});
