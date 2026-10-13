import { describe, expect, it } from 'vitest';
import { LINEAGE_BASIS, LINEAGE_MISSING, LINEAGE_SOURCES, lineage, lineageAsOf, lineageNote, lineagePeriod, lineageSample, lineageUnknown } from './lineage';

// G29 (2026-10-13, system review FIX_PLAN; criterion 3.11): every number a customer sees says where it came from, over what period
// and from how big a sample. A modelled number says so; an unrecorded source reads "source not recorded", never a borrowed one.
describe('lineage (G29)', () => {
  it('carries the source, the period, the sample and how the figure was arrived at as fields', () => {
    const l = lineage('Clicks', 'gsc', { period: '2026-09-15 to 2026-10-12 (28 days)', sample: '13,440 impressions', basis: 'measured', note: 'property sc-domain:x.ae' });
    expect(l).toMatchObject({ figure: 'Clicks', source: 'gsc', sourceLabel: 'Google Search Console', basis: 'measured', basisLabel: 'measured' });
    expect(lineageNote(l)).toBe('Google Search Console · 2026-09-15 to 2026-10-12 (28 days) · 13,440 impressions · measured · property sc-domain:x.ae');
  });

  it('says a modelled number is modelled and a live check is one sample', () => {
    expect(lineage('Share of voice', 'model', { basis: 'modelled' }).basisLabel).toBe('modelled, not measured');
    expect(lineage('Position', 'serp', { basis: 'one_sample' }).basisLabel).toBe('one sample, not an average');
    expect(lineage('Traffic potential', 'kwdata', { basis: 'estimated' }).basisLabel).toBe('estimated');
    expect(lineage('Impressions', 'gsc', { basis: 'calibrated' }).basisLabel).toContain('calibrated');
  });

  it('reads "source not recorded" where the lineage is unknown, with the reason and no borrowed source', () => {
    const l = lineageUnknown('Visits', 'Google Analytics is not connected for this website');
    expect(l.source).toBe('none');
    expect(l.sourceLabel).toBe(LINEAGE_MISSING);
    expect(l.basisLabel).toBe(LINEAGE_MISSING);
    expect(lineageNote(l)).toBe('source not recorded · Google Analytics is not connected for this website');
    expect(lineageNote(null)).toBe(LINEAGE_MISSING);
  });

  it('falls back to "source not recorded" instead of inventing a source for an unknown key', () => {
    const l = lineage('Something', 'made-up' as never);
    expect(l.source).toBe('none');
    expect(l.basis).toBe('unknown');
  });

  it('states a period with both dates and its length, and never an empty claim', () => {
    expect(lineagePeriod('2026-09-15', '2026-10-12')).toBe('2026-09-15 to 2026-10-12 (28 days)');
    expect(lineagePeriod('2026-10-12', '2026-10-12')).toBe('2026-10-12 to 2026-10-12 (1 day)');
    expect(lineagePeriod('', '2026-10-12')).toBe('to 2026-10-12');
    expect(lineagePeriod('', '')).toBe('');
    expect(lineageAsOf('2026-10-12T09:00:00.000Z')).toBe('as of 2026-10-12');
    expect(lineageAsOf('')).toBe('');
  });

  it('states a sample with its unit, and nothing at all when the size is unknown', () => {
    expect(lineageSample(13440, 'impressions')).toBe('13,440 impressions');
    expect(lineageSample(null, 'impressions')).toBe('');
    expect(lineageSample(undefined, 'impressions')).toBe('');
  });

  it('keeps one vocabulary, the same words the engine uses', () => {
    expect(LINEAGE_SOURCES.none).toBe(LINEAGE_MISSING);
    expect(LINEAGE_BASIS.unknown).toBe(LINEAGE_MISSING);
    expect(LINEAGE_BASIS.modelled).toBe('modelled, not measured');
    expect(Object.keys(LINEAGE_SOURCES)).toContain('gsc_history');
  });
});
