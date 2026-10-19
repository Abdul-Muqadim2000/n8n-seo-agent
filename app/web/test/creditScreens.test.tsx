import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { autopilotRows, formatCredits } from '@seo/shared';
import { DEFAULT_MONITORS, MonitoringCost, MonitorSettingsFields } from '@/components/site/MonitorSettingsFields';
import { creditRefusalTitle } from '@/components/site/CreditRefusal';
import { GuideProvider } from '@/components/guide';
import { TooltipProvider } from '@/components/ui/overlay';
import { ThemeProvider } from '@/lib/theme';
import { ApiRequestError } from '@/lib/api';
import { toCredits } from '@/lib/credits';
import { PRICES } from '@/lib/prices';

// Credits (app/docs/CREDITS.md): the forms, settings, onboarding and website pages price everything in credits — no provider cost in
// dollars, no dollar "monthly budget". These tests hold the screens to it.

const SRC = join(__dirname, '..', 'src');
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
const SCREENS = ['pages/tools', 'pages/onboarding', 'components/site', 'pages/site', 'pages/settings/_components/ApiKeysTab.tsx', 'pages/settings/_components/integrations'];

const App = ({ children }: { children: ReactNode }) => (
  <ThemeProvider>
    <QueryClientProvider client={new QueryClient()}>
      <TooltipProvider>
        <GuideProvider>{children}</GuideProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

describe('prices in credits on the customer screens', () => {
  it('no form, setting, onboarding or website screen formats a cost in dollars', () => {
    const offenders: string[] = [];
    for (const s of SCREENS) {
      const p = join(SRC, s);
      for (const f of statSync(p).isDirectory() ? files(p) : [p]) {
        readFileSync(f, 'utf8')
          .split('\n')
          .forEach((line, i) => {
            if (/\bformatUsd\(|monthly budget|Raise the budget/i.test(line)) offenders.push(`${relative(SRC, f)}:${i + 1}`);
          });
      }
    }
    expect(offenders).toEqual([]);
  });

  it('every sentence price is a credit label', () => {
    for (const [k, fn] of Object.entries(PRICES)) {
      const label = k === 'pages' ? (fn as (n: number) => string)(2) : (fn as () => string)();
      expect(label, k).toMatch(/^[\d,.<]+ credits?$/);
    }
  });

  it("the schedules' card is autopilotRows in credits, with its total", () => {
    const html = renderToString(
      <App>
        <MonitoringCost monitors={DEFAULT_MONITORS} blogsPerWeek={2} />
      </App>,
    );
    const rows = autopilotRows(DEFAULT_MONITORS, 2);
    const total = toCredits(rows.reduce((t, r) => t + r.usd, 0));
    expect(html).toContain('Estimated credits a month');
    expect(html).toContain(formatCredits(total, { unit: false }));
    for (const r of rows) expect(html).toContain(r.label);
    expect(html).not.toMatch(/\$\s?\d/);
  });

  it('the monitor fields (AI panel, daily pulse) name no dollar figure', () => {
    const html = renderToString(
      <App>
        <MonitorSettingsFields value={{ ...DEFAULT_MONITORS, aiVisibility: true, aiPulse: true }} onChange={() => undefined} />
      </App>,
    );
    expect(html).toContain('credits');
    expect(html).not.toMatch(/\$\s?\d/);
  });

  it('a 402 is titled by the rule that refused it', () => {
    const e = (code: string, reason?: string) => new ApiRequestError(402, 'msg', {}, code, reason ? { reason } : {});
    expect(creditRefusalTitle(e('credits', 'balance'))).toBe('Not enough credits');
    expect(creditRefusalTitle(e('credits', 'reserve'))).toBe('These credits are kept for autopilot');
    expect(creditRefusalTitle(e('credits', 'on_demand_limit'))).toBe('Over your on-demand limit');
    expect(creditRefusalTitle(e('budget'))).toBe('Over your monthly usage limit');
  });
});
