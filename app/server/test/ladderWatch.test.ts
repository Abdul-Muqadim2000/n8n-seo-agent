import { describe, expect, it, vi } from 'vitest';
import type { ContentLogRow, LadderRow } from '@seo/shared';

import { checkStuckRungs, stuckRungsOf } from '../src/services/ladderWatch';
import { ladderMarketInfo } from '../src/services/ladders';
import { ladderMovesOf } from '../src/services/siteTasks';
import { unfinishedVia, type ExecutionSummary } from '../src/n8n/client';

// LADDER PACKAGE (2026-11-09, rule 5): techand.ai's rung "what is a crm company" sat at `writing` from 2026-11-05 01:33 with its page run gone
const row = (o: Partial<LadderRow>): LadderRow => ({ id: 47, createdAt: '', updatedAt: '2026-11-05T01:33:12.154Z', ladder_id: 'lad_mw0goinsniv1', domain: 'techand.ai', head_keyword: 'crm service provider', rung: 2,
  page_no: 2, keyword: 'what is a crm company', supporting: '', page_type: 'Guide', target_url: 'https://www.techand.ai/what-is-a-crm-company', page_exists: false, status: 'writing', months: '', start_date: '',
  country: 'United Arab Emirates', location_code: 2784, language_code: 'en', email: '', callback_url: '', request_id: '7338', ...o });
const log = (o: Partial<ContentLogRow>): ContentLogRow => ({ id: 26, createdAt: '', updatedAt: '', site_id: 'site_techand-ai', domain: 'techand.ai', keyword: 'what is a crm company', source: 'ladder', page_type: 'Guide',
  existing_page_url: '', rung: 2, ladder_id: 'lad_mw0goinsniv1', request_id: 'cad_20261105_techand-ai_2', started_at: '2026-11-05T01:33:11.576Z', status: 'started', published_url: '', published_at: '', week: '', ...o });
const NOW = Date.parse('2026-11-08T12:00:00Z');

describe('stuck ladder rungs (rule 5)', () => {
  it('the production case: writing for days, nothing running -> closed with the reason', () => {
    const out = stuckRungsOf({ domain: 'techand.ai', ladders: [row({})], logs: [log({})], running: [], openKeywords: new Set(), now: NOW });
    expect(out).toHaveLength(1);
    expect(out[0].keyword).toBe('what is a crm company');
    expect(out[0].reason).toMatch(/stopped without a result/);
  });
  it('a running execution started after the rung, an open app run, or an engine that cannot be asked: left alone', () => {
    expect(stuckRungsOf({ domain: 'techand.ai', ladders: [row({})], logs: [log({})], running: [{ status: 'running', startedAt: '2026-11-05T01:33:40Z' }], openKeywords: new Set(), now: NOW })).toHaveLength(0);
    expect(stuckRungsOf({ domain: 'techand.ai', ladders: [row({})], logs: [log({})], running: [], openKeywords: new Set(['what is a crm company']), now: NOW })).toHaveLength(0);
    expect(stuckRungsOf({ domain: 'techand.ai', ladders: [row({})], logs: [log({})], running: null, openKeywords: new Set(), now: NOW })).toHaveLength(0);
  });
  it('review H1: a page run queued in n8n (status new / waiting) for 65 minutes is alive, so the rung is not closed; finished executions are not', () => {
    const t65 = Date.parse('2026-11-05T02:38:00Z');
    const queued = [{ status: 'new', startedAt: null }];
    expect(stuckRungsOf({ domain: 'techand.ai', ladders: [row({})], logs: [log({})], running: queued, openKeywords: new Set(), now: t65 })).toHaveLength(0);
    expect(stuckRungsOf({ domain: 'techand.ai', ladders: [row({})], logs: [log({})], running: [{ status: 'waiting', startedAt: '2026-11-05T01:00:00Z' }], openKeywords: new Set(), now: t65 })).toHaveLength(0);
    // a long run that started a few minutes BEFORE the content-log row was written is still its run
    expect(stuckRungsOf({ domain: 'techand.ai', ladders: [row({})], logs: [log({})], running: [{ status: 'running', startedAt: '2026-11-05T01:27:00Z' }], openKeywords: new Set(), now: t65 })).toHaveLength(0);
    const done = [{ status: 'success', startedAt: '2026-11-05T01:33:20Z' }, { status: 'error', startedAt: '2026-11-05T01:40:00Z' }, { status: 'crashed', startedAt: '2026-11-05T01:41:00Z' }];
    expect(stuckRungsOf({ domain: 'techand.ai', ladders: [row({})], logs: [log({})], running: done, openKeywords: new Set(), now: t65 })).toHaveLength(1);
  });
  it('re-review H1: n8n 2.41.4 leaves RUNNING executions out of a list with no status; the watcher asks running / new / waiting one by one and keeps a 189-minute run alive', async () => {
    const all: ExecutionSummary[] = [
      { id: '1', workflowId: 'SEOagentV4Full01', status: 'running', startedAt: '2026-11-05T01:33:05Z' },
      { id: '2', workflowId: 'SEOagentV4Full01', status: 'success', startedAt: '2026-11-05T01:00:00Z' },
    ];
    // the API's own behaviour: no status -> running ones excluded (executions.public.controller.js excludeRunning); a status -> only that status
    const fakeApi = async (status?: string) => all.filter((e) => (status ? e.status === status : e.status !== 'running'));
    expect((await fakeApi()).some((e) => e.status === 'running')).toBe(false);   // what the f7399da4 watcher saw
    const seen = await unfinishedVia((st) => fakeApi(st));
    expect(seen.map((e) => e.id)).toEqual(['1']);
    const t189 = Date.parse('2026-11-05T04:42:00Z');   // 189 minutes after the rung started
    expect(stuckRungsOf({ domain: 'techand.ai', ladders: [row({})], logs: [log({})], running: seen, openKeywords: new Set(), now: t189 })).toHaveLength(0);
    expect(stuckRungsOf({ domain: 'techand.ai', ladders: [row({})], logs: [log({})], running: await fakeApi(), openKeywords: new Set(), now: t189 })).toHaveLength(1);   // the defect, for the record
  });
  it('a rung writing for 40 minutes is not stuck; a planned or published row never is', () => {
    const recent = Date.parse('2026-11-05T02:13:00Z');
    expect(stuckRungsOf({ domain: 'techand.ai', ladders: [row({})], logs: [log({})], running: [], openKeywords: new Set(), now: recent })).toHaveLength(0);
    expect(stuckRungsOf({ domain: 'techand.ai', ladders: [row({ status: 'planned' }), row({ status: 'published' })], logs: [], running: [], openKeywords: new Set(), now: NOW })).toHaveLength(0);
  });
  it('the sweep writes the ladder row failed (only from writing) and the content-log row failed, and skips a site with nothing writing', async () => {
    const update = vi.fn().mockResolvedValue(true);
    const closed = await checkStuckRungs({
      sites: async () => [{ id: 's1', orgId: 'o1', domain: 'techand.ai' }, { id: 's2', orgId: 'o1', domain: 'devaicon.com' }],
      ladders: async (d) => (d === 'techand.ai' ? [row({})] : [row({ status: 'planned', domain: 'devaicon.com' })]),
      logs: async () => [log({})],
      running: async () => [],
      openRuns: async () => [],
      update,
    }, NOW);
    expect(closed.map((c) => c.keyword)).toEqual(['what is a crm company']);
    expect(update).toHaveBeenCalledTimes(2);
    const [t1, f1, d1] = update.mock.calls[0];
    expect(t1).toBe('ladders');
    expect(f1).toContainEqual({ columnName: 'status', condition: 'eq', value: 'writing' });
    expect(d1.status).toBe('failed');
    expect(String(d1.status_note)).toMatch(/^failed: .*the next page of the ladder goes on\. If the run finishes after all, the page shows here as written/);
    expect(String(d1.status_note)).not.toMatch(/nothing is charged/);
    expect(update.mock.calls[1][0]).toBe('contentLog');
    expect(update.mock.calls[1][2].status).toBe('failed');
  });
});

