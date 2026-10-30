import { describe, expect, it } from 'vitest';
import { renderReport, report, text } from './renderReport';

// W0-D (page-quality 2026-10-29): a page the engine held for the client's OK before writing. The report says so, gives the reasons and the
// three ways forward (improve the page the website has, the search the verdict recommends, "Write it anyway" with hold_ack), and never
// offers "Write this page" again (it would only be held again). A page the autopilot wrote under the trial check says what it found.

const HOLD = {
  score: 42, threshold: 50, kinds: ['score', 'duplicate'], mode: 'enforce', held: true,
  reasons: ['Our verdict scored "ms 365 erp" 42 out of 100, under the 50 we write without asking: Search volume is 10 a month.', 'Your website already has a page aimed at this search: https://www.novaand.example/dynamics-365-business-central-uae. A second page would compete with it for the same search; improving that page is usually the faster way up.'],
  alternatives: [
    { kind: 'improve', label: 'Improve the existing page', url: 'https://www.novaand.example/dynamics-365-business-central-uae', keyword: 'ms 365 erp', why: 'your website already has this page for the search: a refresh keeps its address and what it has already earned' },
    { kind: 'retarget', label: 'Use the recommended target', keyword: 'Microsoft Dynamics 365 ERP implementation partner UAE', page_type: 'Service Page', why: 'the verdict recommends this search instead of "ms 365 erp"' },
  ],
  duplicates: [{ url: 'https://www.novaand.example/dynamics-365-business-central-uae', title: 'Business Central ERP Solutions in UAE' }],
  rule: 'A page waits for your OK when our verdict scores its keyword under 50 out of 100, or when your website already has a page for the same search.',
  next: 'Nothing was written and only the check was charged.',
};
const held = { keyword: 'ms 365 erp', verdict: 'GO_WITH_CHANGES', score: 42, recommended_page: 'Service Page', country: 'United Arab Emirates', markdown: null, html: null, reasons: ['Search volume is 10 a month.'], hold: HOLD, hold_shadow: null, verdict_acknowledged: false };

describe('a page held for your OK', () => {
  const html = renderReport(report('content', held));
  const t = text(html);
  it('says it waits for the client, with the score, the reasons and the page the website already has', () => {
    expect(t).toContain('Needs your OK: "ms 365 erp" scored 42');
    expect(t).toContain('Nothing was written and only the check was used');
    expect(t).toContain('Business Central ERP Solutions in UAE');
    expect(t).toContain('under 50 out of 100');
  });
  it('offers the three ways forward and not "Write this page"', () => {
    expect(t).toContain('Improve the existing page');
    expect(t).toContain('Use the recommended target');
    expect(t).toContain('Write it anyway');
    expect(t).not.toContain('Write this page');
  });
  it('"Write it anyway" opens the page form with the acknowledgement; the others with the existing page or the recommended search', () => {
    // the page form's link carries its values as base64 JSON (lib/utils.ts encodePrefill)
    const links = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&')).filter((l) => l.includes('/tools/keyword')).map((l) => {
      const q = new URLSearchParams(l.slice(l.indexOf('?') + 1)).get('prefill') ?? '';
      return '/tools/keyword ' + (q ? decodeURIComponent(escape(atob(q))) : '');
    });
    expect(links.some((l) => /\/tools\/keyword/.test(l) && /"holdAck":\{"score":42\}/.test(l) && /"keyword":"ms 365 erp"/.test(l))).toBe(true);
    expect(links.some((l) => /\/tools\/keyword/.test(l) && /"existingPageUrl":"https:\/\/www\.novaand\.example\/dynamics-365-business-central-uae"/.test(l))).toBe(true);
    expect(links.some((l) => /\/tools\/keyword/.test(l) && /Microsoft Dynamics 365 ERP implementation partner UAE/.test(l))).toBe(true);
  });
  it('keeps the house copy rules', () => {
    const own = t.slice(t.indexOf('Needs your OK'));
    expect(own).not.toMatch(/[–—…]/);
  });
});

// a page the autopilot wrote under the trial check renders its article (a browser-only viewer), so its note is covered by the shared
// reader (shared/src/hold.test.ts: a shadow hold is not held) and by the engine's own scenario (harness W0D2 / W0D9)
