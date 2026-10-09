import { describe, expect, it } from 'vitest';
import { LINK_IMPORT_PAGES_PER_DOMAIN, importDate, parseCsv, parseLinkImport } from './link-import';

describe('parseCsv', () => {
  it('reads quotes, escaped quotes, CRLF and a BOM', () => {
    expect(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n')).toEqual([['a', 'b'], ['x, y', 'say "hi"']]);
  });
  it('detects semicolons and tabs', () => {
    expect(parseCsv('a;b\n1;2')).toEqual([['a', 'b'], ['1', '2']]);
    expect(parseCsv('a\tb\n1\t2')).toEqual([['a', 'b'], ['1', '2']]);
  });
});

describe('importDate', () => {
  it('reads the forms Search Console and other tools export', () => {
    expect(importDate('2026-09-28')).toBe('2026-09-28');
    expect(importDate('Sep 28, 2026')).toBe('2026-09-28');
    expect(importDate('28 Sep 2026')).toBe('2026-09-28');
    expect(importDate('28/09/2026')).toBe('2026-09-28');
    expect(importDate('soon')).toBe('');
  });
});

describe('parseLinkImport', () => {
  it('Search Console "Latest links": linking page + last crawled; own pages dropped', () => {
    const csv = 'Linking page,Last crawled\nhttps://peppol.org/members/full-members-list/,2026-09-28\nhttps://www.partnerdir.ae/uae/techand,2026-09-21\nhttps://techand.ai/blog/x,2026-09-20\n';
    const r = parseLinkImport(csv, 'techand.ai');
    expect(r.source).toBe('gsc_latest');
    expect(r.rows.map((x) => x.ref_domain)).toEqual(['peppol.org', 'partnerdir.ae']);
    expect(r.rows[0]!.last_crawled).toBe('2026-09-28');
    expect(r.skipped).toBe(1);
    expect(r.domains).toBe(2);
  });
  it('works with headers in another language (found by content)', () => {
    const csv = 'Página de enlace,Último rastreo\nhttps://blog.example.es/erp,28 Sep 2026\n';
    const r = parseLinkImport(csv, 'techand.ai');
    expect(r.source).toBe('gsc_latest');
    expect(r.rows[0]).toMatchObject({ ref_domain: 'blog.example.es', last_crawled: '2026-09-28' });
  });
  it('"More sample links": a single URL column', () => {
    const r = parseLinkImport('Linking page\nhttps://a.example.com/1\nhttps://b.example.org/2\n', 'techand.ai');
    expect(r.source).toBe('gsc_sample');
    expect(r.rows).toHaveLength(2);
  });
  it('"Top linking sites": domains with counts', () => {
    const r = parseLinkImport('Site,Linking pages,Target pages\npeppol.org,3,1\nwww.zawya.com,1,1\ntechand.ai,9,9\n', 'techand.ai');
    expect(r.source).toBe('gsc_sites');
    expect(r.rows.map((x) => [x.ref_domain, x.links])).toEqual([['peppol.org', 3], ['zawya.com', 1]]);
  });
  it('another tool export (Ahrefs Webmaster Tools style): linking page, target, anchor', () => {
    const csv = '"Referring page title","Referring page URL","Domain rating","Target URL","Anchor"\n"Peppol members","https://peppol.org/members/","72","https://techand.ai/","techand.ai"\n';
    const r = parseLinkImport(csv, 'techand.ai');
    expect(r.source).toBe('csv');
    expect(r.rows[0]).toMatchObject({ ref_domain: 'peppol.org', to_url: 'https://techand.ai/', anchor: 'techand.ai' });
  });
  it(`keeps at most ${LINK_IMPORT_PAGES_PER_DOMAIN} pages per linking site, newest first, no duplicates`, () => {
    const lines = Array.from({ length: 9 }, (_, i) => `https://big.example.com/p${i},2026-09-${String(10 + i).padStart(2, '0')}`);
    const r = parseLinkImport('Linking page,Last crawled\n' + lines.join('\n') + '\n' + lines[0], 'techand.ai');
    expect(r.rows).toHaveLength(LINK_IMPORT_PAGES_PER_DOMAIN);
    expect(r.rows[0]!.from_url).toBe('https://big.example.com/p8');
    expect(r.skipped).toBe(5);
  });
  it('refuses the "Top linked pages" table (own pages only) with a clear message', () => {
    expect(() => parseLinkImport('Target page,Incoming links\nhttps://techand.ai/,5\nhttps://techand.ai/a,2\n', 'techand.ai')).toThrow(/your own pages/);
  });
  it('refuses a file without links to the site', () => {
    expect(() => parseLinkImport('Name,Count\nfoo,1\n', 'techand.ai')).toThrow(/No column/);
    expect(() => parseLinkImport('only a header\n', 'techand.ai')).toThrow(/no rows/);
  });
});
