import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ReportSummaryLine } from '@/components/reports';
import { renderReport, report, text } from './renderReport';

// Report renderers against the payloads of the 2026-10-17 re-rating (executor D, part 6), cut to the fields each assertion needs.

// AI Growth exec 783 (report 6feb9b2e…): the first live run, a dry run
const growthDry = {
  dry_run: true,
  dry_run_note:
    'DRY RUN — nothing was submitted: 0 page(s) would have been sent to Bing and 0 notified through IndexNow (a test run; the weekly run submits)',
  submitted: { bing: { enabled: true, in_account: true, submitted: 0, urls: [] }, indexnow: { verified: false, submitted: 0 } },
  avg_score: 81,
  pages: [],
  earned: [],
  targets: [],
  actions: [],
  alerts: [],
};

describe('D-4: an AI Growth dry run reads as a dry run', () => {
  it('shows the engine’s dry-run note at the top and does not claim the week’s work was done', () => {
    const t = text(renderReport(report('ai_growth', growthDry)));
    expect(t).toContain('Dry run: nothing was submitted');
    expect(t).toContain('DRY RUN — nothing was submitted');
    expect(t).not.toContain('done for you this week');
    expect(t).toContain('dry run');
  });

  it('the weekly run still reads as before', () => {
    const t = text(renderReport(report('ai_growth', { ...growthDry, dry_run: false, dry_run_note: undefined })));
    expect(t).toContain('AI growth: done for you this week');
    expect(t).not.toContain('Dry run');
  });

  it('the list line says so (D-4)', () => {
    const r = report('ai_growth', growthDry, { summary: { dryRun: true, submitted: 0, avgScore: 81 } });
    expect(text(renderToString(<ReportSummaryLine report={r} />))).toContain('dry run: nothing submitted');
  });
});

describe('D-6: the ladder hero gives one duration', () => {
  // report 5 (00a0da6c…, exec 770 "it consulting dubai"): badge "Direct plan · 2–4 months", tile "Time to rank ~5 months"
  const plan = { keyword: 'it consulting dubai', planned: true, plan_type: 'direct', months: '2-4', stretch: false, difficulty_for_you: 'easy', head: { keyword: 'it consulting dubai', volume: 90, kd: 12 }, feasibility: { time_to_rank_months: 5, expected_visits_top3: 27, verdict: 'GO_WITH_CHANGES', score: 52 }, rungs: [], stats: {} };
  it("the time-to-rank tile shows the plan's range; the model's ~5 is only a note", () => {
    const t = text(renderReport(report('ladder_plan', plan)));
    expect(t).toMatch(/Time to rank\s*2–4 months/);
    expect(t).not.toMatch(/Time to rank\s*~\s*5 months/);
    expect(t).toContain("the writing model's own guess, not measured: ~5 months");
  });
  it('without a plan range the model estimate is shown, labelled', () => {
    const t = text(renderReport(report('ladder_plan', { ...plan, months: '' })));
    expect(t).toMatch(/Time to rank\s*~\s*5 months/);
  });
});

describe('D-13: what a started note and a page draft say in the app', () => {
  it('a started note says the report arrives here, not "at your callback" (reports 8 and 9)', () => {
    const summary =
      'Your AI visibility check for techand.ai has started: about 8 buyer questions are asked to ChatGPT, Perplexity, Gemini, Claude and Google AI Mode, and Google is checked for AI Overviews. The report (who AI recommends, which of your pages it cites, which sources it trusts, what to do) arrives at your callback in about 5-10 minutes.';
    const t = text(renderReport(report('ai_visibility_started', { status: 'accepted', summary, started: true, estimated_minutes: 10 })));
    expect(t).not.toContain('your callback');
    expect(t).toContain('arrives here in about 5-10 minutes');
    const withMail = text(renderReport(report('backlinks_started', { status: 'accepted', summary: 'Your backlink check has started. The report arrives at a@example.org and your callback in about 3-5 minutes.', started: true })));
    expect(withMail).toContain('arrives here and at a@example.org');
  });

  it("a page's images are listed as images (report 7: three .webp files)", () => {
    const files = [
      { id: 'f1', kind: 'image' as const, fileName: 'it-consulting-dubai-hero.webp', mimeType: 'image/webp', size: 48211, field: 'images[0]' },
      { id: 'f2', kind: 'pdf' as const, fileName: 'it-consulting-dubai-DRAFT.pdf', mimeType: 'application/pdf', size: 120000, field: 'pdf' },
    ];
    const t = text(renderReport(report('backlinks_started', { status: 'accepted', summary: 'x', started: true }, { files })));
    expect(t).toContain('Image');
  });
});
