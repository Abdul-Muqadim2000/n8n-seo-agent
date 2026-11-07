// KI A1 (2026-11-08, CONTRACTS.md §4): what the app makes of the KI callbacks. ok / partial / refused bodies are built from the shared callback
// types (shared/src/ki.ts), so a change of the contract breaks this file at compile time. Synthetic data.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { deliveryDecision, finishedStatus, MODES, type KiCompetitorsCallback, type KiResearchCallback, type KiStartedCallback } from '@seo/shared';

const st = vi.hoisted(() => ({ platform: false }));
vi.mock('../src/auth/access', async (orig) => ({ ...(await orig<typeof import('../src/auth/access')>()), isPlatformAdmin: vi.fn(() => st.platform) }));

import { summarize, titleFor } from '../src/services/summaries';
import { runOutcome } from '../src/services/runs';
import { invalidateKi, isKiStage, kiCache, kiReportVisible, kiTrialCallback } from '../src/services/ki';

const base = {
  reason: '', request_id: '41', run_id: 'kir_1', domain: 'nova-ki.example', market: 'AE-en', mode: 'on' as const, rule_version: 'ki-1',
  labels: { measured: 'measured', provider_estimate: 'estimate from <source>' }, run_ledger: { run_id: '77', dfs_usd: 0.31, ai_usd: 0.01 },
  run_cost_estimate_usd: 0.35, run_cost_estimate_basis: 'table', run_cost_estimate_state: 'estimated',
};
const competitors = (status: KiCompetitorsCallback['status'], over: Partial<KiCompetitorsCallback> = {}): KiCompetitorsCallback => ({
  ...base,
  stage: 'ki_competitors',
  status,
  sections: [{ key: 'serps', state: 'ok', reason: '', rows: 20 }, { key: 'profiles', state: status === 'partial' ? 'missing' : 'ok', reason: status === 'partial' ? 'provider did not answer' : '', rows: 0 }],
  summary: { candidates: 12, chosen: 0 },
  competitors: [{ comp_domain: 'rival.example', status: 'chosen' } as never, { comp_domain: 'other.example', status: 'candidate' } as never],
  listings: [{ comp_domain: 'g2.example' } as never],
  platforms: [],
  ...over,
});
const research = (status: KiResearchCallback['status'], over: Partial<KiResearchCallback> = {}): KiResearchCallback => ({
  ...base,
  stage: 'ki_research',
  status,
  sections: [{ key: 'volumes', state: status === 'partial' ? 'partial' : 'ok', reason: '', rows: 40 }, { key: 'gsc', state: status === 'partial' ? 'missing' : 'ok', reason: 'not connected', rows: 0 }],
  summary: { keywords: 420 },
  clusters: [{ cluster_id: 'c1', head: 'erp dubai', members: 7, demand: 900, stage: 'hire', verdict: 'go', score: 71, score_low: 60, score_high: 80, page_action: 'new', page_url: null }],
  striking: [{ keyword: 'erp price dubai', position: 12, impressions: 300, page: '/erp', change: '' }],
  questions: [{ question: 'how much does erp cost', cluster_id: 'c1', sources: ['paa'] }],
  gaps_summary: { missing: 4, striking: 2 },
  plan: [{ action_id: 'a1', kind: 'write', title: 'Write the ERP price page', why: 'searched 900 times', target: 'erp price dubai', credits: 40 }],
  ...over,
});
const asBody = (b: object) => b as unknown as Record<string, unknown>;
const finals = MODES.keyword_research.finalStages;

describe('KI A1: the list summary of a KI report', () => {
  it('ok: the counts, no partial flag', () => {
    expect(summarize('ki_competitors', asBody(competitors('ok')))).toEqual({ status: 'ok', market: 'AE-en', competitors: 2, chosen: 1, listings: 1, platforms: 0 });
    expect(summarize('ki_research', asBody(research('ok')))).toEqual({ status: 'ok', market: 'AE-en', clusters: 1, striking: 1, questions: 1, gaps: 6, plan: 1, keywords: 420 });
  });
  it('partial: said honestly, with the sections it could not read', () => {
    expect(summarize('ki_research', asBody(research('partial')))).toMatchObject({ status: 'partial', partial: true, missing: 'volumes, gsc' });
    expect(summarize('ki_competitors', asBody(competitors('partial')))).toMatchObject({ partial: true, missing: 'profiles' });
  });
  it('refused / failed carry the reason; a Trial run is marked; the started notices too', () => {
    expect(summarize('ki_research', asBody(research('refused', { reason: 'killed', clusters: [], striking: [], questions: [], plan: [], gaps_summary: {} })))).toMatchObject({ status: 'refused', reason: 'killed' });
    expect(summarize('ki_competitors', asBody(competitors('ok', { mode: 'trial' })))).toMatchObject({ trial: true });
    const started: KiStartedCallback = { stage: 'ki_research_started', status: 'accepted', request_id: '41', run_id: 'kir_1', domain: 'nova-ki.example', market: 'AE-en', mode: 'trial', rule_version: 'ki-1' };
    expect(summarize('ki_research_started', asBody(started))).toEqual({ market: 'AE-en', trial: true });
    expect(titleFor('ki_research', asBody(research('ok')))).toBe('Keyword research · nova-ki.example');
  });
});

