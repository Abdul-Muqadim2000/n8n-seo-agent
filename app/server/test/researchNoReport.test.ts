// Rehearsal 2026-10-20 (real engine): the automatic research (the free one at setup, the level-3 refresh) asks the engine for the keyword
// strategy only. With the discover schema's default `receiveReport: true` the engine also spawned a full keyword report on its own top
// pick ("crm system"), a second paid run under a run quoted free that nobody reads at setup.
import { describe, expect, it } from 'vitest';
import { buildN8nPayload } from '@seo/shared';
import { inputOf } from '../src/services/research';

const site = { id: '00000000-0000-4000-8000-000000000001', domain: 'example.ae', country: 'United Arab Emirates', business: 'CRM consulting', customers: 'Mid-size companies', businessFacts: '', goal: 'leads' } as never;

describe('automatic research asks for the keyword strategy only', () => {
  it('the setup research input has no keyword report', () => {
    expect(inputOf(site).receiveReport).toBe(false);
  });
  it('the engine body it becomes asks for no follow-up deliverable', () => {
    const body = buildN8nPayload(inputOf(site), { domain: 'example.ae' } as never, { email: '', callbackUrl: 'https://example.test/hook', requestId: 'r1' } as never);
    expect(body.mode).toBe('discover');
    expect(body.receive).toEqual([]);
  });
});
