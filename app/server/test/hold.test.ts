// W0-D (page-quality 2026-10-29, n8n/seo-agent/docs/page-quality-2026-10-29/PLAN.md Fix 4; REVIEW_CODE M1 / M3; owner decisions D1 / D8):
// a page the engine held for the client's OK before writing. Its callback keeps stage `content`, so the run completes; it carries the
// ledger of the check alone, so only the check is charged; Needs you asks the client; the content log's `held` row is skipped by the
// cadence and is never a page to publish.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { estimateRunCost, HOLD_CHECK_USD } from '@seo/shared';
import { runOutcome } from '../src/services/runs';
import { ledgerCost, summarize } from '../src/services/summaries';
import { heldPages } from '../src/services/pipeline';
import { quoteOf } from '../src/services/runCredits';
import { cadenceInputFromTables, planCadence, triggerOf, type CadenceTables } from '../src/services/cadence';

const LIST = { creditValueUsd: 0.05, markup: 3 };
// the callback of a held run (the engine's Build Webhook Response, harness W0D9; anonymised page run 3299): no page, the check's ledger
const HELD = {
  status: 'completed', stage: 'content', request_id: '3298', keyword: 'ms 365 erp', verdict: 'GO_WITH_CHANGES', score: 42, markdown: null, html: null,
  run_ledger: { dataforseo_usd: 0.0161, ai_usd: 0.1284, ai_cost: { usd: 0.1284, estimated: false } },
  hold: { score: 42, threshold: 50, kinds: ['score', 'duplicate'], mode: 'enforce', held: true, reasons: ['Our verdict scored "ms 365 erp" 42 out of 100.'], alternatives: [], duplicates: [{ url: 'https://www.novaand.example/dynamics-365-business-central-uae', title: '' }] },
  hold_shadow: null,
  verdict_acknowledged: false,
};

describe('a held page run (REVIEW_CODE M1)', () => {
  it('completes on stage content: the run does not stay open until the failure watcher', () => {
    const o = runOutcome('running', ['content'], 'content', HELD);
    expect(o.status).toBe('completed');
    expect(o.error).toBeNull();
  });
  it('is charged only what the check used (D8): about 9 credits, never the page quote', () => {
    const c = ledgerCost(HELD)!;
    expect(c.usd).toBeCloseTo(0.1445, 4);
    expect(c.partial).toBe(false);
    const charged = quoteOf(c.usd, LIST);
    expect(charged).toBeLessThanOrEqual(quoteOf(HOLD_CHECK_USD, LIST));
    expect(quoteOf(HOLD_CHECK_USD, LIST)).toBe(9);
    expect(quoteOf(estimateRunCost('keyword', {}), LIST)).toBe(114);   // the page it did not write
  });
  it('its summary says it waits for the client, with the score', () => {
    const s = summarize('content', HELD);
    expect(s.held).toBe(true);
    expect(s.holdScore).toBe(42);
    expect(s.holdDuplicate).toBe(true);
    expect(s.hasPage).toBe(false);
    expect(summarize('content', { ...HELD, hold: null, hold_shadow: { ...HELD.hold, mode: 'shadow', held: false }, html: '<h1>' + 'x'.repeat(80) + '</h1>' }).held).toBeUndefined();
  });
});

describe('Needs you: "Needs your OK"', () => {
  const now = Date.parse('2026-10-29T12:00:00.000Z');
  const rep = (id: string, keyword: string, at: string, over: Record<string, unknown> = {}) => ({ id, runId: 'run_' + id, stage: 'content', receivedAt: at, summary: { keyword, held: true, holdScore: 42, holdDuplicate: true, ...over } });
  it('one item per held keyword, newest first, to the report with the three choices', () => {
    const items = heldPages([rep('r1', 'ms 365 erp', '2026-10-28T10:00:00.000Z'), rep('r0', 'MS 365 ERP', '2026-10-27T10:00:00.000Z')], [], now);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: 'hold:r1', kind: 'hold', severity: 'warning', title: 'Needs your OK: "ms 365 erp" scored 42', action: { label: 'Choose what to do', reportId: 'r1' } });
    expect(JSON.stringify(items)).not.toMatch(/[–—‘’“”…]/);
  });
  it('gone once the client started a page run for the keyword (Write it anyway, or an improvement), or after 30 days', () => {
    const r = [rep('r1', 'ms 365 erp', '2026-10-28T10:00:00.000Z')];
    expect(heldPages(r, [{ mode: 'keyword', keyword: 'ms 365 erp', status: 'running', createdAt: '2026-10-28T11:00:00.000Z' }], now)).toEqual([]);
    expect(heldPages(r, [{ mode: 'keyword', keyword: 'ms 365 erp', status: 'failed', createdAt: '2026-10-28T11:00:00.000Z' }], now)).toHaveLength(1);
    expect(heldPages(r, [], Date.parse('2026-12-01T00:00:00.000Z'))).toEqual([]);
  });
  it('a page that was written (no hold) or a trial hold is not asked about', () => {
    expect(heldPages([rep('r2', 'crm', '2026-10-28T10:00:00.000Z', { held: undefined })], [], now)).toEqual([]);
  });
});

describe('the cadence mirror skips a held keyword and takes the next candidate (D1, REVIEW_CODE M3)', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const FX = JSON.parse(readFileSync(resolve(here, '../../../n8n/seo-agent/harness/fixtures/cadence_levels.json'), 'utf8')) as { cases: { now: string; trigger: Record<string, unknown>; tables: CadenceTables & Record<string, unknown> }[] };
  const planOf = (c: (typeof FX.cases)[number]) => planCadence(cadenceInputFromTables(c.tables, { estPageUsd: 1.9 }), Date.parse(c.now), triggerOf(c.trigger));
  const found = FX.cases.map((c) => ({ c, p: planOf(c) })).find((x) => x.p.picks.length > 0 && x.p.candidates.length > x.p.picks.length && !x.p.picks[0].aiTarget);
  it('a fixture case picks a page with another candidate on hand', () => expect(found).toBeDefined());
  const heldRow = (daysAgo: number) => {
    const c = JSON.parse(JSON.stringify(found!.c)) as (typeof FX.cases)[number];
    const site = (c.tables.sites as { site_id: string; domain: string }[])[0];
    c.tables.content_log = [...((c.tables.content_log as unknown[]) ?? []), { site_id: site.site_id, domain: site.domain, keyword: found!.p.picks[0].keyword, source: 'cadence', status: 'held', request_id: 'cad_old_1',
      started_at: new Date(Date.parse(c.now) - daysAgo * 864e5).toISOString(), published_url: '', published_at: '', qa_reasons: 'held for your OK: verdict score 31 (under 50)' }] as NonNullable<CadenceTables['content_log']>;
    return c;
  };
  it('held 30 days ago: not picked; the next candidate takes its place', () => {
    const before = found!.p.picks.map((x) => x.keyword);
    const after = planOf(heldRow(30)).picks.map((x) => x.keyword);
    expect(after).not.toContain(before[0]);
    expect(after.length).toBe(before.length);
  });
  it('held 100 days ago: checked again', () => {
    expect(planOf(heldRow(100)).picks.map((x) => x.keyword)).toContain(found!.p.picks[0].keyword);
  });
});
