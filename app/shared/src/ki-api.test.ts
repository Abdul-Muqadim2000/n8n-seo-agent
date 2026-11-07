// KI A1 (2026-11-08): the pure readers behind the KI routes (fixes/A1_ROUTES.md). Synthetic rows.
import { describe, expect, it } from 'vitest';
import {
  KI_PAGE_SIZE,
  KI_RECOMMENDATION_GUIDES,
  kiBrandTokens,
  kiCompetitorView,
  kiIsBrand,
  kiIsQuestion,
  kiJson,
  kiKeywordQueryOf,
  kiPage,
  kiQuestionText,
  kiRunView,
} from './ki-api';

describe('KI A1: the keyword query from the URL', () => {
  it('known values pass, unknown ones are dropped, the page size is bounded', () => {
    const q = kiKeywordQueryOf({ stage: 'hire', verdict: 'nope', source: 'gsc', min_volume: '50', brand: 'brand', sort: '-volume', page: '2', page_size: '999', include: 'serp', market: 'AE-en' });
    expect(q).toEqual({ stage: 'hire', source: 'gsc', minVolume: 50, brand: 'brand', sort: '-volume', page: 2, pageSize: KI_PAGE_SIZE.max, includeSerp: true, market: 'AE-en' });
    expect(kiKeywordQueryOf({})).toEqual({ sort: '-score', page: 1, pageSize: 50, includeSerp: false });
    expect(kiKeywordQueryOf({ sort: 'dropTables', market: 'ae', page: '-3' })).toEqual({ sort: '-score', page: 1, pageSize: 50, includeSerp: false });
  });
  it('pages: bounded, never past the last', () => {
    const p = kiPage(Array.from({ length: 450 }, (_, i) => i), 9, 500);
    expect(p).toMatchObject({ total: 450, pageSize: 200, pages: 3, page: 3 });
    expect(p.items).toHaveLength(50);
    expect(kiPage([], 1, 50)).toMatchObject({ total: 0, pages: 1, page: 1, items: [] });
  });
});

describe('KI A1: words and rows', () => {
  it('questions and brand', () => {
    expect(kiIsQuestion('how much does erp cost')).toBe(true);
    expect(kiIsQuestion('erp cost dubai')).toBe(false);
    expect(kiIsQuestion('erp cost dubai free', ['paa'])).toBe(true);
    expect(kiQuestionText('how much does erp cost??')).toBe('How much does erp cost?');
    const t = kiBrandTokens('www.techand.ai', ['Tech And', 'TA']);
    expect(t).toEqual(['techand']);
    expect(kiIsBrand('techand erp reviews', t)).toBe(true);
    expect(kiIsBrand('erp reviews', t)).toBe(false);
  });
  it('a broken JSON column reads as its fallback; an AI judgement is labelled so', () => {
    expect(kiJson('{bad', [])).toEqual([]);
    const c = kiCompetitorView({ comp_domain: 'Rival.example', class: 'weird', class_basis: 'llm', size_tag: '', reasons_json: '{bad', evidence_json: null, status: 'chosen', status_by: 'user' } as never);
    expect(c).toMatchObject({ compDomain: 'rival.example', class: 'direct', basis: 'inferred', basisLabel: 'AI judgement', sizeTag: 'unknown', reasons: [], evidence: [], status: 'chosen' });
    const r = kiRunView({ run_id: 'r', kind: 'competitors', status: 'partial', sections_json: '[{"key":"profiles","state":"missing"}]', counts_json: '{"a":2,"b":"x"}' } as never);
    expect(r).toMatchObject({ status: 'partial', missingSections: ['profiles'], counts: { a: 2 } });
  });
  it('the agreed guide ids', () => {
    expect(KI_RECOMMENDATION_GUIDES).toEqual({ 'ki:competitors': 'ki-choose-competitors', 'ki:quick-wins': 'ki-read-keyword-research' });
  });
});