describe('KI A1: what a KI answer does to the run and its delivery', () => {
  it('ok and partial complete the run (charged what the ledger settled, capped at the quote); refused and failed end it failed, not charged', () => {
    expect(runOutcome('running', finals, 'ki_research', asBody(research('ok'))).status).toBe('completed');
    expect(runOutcome('running', finals, 'ki_research', asBody(research('partial'))).status).toBe('completed');
    expect(runOutcome('running', finals, 'ki_research', asBody(research('refused', { reason: 'market_mismatch' })))).toMatchObject({ status: 'failed', error: expect.stringMatching(/main market.*Nothing was charged/) });
    expect(runOutcome('running', finals, 'ki_research', asBody(research('failed'))).status).toBe('failed');
    expect(runOutcome('accepted', finals, 'ki_research_started', { stage: 'ki_research_started', status: 'accepted' }).status).toBe('running');
  });
  it('a partial report is a finished report (delivered, saying what is missing); refused and failed ones are held', () => {
    expect(finishedStatus('ki_research', 'partial')).toBe(true);
    expect(finishedStatus('ki_competitors', 'partial')).toBe(true);
    expect(finishedStatus('content', 'partial')).toBe(false);   // no other stage changes
    expect(deliveryDecision({ stage: 'ki_research', status: 'ok', payload: asBody(research('ok')) }).deliver).toBe(true);
    expect(deliveryDecision({ stage: 'ki_research', status: 'partial', payload: asBody(research('partial')) }).deliver).toBe(true);
    for (const s of ['refused', 'failed'] as const) expect(deliveryDecision({ stage: 'ki_competitors', status: s, payload: asBody(competitors(s)) }).deliver).toBe(false);
    expect(deliveryDecision({ stage: 'ki_research_started', status: 'accepted', payload: {} }).code).toBe('interim');
  });
  it('a Trial run never leaves the app: held, no event, hidden from everyone but platform admins', () => {
    const trial = asBody(research('ok', { mode: 'trial' }));
    const d = deliveryDecision({ stage: 'ki_research', status: 'ok', payload: trial });
    expect(d).toMatchObject({ deliver: false, code: 'trial' });
    expect(d.reason).not.toMatch(/[—–…‘’“”]/);
    expect(kiTrialCallback('ki_research', trial)).toBe(true);
    expect(kiTrialCallback('ki_research', asBody(research('ok')))).toBe(false);
    expect(kiTrialCallback('content', { mode: 'trial' })).toBe(false);
    const rep = { stage: 'ki_research', summary: summarize('ki_research', trial) };
    st.platform = false;
    expect(kiReportVisible(rep, { id: 'u' } as never)).toBe(false);
    expect(kiReportVisible({ stage: 'ki_research', summary: summarize('ki_research', asBody(research('ok'))) }, { id: 'u' } as never)).toBe(true);
    // FX-A: the one mark is the summary's `trial` (any report of a Trial run carries it); a report without it is everyone's
    expect(kiReportVisible({ stage: 'content', summary: { trial: true } }, null)).toBe(false);
    expect(kiReportVisible({ stage: 'content', summary: {} }, null)).toBe(true);
    st.platform = true;
    expect(kiReportVisible(rep, { id: 'u' } as never)).toBe(true);
    st.platform = false;
  });
  it('the callback path skips events for a Trial run and empties the KI cache of the website', () => {
    const src = readFileSync(join(__dirname, '../src/services/runs.ts'), 'utf8');
    // FX-A: the one Trial check of a callback (a KI answer in Trial, or any callback of a Trial run) marks the report and skips the events
    expect(src).toMatch(/const trial = kiTrialOf\(stage, body, run\);/);
    expect(src).toMatch(/summary: trial \? \{ \.\.\.summarize\(stage, body\), trial: true \} : summarize\(stage, body\)/);
    expect(src).toMatch(/if \(!trial\) void emitForCallback\(/);
    expect(src).toMatch(/if \(domain && isKiStage\(stage\)\) invalidateKi\(domain\);/);
    kiCache.set('nova-ki.example|novaki', { at: Date.now(), value: 1 });
    kiCache.set('other.example|other', { at: Date.now(), value: 1 });
    invalidateKi('Nova-KI.example');
    expect([...kiCache.keys()]).toEqual(['other.example|other']);
    expect(isKiStage('ki_competitors_started')).toBe(true);
    expect(isKiStage('keyword_strategy')).toBe(false);
  });
  it('the report routes and API v1 hide a Trial run\'s reports', () => {
    const routes = readFileSync(join(__dirname, '../src/routes/runs.ts'), 'utf8');
    // FX-A: filtered in the reads themselves (before the limit), with the one Trial condition of services/ki.ts
    expect(routes.match(/viewer: a\.user/g)?.length).toBeGreaterThanOrEqual(2);
    expect(routes).toMatch(/kiReportConds\(a\.user\)/);
    const v1 = readFileSync(join(__dirname, '../src/services/apiV1.ts'), 'utf8');
    expect(v1).toMatch(/NOT_KI_TRIAL_REPORT/);
    expect(v1).toMatch(/NOT_KI_TRIAL_RUN/);
    const ki = readFileSync(join(__dirname, '../src/services/ki.ts'), 'utf8');
    expect(ki).toMatch(/summary\}->>'trial', ''\) <> 'true'/);
  });
});
