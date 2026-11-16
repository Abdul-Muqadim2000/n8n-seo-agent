import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CARRY_APPROVAL_DAYS, type ComingUpItem, type SkipRow } from '@seo/shared';
import type { CyclePreviewRow } from '../src/db/schema';
import { cadenceInputFromTables, planCadence, triggerOf, type CadenceTables } from '../src/services/cadence';
import { carriedApprovals, comingUpMail, comingUpView, decisionRow, notWrittenMessage, planSlots, previewOf } from '../src/services/comingUp';

// APPROVALS FIRST (owner 2026-11-16, after the devaicon.com report b): the enterprise rule that the customer's explicit decision outranks the
// autopilot's own choice. The client's approvals for a cycle take the pages a week first (the earliest approval first), then the ladder pages, then
// the level's other automatic items; an approval never raises the pages a week and every hold still applies. Before the run the plan says what an
// approval moves to the next week; an approval the pages could not fit is carried to the next plan by itself, keeping its first approval time.

const here = dirname(fileURLToPath(import.meta.url));
const KF = JSON.parse(readFileSync(resolve(here, '../../../n8n/seo-agent/harness/fixtures/cadence_levels.json'), 'utf8')) as { cases: { name: string; now: string; trigger: Record<string, unknown>; tables: CadenceTables & Record<string, unknown> }[] };
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const caseOf = (n: string) => clone(KF.cases.find((c) => c.name === n)!);
const planOf = (c: ReturnType<typeof caseOf>) => planCadence(cadenceInputFromTables(c.tables, { estPageUsd: 0.84 }), Date.parse(c.now), triggerOf(c.trigger));
const ks = (a: { keyword: string; source: string }[]) => a.map((x) => `${x.keyword} (${x.source})`);
const SQ = 'crm support desk setup uae';
const approve = (item_key: string, source: string, created_at: string) => ({ key: `site_techand-ai:cyc:site_techand-ai:2026-10-21:${item_key}`, site_id: 'site_techand-ai', cycle_key: 'cyc:site_techand-ai:2026-10-21', item_key, decision: 'approve', scope: 'cycle', by: 'owner', created_at, source });

describe('the app mirror (cadence.ts) writes approvals first, the earliest first', () => {
  it('one page a week: the approval takes it and the automatic ladder page waits', () => {
    const c = caseOf('approval_by_source');
    (c.tables.cadence as unknown as Record<string, unknown>[])[0].pages_per_week = 1;
    const p = planOf(c);
    expect(ks(p.picks)).toEqual(['crm implementation partner uae (decay)']);
    expect(p.approvedNotWritten).toEqual([]);
  });
  for (const first of ['decay', 'striking'] as const)
    it(`two approvals, one page a week: the one approved first (${first}) is written, the other is "budget"`, () => {
      const c = caseOf('approval_by_source');
      (c.tables.cadence as unknown as Record<string, unknown>[])[0].pages_per_week = 1;
      (c.tables.query_history as unknown as Record<string, unknown>[]).push({ site_id: 'site_techand-ai', domain: 'techand.ai', period_end: '2026-10-18', query: SQ, position: 9, impressions: 400, clicks: 3, page: 'https://techand.ai/support-desk/' });
      (c.tables as Record<string, unknown>).skips = [
        approve('crm implementation partner uae', 'decay', first === 'decay' ? '2026-10-19T08:00:00.000Z' : '2026-10-20T09:00:00.000Z'),
        approve(SQ, 'striking', first === 'striking' ? '2026-10-19T08:00:00.000Z' : '2026-10-20T09:00:00.000Z'),
      ];
      const p = planOf(c);
      expect(p.picks.map((x) => x.source)).toEqual([first]);
      expect(p.approvedNotWritten.map((x) => [x.keyword, x.reason])).toEqual([[first === 'decay' ? SQ : 'crm implementation partner uae', 'budget']]);
    });
});

