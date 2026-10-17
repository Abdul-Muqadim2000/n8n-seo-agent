import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import type { CrawlerData } from '@seo/shared';
import { guideById } from '@seo/shared/guides';
import { GuideProvider } from '@/components/guide';
import { TooltipProvider } from '@/components/ui/overlay';
import { ThemeProvider } from '@/lib/theme';
import { Crawlers } from '@/pages/site/CrawlersPage';
import { text } from './renderReport';

// The Crawlers page (gap #6, app/docs/LOG_ANALYTICS.md) renders from one answer: before any log, with data, and for a viewer.

const wrap = (node: ReactNode) =>
  renderToString(
    <ThemeProvider>
      <QueryClientProvider client={new QueryClient()}>
        <TooltipProvider>
          <GuideProvider>
            <MemoryRouter>{node}</MemoryRouter>
          </GuideProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );

const setup: CrawlerData['setup'] = {
  retentionDays: 30,
  push: { enabled: false, prefix: null, createdAt: null, lastPushAt: null, pushes24h: 0 },
  endpoint: 'https://app.example/api/ingest/logs/site-1',
  header: 'X-Ascentra-Log-Key',
  limits: { uploadMaxBytes: 1073741824, pushMaxBytes: 104857600, rollupDays: 400 },
  ranges: [{ id: 'openai-gptbot', label: 'GPTBot', url: 'https://openai.com/gptbot.json', fetchedAt: '2026-10-17T00:00:00Z', creationTime: '2026-09-22T02:00:07', prefixes: 18, error: '' }],
};
const empty: CrawlerData = {
  windowDays: 30,
  from: '2026-09-19',
  to: '2026-10-18',
  hasData: false,
  dataFrom: null,
  dataTo: null,
  totals: { hits: 0, search: 0, googlebot: 0, ai: 0, aiUser: 0, spoofed: 0, verifiedShare: null, uncheckedShare: null },
  bots: [],
  daily: [],
  coverage: { source: 'none', inventory: 0, inSitemap: 0, fetchedByGoogle: 0, fetchedByAi: 0, neverGoogle: [], neverAi: [], unknownToInventory: [], error: null },
  waste: { googleHits: 0, redirects: 0, clientErrors: 0, serverErrors: 0, paramHits: 0, share: null, top: [], paramPatterns: [] },
  newPages: [],
  aiDemand: [],
  responseTimes: [],
  spoofed: [],
  blocked: [],
  recommendations: [],
  setup,
  ingests: [],
};
const full: CrawlerData = {
  ...empty,
  hasData: true,
  dataFrom: '2026-10-10',
  dataTo: '2026-10-16',
  totals: { hits: 120, search: 80, googlebot: 70, ai: 40, aiUser: 6, spoofed: 9, verifiedShare: 0.92, uncheckedShare: 0.05 },
  bots: [
    { bot: 'googlebot', label: 'Googlebot', vendor: 'Google', kind: 'search', method: 'ip_list_dns', hits: 70, verified: 66, claimed: 0, unchecked: 4, spoofed: 7, pages: 40, s2xx: 60, s3xx: 5, s4xx: 3, s5xx: 2, paramHits: 4, assetHits: 10, avgMs: 140, lastSeen: '2026-10-16' },
    { bot: 'gptbot', label: 'GPTBot', vendor: 'OpenAI', kind: 'ai_training', method: 'ip_list', hits: 30, verified: 30, claimed: 0, unchecked: 0, spoofed: 2, pages: 20, s2xx: 30, s3xx: 0, s4xx: 0, s5xx: 0, paramHits: 0, assetHits: 0, avgMs: 90, lastSeen: '2026-10-15' },
    { bot: 'bytespider', label: 'Bytespider', vendor: 'ByteDance', kind: 'ai_training', method: 'none', hits: 4, verified: 0, claimed: 4, unchecked: 0, spoofed: 0, pages: 3, s2xx: 4, s3xx: 0, s4xx: 0, s5xx: 0, paramHits: 0, assetHits: 0, avgMs: null, lastSeen: '2026-10-12' },
  ],
  daily: [{ day: '2026-10-16', search: 10, ai_training: 5, ai_search: 1, ai_user: 2, seo_tool: 0, other: 0, spoofed: 1, googlebot: 9 }],
  coverage: { source: 'inventory', inventory: 3, inSitemap: 2, fetchedByGoogle: 1, fetchedByAi: 2, neverGoogle: [{ path: '/pricing', url: 'https://techand.ai/pricing', title: 'Pricing', clicks: 30, impressions: 400, lastGoogle: null, lastAi: '2026-10-15' }], neverAi: [], unknownToInventory: [{ path: '/old-landing', hits: 4, status: 200 }], error: null },
  waste: { googleHits: 70, redirects: 5, clientErrors: 3, serverErrors: 2, paramHits: 4, share: 0.2, top: [{ path: '/api/broken', reason: '5xx', hits: 2, status: 500 }], paramPatterns: [{ path: '/blog', keys: 'page,utm_source', hits: 4 }] },
  newPages: [{ path: '/blog/peppol', firstGoogle: '2026-10-14', firstAi: null, inInventory: true }],
  aiDemand: [{ path: '/pricing', hits: 5, bots: ['ChatGPT-User', 'Claude-User'], lastSeen: '2026-10-16' }],
  responseTimes: [{ bot: 'googlebot', label: 'Googlebot', avgMs: 140, hits: 70 }],
  spoofed: [{ bot: 'googlebot', label: 'Googlebot', hits: 7, networks: 2, topNetworks: ['45.133.1.0/24'] }],
  recommendations: [{ id: 'crawl-waste', tone: 'warning', title: 'Googlebot spends 20% of its requests on redirects, errors and parameter URLs', detail: 'Point internal links at the final URLs.', link: 'technical' }],
  setup: { ...setup, push: { enabled: true, prefix: 'asl_AbCdEfGh', createdAt: '2026-10-16T00:00:00Z', lastPushAt: '2026-10-18T08:00:00Z', pushes24h: 12 } },
  ingests: [{ id: 'i1', source: 'upload', fileName: 'access.log.gz', status: 'done', format: 'combined', bytes: 2048, stats: { lines: 25, malformed: 2, otherHost: 0, people: 3, bots: 20, duplicates: 0, verified: 15, spoofed: 3, claimed: 1, unchecked: 1, proxyAddresses: 1, firstAt: null, lastAt: null, samples: [] }, error: '', createdAt: '2026-10-16T10:00:00Z', finishedAt: '2026-10-16T10:00:02Z' }],
};
const props = { orgId: 'org-1', siteId: 'site-1', domain: 'techand.ai', onUpload: () => {} };

