// Rehearsal 2026-10-20 (real engine): two ladder plans for the client's own keyword came back NOT_CHECKED because DataForSEO's live
// Google results answered "Internal SE Server Error" on every attempt, and each was charged about 16 credits for nothing. A ladder plan
// that delivered nothing for that reason now ends the run as failed, which the cost sync never charges (and refunds, step 6).
import { describe, expect, it } from 'vitest';
import { noResultOf, runOutcome } from '../src/services/runs';

const refused = { stage: 'ladder_plan', planned: false, refusal: { reason: 'serp_unchecked', transient: true, attempts: 3 } };

describe('a run that delivered nothing because the external data could not be read is not charged', () => {
  it('a ladder plan refused for an unread results page ends as failed, with a plain reason', () => {
    const o = runOutcome('running', ['ladder_plan'], 'ladder_plan', refused);
    expect(o.status).toBe('failed');
    expect(o.error).toMatch(/no credits were used/);
    expect(o.error).not.toMatch(/[—–…‘’“”]/);
  });
  it('a planned ladder, or a refusal for another reason, completes as before', () => {
    expect(runOutcome('running', ['ladder_plan'], 'ladder_plan', { stage: 'ladder_plan', planned: true }).status).toBe('completed');
    expect(runOutcome('running', ['ladder_plan'], 'ladder_plan', { stage: 'ladder_plan', planned: false, refusal: { reason: 'duplicate' } }).status).toBe('completed');
    expect(noResultOf('content', refused)).toBeNull();
  });
  it('a run already failed is left alone', () => {
    expect(runOutcome('failed', ['ladder_plan'], 'ladder_plan', refused)).toEqual({});
  });
});