const CYCLE = 'cyc:site_techand-ai:2026-11-20';
const PREV = 'cyc:site_techand-ai:2026-11-13';
const RECEIVED = Date.parse('2026-11-18T01:00:00.000Z');
const NOW = Date.parse('2026-11-18T09:00:00.000Z');
const item = (keyword: string, source: string, auto: boolean, extra: Record<string, unknown> = {}) => ({ keyword, item_key: keyword, source, auto, est_usd: 0.84, why: 'w', ...extra });
const bodyOf = (o: { items: unknown[]; suggestions: unknown[]; room?: number; pages?: number }) => ({
  stage: 'cycle_preview', site_id: 'site_techand-ai', domain: 'techand.ai', cycle_key: CYCLE, scheduled_for: '2026-11-20T01:00:00.000Z', level: 2, pages_per_week: o.pages ?? 1,
  waiting_for_keyword: false, paused_reason: '', reason: '', items: o.items, suggestions: o.suggestions, budget: { pages_per_week: o.pages ?? 1, spent: 0, room: o.room ?? o.pages ?? 1 },
});
const previewRow = (body: Record<string, unknown>) => ({ id: 'cp', siteId: 's', orgId: 'o', cycleKey: CYCLE, scheduledFor: new Date('2026-11-20T01:00:00.000Z'), body, reportId: null, receivedAt: new Date(RECEIVED), emailedAt: null }) as CyclePreviewRow;
const skip = (item_key: string, created_at: string, o: Partial<SkipRow> = {}): SkipRow => ({ key: `k:${item_key}:${created_at}`, site_id: 'site_techand-ai', cycle_key: CYCLE, item_key, decision: 'approve', scope: 'cycle', by: 'owner@example.com', created_at, source: 'decay', ladder_id: '', ...o });
const viewOf = (body: Record<string, unknown>, skips: SkipRow[]) => comingUpView({ site: { id: 's', domain: 'techand.ai' }, preview: previewRow(body), skips, role: 'owner', now: NOW, credits: (u) => Math.ceil(u * 60) });
const byKey = (v: { items: ComingUpItem[]; suggestions: ComingUpItem[] }, k: string) => [...v.items, ...v.suggestions].find((i) => i.itemKey === k)!;

