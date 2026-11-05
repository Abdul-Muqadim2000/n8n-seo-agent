import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { runOverdueMinutes, type Run } from '@seo/shared';
import { TooltipProvider } from '@/components/ui/overlay';
import { RunProgress } from '@/components/reports/run';

// Prod 2026-11-05 (devaicon.com): a one-minute publish check read "Taking longer than usual. Large sites and busy AI models slow some
// steps" for 69 minutes while its engine host had been cut off. Past the moment the server starts asking the engine (the same
// runOverdueMinutes), the page says so plainly and what will happen next.
const accepted = '2026-11-04T08:25:00.000Z';
const at = (min: number) => Date.parse(accepted) + min * 60_000;
const pub = { id: 'r1', mode: 'published', status: 'accepted', etaMinutes: 1, createdAt: accepted, acceptedAt: accepted, input: { mode: 'published' } } as unknown as Run;
const text = (run: Run, now: number) =>
  renderToString(
    <TooltipProvider>
      <RunProgress run={run} now={now} />
    </TooltipProvider>,
  )
    .replace(/<[^>]+>/g, ' ')
    .replace(/<!-- -->/g, '')
    .replace(/\s+/g, ' ');

describe('a run that is taking far too long', () => {
  it('the overdue moment is three times the estimate, never under 10 minutes', () => {
    expect(runOverdueMinutes(1)).toBe(10);
    expect(runOverdueMinutes(15)).toBe(45);
    expect(runOverdueMinutes(0)).toBe(10);
    expect(runOverdueMinutes(null)).toBe(10);
  });

  it('a publish check 69 minutes in says the engine is being checked, not "busy AI models"', () => {
    const t = text(pub, at(69));
    expect(t).toContain('This is taking far longer than it should (usually about 1 min)');
    expect(t).toContain('started again for you where that is safe');
    expect(t).toContain('No credits are charged for a run that stopped');
    expect(t).not.toContain('Large sites and busy AI models');
  });

  it('a little late is only "taking longer than usual"; on time says nothing', () => {
    const late = text(pub, at(3));
    expect(late).toContain('Taking longer than usual');
    expect(late).not.toContain('far longer than it should');
    expect(text(pub, at(0.5))).not.toContain('longer than');
  });

  it('a 15-minute page run at 30 minutes is late, not overdue', () => {
    const page = { ...pub, mode: 'keyword', etaMinutes: 15, input: { mode: 'keyword' } } as unknown as Run;
    const t = text(page, at(30));
    expect(t).toContain('Taking longer than usual');
    expect(t).not.toContain('far longer than it should');
    expect(text(page, at(46))).toContain('far longer than it should');
  });
});
