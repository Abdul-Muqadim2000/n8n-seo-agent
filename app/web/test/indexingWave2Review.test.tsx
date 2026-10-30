import type { ReactNode } from 'react';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { buildIndexingData, type IndexPageRow, type IndexRunRow } from '@seo/shared';
import { GuideProvider } from '@/components/guide';
import { TooltipProvider } from '@/components/ui/overlay';
import { ThemeProvider } from '@/lib/theme';
import { Indexing } from '@/pages/site/IndexingPage';
import { DEFAULT_MONITORS, MonitorSettingsFields, SitemapAccessLine } from '@/components/site/MonitorSettingsFields';
import { text } from './renderReport';

// Index coverage wave 2 review (n8n/seo-agent/docs/indexing-2026-10-29/REVIEW_WAVE2.md), the web half: W1 the sitemap card promises a
// submission only when the engine says it will (`submit.will_submit`) and otherwise gives the engine's reason; W6 the sitemap switch only
// where it is saved (Website settings, Growth monitors); W7 a refusal is not read-only access; W10 the last read-only promises.

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

const D = 'novaand-demo.com';
const U = (p: string) => `https://${D}${p}`;
const RUN = '2026-10-30T06:00:00Z';
const props = { orgId: 'org-1', siteId: 'site-1', domain: D };
const rows: Partial<IndexPageRow>[] = [{ url: U('/whatwedo'), lane: 'existing', state: 'not_indexed', inspect_at: RUN, cause: 'unknown_to_google', action: 'wait', linked_by: JSON.stringify([U('/')]) }];
const run = (o: Record<string, unknown>): Partial<IndexRunRow> => ({ run_at: RUN, known: 1, inspected: 1, sitemaps_json: JSON.stringify({ submitted: 0, submitted_errors: 0, read: 1, complete: true, ...o }) });
const card = (o: Record<string, unknown>, submit = true) =>
  text(wrap(<Indexing d={buildIndexingData({ rows, runs: [run(o)], events: [], impacts: [], settings: { on: true, dailyCap: 300 }, sitemapSubmit: submit })} {...props} member />));
const PROMISE = 'We will submit it on the next daily check';
const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

describe('W1: the sitemap card promises a submission only when the engine will make it', () => {
  it('will_submit true: the promise; Full access alone (an older row): no promise, the step stays', () => {
    expect(card({ permission: 'siteFullUser', permission_full: true, submit: { on: true, gate: 'ok', will_submit: true, blocked: '' } })).toContain(PROMISE);
    const old = card({ permission: 'siteFullUser', permission_full: true });
    expect(old).not.toContain(PROMISE);
    expect(old).toContain('we will not submit it on the next daily check, so it stays a step for you under Steps on your website');
  });
  it('each reason in words, never the promise', () => {
    const at = (blocked: string, permission = 'siteFullUser') => card({ permission, submit: { on: true, will_submit: false, blocked } });
    const cases: [string, string][] = [
      ['no_sitemap', 'We could not read a sitemap on your website'],
      ['outside_property', 'outside the Search Console property we can read'],
      ['paused', 'paused on our side'],
      ['not_set_up', 'not set up on our side yet'],
      ['too_soon', 'We submitted your sitemap in the last 7 days'],
      ['unchanged', 'has not changed since it was last submitted'],
    ];
    for (const [b, words] of cases) {
      const t = at(b);
      expect(t, b).toContain(words);
      expect(t, b).not.toContain(PROMISE);
      expect(t, b).not.toMatch(/[—–…“”‘’]|will be indexed|we ask google/i);
    }
    // read-only access: the warning and the Full access guide
    const ro = at('not_full_access', 'siteRestrictedUser');
    expect(ro).toContain('Google gives us read-only access');
    expect(ro).toContain('Give us Full access');
    expect(ro).not.toContain(PROMISE);
  });
  it('the access line beside the switch says the reason when the switch is on', () => {
    const line = (info: Parameters<typeof SitemapAccessLine>[0]['info'], on = true) => text(wrap(<SitemapAccessLine info={info} domain={D} on={on} />));
    expect(line({ access: 'full', at: RUN, blocked: '' })).toContain('We can submit your sitemap');
    const paused = line({ access: 'full', at: RUN, blocked: 'paused' });
    expect(paused).not.toContain('We can submit your sitemap');
    expect(paused).toContain('Sitemap submission is paused on our side');
    // the switch off: no reason (nothing would be submitted anyway)
    expect(line({ access: 'full', at: RUN, blocked: 'paused' }, false)).not.toContain('paused');
  });
});

describe('W7: Google refused the submission at Full access', () => {
  it('says Google refused it, not read-only access, and does not send the client to give Full access', () => {
    const t = card({ permission: 'siteFullUser', permission_full: false, submit: { on: true, will_submit: false, blocked: 'refused' } });
    expect(t).toContain('Google refused our sitemap submission');
    expect(t).toContain('Google refused our last submission');
    expect(t).not.toContain('read-only');
    expect(t).not.toContain('Give us Full access');
    expect(t).not.toContain(PROMISE);
  });
});

describe('W6: the sitemap switch only where it is saved', () => {
  it('not in the onboarding / Start weekly tracking forms (they save through Track my site, which does not carry it)', () => {
    const fields = (sitemapSwitch?: boolean) =>
      text(wrap(<MonitorSettingsFields value={{ ...DEFAULT_MONITORS, indexWatch: true }} onChange={() => {}} domain={D} {...(sitemapSwitch ? { sitemapSwitch } : {})} />));
    expect(fields()).not.toContain('Let Alaventra submit your sitemap to Google');
    expect(fields(true)).toContain('Let Alaventra submit your sitemap to Google');
    expect(src('components/site/TrackingForm.tsx')).not.toContain('sitemapSwitch');
    expect(src('pages/site/SiteSettingsPage.tsx')).toMatch(/<MonitorSettingsFields[^>]*sitemapSwitch/);
  });
});

describe('W10: no read-only promise left', () => {
  it('the onboarding verify step and the website settings say the new sentence', () => {
    const SENTENCE = /We only read\s+your Search Console, unless you switch on sitemap submission, which lets us\s+submit your sitemap and nothing else\./;
    for (const f of ['pages/onboarding/_components/VerifyStep.tsx', 'pages/site/SiteSettingsPage.tsx']) {
      expect(src(f), f).toMatch(SENTENCE);
      expect(src(f), f).not.toMatch(/read-only service account|never change anything in your accounts/);
    }
    expect(src('marketing/content/features.ts')).not.toContain('it does not change your settings');
  });
});

describe('the engine\'s review-fix contract on the sitemap card', () => {
  it('could not read Search Console today: says so, no promise; a pending attempt is never "Submitted"', () => {
    const t = card({ submitted: null, permission: 'siteFullUser', permission_full: true, submit: { on: true, gate: 'list_not_read', will_submit: false, blocked: '' } });
    expect(t).toContain('We could not read your Search Console today');
    expect(t).not.toContain(PROMISE);
    const p = card({ submitted: 0, permission: 'siteFullUser', permission_full: true, submit: { on: true, gate: 'ok', will_submit: false, blocked: 'too_soon' }, submissions: [{ path: U('/sitemap.xml'), at: '2026-10-30T06:05:00Z', status: 'pending', reason: 'not_listed' }] });
    expect(p).toContain('Last attempt, not confirmed');
    expect(p).toContain('Search Console has not listed it since');
    expect(p).not.toMatch(/Submitted on|Google read your sitemap on/);
  });
});