describe('the plan says, before the run, what an approval moves', () => {
  const body = bodyOf({ items: [item('crm implementation cost uae', 'ladder', true)], suggestions: [item('crm implementation partner uae', 'decay', false), item(SQ, 'striking', false)] });
  it('nothing approved: the ladder page uses this week\'s page, and approving a suggestion says it moves the ladder page', () => {
    const v = viewOf(body, []);
    expect(byKey(v, 'crm implementation cost uae').slot).toBe('this_week');
    expect(byKey(v, SQ).approveMoves).toBe('crm implementation cost uae');
    expect(byKey(v, SQ).approveOver).toBeUndefined();
  });
  it('one approval: it takes the page, the ladder page moves to next week, the other suggestion would wait for the next plan', () => {
    const v = viewOf(body, [skip('crm implementation partner uae', '2026-11-18T08:00:00.000Z')]);
    expect(byKey(v, 'crm implementation partner uae').slot).toBe('this_week');
    expect(byKey(v, 'crm implementation cost uae').slot).toBe('moved');
    expect(byKey(v, SQ).approveOver).toBe(true);
    expect(v.autoCredits).toBe(0);
  });
  it('two approvals for one page a week: the earliest is this week, the later one is over (carried)', () => {
    const v = viewOf(body, [skip(SQ, '2026-11-18T08:30:00.000Z', { source: 'striking' }), skip('crm implementation partner uae', '2026-11-18T08:00:00.000Z')]);
    expect(byKey(v, 'crm implementation partner uae').slot).toBe('this_week');
    expect(byKey(v, SQ).slot).toBe('over');
  });
  it('a page on top of the pages a week (the AI ranking page) is never moved, and a skipped page takes no slot', () => {
    const b = bodyOf({ items: [item('crm implementation cost uae', 'ladder', true), item('best crm partner uae', 'ai_answer', true, { why: 'x; the reserved AI ranking page of the week (on top of your pages a week)' })], suggestions: [item('crm implementation partner uae', 'decay', false)] });
    const v = viewOf(b, [skip('crm implementation partner uae', '2026-11-18T08:00:00.000Z')]);
    expect(byKey(v, 'best crm partner uae').slot).toBeUndefined();
    expect(byKey(v, 'crm implementation cost uae').slot).toBe('moved');
    const v2 = viewOf(b, [skip('crm implementation partner uae', '2026-11-18T08:00:00.000Z'), skip('crm implementation cost uae', '2026-11-18T08:10:00.000Z', { decision: 'skip', source: '' })]);
    expect(byKey(v2, 'crm implementation partner uae').slot).toBe('this_week');
    expect(byKey(v2, 'crm implementation cost uae').slot).toBeUndefined();
  });
  it('the engine\'s on_top mark is read, and no slot is shown while nothing is written (pile-up) or once the cycle started', () => {
    expect(previewOf(bodyOf({ items: [item('a', 'ai_answer', true, { on_top: true })], suggestions: [] })).items[0].on_top).toBe(true);
    const paused = viewOf({ ...body, paused_reason: 'pileup' }, [skip('crm implementation partner uae', '2026-11-18T08:00:00.000Z')]);
    expect(byKey(paused, 'crm implementation cost uae').slot).toBeUndefined();
    const started = comingUpView({ site: { id: 's', domain: 'techand.ai' }, preview: previewRow(body), skips: [], role: 'owner', now: Date.parse('2026-11-20T02:00:00.000Z'), credits: () => 1 });
    expect(byKey(started, 'crm implementation cost uae').slot).toBeUndefined();
  });
  it('planSlots: zero pages a week puts every approval over and offers no move', () => {
    const it0 = (k: string, auto: boolean, d: ComingUpItem['decision'] = null): ComingUpItem => ({ itemKey: k, keyword: k, source: 'decay', pageType: '', existingPageUrl: '', ladderId: '', rung: 0, why: '', auto, credits: 1, aiTarget: null, decision: d, canSkip: true, canApprove: !auto, recheck: false, held: false });
    const r = planSlots({ items: [], suggestions: [it0('a', false, { decision: 'approve', scope: 'cycle', by: '', at: '2026-11-18T08:00:00.000Z' }), it0('b', false)], room: 0, onTop: new Set() });
    expect(r.suggestions[0].slot).toBe('over');
    expect(r.suggestions[1].approveOver).toBe(true);
  });
  it('an approval older than the plan is shown as carried over, and the e-mail names it and what moved', () => {
    const v = viewOf(body, [skip('crm implementation partner uae', '2026-11-12T08:00:00.000Z')]);
    expect(byKey(v, 'crm implementation partner uae').decision?.carried).toBe(true);
    const m = comingUpMail({ site: { domain: 'techand.ai', timezone: 'Asia/Dubai' } as never, view: v, url: 'https://app.example.com' });
    expect(m.lines.join(' ')).toMatch(/Carried over from your last plan, and written first: "crm implementation partner uae"/);
    expect(m.lines.join(' ')).toMatch(/Moved to next week because your approved pages come first: "crm implementation cost uae"/);
    expect(m.lines.join(' ')).not.toMatch(/[—…“”]/);
    expect(byKey(viewOf(body, [skip('crm implementation partner uae', '2026-11-18T08:00:00.000Z')]), 'crm implementation partner uae').decision?.carried).toBeUndefined();
  });
});

