import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { contentReadiness, FACTS_MIN_CHARS, READINESS_LABELS, READINESS_REASON, readinessPage } from './readiness';

// The engine's rule (n8n/seo-agent/v5/code/_readiness.js) and this copy, held to each other on the same inputs: a drift fails here.
const here = dirname(fileURLToPath(import.meta.url));
const KIT = readFileSync(resolve(here, '../../../n8n/seo-agent/v5/code/_readiness.js'), 'utf8');
type Ready = { of: (o: unknown) => { ready: boolean; profile_ready: boolean; facts_ready: boolean; missing: { key: string; label: string }[]; missing_text: string }; FACTS_MIN: number; REASON: string };
const READY = new Function(`${KIT}\nreturn READY;`)() as Ready;

const AUTHOR = { author_name: 'Sara Haddad', author_job_title: 'Head of CRM delivery', author_bio: 'Leads the CRM delivery team.' };
const FACTS = 'Founded in 2015; 25 consultants; certified partner since 2017.';
const CASES: { profile: Record<string, string> | null; facts: string }[] = [
  { profile: null, facts: '' },
  { profile: AUTHOR, facts: FACTS },
  { profile: AUTHOR, facts: 'We do CRM.' },
  { profile: { ...AUTHOR, author_bio: '' }, facts: FACTS },
  { profile: { ...AUTHOR, author_job_title: '   ' }, facts: `  ${'x'.repeat(FACTS_MIN_CHARS)}  ` },
  { profile: { author_name: 'A' }, facts: 'y'.repeat(FACTS_MIN_CHARS - 1) },
  { profile: {}, facts: `${'word '.repeat(5)}   ${'word '.repeat(2)}` },
];

describe('content readiness (author profile + business facts before a written page)', () => {
  it('has the engine kit\'s minimum, labels and reason', () => {
    expect(FACTS_MIN_CHARS).toBe(READY.FACTS_MIN);
    expect(READINESS_REASON).toBe(READY.REASON);
    const all = READY.of({}).missing;
    expect(all.map((m) => m.key)).toEqual(Object.keys(READINESS_LABELS));
    expect(all.map((m) => m.label)).toEqual(Object.values(READINESS_LABELS));
  });

  for (const [i, c] of CASES.entries())
    it(`decides case ${i} exactly as the engine does`, () => {
      const e = READY.of({ profile: c.profile, facts: c.facts });
      const a = contentReadiness({ profile: c.profile, businessFacts: c.facts });
      expect([a.ready, a.profileReady, a.factsReady, a.missing, a.missingText]).toEqual([e.ready, e.profile_ready, e.facts_ready, e.missing.map((m) => m.key), e.missing_text]);
    });

  it('reads the app\'s own profile form shape too, and points at the right settings tab', () => {
    const r = contentReadiness({ profile: { author: { name: 'Sara', jobTitle: 'Lead', bio: 'Leads delivery.' } }, businessFacts: FACTS });
    expect(r.ready).toBe(true);
    const noFacts = contentReadiness({ profile: { author: { name: 'Sara', jobTitle: 'Lead', bio: 'Leads delivery.' } }, businessFacts: '' });
    expect([noFacts.missing, readinessPage(noFacts)]).toEqual([['business_facts'], 'settings/business']);
    const none = contentReadiness({ profile: null, businessFacts: '' });
    expect(readinessPage(none)).toBe('settings/profile');
    expect(none.missingText).toBe("your author's name, your author's job title, a short author bio and your business facts");
  });
});
