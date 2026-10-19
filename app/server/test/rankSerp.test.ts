import { describe, expect, it } from 'vitest';
import type { RankHistoryRow } from '@seo/shared';
import { rankSeries, serpReading } from '../src/services/data';

// G6 (2026-10-12, system review FIX_PLAN): every rank check stores the whole results page it read, the features it showed, the
// top-10 domains, the competitors' positions, a modelled share of voice and a snapshot as proof, plus a weekly mobile reading of
// the ladder's main keywords. The app must read that back without letting a mobile reading into the desktop position series, and
// without ever turning "not known" into "no".

const row = (o: Partial<RankHistoryRow>): RankHistoryRow =>
  ({
    id: 1,
    createdAt: 'x',
    updatedAt: 'x',
    ladder_id: 'lad_1',
    keyword: 'e invoicing software uae',
    checked_at: '2026-10-12T08:00:00.000Z',
    position: 7,
    url: 'https://www.techand.ai/e-invoicing-software-uae/',
    serp_features: 'ai_overview,people_also_ask',
    domain: 'techand.ai',
    rung: 4,
    device: 'desktop',
    ...o,
  }) as RankHistoryRow;

const features = (o: Record<string, unknown> = {}) =>
  JSON.stringify({
    unavailable: false,
    error: '',
    checked_at: '2026-10-12T08:03:17.000Z',
    types: ['ai_overview', 'organic', 'people_also_ask'],
    ai_overview: { shown: true, content_loaded: true, cites_us: true, cited_domains: ['tax.gov.ae', 'techand.ai'], seen_at: '2026-10-12T08:03:17.000Z' },
    featured_snippet: { shown: true, ours: false, domain: 'cleartax.com' },
    people_also_ask: { shown: true, count: 2, questions: ['Is e-invoicing mandatory in the UAE?'] },
    local_pack: { shown: false, ours: null },
    video: { shown: false },
    shopping: { shown: false },
    ...o,
  });

const competitors = JSON.stringify({
  our_position: 7,
  above: [
    { d: 'cleartax.com', p: 1, t: true },
    { d: 'tax.gov.ae', p: 2, t: false },
  ],
  competitors: [
    { d: 'cleartax.com', p: 1, t: true },
    { d: 'zoho.com', p: null, t: true },
  ],
  shares: [{ domain: 'cleartax.com', pct: 21.4 }],
  tracked: ['cleartax.com', 'zoho.com'],
  method: 'modelled: clicks by position from a published CTR curve ... Not measured clicks.',
});

const snapshot = JSON.stringify({
  at: '2026-10-12T08:03:17.000Z',
  device: 'desktop',
  top: [
    { p: 1, u: 'https://cleartax.com/uae/', t: 'ClearTax UAE' },
    { p: 2, u: 'https://tax.gov.ae/en/', t: '' },
  ],
});

const full = row({ features_json: features(), competitors_json: competitors, snapshot_json: snapshot, share_of_voice: 13.6 });

describe('G6: the results page stored with every rank check', () => {
  it('reads the features, the competitors, the share of voice and the proof of the latest check', () => {
    const r = serpReading([full])!;
    expect(r.features.aiOverview.shown).toBe(true);
    expect(r.features.aiOverview.citesUs).toBe(true);
    expect(r.features.featuredSnippet.ours).toBe(false);
    expect(r.features.featuredSnippet.domain).toBe('cleartax.com');
    expect(r.features.peopleAlsoAsk.count).toBe(2);
    expect(r.features.labels).toEqual(['AI Overview (cites you)', 'Snippet', 'PAA']);
    expect(r.shareOfVoice).toBe(13.6);
    expect(r.method).toContain('Not measured clicks');
    expect(r.above.map((c) => c.domain)).toEqual(['cleartax.com', 'tax.gov.ae']);
    expect(r.above[0].tracked).toBe(true);
    expect(r.competitors.find((c) => c.domain === 'zoho.com')!.position).toBeNull();
    expect(r.snapshot.top).toEqual([
      { position: 1, url: 'https://cleartax.com/uae/', title: 'ClearTax UAE' },
      { position: 2, url: 'https://tax.gov.ae/en/', title: '' },
    ]);
  });

  it('labels an AI Overview whose sources Google did not load as "not loaded", never as "does not cite you"', () => {
    const r = serpReading([
      row({ features_json: features({ ai_overview: { shown: true, content_loaded: false, cites_us: null, cited_domains: [] } }), share_of_voice: 9 }),
    ])!;
    expect(r.features.aiOverview.citesUs).toBeNull();
    expect(r.features.aiOverview.sourcesLoaded).toBe(false);
    expect(r.features.labels).toContain('AI Overview (sources not loaded)');
  });

  it('claims nothing when the check could not be read, and reports no share of voice', () => {
    const r = serpReading([
      row({ position: -1, share_of_voice: -1, features_json: JSON.stringify({ unavailable: true, error: 'Internal Server Error.', ai_overview: { shown: null, cites_us: null } }) }),
    ])!;
    expect(r.features.unavailable).toBe(true);
    expect(r.features.aiOverview.shown).toBeNull();
    expect(r.features.labels).toEqual(['not read']);
    expect(r.shareOfVoice).toBeNull();
  });

  it('keeps the mobile reading beside the desktop series instead of inside it', () => {
    const rows = [
      row({ checked_at: '2026-10-05T08:00:00.000Z', position: 9, features_json: features(), share_of_voice: 11 }),
      full,
      row({ checked_at: '2026-10-12T08:10:00.000Z', position: 14, device: 'mobile', features_json: features(), share_of_voice: 4 }),
    ];
    const series = rankSeries(rows);
    expect(series.history.map((h) => h.position)).toEqual([9, 7]); // the mobile reading is not a third point
    expect(series.latest).toBe(7);
    expect(series.previous).toBe(9);
    expect(series.history[1].shareOfVoice).toBe(13.6);
    const r = serpReading(rows)!;
    expect(r.mobile).toEqual({ position: 14, checkedAt: '2026-10-12T08:10:00.000Z' });
    expect(r.shareOfVoice).toBe(13.6); // the desktop reading, not the mobile one
  });

  it('a failed check is still "check again": it never becomes a position and never a 0% share', () => {
    const series = rankSeries([row({ checked_at: '2026-10-05T08:00:00.000Z', position: 3 }), row({ position: -1, share_of_voice: -1 })]);
    expect(series.latest).toBe(3);
    expect(series.history[1].shareOfVoice).toBeNull();
    expect(series.best).toBe(3);
  });

  it('rows written before G6 (no device, no JSON) behave exactly as they did', () => {
    const old = [
      { ...row({ checked_at: '2026-09-28T08:00:00.000Z', position: 12 }), device: undefined },
      { ...row({ position: 8 }), device: undefined },
    ] as RankHistoryRow[];
    const series = rankSeries(old);
    expect(series.history.map((h) => h.position)).toEqual([12, 8]);
    expect(series.latest).toBe(8);
    expect(series.history[0].shareOfVoice).toBeNull();
    expect(serpReading(old)).toBeNull();
  });
});