describe('an approval the pages could not fit is carried to the next plan by itself', () => {
  const next = previewOf(bodyOf({ items: [item('crm implementation cost uae', 'ladder', true)], suggestions: [item('crm implementation partner uae', 'decay', false), item(SQ, 'striking', false)] }));
  const prevRow = (k: string, created_at: string, o: Partial<SkipRow> = {}) => skip(k, created_at, { cycle_key: PREV, ...o });
  const carry = (reported: { keyword: string; source: string; reason: string }[], skips: SkipRow[], now = NOW) => carriedApprovals({ siteId: 'site_techand-ai', prevCycleKey: PREV, reported, skips, next, now });
  it('budget and same_page are carried with the FIRST approval time and author, for the same item only', () => {
    const rows = carry([{ keyword: 'crm implementation partner uae', source: 'decay', reason: 'budget' }, { keyword: SQ, source: 'striking', reason: 'same_page' }], [prevRow('crm implementation partner uae', '2026-11-11T10:00:00.000Z'), prevRow(SQ, '2026-11-12T10:00:00.000Z', { source: 'striking', by: 'b@example.com' })]);
    expect(rows.map((r) => [r.item_key, r.cycle_key, r.created_at, r.source, r.by])).toEqual([
      ['crm implementation partner uae', CYCLE, '2026-11-11T10:00:00.000Z', 'decay', 'owner@example.com'],
      [SQ, CYCLE, '2026-11-12T10:00:00.000Z', 'striking', 'b@example.com'],
    ]);
    expect(rows[0].key).toBe(`site_techand-ai:${CYCLE}:crm implementation partner uae`);
  });
  it('not carried: another reason, an item no longer offered or of another source, older than the limit, already decided or skipped for good', () => {
    const r1 = prevRow('crm implementation partner uae', '2026-11-11T10:00:00.000Z');
    expect(carry([{ keyword: 'crm implementation partner uae', source: 'decay', reason: 'covered_by_live_page' }], [r1])).toEqual([]);
    // not in the new plan's visible list: carried by its own item (the run reports it as no longer offered if it is gone, and that is never carried)
    expect(carry([{ keyword: 'gone page', source: 'decay', reason: 'budget' }], [prevRow('gone page', '2026-11-11T10:00:00.000Z')]).map((r) => r.source)).toEqual(['decay']);
    expect(carry([{ keyword: 'crm implementation partner uae', source: 'decay', reason: 'budget' }], [prevRow('crm implementation partner uae', '2026-11-11T10:00:00.000Z', { source: 'striking' })])).toEqual([]);
    expect(carry([{ keyword: 'crm implementation partner uae', source: 'decay', reason: 'budget' }], [r1], Date.parse('2026-11-11T10:00:00.000Z') + (CARRY_APPROVAL_DAYS + 1) * 864e5)).toEqual([]);
    expect(carry([{ keyword: 'crm implementation partner uae', source: 'decay', reason: 'budget' }], [r1, skip('crm implementation partner uae', '2026-11-18T08:00:00.000Z', { decision: 'skip', source: '' })])).toEqual([]);
    expect(carry([{ keyword: 'crm implementation partner uae', source: 'decay', reason: 'budget' }], [r1, skip('crm implementation partner uae', '2026-11-01T08:00:00.000Z', { decision: 'skip', scope: 'always', cycle_key: '', source: '' })])).toEqual([]);
    expect(carry([{ keyword: 'crm implementation cost uae', source: 'ladder', reason: 'budget' }], [prevRow('crm implementation cost uae', '2026-11-11T10:00:00.000Z', { source: 'ladder' })])).toEqual([]);
  });
  it('the reason says it moves on by itself, in plain words', () => {
    for (const reason of ['budget', 'same_page']) {
      const m = notWrittenMessage({ keyword: 'x', reason, detail: 'https://techand.ai/p/' }).message;
      expect(m).toMatch(/next plan by itself/);
      expect(m).toMatch(/as long as it is still a page we would write/);
      expect(m).not.toMatch(/approvals you gave earlier/);
      expect(m).not.toMatch(/Approve it again/);
      expect(m).not.toMatch(/[—…“”]/);
    }
  });
});

