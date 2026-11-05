import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  AI_RANK_GUIDE_OF_LEVER,
  AI_RANK_LEVER_LABELS,
  AI_RANK_MODE_TEXT,
  aiRankBody,
  aiRankPaidChange,
  aiRankPlanOf,
  aiRankReportOf,
  aiRankSettingsOf,
  aiRankShadowOf,
  type AiRankActionRow,
  type AiRankRunRow,
} from './ai-rank';
import { adminActionSchema, aiRankSettingsSchema } from './schemas';
import { siteAdminMonitorsBody } from './payload';
import { AI_RANK_STEPS_NEW_PER_WEEK, AI_RANK_STEPS_OPEN_MAX, deriveSiteTasks, SITE_TASK_KINDS, siteTaskKindOfKey, siteTaskPayload, type SiteTaskInputs, type StoredSiteTask } from './site-tasks';
import { guideById } from './guides';

// AIR (2026-11-06, n8n/seo-agent/docs/ai-ranking-2026-11-05/DESIGN.md §4.1, §6.7): the app's half of AI ranking. The settings read as the
// engine reads them, the body Site Admin receives, the readers of the engine's rows and of the ai_growth callback's additive `ai_rank` key
// (never throwing on an older or missing shape), and the two new site task kinds (backward compatible). Synthetic data only.

const here = dirname(fileURLToPath(import.meta.url));
const KIT = resolve(here, '../../../n8n/seo-agent/v5/code/_ai_rank_flags.js');

describe('the settings, read as the engine reads them (AIRF.settingsOf)', () => {
  const cases: Record<string, unknown>[] = [
    {},
    { ai_rank_mode: '' },
    { ai_rank_mode: 'ON', ai_rank_reserve: 'true', ai_rank_fanout_n: '12', ai_rank_mentions: 1, ai_rank_brave: 'yes' },
    { ai_rank_mode: 'shadow', ai_rank_reserve: false, ai_rank_fanout_n: 80, ai_rank_mentions: 'no', ai_rank_brave: null },
    { ai_rank_mode: 'later', ai_rank_reserve: 'maybe', ai_rank_fanout_n: 'x', ai_rank_mentions: 'off' },
    { ai_rank_mode: ' on ', ai_rank_fanout_n: -3, ai_rank_reserve: true },
    { ai_rank_mode: 'off', ai_rank_fanout_n: 7.6 },
  ];
  it('is off, false, 0, false, false when empty or junk', () => {
    expect(aiRankSettingsOf(null)).toEqual({ mode: 'off', reserve: false, fanoutN: 0, mentions: false, brave: false });
    expect(aiRankSettingsOf({ ai_rank_mode: 'later', ai_rank_reserve: 'maybe', ai_rank_fanout_n: 'x' })).toEqual({ mode: 'off', reserve: false, fanoutN: 0, mentions: false, brave: false });
    expect(aiRankSettingsOf({ ai_rank_mode: 'ON', ai_rank_reserve: 'true', ai_rank_fanout_n: '12', ai_rank_mentions: 1, ai_rank_brave: 'yes' })).toEqual({ mode: 'on', reserve: true, fanoutN: 12, mentions: true, brave: true });
  });
  it.runIf(existsSync(KIT))('agrees with the engine kit field for field (read from the repository when it is beside the app)', () => {
    const AIRF = new Function(readFileSync(KIT, 'utf8') + '\nreturn AIRF;')() as { settingsOf: (r: unknown) => Record<string, unknown> };
    for (const c of cases) {
      const e = AIRF.settingsOf(c);
      const a = aiRankSettingsOf(c);
      expect({ mode: a.mode, reserve: a.reserve, fanout_n: a.fanoutN, mentions: a.mentions, brave: a.brave }, JSON.stringify(c)).toEqual(e);
    }
  });
  it('says what each mode does in plain words (Trial for the engine\'s shadow, no internal names)', () => {
    expect(AI_RANK_MODE_TEXT.shadow.label).toBe('Trial');
    for (const m of Object.values(AI_RANK_MODE_TEXT)) {
      expect(m.text).not.toMatch(/[–—‘’“”…]|shadow|seo_|n8n|AIR\b/);
    }
  });
});

