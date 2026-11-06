import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { airCacheRowsFor, type AirCacheRow } from '../src/services/pipeline';
import { cadenceInputFromTables, planCadence, triggerOf, type CadenceTables } from '../src/services/cadence';

// FX-C RC-10 (review C, 2026-11-06): the Pipeline's cadence mirror reads a website's AI-ranking protect list and the kill switch by key. The old
// read took the first 50 seo_cache rows of kind 'air' across every website; that kind grows by one week row per on website each week, so a
// newly-on website's protect row fell past the first 50 and the Pipeline promised a rewrite of a page the engine protects.

const here = dirname(fileURLToPath(import.meta.url));
const FX = JSON.parse(readFileSync(resolve(here, '../../../n8n/seo-agent/harness/air_cadence_cases.json'), 'utf8')) as { cases: { name: string; now: string; trigger: Record<string, unknown>; tables: CadenceTables }[] };
const protectCase = FX.cases.find((c) => c.name === 'air_on_protect')!;
const protectRow = (protectCase.tables.air_cache ?? [])[0] as AirCacheRow;

/** seo_cache as the n8n Data Table API serves it: 60 older week rows of other websites first, then the protect row (filters + max applied) */
const table: AirCacheRow[] = [
  ...Array.from({ length: 60 }, (_, i) => ({ key: `air:week:site_other-${i % 3}:2026-W${String(10 + i).padStart(2, '0')}`, kind: 'air', site_id: '', value: '{}' })),
  protectRow,
];
const served = (filter: (r: AirCacheRow) => boolean, max: number) => table.filter(filter).slice(0, max);

describe('the Pipeline reads the AI-ranking cache rows by key (FX-C RC-10)', () => {
  it('a website that is not on reads nothing', async () => {
    let reads = 0;
    expect(await airCacheRowsFor('shadow', 'site_techand-ai', async () => (reads++, table))).toEqual([]);
    expect(await airCacheRowsFor('', 'site_techand-ai', async () => (reads++, table))).toEqual([]);
    expect(reads).toBe(0);
  });

  it('with 60 week rows before it, the protect row is still read, and the mirror holds the protected pages', async () => {
    const keys: string[] = [];
    const rows = await airCacheRowsFor('on', 'site_techand-ai', async (key) => (keys.push(key), served((r) => r.key === key, 3)));
    expect(keys.sort()).toEqual(['air:kill', 'air:protect:site_techand-ai']);
    expect(rows.map((r) => r.key)).toEqual(['air:protect:site_techand-ai']);
    const plan = planCadence(cadenceInputFromTables({ ...protectCase.tables, air_cache: rows }, { estPageUsd: 0.84 }), Date.parse(protectCase.now), triggerOf(protectCase.trigger));
    expect(plan.air?.protected.map((x) => x.keyword)).toEqual(['crm implementation partner uae', 'crm consulting dubai']);
    expect(plan.picks.map((x) => x.keyword)).not.toContain('crm consulting dubai');
  });

  it('the old read (the first 50 rows of kind air) missed the protect row: the mirror then promised the protected rewrites', () => {
    const old = served((r) => r.kind === 'air', 50);
    expect(old.some((r) => r.key === 'air:protect:site_techand-ai')).toBe(false);
    const plan = planCadence(cadenceInputFromTables({ ...protectCase.tables, air_cache: old }, { estPageUsd: 0.84 }), Date.parse(protectCase.now), triggerOf(protectCase.trigger));
    expect(plan.picks.map((x) => x.keyword)).toContain('crm consulting dubai');
  });

  it('the kill switch row is read by its key too, and a failed read is no row', async () => {
    const rows = await airCacheRowsFor('on', 'site_x', async (key) => (key === 'air:kill' ? [{ key: 'air:kill', kind: 'air', value: '1' }] : Promise.reject(new Error('down'))));
    expect(rows).toEqual([{ key: 'air:kill', kind: 'air', value: '1' }]);
  });
});
