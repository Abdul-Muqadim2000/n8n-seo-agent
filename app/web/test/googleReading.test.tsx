import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import type { LadderPage, SerpReading } from '@seo/shared';
import { GoogleReading } from '@/pages/site/_components/pipeline/climb';

// Production 2026-11-11 (devaicon.com): "Not in the top 50, but Google shows the first keyword on page one, as a blog post". A neutral reading
// put the post at #59 to #64; the page panel now shows what our check saw (top 10, the website marked), where the website was on a computer
// and a phone, and a link to the same search. Anonymised (novaand-demo.com).
const tell = /[—–‘’“”…]/;
const strip = (h: string) => h.replace(/<!-- -->/g, '').replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim();

const serp = (top: SerpReading['snapshot']['top'], mobile: SerpReading['mobile'] = { position: 0, checkedAt: '2026-11-08T19:38:43Z' }): SerpReading => ({
  features: { unavailable: false, checkedAt: '2026-11-08T19:38:43Z', aiOverview: { shown: true, citesUs: false, sourcesLoaded: true, citedDomains: [] }, featuredSnippet: { shown: false, ours: false, domain: '' }, peopleAlsoAsk: { shown: false, count: 0, questions: [] }, localPack: { shown: false, ours: null }, video: true, shopping: false, labels: [] },
  shareOfVoice: null, method: '', above: [], competitors: [], snapshot: { at: '2026-11-08T19:38:43Z', device: 'desktop', top }, mobile,
});
const page = (o: Partial<LadderPage>): LadderPage => ({ keyword: 'ai in industrial automation', rung: 2, pageNo: 1, pageType: 'Guide', state: 'published', targetUrl: '', publishedUrl: 'https://novaand-demo.com/insights/ai-in-industrial-automation', position: 0, previousPosition: 0, bestPosition: null, history: [], writtenAt: null, publishedAt: '2026-10-28T00:00:00Z', runId: null, reportId: null, volume: null, kd: null, supporting: [], ...o });
const ladder = { market: { country: 'Pakistan', iso: 'PK', siteCountry: 'Pakistan', note: '' } };

describe('what Google showed in our check, on the ladder page panel', () => {
  it('the top results with the website marked, the computer and phone reading, and the same search to open', () => {
    const top = [
      { position: 1, url: '', title: 'How AI in Industrial Automation Transforms Businesses', host: 'kaopiz.com', approximate: true },
      { position: 2, url: 'https://www.ifs.com/what-is-industrial-ai', title: 'What is Industrial AI?' },
    ];
    const html = renderToString(<GoogleReading page={page({ serp: serp(top) })} ladder={ladder} domain="novaand-demo.com" />);
    const t = strip(html);
    expect(t).toMatch(/^What Google showed in our check on .+ \(Google Pakistan, computer, not signed in\)/);
    expect(t).toContain('1 How AI in Industrial Automation Transforms Businesses (kaopiz.com)');
    expect(t).toContain('2 What is Industrial AI? (ifs.com)');
    expect(t).toContain('Your website in this check: not in the top 50 on a computer; on a phone not in the top 50.');
    expect(html).toContain('href="https://www.google.com.pk/search?q=ai+in+industrial+automation&amp;hl=en&amp;gl=pk&amp;pws=0"');
    expect(t).toContain('Use a private window');
    expect(t).not.toMatch(tell);
  });

  it('our own result is marked as the website', () => {
    const t = strip(renderToString(<GoogleReading page={page({ position: 3, serp: serp([{ position: 3, url: '', title: 'A Practical Guide', host: 'novaand-demo.com', approximate: true }], null) })} ladder={ladder} domain="www.novaand-demo.com" />));
    expect(t).toContain('3 A Practical Guide (novaand-demo.com, your website)');
    expect(t).toContain('Your website in this check: #3 on a computer.');
  });

  it('a place outside the blue links is named: the AI Overview citing the website', () => {
    const r = serp([]);
    r.features.aiOverview.citesUs = true;
    r.features.localPack.ours = true;
    expect(strip(renderToString(<GoogleReading page={page({ serp: r })} ladder={ladder} domain="novaand-demo.com" />))).toContain('Google also showed your website in the AI Overview and the map results of this search.');
  });

  it('never checked, or no stored reading: nothing', () => {
    expect(renderToString(<GoogleReading page={page({ position: null, serp: serp([]) })} ladder={ladder} domain="novaand-demo.com" />)).toBe('');
    expect(renderToString(<GoogleReading page={page({ serp: null })} ladder={ladder} domain="novaand-demo.com" />)).toBe('');
  });
});
