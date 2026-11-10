import { describe, expect, it, vi } from 'vitest';
import type { ContentLogRow, LadderRow } from '@seo/shared';

import { checkStuckRungs, stuckRungsOf } from '../src/services/ladderWatch';
import { ladderMarketInfo } from '../src/services/ladders';

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
    expect(stuckRungsOf({ domain: 'techand.ai', ladders: [row({})], logs: [log({})], running: [{ startedAt: '2026-11-05T01:33:40Z' }], openKeywords: new Set(), now: NOW })).toHaveLength(0);
    expect(stuckRungsOf({ domain: 'techand.ai', ladders: [row({})], logs: [log({})], running: [], openKeywords: new Set(['what is a crm company']), now: NOW })).toHaveLength(0);
    expect(stuckRungsOf({ domain: 'techand.ai', ladders: [row({})], logs: [log({})], running: null, openKeywords: new Set(), now: NOW })).toHaveLength(0);
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
    expect(String(d1.status_note)).toMatch(/^failed: .* nothing is charged for it; the next page of the ladder goes on/);
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