describe('Crawlers page', () => {
  it('before any log: three ways in, each with its guide, and the setup', () => {
    const t = text(wrap(<Crawlers d={empty} {...props} admin member />));
    expect(t).toContain('See what Google and the AI crawlers really fetch');
    for (const s of ['Upload an access log', 'Cloudflare Logpush', 'Vercel, Fastly or Akamai', 'Create push key', 'X-Ascentra-Log-Key', 'Keep each crawler request for']) expect(t).toContain(s);
    expect(t).not.toContain('NaN');
  });
  it('with data: headline, impostors apart, coverage gaps, budget, AI demand, recommendation links', () => {
    const html = wrap(<Crawlers d={full} {...props} admin member />);
    const t = text(html);
    expect(t).toContain('Googlebot asked for 70 pages; AI crawlers for 40 in 30 days');
    expect(t).toContain('92% of crawler requests were proved');
    expect(t).toContain('9 more only pretended to be a crawler');
    for (const s of ['Pages Googlebot did not fetch', '/pricing', 'Crawl budget Googlebot spent badly', '/api/broken', 'page,utm_source', 'ChatGPT-User, Claude-User', 'Impostors', '45.133.1.0/24', 'Claimed', 'Proved', '/old-landing', 'Key asl_AbCdEfGh… active', 'Replace the key', 'Delete all log data', 'Export CSV']) expect(t).toContain(s);
    expect(html).toContain('/o/org-1/sites/site-1/technical');
    expect(t).not.toContain('NaN');
    expect(t).not.toContain('undefined');
  });
  it('a viewer sees everything but cannot upload, create a key or delete', () => {
    const t = text(wrap(<Crawlers d={full} {...props} admin={false} member={false} />));
    expect(t).toContain('Members and admins upload logs.');
    expect(t).toContain('An admin creates the push key.');
    expect(t).not.toContain('Replace the key');
    expect(t).not.toContain('Delete all log data');
  });
  it('the three setup guides exist and name the real header', () => {
    for (const id of ['crawler-logs-upload', 'crawler-logs-cloudflare', 'crawler-logs-drain']) expect(guideById(id), id).toBeTruthy();
    expect(JSON.stringify(guideById('crawler-logs-cloudflare'))).toContain('header_{{logHeader}}');
  });
});
