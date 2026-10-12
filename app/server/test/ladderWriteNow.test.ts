import { describe, expect, it } from 'vitest';
import type { LadderRow } from '@seo/shared';
import { ladderPageContext } from '../src/services/runs';

// P2-7 (Phase 2 live check, 2026-10-12): "Write now" for the main page of the "erp software uae" ladder wrote 3,864 words although the
// ladder's verdict had asked for a service page of about 2,100 — the run has no competitor analysis and no verdict of its own, so nothing
// remembered that number. The ladder row stores it (`target_words`) and the body carries it to the engine as `ladder_words`, where
// *Parse Brief* clamps the brief to it.

const lad = (o: Partial<LadderRow>) =>
  ({
    ladder_id: 'lad_mv40b6s9h5a8', domain: 'techand.ai', head_keyword: 'erp software uae', keyword: '', rung: 1, page_no: 1,
    supporting: '', page_type: 'Service Page', target_url: '', page_exists: false, status: 'planned', months: '1-2', start_date: '',
    country: 'United Arab Emirates', location_code: 2784, language_code: 'en', email: '', callback_url: '', request_id: '',
    ...o,
  }) as LadderRow;

const ROWS: LadderRow[] = [
  lad({ rung: 4, page_no: 4, keyword: 'erp software uae', target_url: 'https://www.techand.ai/erp-software-uae/', status: 'writing', target_words: 2100 }),
  lad({ rung: 1, page_no: 1, keyword: 'best erp software in dubai', target_url: 'https://www.techand.ai/best-erp-software-in-dubai/' }),
  lad({ rung: 1, page_no: 2, keyword: 'erp software dubai', target_url: 'https://www.techand.ai/erp-software-dubai/' }),
];

describe('the "Write now" body of a ladder page', () => {
  it('carries the word count the ladder verdict set for the main page', () => {
    const { targetWords, links } = ladderPageContext(ROWS, 4, 'erp software uae');
    expect(targetWords).toBe(2100);
    expect(links.map((l) => [l.role, l.path])).toEqual([
      ['down', '/best-erp-software-in-dubai/'],
      ['down', '/erp-software-dubai/'],
    ]);
  });

  it('gives a rung page its own target, and the main page\'s when it has none', () => {
    expect(ladderPageContext(ROWS, 1, 'erp software dubai').targetWords).toBe(2100);
    const own = ROWS.map((r) => (r.keyword === 'erp software dubai' ? { ...r, target_words: 1400 } : r));
    expect(ladderPageContext(own, 1, 'erp software dubai').targetWords).toBe(1400);
    // the links of a rung page are unchanged: up to the main page, sideways to one sibling
    expect(ladderPageContext(ROWS, 1, 'erp software dubai').links.map((l) => l.role)).toEqual(['top', 'sibling']);
  });

  it('sends no target when the rows have none (a ladder planned before P2-7) or the number is not a page length', () => {
    const old = ROWS.map(({ target_words: _drop, ...r }) => r as LadderRow);
    expect(ladderPageContext(old, 4, 'erp software uae').targetWords).toBe(0);
    for (const bad of [0, 12, 290, 6001, Number.NaN]) {
      const rows = ROWS.map((r) => (Number(r.rung) === 4 ? { ...r, target_words: bad } : { ...r, target_words: 0 }));
      expect(ladderPageContext(rows, 4, 'erp software uae').targetWords).toBe(0);
    }
  });
});
