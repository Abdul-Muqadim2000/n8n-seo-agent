import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { aiCompareInterim, type AiCompare } from '@seo/shared';
import { AiDelta, aiHeadline, compareNote } from '@/pages/site/_components/ai-compare';
import { addedMessage } from '@/pages/site/_components/ai-panel';
import { pulseAskedLabel } from '@/pages/site/AiVisibilityPage';
import { reportVerdict } from '@/components/reports/ai';

// F3 (2026-10-23, n8n/seo-agent/docs/ai-visibility-2026-10-23/APP_AUDIT.md): the web halves of A1 A3 A7 A14.

const notComparable: AiCompare = { source: 'app', ruleVersion: 'x', comparable: false, reason: 'Not compared with 2026-10-12: only 7% of the questions asked now were asked then, a different panel, not a different result.', previousRunId: 'p', previousAt: '2026-10-12T07:00:00Z', panelOverlap: 0.07, enginesSame: true, window: null, metrics: {} };
const side = (rate: number, at: string) => ({ runId: at, checkedAt: at, prompts: 50, samples: 400, mentionRate: rate, citationRate: 2, shareOfVoice: 5, visibilityScore: 10, avgRank: 2, engines: ['chatgpt'], questionIds: ['a', 'b'] });

describe('A1: the headline and the arrows', () => {
  it('a changed panel: no up / down in the H1, no arrow, and the reason in the note', () => {
    expect(aiHeadline(3.1, notComparable)).toBe("You're named in 3.1% of AI answers");
    expect(renderToString(<AiDelta compare={notComparable} metric="named_rate" />)).toBe('');
    expect(compareNote(notComparable, (x) => x)).toMatch(/different panel/);
  });
  it('a comparable, tested change is drawn; a change within noise is greyed and says so', () => {
    const real = aiCompareInterim(side(30, '2026-10-19T07:00:00Z'), side(20, '2026-10-12T07:00:00Z'));
    expect(aiHeadline(30, real)).toBe("You're named in 30% of AI answers, up 10.0 pts");
    const noise = aiCompareInterim(side(21, '2026-10-19T07:00:00Z'), side(20, '2026-10-12T07:00:00Z'));
    expect(aiHeadline(21, noise)).toBe("You're named in 21% of AI answers, no real change");
    expect(renderToString(<AiDelta compare={noise} metric="named_rate" />)).toContain('within noise');
    expect(renderToString(<AiDelta compare={real} metric="share_of_voice" />)).toContain('not tested');
  });
});

describe('A3: the add message follows the panel size', () => {
  it('within the size, and past it', () => {
    expect(addedMessage(2, 10, 50)).toBe('2 questions added. They are asked from the next weekly run');
    expect(addedMessage(200, 0, 50)).toMatch(/150 of your questions are over your panel size of 50/);
  });
});

describe('A7: a pulse morning that did not ask the whole panel is marked', () => {
  it('sample, partial, too few', () => {
    expect(pulseAskedLabel({ date: '2026-10-20', samples: 9, mentionRate: 33, citationRate: 0, shareOfVoice: 0, visibilityScore: 0, alerts: [], sampleMode: 'sample', questionsAsked: 100, panelSize: 200, partial: true, enough: false }))
      .toBe('sample of 100 of 200 · partial: an engine returned nothing · too few answers for a rate');
    expect(pulseAskedLabel({ date: '2026-10-20', samples: 90, mentionRate: 3, citationRate: 0, shareOfVoice: 0, visibilityScore: 0, alerts: [] })).toBe('-');
  });
});

describe('A14: a report change carries its own verdict', () => {
  it('per figure, with the headline fallback', () => {
    expect(reportVerdict({ significant: true })).toBe('real');
    expect(reportVerdict({ significant: false })).toBe('noise');
    expect(reportVerdict(undefined, true)).toBe('real');
    expect(reportVerdict(undefined)).toBe('untested');
  });
});
