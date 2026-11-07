import { describe, expect, it } from 'vitest';
import type { RankHistoryRow } from '@seo/shared';
import { poisonedRow, prevReading, serpHosts } from '../src/services/cadence';
import { serpReading, snapTop } from '../src/services/data';

// SERP-GOTO (2026-11-08, n8n/seo-agent/docs/keyword-intel-2026-11-08/fixes/SERP_GOTO.md): since about 2026-10-30 DataForSEO's live Google
// results carried google.com/goto redirect links instead of the result's address. The engine now recovers the site from Google's
// breadcrumb and marks the address approximate (snapshot `x: 1`); readings stored before the fix hold the bare redirects. The app must
// (1) never take such a stored reading as the baseline (the engine's RS.prevReading rule, mirrored for the cadence) and (2) never show an
// approximate address as a link to a page.

const goto = (i: number) => `https://google.com/goto?url=CAES${i}`;
const row = (o: Partial<RankHistoryRow> & { snapshot_json?: string }): RankHistoryRow =>
  ({
    id: 1,
    createdAt: 'x',
    updatedAt: 'x',
    ladder_id: 'lad_1',
    keyword: 'erp software uae',
    checked_at: '2026-10-29T01:10:00.000Z',
    position: 9,
    url: 'https://www.techand.ai/erp/',
    serp_features: '',
    domain: 'techand.ai',
    rung: 4,
    device: 'desktop',
    ...o,
  }) as RankHistoryRow;
const clean = row({ snapshot_json: JSON.stringify({ at: '2026-10-29T01:10:00Z', device: 'desktop', top: [{ p: 1, u: 'https://www.sage.com/en-ae/erp/', t: 'Sage' }, { p: 2, u: 'https://www.brainsphereit.com/page-tag/x/', t: 'B' }] }) });
const poisoned = row({
  checked_at: '2026-11-05T01:12:00.000Z',
  position: 0,
  url: '',
  snapshot_json: JSON.stringify({ at: '2026-11-05T01:12:00Z', device: 'desktop', top: [1, 2, 3].map((p) => ({ p, u: goto(p), t: 'x' })) }),
});

describe('SERP-GOTO: the cadence mirror skips readings stored with Google redirect links', () => {
  it('a stored reading whose top list holds google.com/goto links is poisoned; a clean one is not', () => {
    expect(poisonedRow(poisoned)).toBe(true);
    expect(poisonedRow(clean)).toBe(false);
    expect(poisonedRow(row({ snapshot_json: JSON.stringify({ top: [{ p: 1, u: 'https://support.google.com/webmasters/answer/1' }] }) }))).toBe(false);
  });
  it('the baseline is the reading before the poisoned one, so google.com never becomes a results-page host', () => {
    const h = prevReading([clean, poisoned], { keyword: 'erp software uae', domain: 'techand.ai', before: '2026-11-08T00:00:00Z', withSnapshot: true });
    expect(h?.checked_at).toBe('2026-10-29T01:10:00.000Z');
    expect(serpHosts(h!, 10)).toEqual(['sage.com', 'brainsphereit.com']);
  });
});

describe('SERP-GOTO: an approximate address is shown as its site, never as a link', () => {
  it('x: 1 rows keep their title and host with no url; bare redirects are dropped; exact rows are unchanged', () => {
    const top = snapTop([
      { p: 1, u: 'https://www.sage.com/en-ae/erp', t: 'Sage ERP', x: 1 },
      { p: 2, u: 'https://www.switchertechno.com/erp-software-uae/', t: 'Switcher' },
      { p: 3, u: goto(3), t: 'hidden' },
    ]);
    expect(top).toEqual([
      { position: 1, url: '', title: 'Sage ERP', host: 'sage.com', approximate: true },
      { position: 2, url: 'https://www.switchertechno.com/erp-software-uae/', title: 'Switcher' },
    ]);
  });
  it('serpReading applies the same rule to the stored snapshot', () => {
    const r = serpReading([
      row({
        checked_at: '2026-11-09T01:10:00.000Z',
        features_json: JSON.stringify({ unavailable: false, error: '', checked_at: '2026-11-09T01:10:00Z', types: ['organic'], local_pack: { shown: true, ours: null } }),
        competitors_json: JSON.stringify({ our_position: 9, above: [], competitors: [], method: 'modelled' }),
        snapshot_json: JSON.stringify({ at: '2026-11-09T01:10:00Z', device: 'desktop', top: [{ p: 1, u: 'https://odooerp.ae/', t: 'Odoo ERP', x: 1 }] }),
      } as Partial<RankHistoryRow>),
    ]);
    expect(r?.snapshot.top).toEqual([{ position: 1, url: '', title: 'Odoo ERP', host: 'odooerp.ae', approximate: true }]);
  });
});
