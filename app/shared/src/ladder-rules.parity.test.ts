import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LRU } from './ladder-rules';

// LADDER PACKAGE (2026-11-09): ONE set of ladder rules. The app's module (ladder-rules.generated.js, written by build_v4.py through
// ladder_rules_app.py) must be the engine's kit (n8n/seo-agent/v5/code/_ladder_rules.js) byte for byte and answer every case below exactly as
// the kit does. The kit is evaluated here straight from the engine folder (with the fit gate it reads its places from), so a kit change
// without a rebuild fails this suite. Needs the repo root (CI checks it out whole).

const here = dirname(fileURLToPath(import.meta.url));
const ENGINE = join(here, '../../../n8n/seo-agent');
const KIT_SRC = readFileSync(join(ENGINE, 'v5/code/_ladder_rules.js'), 'utf8').replace(/\n+$/, '');
const GATE_SRC = readFileSync(join(ENGINE, 'v5/code/_fit_gate.js'), 'utf8');
const GENERATED = readFileSync(join(here, 'ladder-rules.generated.js'), 'utf8');
const KIT = new Function(GATE_SRC + '\n' + KIT_SRC + '\nreturn LRU;')() as typeof LRU;

const MARKETS = [
  { keyword: 'ai automation solutions gcc', site_iso: 'AE', request_iso: 'PK' },
  { keyword: 'ai automation services pakistan', site_iso: 'AE', request_iso: 'AE' },
  { keyword: 'dynamics 365 erp system', site_iso: 'AE', request_iso: 'AE' },
  { keyword: 'erp software qatar', site_iso: 'AE', request_iso: 'AE' },
  { keyword: 'erp software gcc', site_iso: 'PK', request_iso: 'PK' },
  { keyword: 'crm service provider', site_iso: '', request_iso: 'AE' },
];
const KEYWORDS = ['crm service provider', 'what is a crm company', 'crm for customers', 'best crm software for customer service', 'ms 365 erp', 'dynamics 365 partner uae', 'e invoicing penalties uae'];
const ROWS = [
  { status: 'stopped', status_note: 'stopped: our check advised against this page (AVOID, score 30)', target_url: 'https://www.techand.ai/insights/crm-for-customers' },
  { status: 'failed', status_note: 'failed: the page run stopped without a result', target_url: 'https://www.techand.ai/what-is-a-crm-company' },
  { status: 'planned', page_exists: true, target_url: 'https://www.techand.ai/dynamics-365-crm-uae' },
  { status: 'planned', page_exists: false, target_url: 'https://devaicon.com/ai-app-development' },
  { status: 'writing', target_url: 'https://devaicon.com/agentic-ai-development-in-uae' },
];

describe('the app runs the engine\'s ladder rules kit', () => {
  it('ladder-rules.generated.js is _ladder_rules.js unchanged (rebuild with python3 build_v4.py when this fails)', () => {
    expect(GENERATED.includes(KIT_SRC)).toBe(true);
  });
  it('the same market lock', () => {
    for (const m of MARKETS) expect(LRU.market(m)).toEqual(KIT.market(m));
  });
  it('the same stages and definitions', () => {
    for (const k of KEYWORDS) {
      expect(LRU.stageOf(k)).toBe(KIT.stageOf(k));
      expect(LRU.isDefinitional(k)).toBe(KIT.isDefinitional(k));
    }
  });
  it('the same rung reasons, stuck rule and verdict stop', () => {
    for (const r of ROWS) expect(LRU.rungState(r)).toEqual(KIT.rungState(r));
    const s = { status: 'writing', since: '2026-11-05T01:33:00Z', live: false, now: '2026-11-05T03:00:00Z' };
    expect(LRU.stuck(s)).toEqual(KIT.stuck(s));
    expect(LRU.verdictStop({ verdict: 'AVOID', score: 30 })).toEqual(KIT.verdictStop({ verdict: 'AVOID', score: 30 }));
  });
});
