import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LINK_KINDS, bingSourceText, checkNote, linkBreakdown, linkCounts, linkKindOf, sourcesFromLedger, spamScoreReading, type BingCheck } from './backlinks';

// devaicon.com's link ledger as production held it on 2026-11-11 (personal profile paths replaced by /x)
const F = JSON.parse(readFileSync(join(__dirname, '__fixtures__', 'backlinks-devaicon-2026-11-11.json'), 'utf8')) as { cols: string[]; rows: unknown[][] };
type Row = { refDomain: string; kind: string; fromUrl: string; linkType: string; verify: string; sources: string[]; spamScore: number; visits: number; status: string; seoValue: number };
const rows: Row[] = F.rows.map((r) => {
  const o = Object.fromEntries(F.cols.map((c, i) => [c, r[i]])) as Record<string, unknown>;
  return { ...(o as unknown as Row), sources: String(o.sources).split(',').filter(Boolean) };
});
const ref = (o: Partial<Row>): Row => ({ refDomain: 'example.org', kind: 'web', fromUrl: '', linkType: '', verify: 'unchecked', sources: ['dfs'], spamScore: 0, visits: 0, status: 'live', seoValue: 0, ...o });
const kindOf = (d: string) => linkKindOf(rows.find((r) => r.refDomain === d)!);

describe('link kinds on the devaicon.com ledger (client report 2026-11-11)', () => {
  const b = linkBreakdown(rows);
  it('splits the 1,289 live rows: almost all are automatic report pages or farms', () => {
    expect(b.total).toBe(1289);
    expect(b.counts.auto + b.counts.farm).toBe(b.ignored);
    expect(b.ignored).toBeGreaterThanOrEqual(1278);
    expect(b.counted).toBeLessThanOrEqual(11);
  });
  it('names the client\'s screenshot rows for what they are', () => {
    for (const d of ['bottraffic.site', 'organicseo.shop', 'websitetr.space', 'offpageseo.website', 'seomonitor.space', 'pagereport.shop', 'sitereport.space', 'scamadviser.com']) expect(kindOf(d), d).toBe('auto');
    for (const d of ['crunchbase.com', 'bebee.com', 'github.com', 'linkedin.com', 'gulfleads.ae']) expect(kindOf(d), d).toBe('listing');
    expect(kindOf('zynbox.cloud')).toBe('real');
  });
  it('keeps every engine spam label a farm', () => {
    for (const r of rows.filter((x) => x.linkType === 'spam')) expect(linkKindOf(r)).toBe('farm');
  });
  it('leaves only the two listings among the 50+ rows that count (the Best tab was 775, all automatic pages but these)', () => {
    const best = rows.filter((r) => r.status !== 'lost' && r.kind === 'web' && r.seoValue >= 50);
    expect(best.length).toBeGreaterThan(700);
    expect(best.filter(linkCounts).map((r) => r.refDomain).sort()).toEqual(['bebee.com', 'crunchbase.com']);   // listings, kept
  });
  it('counts no farm in "missed once" (219 at risk before, 217 of them farm pages)', () => {
    const atRisk = rows.filter((r) => r.status === 'at_risk');
    expect(atRisk.length).toBe(219);
    expect(atRisk.filter(linkCounts).map((r) => r.refDomain).sort()).toEqual(['bebee.com', 'gulfleads.ae']);
  });
});

