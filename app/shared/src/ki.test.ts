// KI W0 (2026-11-08, docs/keyword-intel-2026-11-08/CONTRACTS.md): the per-site switch, the run modes, the schemas and the payload of the two
// KI modes (the head order rule of payload.ts), the words and the credits quote.
import { describe, expect, it } from 'vitest';
import { LISTED_MODE_IDS, MODE_IDS, MODES, STAGE_LABELS } from './constants';
import { COST_TABLE, keyCost } from './cost';
import { buildN8nPayload } from './payload';
import { parseRunInput, RUN_SCHEMAS } from './schemas';
import {
  KI_BASIS, KI_CLASSES, KI_FINAL_STAGES, KI_STAGES, KI_VERDICT_TONE, KI_VERDICTS, kiBasisLabel, kiCreditsEstimate, kiKilled, kiMaxCompetitorsOf,
  kiMayRun, kiModeOf, kiNoResultOf, kiRefreshOf, kiVisible,
} from './ki';

const SITE = '7a1c2d3e-4f50-4a61-8b72-93a4b5c6d7e8';
const site = { domain: 'northwind-erp.com', country: 'United Arab Emirates', business: 'ERP for distributors', customers: 'finance teams', goal: 'leads', tone: '', cta: '', businessFacts: '', competitors: ['azentio.com'], brandNames: [], ga4PropertyId: '' };
const d = { callbackUrl: 'https://app.example/api/hooks/n8n/tok', email: '' };

describe('KI: the per-site switch', () => {
  it('only trial and on are modes; everything else is off', () => {
    expect(['trial', ' ON ', '', null, 'shadow', 'yes'].map(kiModeOf)).toEqual(['trial', 'on', 'off', 'off', 'off', 'off']);
    expect([kiMayRun('on', false), kiMayRun('trial', false), kiMayRun('trial', true), kiMayRun('off', true)]).toEqual([true, false, true, false]);
    expect(kiVisible).toBe(kiMayRun);
  });
  it('kill switch fails closed; refresh empty = yes; competitors 1-5, empty = 5', () => {
    expect([kiKilled([{ key: 'ki:kill', value: '1' }]), kiKilled([{ key: 'ki:kill', value: '0' }]), kiKilled([]), kiKilled(null)]).toEqual([true, false, false, true]);
    expect([kiRefreshOf(''), kiRefreshOf(null), kiRefreshOf(false), kiRefreshOf('no'), kiRefreshOf(true)]).toEqual([true, true, false, false, true]);
    expect([kiMaxCompetitorsOf(''), kiMaxCompetitorsOf(3), kiMaxCompetitorsOf(9), kiMaxCompetitorsOf(0), kiMaxCompetitorsOf('x')]).toEqual([5, 3, 5, 1, 5]);
  });
});