describe('review 2026-11-16 (approvals first): what the plan says stays true', () => {
  const body = bodyOf({ items: [item('crm implementation cost uae', 'ladder', true)], suggestions: [item('crm implementation partner uae', 'decay', false), item(SQ, 'striking', false, { not_approvable: true })] });
  it('a suggestion the engine marks not approvable offers no Approve, and an approval of it takes no page', () => {
    const v = viewOf(body, []);
    expect(byKey(v, SQ).canApprove).toBe(false);
    const v2 = viewOf(body, [skip(SQ, '2026-11-18T08:00:00.000Z', { source: 'striking' })]);
    expect(byKey(v2, 'crm implementation cost uae').slot).toBe('this_week');
    expect(byKey(v2, SQ).slot).toBeUndefined();
  });
  it('zero pages a week: no slot is promised, and the reason says to set pages a week (never "next plan")', () => {
    const v = viewOf({ ...bodyOf({ items: [], suggestions: [item('crm implementation partner uae', 'decay', false)], pages: 0, room: 0 }), approved_not_written: [{ keyword: 'crm implementation partner uae', source: 'decay', reason: 'budget' }] }, [skip('crm implementation partner uae', '2026-11-18T08:00:00.000Z')]);
    expect(byKey(v, 'crm implementation partner uae').slot).toBeUndefined();
    expect(v.approvedNotWritten[0].message).toMatch(/no pages a week are set for this website/);
    expect(v.approvedNotWritten[0].message).not.toMatch(/next plan/);
  });
  it('a plan stored before the on_top mark keeps its level-3 AI page out of the week\'s pages', () => {
    const b = { ...bodyOf({ items: [item('crm implementation cost uae', 'ladder', true), item('best crm partner uae', 'ai_answer', true)], suggestions: [item('crm implementation partner uae', 'decay', false)] }), ai_pages: { this_week: true, on_top: true } };
    const v = viewOf(b, []);
    expect(byKey(v, 'best crm partner uae').slot).toBeUndefined();
    expect(byKey(v, 'crm implementation cost uae').slot).toBe('this_week');
  });
  it('the e-mail never says "nothing is planned" when a carried approval takes the week', () => {
    const v = viewOf(body, [skip('crm implementation partner uae', '2026-11-12T08:00:00.000Z')]);
    const m = comingUpMail({ site: { domain: 'techand.ai', timezone: 'Asia/Dubai' } as never, view: v, url: 'https://app.example.com' });
    const t = m.lines.join(' ');
    expect(t).toMatch(/Carried over from your last plan, and written first: "crm implementation partner uae"/);
    expect(t).not.toMatch(/Nothing is planned/);
    expect(m.details.find((d) => d.label === 'Carried over and written first')?.value).toBe('1');
  });
  it('carry-over: an item beyond the five suggestions is carried by its own source; never with zero pages a week, never a not approvable one', () => {
    const next = previewOf(bodyOf({ items: [item('crm implementation cost uae', 'ladder', true)], suggestions: [item(SQ, 'striking', false, { not_approvable: true })] }));
    const r1 = skip('hidden page', '2026-11-11T10:00:00.000Z', { cycle_key: PREV, source: 'trend' });
    const rows = carriedApprovals({ siteId: 'site_techand-ai', prevCycleKey: PREV, reported: [{ keyword: 'hidden page', source: 'trend', reason: 'budget' }], skips: [r1], next, now: NOW });
    expect(rows.map((r) => [r.item_key, r.source, r.created_at])).toEqual([['hidden page', 'trend', '2026-11-11T10:00:00.000Z']]);
    expect(carriedApprovals({ siteId: 'site_techand-ai', prevCycleKey: PREV, reported: [{ keyword: 'hidden page', source: '', reason: 'budget' }], skips: [{ ...r1, source: '' }], next, now: NOW })).toEqual([]);
    expect(carriedApprovals({ siteId: 'site_techand-ai', prevCycleKey: PREV, reported: [{ keyword: SQ, source: 'striking', reason: 'budget' }], skips: [skip(SQ, '2026-11-11T10:00:00.000Z', { cycle_key: PREV, source: 'striking' })], next, now: NOW })).toEqual([]);
    const zero = previewOf(bodyOf({ items: [], suggestions: [item('hidden page', 'trend', false)], pages: 0, room: 0 }));
    expect(carriedApprovals({ siteId: 'site_techand-ai', prevCycleKey: PREV, reported: [{ keyword: 'hidden page', source: 'trend', reason: 'budget' }], skips: [r1], next: zero, now: NOW })).toEqual([]);
  });
  it('the server refuses an approval the engine would not reach, with a plain reason', () => {
    const b = bodyOf({ items: [], suggestions: [item(SQ, 'striking', false, { not_approvable: true })] });
    expect(() => decisionRow({ site: { domain: 'techand.ai' }, preview: previewRow(b), input: { itemKey: SQ, decision: 'approve', scope: 'cycle' }, by: 'a@x', now: NOW })).toThrow(/cannot be approved for this one/);
    expect(decisionRow({ site: { domain: 'techand.ai' }, preview: previewRow(b), input: { itemKey: SQ, decision: 'skip', scope: 'cycle' }, by: 'a@x', now: NOW }).row.decision).toBe('skip');
  });
});
