import { describe, expect, it } from 'vitest';
import { googleReadingLine, googleResultLines, googleSearchLink } from './ladders';

// Production 2026-11-11 (devaicon.com, ladder "ai automation services pakistan"): "Not in the top 50" while the client's own Google showed the
// blog post on page one. A fresh neutral reading (Pakistan and Lahore, desktop and mobile, 100 results, 2026-11-11) put the page at #59 to #64
// for its rung keyword "ai in industrial automation", so our reading was right; what the client lacked was what our check saw and the same
// search to open. Client names anonymised (novaand-demo.com).

describe('the same search on Google', () => {
  it('the market\'s own Google, its country and language, personalised results asked off', () => {
    expect(googleSearchLink('ai in industrial automation', 'PK')).toBe('https://www.google.com.pk/search?q=ai+in+industrial+automation&hl=en&gl=pk&pws=0');
    expect(googleSearchLink('erp & crm uae', 'ae', 'EN')).toBe('https://www.google.ae/search?q=erp+%26+crm+uae&hl=en&gl=ae&pws=0');
  });
  it('unknown market: google.com and no country; no keyword: no link', () => {
    expect(googleSearchLink('open edx', 'ZZ')).toBe('https://www.google.com/search?q=open+edx&hl=en&gl=zz&pws=0');
    expect(googleSearchLink('open edx', '')).toBe('https://www.google.com/search?q=open+edx&hl=en&pws=0');
    expect(googleSearchLink('  ', 'PK')).toBe('');
  });
});

describe('the top results of a check, with the website marked', () => {
  const top = [
    { position: 2, url: '', title: 'What is Industrial AI?', host: 'ifs.com' },
    { position: 1, url: 'https://kaopiz.com/en/ai', title: 'How AI in Industrial Automation Transforms Businesses' },
    { position: 3, url: '', title: 'AI in Industrial Automation: A Practical Guide for Pakistan', host: 'blog.novaand-demo.com' },
    { position: 0, url: 'https://x.example/', title: 'no position' },
    { position: 4, url: '', title: 'no site', host: '' },
  ];
  it('sorted, site from the address or the host Google gave, a subdomain of ours is ours, nothing without a site or a position', () => {
    const lines = googleResultLines(top, 'www.novaand-demo.com');
    expect(lines.map((l) => [l.position, l.site, l.ours])).toEqual([
      [1, 'kaopiz.com', false],
      [2, 'ifs.com', false],
      [3, 'blog.novaand-demo.com', true],
    ]);
    expect(googleResultLines(top, 'novaand-demo.com', 2)).toHaveLength(2);
    // a site that only ends with our name is not ours
    expect(googleResultLines([{ position: 1, url: 'https://notnovaand-demo.com/', title: '' }], 'novaand-demo.com')[0].ours).toBe(false);
  });
});

describe('where the website was in the check', () => {
  it('computer, and the phone reading when one was bought', () => {
    expect(googleReadingLine({ position: 0 })).toBe('Your website in this check: not in the top 50 on a computer.');
    expect(googleReadingLine({ position: 7, mobile: { position: 0 } })).toBe('Your website in this check: #7 on a computer; on a phone not in the top 50.');
    expect(googleReadingLine({ position: -1, mobile: { position: -1 } })).toBe('Your website in this check: could not be told on a computer.');
    expect(googleReadingLine({ position: 0, depth: 100 })).toBe('Your website in this check: not in the top 100 on a computer.');
  });
  it('plain customer copy', () => {
    for (const t of [googleReadingLine({ position: 0, mobile: { position: 3 } }), googleReadingLine({ position: null })]) expect(t).not.toMatch(/[—–‘’“”…]/);
  });
});