describe('KI: the two run modes', () => {
  it('are registered, hidden from every list, with their stages, ETA and a cost row', () => {
    for (const m of ['competitors', 'keyword_research'] as const) {
      expect(MODE_IDS).toContain(m);
      expect(LISTED_MODE_IDS).not.toContain(m);
      expect(MODES[m]).toMatchObject({ hidden: true, siteBound: true, category: 'keywords' });
      expect(RUN_SCHEMAS[m]).toBeDefined();
      expect(COST_TABLE[m].basis.length).toBeGreaterThan(10);
      for (const s of [...MODES[m].finalStages, ...(MODES[m].startStages ?? [])]) expect(STAGE_LABELS[s]).toBeTruthy();
    }
    expect([MODES.competitors.etaMinutes, MODES.keyword_research.etaMinutes]).toEqual([6, 12]);
    expect([...MODES.competitors.finalStages, ...MODES.keyword_research.finalStages]).toEqual([...KI_FINAL_STAGES]);
    expect(LISTED_MODE_IDS.length).toBe(MODE_IDS.length - 2);
  });
  it('validate the website, up to 5 competitors and 20 seeds', () => {
    const ok = parseRunInput({ mode: 'competitors', siteId: SITE, country: 'United Arab Emirates', competitors: ['WWW.Rival.ae'], seeds: ['odoo partner dubai'] });
    expect(ok.success && ok.data).toMatchObject({ competitors: ['rival.ae'], seeds: ['odoo partner dubai'], kiForce: false });
    expect(parseRunInput({ mode: 'keyword_research', country: 'United Arab Emirates' }).success).toBe(false);
    expect(parseRunInput({ mode: 'keyword_research', siteId: SITE, country: 'United Arab Emirates', competitors: ['a.com', 'b.com', 'c.com', 'd.com', 'e.com', 'f.com'] }).success).toBe(false);
    expect(parseRunInput({ mode: 'keyword_research', siteId: SITE, country: 'United Arab Emirates', seeds: Array.from({ length: 21 }, (_, i) => `seed ${i}`) }).success).toBe(false);
  });
  it('build the body with the head first, then competitors, seeds and ki_force', () => {
    const p = parseRunInput({ mode: 'keyword_research', siteId: SITE, country: 'United Arab Emirates', seeds: ['erp uae'], kiForce: true });
    if (!p.success) throw new Error('parse');
    const body = buildN8nPayload(p.data, site, d);
    expect(Object.keys(body)).toEqual(['mode', 'keyword', 'country', 'domain', 'email', 'callback_url', 'business', 'customers', 'competitors', 'seeds', 'ki_force']);
    expect(body).toMatchObject({ mode: 'keyword_research', keyword: '', domain: 'northwind-erp.com', competitors: ['azentio.com'], seeds: ['erp uae'], ki_force: true });
  });
});

describe('KI: words, tones and credits', () => {
  it('one word and one tone per verdict; class, stage and basis labels', () => {
    expect(KI_VERDICTS).toEqual({ go: 'Go', months: 'Takes a few months', hard: 'Hard for your website now', gated: 'Not for you', unknown: 'Not judged yet' });
    expect(Object.keys(KI_VERDICT_TONE)).toEqual(Object.keys(KI_VERDICTS));
    expect(Object.keys(KI_CLASSES)).toHaveLength(10);   // FX-L 2026-11-10: + education (training providers, schools, universities)
    expect(Object.keys(KI_STAGES)).toEqual(['hire', 'compare', 'solution', 'problem', 'info']);
    expect(KI_BASIS.modelled).toBe('our estimate');
    // FX-A (review CONSISTENCY L10): a provider's product name never reaches a customer
    expect(kiBasisLabel('provider_estimate', 'DataForSEO Labs')).toBe('estimate from our keyword data');
    expect(kiBasisLabel('provider_estimate', 'Google Ads')).toBe('estimate from Google Ads');
    expect(kiBasisLabel('inferred')).toBe('our reading of the results');
    const copy = JSON.stringify([KI_VERDICTS, KI_CLASSES, KI_STAGES, KI_BASIS, MODES.competitors, MODES.keyword_research]);
    expect(copy).not.toMatch(/[—–…‘’“”]/);
  });
  it('credits come from the one cost table at the platform rate (60 a dollar by default)', () => {
    expect(kiCreditsEstimate('competitors')).toBe(Math.ceil(keyCost('competitors') * 60));
    expect(kiCreditsEstimate('keyword_research')).toBe(Math.ceil(keyCost('keyword_research') * 60));
    expect(kiCreditsEstimate('competitors', { creditValueUsd: 0, markup: 3 })).toBe(0);
  });
  it('a refused or failed final answer is no result; anything else is', () => {
    expect(kiNoResultOf('ki_competitors', { status: 'refused', reason: 'ki_off' })).toMatch(/not switched on/);
    expect(kiNoResultOf('ki_research', { status: 'ok' })).toBeNull();
    expect(kiNoResultOf('ki_research_started', { status: 'refused' })).toBeNull();
  });
});
