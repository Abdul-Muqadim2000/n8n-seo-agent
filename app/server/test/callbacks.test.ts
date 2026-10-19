import { describe, expect, it } from 'vitest';
import { extractFiles } from '../src/services/files';
import { wonLadderOf } from '../src/services/runs';
import { engineCostEstimate, ledgerCost, stageOf, summarize, titleFor } from '../src/services/summaries';

const b64 = (s: string) => Buffer.from(s).toString('base64');

describe('extractFiles', () => {
  it('moves embedded files out of the JSON, once each, and keeps a reference', () => {
    const pdf = { data: b64('%PDF-1.4 hello'), fileName: 'report.pdf', mimeType: 'application/pdf' };
    const { payload, files } = extractFiles({ stage: 'backlinks', pdf, files: { pdf, prospects_csv: { data: b64('a,b\n1,2'), fileName: 'prospects.csv', mimeType: 'text/csv' } } });
    expect(files.map((f) => f.fileName).sort()).toEqual(['prospects.csv', 'report.pdf']);
    const ref = payload.pdf as { $file: string; size: number };
    expect(ref.$file).toBe((payload.files as { pdf: { $file: string } }).pdf.$file);
    expect(ref.size).toBe('%PDF-1.4 hello'.length);
    expect(JSON.stringify(payload)).not.toContain(b64('%PDF-1.4 hello'));
  });

  it('turns the blog package and the fix pack into files', () => {
    const { files } = extractFiles({
      stage: 'content',
      keyword: 'uae e invoicing penalties',
      html: '<article><h1>UAE e-invoicing penalties</h1><p>' + 'x'.repeat(80) + '</p></article>',
      markdown: '# UAE e-invoicing penalties\n\n' + 'y'.repeat(80),
      meta: { slug: 'uae-e-invoicing-penalties', title: 'Penalties' },
      fix_pack: { files: [{ name: 'robots.txt', content: 'User-agent: *' }, { name: 'internal-links.csv', content: 'from,to' }] },
    });
    const names = files.map((f) => f.fileName);
    expect(names).toEqual(expect.arrayContaining(['uae-e-invoicing-penalties.html', 'uae-e-invoicing-penalties.md', 'uae-e-invoicing-penalties.meta.json', 'robots.txt', 'internal-links.csv']));
    expect(files.find((f) => f.fileName === 'internal-links.csv')?.kind).toBe('csv');
  });

  it('ignores things that only look like files', () => {
    const { files } = extractFiles({ note: { data: 'not base64!!', fileName: 'x.txt' }, short: { data: 'abc', mimeType: 'text/plain' } });
    expect(files).toHaveLength(0);
  });
});

describe('summaries', () => {
  it('derives the stage', () => {
    expect(stageOf({ status: 'rejected', error: 'budget' })).toBe('rejected');
    expect(stageOf({ verdict: 'GO' })).toBe('content');
    expect(stageOf({ stage: 'site_tracker' })).toBe('site_tracker');
  });

  it('summarizes an audit and a weekly report', () => {
    expect(summarize('site_audit', { health_score: 80, grade: 'Good', issue_counts: { Critical: 0, High: 5 }, audit_diff: { score_delta: 1 } })).toEqual({ healthScore: 80, grade: 'Good', critical: 0, high: 5, scoreDelta: 1 });
    const s = summarize('site_tracker', { gsc: { totals: { cur: { clicks: 29, impressions: 4226 } }, deltas: { clicks_pct: 53 } }, ga4: { organic: { cur: { sessions: 46 } } }, actions: [{}, {}] });
    expect(s).toMatchObject({ clicks: 29, impressions: 4226, clicksPct: 53, sessions: 46, actions: 2 });
  });

  it('titles and costs', () => {
    expect(titleFor('content', { keyword: 'erp dubai', html: '<p>x</p>' })).toBe('Page: erp dubai');
    expect(titleFor('site_audit', { domain: 'techand.ai' })).toBe('Technical audit · techand.ai');
    expect(ledgerCost({ run_ledger: { dataforseo_usd: 0.12 } })?.usd).toBeCloseTo(0.12);
    expect(ledgerCost({})).toBeNull();
  });

  // re-rating 2026-10-17: C-14 the on-demand pulse of 2026-10-17 had 0 alerts and was titled "AI pulse alert · techand.ai";
  // C-11 the AI Growth dry run read as a finished "done for you" report; C-1 a run the catch-up started late said nothing
  it('titles say what the report is: an alert only with alerts, a test run, a run that ran late', () => {
    expect(titleFor('ai_pulse', { domain: 'techand.ai', alerts: [], samples: 21 })).toBe('AI pulse · techand.ai');
    expect(titleFor('ai_pulse', { domain: 'techand.ai', alerts: [{ level: 'medium', text: 'ChatGPT stopped naming you' }] })).toBe('AI pulse alert · techand.ai');
    expect(titleFor('ai_growth', { domain: 'techand.ai', dry_run: true })).toBe('AI growth · techand.ai (test run, nothing submitted)');
    expect(titleFor('rank_tracker', { domain: 'techand.ai', ran_late: { late: true, due: '2026-10-19T12:00:00.000Z' } })).toBe('Rank tracker · techand.ai (ran late)');
    expect(titleFor('backlinks', { domain: 'techand.ai', ran_late: { late: false } })).toBe('Backlink report · techand.ai');
  });
});

