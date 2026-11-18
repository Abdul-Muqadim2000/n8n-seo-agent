// CR17 CodeQL fix (PR #71, js/bad-tag-filter): the prerender's visible-text reader drops a script or style block in any case, with
// attributes, and with the end tags browsers accept ("</script >", "</SCRIPT foo>"); React's own lowercase output reads as before.
import { describe, expect, it } from 'vitest';
import { visibleText } from '@/marketing/seo/document';

describe('visibleText', () => {
  it('reads our own rendered markup as before', () => {
    const html = '<main><h1>Rank in search</h1><script type="application/ld+json">{"@type":"Organization"}</script><style>.a{color:red}</style><p>Get recommended by AI &amp; more.</p></main>';
    expect(visibleText(html)).toBe('Rank in search Get recommended by AI more.');
  });
  it('drops script and style blocks however their tags are written', () => {
    for (const html of ['<p>a</p><SCRIPT>x()</SCRIPT><p>b</p>', '<p>a</p><script src="x.js"></script ><p>b</p>', '<p>a</p><script>x()</script foo="bar"><p>b</p>', '<p>a</p><Style media="all">.x{}</STYLE><p>b</p>'])
      expect(visibleText(html), html).toBe('a b');
  });
  it('a long page reads fast', () => {
    const big = '<p>word</p>'.repeat(20_000) + '<script>' + 'x'.repeat(50_000) + '</script>';
    const t0 = performance.now();
    visibleText(big);
    expect(performance.now() - t0).toBeLessThan(200);
  });
});