describe('the Site Admin body', () => {
  it('sends only the fields given, in the engine\'s names', () => {
    expect(aiRankBody({ mode: 'shadow' })).toEqual({ ai_rank_mode: 'shadow' });
    expect(aiRankBody({ reserve: true, fanoutN: 10, mentions: false, brave: true })).toEqual({ ai_rank_reserve: true, ai_rank_fanout_n: 10, ai_rank_mentions: false, ai_rank_brave: true });
    expect(aiRankBody(undefined)).toEqual({});
  });
  it('an ordinary monitors save never carries an AI ranking field', () => {
    const b = siteAdminMonitorsBody({ aiVisibility: true, aiPagesPerMonth: 2, brandNames: [] }, []);
    expect(Object.keys(b).some((k) => k.startsWith('ai_rank'))).toBe(false);
    const a = adminActionSchema.parse({ action: 'monitors', monitors: { aiVisibility: true } });
    expect(a.action === 'monitors' && a.aiRank).toBeUndefined();
  });
  it('the admin action takes the settings, refuses an unknown field or a bad value', () => {
    const a = adminActionSchema.parse({ action: 'monitors', monitors: {}, aiRank: { mode: 'on', reserve: true } });
    expect(a.action === 'monitors' && a.aiRank).toEqual({ mode: 'on', reserve: true });
    expect(aiRankSettingsSchema.safeParse({ mode: 'live' }).success).toBe(false);
    expect(aiRankSettingsSchema.safeParse({ fanoutN: 51 }).success).toBe(false);
    expect(aiRankSettingsSchema.safeParse({ copilot: true }).success).toBe(false);
  });
  it('knows which changes are paid readings (platform admins only)', () => {
    expect(aiRankPaidChange({ mode: 'on', reserve: true })).toBe(false);
    expect(aiRankPaidChange({ fanoutN: 0 })).toBe(true);
    expect(aiRankPaidChange({ brave: false })).toBe(true);
    expect(aiRankPaidChange(undefined)).toBe(false);
  });
});

const memo = {
  v: 1,
  rule_version: 'air-1',
  site_id: 'site_nova-demo-example',
  mode: 'on',
  parts: [
    { key: 'what_changed', title: 'What changed', lines: [{ text: 'Two questions moved up a stage on Perplexity.', figures: [{ name: 'moved', value: '2', basis: 'measured' }] }] },
    { key: 'why', title: 'Why', lines: [] },
    { key: 'shadow_vs_old', title: 'Shadow vs old', lines: [{ text: 'Overlap 20%.', figures: [] }] },
  ],
  blockers: [{ what: 'Connect a mailbox', owner: 'client', since: '2026-11-01T00:00:00Z', blocks: '0 pitches can be sent' }],
};

describe('the ai_growth callback key (additive, on sites only)', () => {
  it('is null when absent: an off or trial website, or an engine from before AI ranking', () => {
    expect(aiRankReportOf({ stage: 'ai_growth', pages: [] })).toBeNull();
    expect(aiRankReportOf(null)).toBeNull();
    expect(aiRankReportOf({ ai_rank: 'x' })).toBeNull();
  });
  it('reads every field and tolerates missing ones', () => {
    const r = aiRankReportOf({ ai_rank: { v: 1, mode: 'on', run_id: 'air_20261109_site_x', checked_at: '2026-11-09T09:30:00Z', memo, actions: [{ action_id: 'a1', lever: 'L09', executor: 'human', status: 'queued', ref: { url: 'https://dir.example/x' } }], steps: [{ key: 'ai_rank:L09:u:dir.example/x', lever: 'L09', what: 'A profile on dir.example', action_id: 'a1' }, { key: 'bad', lever: 'L01' }], counts: { chosen: 3 }, reserve: true } })!;
    expect(r.mode).toBe('on');
    expect(r.memo?.parts.map((p) => p.key)).toEqual(['what_changed', 'why', 'shadow_vs_old']);
    expect(r.memo?.blockers[0]).toMatchObject({ what: 'Connect a mailbox', since: '2026-11-01' });
    expect(r.actions[0]).toMatchObject({ actionId: 'a1', executor: 'human', url: 'https://dir.example/x', label: AI_RANK_LEVER_LABELS.L09 });
    expect(r.steps.map((s) => s.key)).toEqual(['ai_rank:L09:u:dir.example/x']);
    expect(r.counts).toEqual({ core: 0, chosen: 3, deferred: 0, refused: 0, open: 0 });
    expect(r.cost).toBeNull();
    expect(r.compare).toBeNull();
    const empty = aiRankReportOf({ ai_rank: { memo: null, actions: null } })!;
    expect(empty.memo).toBeNull();
    expect(empty.actions).toEqual([]);
  });
});