describe('the ladder market line (rule 3)', () => {
  it('devaicon.com\'s ladder measured in Pakistan says so', () => {
    const m = ladderMarketInfo('Pakistan', 'United Arab Emirates', 'ai automation services pakistan');
    expect(m?.country).toBe('Pakistan');
    expect(m?.note).toMatch(/names pakistan, which is not your website's market \(United Arab Emirates\)/);
  });
  it('a ladder in the website\'s market: no note', () => {
    expect(ladderMarketInfo('United Arab Emirates', 'United Arab Emirates', 'dynamics 365 erp system')?.note).toBe('');
  });
});

describe('the redirect step for a main page that moved (review H5)', () => {
  it('a published main page whose row says "moved from <old>" asks for the redirect from the old address; anything else asks nothing', () => {
    const moved = ladderMovesOf([
      { status: 'published', target_why: 'moved from https://www.techand.ai/dynamics-365-crm-uae-2: /dynamics-365-crm-uae-2 is a copy of /dynamics-365-crm-uae', target_url: 'https://www.techand.ai/dynamics-365-crm-uae', updatedAt: '2026-11-12T10:00:00Z' },
      { status: 'planned', target_why: 'moved from https://www.techand.ai/x: ...', target_url: 'https://www.techand.ai/y', updatedAt: '' },
      { status: 'published', target_why: 'a page you do not have yet, at /z', target_url: 'https://www.techand.ai/z', updatedAt: '' },
    ]);
    expect(moved).toEqual([{ url: 'https://www.techand.ai/dynamics-365-crm-uae-2', to: 'https://www.techand.ai/dynamics-365-crm-uae', at: '2026-11-12T10:00:00Z' }]);
    // re-review N1: never a redirect from an address another ladder page holds
    const held = ladderMovesOf([
      { keyword: 'dynamics 365 erp system', status: 'published', target_why: 'moved from https://www.techand.ai/insights/guide: ...', target_url: 'https://www.techand.ai/dynamics-365-erp-system', updatedAt: '2026-11-12T10:00:00Z' },
      { keyword: 'is microsoft dynamics 365 an erp system', status: 'published', target_why: '', target_url: 'https://techand.ai/insights/guide/', updatedAt: '' },
    ]);
    expect(held).toEqual([]);
  });

  it('prod 2026-11-10 (devaicon.com): never a redirect from the home page, the step could never be done', () => {
    expect(ladderMovesOf([
      { status: 'published', target_why: 'moved from https://novaand-demo.com/: the home page answers another search', target_url: 'https://novaand-demo.com/ai-automation-services-pakistan', updatedAt: '2026-10-30T07:52:35Z' },
      { status: 'published', target_why: 'moved from https://www.novaand-demo.com: the home page', target_url: 'https://novaand-demo.com/ai-automation', updatedAt: '' },
    ])).toEqual([]);
  });
});