describe('real links are not swept up', () => {
  it('a real business on a new ending, confirmed by another source or found on the page, stays a link', () => {
    expect(linkKindOf(ref({ refDomain: 'webdesign-studio.online', fromUrl: 'https://webdesign-studio.online/partners/acme', sources: ['dfs', 'gsc'] }))).toBe('real');
    expect(linkKindOf(ref({ refDomain: 'sitebuilders.shop', fromUrl: 'https://sitebuilders.shop/blog/x', verify: 'found' }))).toBe('real');
    expect(linkKindOf(ref({ refDomain: 'rankingdata.store', visits: 3 }))).toBe('unknown');
  });
  it('a site of a plain name on a new ending is not an automatic page', () => {
    expect(linkKindOf(ref({ refDomain: 'acmebakery.shop', fromUrl: 'https://acmebakery.shop/about' }))).toBe('real');
  });
  it('techand.ai rows: the members list is a listing, a GA4-only referrer is not identified, a page the index rates 60+ alone is a farm', () => {
    expect(linkKindOf(ref({ refDomain: 'peppol.org', fromUrl: 'https://peppol.org/members/full-members-list/', linkType: 'directory', verify: 'found', sources: ['ga4'] }))).toBe('listing');
    expect(linkKindOf(ref({ refDomain: 'tracxn.com', fromUrl: 'https://tracxn.com/d/companies/x', sources: ['gsc'], verify: 'found' }))).toBe('listing');
    expect(linkKindOf(ref({ refDomain: 'vercel.com', sources: ['ga4'], spamScore: 14 }))).toBe('unknown');
    expect(linkKindOf(ref({ refDomain: 'thcradar.com', spamScore: 60 }))).toBe('farm');
    expect(linkKindOf(ref({ refDomain: 'ownproduct.cloud', fromUrl: 'https://ownproduct.cloud/', sources: ['web', 'gsc'], spamScore: 64, verify: 'found' }))).toBe('real');
  });
  it('every kind says what to do in plain words', () => {
    for (const k of Object.values(LINK_KINDS)) {
      expect(k.todo).not.toMatch(/[—…“”]/);
      expect(k.what + k.todo).not.toMatch(/DataForSEO|LK\.|seo_|ledger/);
    }
  });
});

describe('the Check column, the spam score and the sources', () => {
  it('says why a row was not read instead of "not checked yet" for ever', () => {
    expect(checkNote(ref({ refDomain: 'bottraffic.site', spamScore: 45 }))).toBe('Not checked: Google ignores these');
    expect(checkNote(ref({ refDomain: 'example.org', sources: ['gsc'] }))).toBe('No page to open yet');
    expect(checkNote(ref({ refDomain: 'example.org', fromUrl: 'https://example.org/a', sources: ['gsc'] }))).toBe('Checked on a coming run');
    expect(checkNote(ref({ verify: 'found' }))).toBe('');
  });
  it('reads 56 as caused by automatic pages when they are most of the links', () => {
    const r = spamScoreReading(56, linkBreakdown(rows));
    expect(r.badge).toBe('Caused by automatic pages');
    expect(r.text).toMatch(/not your website/);
    expect(spamScoreReading(56, { counts: { real: 30, listing: 5, unknown: 0, auto: 2, farm: 3 }, total: 40, counted: 35, ignored: 5 }).badge).toBe('High');
    expect(spamScoreReading(12, null).tone).toBe('good');
  });
  it('counts sources from the ledger, not from what a light check read', () => {
    const s = sourcesFromLedger(rows);
    expect(s.union).toBe(1288);
    expect(s.dfsShare).toBeGreaterThan(95);
    expect(s.googleSample).toBe(6);   // the engine's "6 sites in Google's own sample" (LinkedIn is a social profile)
    expect(s.dfsSeesGoogle).toBe(0);
  });
});

describe('the Bing line', () => {
  const st = { enabled: true, connected: false, inAccount: false, error: '', links: 0 };
  const live = (o: Partial<BingCheck>): BingCheck => ({ configured: true, inAccount: false, verified: false, shareWith: '', checkedAt: '2026-11-11T10:00:00.000Z', message: '', ...o });
  it('tells a client who added the site to their own Bing account what is still missing', () => {
    const t = bingSourceText(st, null, 'reader@example.com');
    expect(t.ok).toBe(false);
    expect(t.text).toMatch(/our own account/);
    expect(t.text).toMatch(/reader@example\.com/);
    expect(t.text).toMatch(/Read only/);
  });
  it('follows a fresh check', () => {
    expect(bingSourceText(st, live({ inAccount: true, verified: true })).ok).toBe(true);
    expect(bingSourceText(st, live({ inAccount: true })).text).toMatch(/not as verified/);
    expect(bingSourceText(st, live({ configured: false })).ok).toBe(null);
  });
});
