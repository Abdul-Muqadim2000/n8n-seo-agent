import { describe, expect, it } from 'vitest';
import { fileKind, shownFileKind } from '../src/services/files';
import { toReport } from '../src/services/runs';
import { summarize, titleFor } from '../src/services/summaries';

// What the report list and the report page call a report, against the callbacks of the 2026-10-17 re-rating (executor D, part 6).

describe('D-4: an AI Growth dry run is titled as one', () => {
  const dry = { stage: 'ai_growth', domain: 'techand.ai', dry_run: true, dry_run_note: 'DRY RUN — nothing was submitted', submitted: { bing: { submitted: 0 }, indexnow: { submitted: 0 } } };
  it('title and summary say dry run', () => {
    expect(titleFor('ai_growth', dry)).toBe('AI growth · techand.ai (test run, nothing submitted)');
    expect(summarize('ai_growth', dry).dryRun).toBe(true);
  });
  it('the weekly run keeps its title', () => {
    expect(titleFor('ai_growth', { ...dry, dry_run: false })).toBe('AI growth · techand.ai');
    expect(summarize('ai_growth', { ...dry, dry_run: false }).dryRun).toBeUndefined();
  });
});

describe('D-13: report titles and file kinds', () => {
  it('a pulse day with no alert is not titled "alert" (report 12: 21 samples, 0 alerts)', () => {
    expect(titleFor('ai_pulse', { stage: 'ai_pulse', domain: 'techand.ai', alerts: [], samples: 21 })).toBe('AI pulse · techand.ai');
    expect(titleFor('ai_pulse', { stage: 'ai_pulse', domain: 'techand.ai', alerts: [{ level: 'warning', text: 'named less often' }] })).toBe('AI pulse alert · techand.ai');
  });

  it('a stored "AI pulse alert" over 0 alerts is shown as "AI pulse"', () => {
    const row = { id: 'r', runId: null, siteId: null, stage: 'ai_pulse', status: 'progress', title: 'AI pulse alert · techand.ai', summary: { alerts: 0, samples: 21 }, receivedAt: new Date('2026-10-17T16:35:31Z'), scheduled: true };
    expect(toReport(row, []).title).toBe('AI pulse · techand.ai');
    expect(toReport({ ...row, summary: { alerts: 2 } }, []).title).toBe('AI pulse alert · techand.ai');
  });

  it("a page's WebP images are images, also when stored as 'other' (report 7: three .webp files)", () => {
    expect(fileKind('it-consulting-dubai-hero.webp', 'image/webp')).toBe('image');
    expect(fileKind('photo.png', 'application/octet-stream')).toBe('image');
    expect(fileKind('diagram.svg', 'image/svg+xml')).toBe('other');   // SVG can carry script: a plain download
    expect(shownFileKind({ kind: 'other', fileName: 'it-consulting-dubai-hero.webp', mimeType: 'image/webp' })).toBe('image');
    expect(shownFileKind({ kind: 'pdf', fileName: 'x.pdf', mimeType: 'application/pdf' })).toBe('pdf');
  });
});