describe('the plan and the trial view from the engine rows', () => {
  const runs: AiRankRunRow[] = [
    { run_id: 'r_shadow', mode: 'shadow', checked_at: '2026-11-16T09:30:00Z', chosen_json: '[{"action_id":"s1","lever":"L08","executor":"approve"}]', memo_json: JSON.stringify(memo) },
    { run_id: 'r_on', mode: 'on', checked_at: '2026-11-09T09:30:00Z', chosen_json: JSON.stringify([{ action_id: 'a1', lever: 'L01', executor: 'human', status: 'queued' }]), memo_json: JSON.stringify(memo), cost_json: '{"usd":0.04,"basis":"measured"}', old_json: '{"targets":[{"question":"Which ERP partner?","kind":"answer"}]}', compare_json: '{"overlap":0.2,"gain_air":0.12,"gain_old":0.03,"note":"model"}' },
    { run_id: 'r_bad', mode: 'on', checked_at: '2026-11-02T09:30:00Z', chosen_json: 'not json', memo_json: '{' },
  ];
  const actions: AiRankActionRow[] = [
    { action_id: 'a1', status: 'verified', mode: 'on' },
    { action_id: 'a2', lever: 'L09', executor: 'human', status: 'queued', mode: 'on', ref: '{"url":"https://dir.example/p"}' },
    { action_id: 'a3', lever: 'L09', status: 'expired', mode: 'on' },
  ];
  it('takes the newest on-mode run, the engine status of each action, and the open actions beside it', () => {
    const p = aiRankPlanOf(runs, actions, aiRankSettingsOf({ ai_rank_mode: 'on' }))!;
    expect(p.runId).toBe('r_on');
    expect(p.actions.map((a) => [a.actionId, a.status])).toEqual([
      ['a1', 'verified'],
      ['a2', 'queued'],
    ]);
    expect(p.actions[1].url).toBe('https://dir.example/p');
    expect(p.cost).toEqual({ usd: 0.04, basis: 'measured' });
    expect(p.memo?.parts.length).toBe(3);
  });
  it('is null with no on-mode run, and an unreadable row never throws', () => {
    expect(aiRankPlanOf([runs[0]], [], aiRankSettingsOf({}))).toBeNull();
    expect(aiRankPlanOf([], [], aiRankSettingsOf({}))).toBeNull();
    expect(aiRankShadowOf([runs[2]])[0]).toMatchObject({ runId: 'r_bad', air: [], memo: null });
  });
  it('the trial view: newest first, both plans and the comparison', () => {
    const w = aiRankShadowOf(runs);
    expect(w.map((x) => x.runId)).toEqual(['r_shadow', 'r_on', 'r_bad']);
    expect(w[1].old.targets[0]).toEqual({ question: 'Which ERP partner?', kind: 'answer', pageUrl: '' });
    expect(w[1].compare).toEqual({ overlap: 0.2, gainAir: 0.12, gainOld: 0.03, note: 'model' });
    expect(w[0].air[0]).toMatchObject({ actionId: 's1', executor: 'approve' });
  });
});

const DOMAIN = 'nova-demo.example';
const base: SiteTaskInputs = { domain: DOMAIN, indexnow: null, access: null, reclaim: null };
const step = (i: number, extra: Record<string, unknown> = {}) => ({ key: `ai_rank:L1${i % 5}:p:q${i}`, lever: `L1${i % 5}`, label: '', what: `Step ${i}`, why: 'Answers cite pages that name others', check: 'we open the page and look for your name', url: '', actionId: `a${i}`, status: 'queued', ...extra });
const storedOf = (key: string, kind: StoredSiteTask['kind'], createdAt: string, payload: Record<string, unknown> = {}): StoredSiteTask => ({ key, kind, payload, lastCheck: null, doneAt: null, skippedAt: null, skippedBy: null, createdAt });

