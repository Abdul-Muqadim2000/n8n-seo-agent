import { describe, expect, it } from 'vitest';
import { ladderMarket, rungReason, stuckRung } from './ladder-rules';
import { consistencyWarnings } from './consistency';

// LADDER PACKAGE (2026-11-09): the app's side of the ladder rules (n8n/seo-agent/docs/keyword-intel-2026-11-08/fixes/LADDER.md)

describe('ladderMarket (rule 3)', () => {
  it('devaicon.com: a GCC keyword sent with Pakistan is sent in the UAE, with the reason', () => {
    const m = ladderMarket({ keyword: 'ai automation solutions gcc', siteCountry: 'United Arab Emirates', requested: 'Pakistan' });
    expect(m.sendCountry).toBe('United Arab Emirates');
    expect(m.needsConfirm).toBe(false);
    expect(m.warning).toMatch(/names gcc, so this ladder is measured in United Arab Emirates, not in Pakistan/);
  });
  it('a keyword naming another market than the website is kept in that market', () => {
    const m = ladderMarket({ keyword: 'ai automation services pakistan', siteCountry: 'United Arab Emirates', requested: 'United Arab Emirates' });
    expect(m.sendCountry).toBe('Pakistan');
    expect(m.source).toBe('keyword');
  });
  it('a keyword naming no place, sent elsewhere: confirmed first, then measured where the client chose', () => {
    const a = ladderMarket({ keyword: 'ai automation company', siteCountry: 'United Arab Emirates', requested: 'Pakistan' });
    expect(a.needsConfirm).toBe(true);
    expect(a.sendCountry).toBe('United Arab Emirates');
    const b = ladderMarket({ keyword: 'ai automation company', siteCountry: 'United Arab Emirates', requested: 'Pakistan', marketAck: true });
    expect(b.needsConfirm).toBe(false);
    expect(b.sendCountry).toBe('Pakistan');
  });
  it('the website\'s own market: nothing to say', () => {
    const m = ladderMarket({ keyword: 'dynamics 365 erp system', siteCountry: 'United Arab Emirates', requested: 'United Arab Emirates' });
    expect(m.warning).toBe('');
    expect(m.sendCountry).toBe('United Arab Emirates');
  });
});

describe('the New keyword ladder warning (market.ladder_named)', () => {
  const site = { domain: 'devaicon.com', country: 'United Arab Emirates' } as never;
  it('a GCC ladder started in Pakistan on a UAE website: the website\'s own market, so market.run_country says it ("Use United Arab Emirates")', () => {
    const w = consistencyWarnings('run', { mode: 'ladder', keyword: 'ai automation solutions gcc', country: 'Pakistan' }, { site } as never);
    expect(w.find((x) => x.code === 'market.run_country')?.accept?.label).toBe('Use United Arab Emirates');
    expect(w.some((x) => x.code === 'market.ladder_named')).toBe(false);
  });
  it('a keyword naming another market than the website\'s: market.ladder_named says where it is measured, market.run_country stays quiet', () => {
    const pk = { domain: 'devaicon.com', country: 'Pakistan' } as never;
    const w = consistencyWarnings('run', { mode: 'ladder', keyword: 'ai automation solutions gcc', country: 'Pakistan' }, { site: pk } as never);
    expect(w.find((x) => x.code === 'market.ladder_named')?.accept?.label).toBe('Use United Arab Emirates');
    expect(w.some((x) => x.code === 'market.run_country')).toBe(false);
  });
  it('a ladder in the website\'s own market: no warning', () => {
    const w = consistencyWarnings('run', { mode: 'ladder', keyword: 'ai automation solutions gcc', country: 'United Arab Emirates' }, { site } as never);
    expect(w.some((x) => x.code === 'market.ladder_named' || x.code === 'market.run_country')).toBe(false);
  });
});

describe('rungReason and stuckRung', () => {
  it('a stopped rung says why, a planned rung that exists improves its page', () => {
    expect(rungReason({ status: 'stopped', status_note: 'stopped: our check advised against this page (AVOID, score 30)' }).why).toMatch(/AVOID, score 30/);
    expect(rungReason({ status: 'planned', page_exists: true, target_url: 'https://www.techand.ai/dynamics-365-crm-uae' }).state).toBe('improve');
  });
  it('stuck after 60 minutes with nothing alive, never while alive or unknown', () => {
    const since = '2026-11-05T01:33:00Z', now = Date.parse('2026-11-05T03:00:00Z');
    expect(stuckRung({ status: 'writing', since, live: false, now }).stuck).toBe(true);
    expect(stuckRung({ status: 'writing', since, live: true, now }).stuck).toBe(false);
    expect(stuckRung({ status: 'writing', since, live: null, now }).stuck).toBe(false);
  });
});
