// KI W0 (2026-11-08, docs/keyword-intel-2026-11-08/CONTRACTS.md §6-§7): the app's words and thresholds equal the engine's, through the one
// fixture both sides read (n8n/seo-agent/harness/fixtures/ki_parity.json), the cost rows equal the engine kit's, the table columns equal
// ladder_common.py's. The repo root must be mounted (these read ../n8n); without it they are skipped.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COST_TABLE } from './cost';
import { KI_RULE_VERSION, KI_STAGE_WEIGHT, KI_VERDICT_IDS, KI_VERDICT_THRESHOLDS, KI_VERDICTS, kiVerdict, type KiVerdict } from './ki';

const ENGINE = join(__dirname, '../../../n8n/seo-agent');
const FIXTURE = join(ENGINE, 'harness/fixtures/ki_parity.json');
const KIT = join(ENGINE, 'v5/code/_cost_cal.js');
const LC = join(ENGINE, 'ladder_common.py');

describe.skipIf(!existsSync(FIXTURE))('KI parity fixture', () => {
  const P = JSON.parse(readFileSync(FIXTURE, 'utf8')) as {
    rule_version: string; verdicts: Record<KiVerdict, string>; thresholds: { go: number; months: number }; stage_weights: Record<string, number>;
    cases: { name: string; row: { gate: string; win: number | null }; verdict: KiVerdict }[];
  };
  it('the rule version, the verdict words, the thresholds and the stage weights are the app\'s', () => {
    expect(P.rule_version).toBe(KI_RULE_VERSION);
    expect(P.verdicts).toEqual(KI_VERDICTS);
    expect(Object.keys(P.verdicts)).toEqual([...KI_VERDICT_IDS]);
    expect(P.thresholds).toEqual({ ...KI_VERDICT_THRESHOLDS });
    expect(P.stage_weights).toEqual(KI_STAGE_WEIGHT);
  });
  it('every boundary case gets the fixture\'s verdict', () => {
    for (const c of P.cases) expect([c.name, kiVerdict(c.row)]).toEqual([c.name, c.verdict]);
  });
});

describe.skipIf(!existsSync(KIT))('KI cost rows mirror the engine (_cost_cal.js EST / DFS_EST)', () => {
  const src = readFileSync(KIT, 'utf8');
  const num = (block: string, key: string) => {
    const b = src.match(new RegExp('const ' + block + ' = \\{([\\s\\S]*?)\\n  \\};'));
    const m = b?.[1].match(new RegExp('\\n\\s*' + key + ': ([0-9.]+),'));
    return m ? Number(m[1]) : null;
  };
  it('competitors and keyword_research: the same Claude and search-data figures', () => {
    for (const k of ['competitors', 'keyword_research'] as const) {
      expect([k, COST_TABLE[k].ai]).toEqual([k, num('EST', k)]);
      expect([k, COST_TABLE[k].dfs]).toEqual([k, num('DFS_EST', k)]);
    }
    expect(COST_TABLE.competitors.dfs).toBe(0.35);
    expect(COST_TABLE.keyword_research.dfs).toBe(0.9);
  });
});

describe.skipIf(!existsSync(LC))('KI tables (ladder_common.py)', () => {
  const src = readFileSync(LC, 'utf8');
  const cols = (name: string) => {
    const m = src.match(new RegExp('\\n' + name + '_COLS = \\[([\\s\\S]*?)\\]\\n'));
    return m ? [...m[1].matchAll(/\('([a-z0-9_]+)', '[a-z]+'\)/g)].map((x) => x[1]) : [];
  };
  it('the row types name every column the engine stores (spot check of the keys the app reads first)', () => {
    expect(cols('KI_RUNS')).toContain('sections_json');
    expect(cols('KI_COMP')).toEqual(expect.arrayContaining(['comp_domain', 'class', 'status', 'status_by', 'evidence_json', 'profile_json']));
    expect(cols('KI_KW')).toEqual(expect.arrayContaining(['kw_key', 'verdict', 'score_low', 'score_high', 'cluster_id', 'gate']));
    expect(cols('KI_GAPS')).toEqual(expect.arrayContaining(['gap_id', 'type', 'action', 'credits', 'status']));
    expect(src).toMatch(/\('ki_mode', 'string'\), \('ki_refresh', 'boolean'\), \('ki_max_competitors', 'number'\)\]/);
  });
});