// B-R3, the money the app shows is the engine's, not a guess of ours
describe('what a run reported spending', () => {
  it('counts the model calls as well as the search data (it used to count only the search data)', () => {
    const c = ledgerCost({ run_ledger: { dataforseo_usd: 0.0221, ai_usd: 0.587, ai_cost_estimated: true } });
    expect(c?.usd).toBeCloseTo(0.6091, 4);
    expect(c?.estimated).toBe(true);
  });

  it('reads the model cost out of the cost object when the flat field is missing', () => {
    expect(ledgerCost({ run_ledger: { dataforseo_usd: 0.02, ai_cost: { usd: 0.1, estimated: false } } })?.usd).toBeCloseTo(0.12, 4);
  });

  it('calls a figure measured only when nothing in it is an estimate', () => {
    expect(ledgerCost({ run_ledger: { dataforseo_usd: 0.09, ai_usd: 0 } })?.estimated).toBe(false);
    // a crawl priced from a provider quote is not a measurement either (R32)
    expect(ledgerCost({ run_ledger: { dataforseo_usd: 0.09, dataforseo_estimated_usd: 0.0212 } })?.estimated).toBe(true);
  });

  it('still understands a bare cost_usd and still says nothing when there is nothing', () => {
    expect(ledgerCost({ cost_usd: 0.0114 })?.usd).toBeCloseTo(0.0114, 4);
    expect(ledgerCost({ run_ledger: {} })).toBeNull();
  });

  it('reads the engine\'s own calibrated estimate, with its basis', () => {
    const e = engineCostEstimate({ run_cost_estimate_usd: 0.84, run_cost_estimate_basis: 'Claude $0.80 (calibrated, 6 runs); search data $0.04 (default)' });
    expect(e?.usd).toBe(0.84);
    expect(e?.basis).toContain('calibrated');
  });

  it('accepts a zero estimate (a free run reserves nothing) but not a missing one', () => {
    expect(engineCostEstimate({ run_cost_estimate_usd: 0 })?.usd).toBe(0);
    expect(engineCostEstimate({})).toBeNull();
    expect(engineCostEstimate({ run_cost_estimate_usd: 'cheap' })).toBeNull();
  });

  it('falls back to the ledger\'s own basis sentence when the callback carries no separate one', () => {
    expect(engineCostEstimate({ run_ledger: { run_cost_estimate_usd: 0.2, cost_basis: 'reserved: Claude $0.16 ESTIMATED' } })?.basis).toContain('ESTIMATED');
  });
});

describe('rank tracker: a won ladder', () => {
  it('only rank_tracker callbacks with won: true and a ladder id mark a ladder won', () => {
    expect(wonLadderOf('rank_tracker', { ladder_id: 'lad_mupia2l2c0tp', won: true, stuck: false })).toBe('lad_mupia2l2c0tp');
    expect(wonLadderOf('rank_tracker', { ladder_id: 'lad_x', won: 'true' })).toBe('lad_x');
    expect(wonLadderOf('rank_tracker', { ladder_id: 'lad_x', won: false, stuck: true })).toBeNull();
    expect(wonLadderOf('content_cadence', { ladder_id: 'lad_x', won: true })).toBeNull();
    for (const ladder_id of ['', '_site', '../x', 42]) expect(wonLadderOf('rank_tracker', { ladder_id, won: true })).toBeNull();
  });
});