describe('the two new site task kinds (backward compatible)', () => {
  it('are appended, never renamed, and their keys name them', () => {
    expect(SITE_TASK_KINDS.slice(0, 6)).toEqual(['indexnow', 'ai_crawlers', 'redirect', 'indexing', 'index_links', 'index_merge']);
    expect(SITE_TASK_KINDS.slice(6)).toEqual(['ai_rank', 'ai_export']);
    expect(siteTaskKindOfKey('ai_rank:L09:u:dir.example/x')).toBe('ai_rank');
    expect(siteTaskKindOfKey('ai_export:2026-11')).toBe('ai_export');
    expect(siteTaskKindOfKey('ai_export:november')).toBeNull();
  });
  it('an app build that does not know a kind ignores a stored row of it (an older app reading a newer row)', () => {
    const future = storedOf('ai_future:x', 'ai_rank' as never, '2026-11-01T00:00:00Z');
    const unknownKind = { ...future, kind: 'ai_future' as never };
    const tasks = deriveSiteTasks(base, [unknownKind]);
    expect(tasks).toEqual([]);
    expect(siteTaskPayload(base, [unknownKind], 'ai_future:x')).toBeNull();
  });
  it('nothing is shown for a website that is off or in its trial (no reading), even with rows stored', () => {
    const s = [storedOf('ai_rank:L13:p:q3', 'ai_rank', '2026-11-01T00:00:00Z', { lever: 'L13', actionId: 'a3' }), storedOf('ai_export:2026-11', 'ai_export', '2026-11-01T00:00:00Z', { month: '2026-11' })];
    expect(deriveSiteTasks({ ...base, aiRank: null, aiExport: null }, s)).toEqual([]);
  });
  it(`lists at most ${AI_RANK_STEPS_NEW_PER_WEEK} new steps a week, ${AI_RANK_STEPS_OPEN_MAX} open, each with its guide`, () => {
    const at = '2026-11-09T09:30:00Z';
    const t = deriveSiteTasks({ ...base, aiRank: { checkedAt: at, steps: Array.from({ length: 6 }, (_, i) => step(i)), statusOf: {} } }, []);
    expect(t.map((x) => x.key)).toEqual(['ai_rank:L10:p:q0', 'ai_rank:L11:p:q1', 'ai_rank:L12:p:q2']);
    expect(t.every((x) => x.kind === 'ai_rank' && x.state === 'todo' && guideById(x.guide))).toBe(true);
    expect(t[0].detail).toMatch(/How we check it: we open the page/);
    // three stored this week already: no new one; five stored long ago and still open: the cap of open steps holds
    const recent = [0, 1, 2].map((i) => storedOf(step(i).key, 'ai_rank', '2026-11-08T00:00:00Z', { actionId: `a${i}`, lever: step(i).lever }));
    expect(deriveSiteTasks({ ...base, aiRank: { checkedAt: at, steps: Array.from({ length: 6 }, (_, i) => step(i)), statusOf: {} } }, recent).length).toBe(3);
    const old = Array.from({ length: 8 }, (_, i) => storedOf(`ai_rank:L09:p:old${i}`, 'ai_rank', '2026-09-01T00:00:00Z', { actionId: `o${i}`, lever: 'L09' }));
    const statusOf = Object.fromEntries(old.map((o, i) => [`o${i}`, 'queued']));
    expect(deriveSiteTasks({ ...base, aiRank: { checkedAt: at, steps: [step(0)], statusOf } }, old).filter((x) => x.state === 'todo').length).toBe(8);
  });
  it('is done when the engine confirmed the action; an expired one leaves the list', () => {
    const at = '2026-11-16T09:30:00Z';
    const s = [storedOf('ai_rank:L09:u:dir.example/x', 'ai_rank', '2026-11-02T00:00:00Z', { actionId: 'd1', lever: 'L09' }), storedOf('ai_rank:L13:p:q', 'ai_rank', '2026-11-02T00:00:00Z', { actionId: 'e1', lever: 'L13' })];
    const t = deriveSiteTasks({ ...base, aiRank: { checkedAt: at, steps: [], statusOf: { d1: 'verified', e1: 'expired' } } }, s);
    expect(t.map((x) => [x.key, x.state])).toEqual([['ai_rank:L09:u:dir.example/x', 'done']]);
    expect(t[0].detail).toMatch(/weekly AI ranking check found it/);
    expect(t[0].lastCheck?.by).toBe('weekly');
  });
  it('the monthly ask is done once both of this month\'s uploads arrived', () => {
    const todo = deriveSiteTasks({ ...base, aiExport: { month: '2026-11', bing: true, gsc: false, checkedAt: '2026-11-10T00:00:00Z' } }, []);
    expect(todo).toHaveLength(1);
    expect(todo[0]).toMatchObject({ key: 'ai_export:2026-11', kind: 'ai_export', state: 'todo', guide: 'ai-report-import' });
    expect(todo[0].lastCheck?.message).toMatch(/Search Console upload is not here yet/);
    const done = deriveSiteTasks({ ...base, aiExport: { month: '2026-11', bing: true, gsc: true, checkedAt: '2026-11-10T00:00:00Z' } }, []);
    expect(done[0].state).toBe('done');
  });
});

describe('every guide a new ask opens exists', () => {
  it('each lever step and the monthly ask', () => {
    for (const id of [...Object.values(AI_RANK_GUIDE_OF_LEVER), 'ai-ranking', 'ai-report-import']) expect(guideById(id), id).toBeTruthy();
  });
});
