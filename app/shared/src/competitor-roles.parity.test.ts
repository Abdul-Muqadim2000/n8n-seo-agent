import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CMP, competitorList, competitorRole, isRetiredProspect, leftOutWords, splitAiNamed } from './competitor-roles';

// CR17-F (2026-11-17, client report C5): ONE competitor role classifier. The app's module (competitor-roles.generated.js, written by
// build_v4.py through competitor_roles_app.py) must be the engine's kit (n8n/seo-agent/v5/code/_competitors.js) byte for byte and answer every
// case below exactly as the kit does. The kit is evaluated straight from the engine folder, so a kit change without a rebuild fails this suite.

const here = dirname(fileURLToPath(import.meta.url));
const ENGINE = join(here, '../../../n8n/seo-agent');
const KIT_SRC = readFileSync(join(ENGINE, 'v5/code/_competitors.js'), 'utf8').replace(/\n+$/, '');
const GENERATED = readFileSync(join(here, 'competitor-roles.generated.js'), 'utf8');
const KIT = new Function(KIT_SRC + '\nreturn CMP;')() as typeof CMP;

const DEVAICON = { domain: 'devaicon.com', services: ['Open edX Services', 'Custom AI Solutions', 'AI Automation', 'Custom Software Development'] };
const TECHAND = { domain: 'techand.ai', services: ['Dynamics 365 Business Central', 'Dynamics 365 Finance & Operations', 'UAE e-invoicing (Peppol)'] };
const HOSTS = ['linkedin.com', 'clutch.co', 'edx.org', 'programs.edx.org', 'github.com', 'brandmentions.pk', 'openedx.org', 'microsoft.com', 'learn.microsoft.com',
  'microsoftpartners.microsoft.com', 'sap.com', 'salesforce.com', 'oracle.com', 'hubspot.com', 'zapier.com', 'make.com', 'centralbank.ae', 'edly.io', 'raccoongang.com',
  'code-brew.ae', 'softhat.pk', 'datax.pk', 'techgropse.ae', 'accenture.com', 'u.ae', 'ai.gov.ae', 'bebee.com', 'devaicon.com', 'not a host'];

describe('the app runs the engine\'s competitor role kit', () => {
  it('competitor-roles.generated.js is _competitors.js unchanged (rebuild with python3 build_v4.py when this fails)', () => {
    expect(GENERATED.includes(KIT_SRC)).toBe(true);
  });
  it('the same role for every host, for both production clients', () => {
    for (const site of [DEVAICON, TECHAND])
      for (const h of HOSTS) expect(CMP.role(h, { own_domain: site.domain, services: site.services })).toEqual(KIT.role(h, { own_domain: site.domain, services: site.services }));
  });
  it('the client report hosts get their real role', () => {
    const r = (h: string, s = DEVAICON) => competitorRole(h, s).role;
    expect(r('linkedin.com')).toBe('also_ranks');
    expect(r('clutch.co')).toBe('listing');
    expect(r('edx.org')).toBe('also_ranks');
    expect(r('github.com')).toBe('also_ranks');
    expect(r('brandmentions.pk')).toBe('listing');
    expect(r('openedx.org')).toBe('your_platform');
    expect(r('openedx.org', TECHAND)).toBe('software');
    expect(r('microsoft.com', TECHAND)).toBe('your_platform');
    expect(r('sap.com')).toBe('software');
    expect(r('salesforce.com')).toBe('software');
    expect(r('centralbank.ae')).toBe('authority');
    for (const h of ['edly.io', 'raccoongang.com', 'code-brew.ae', 'softhat.pk', 'datax.pk', 'techgropse.ae']) expect(r(h)).toBe('competitor');
  });
  it('the client\'s own word wins', () => {
    expect(competitorRole('edly.io', { ...DEVAICON, notCompetitors: ['edly.io'] }).role).toBe('not_competitor');
    expect(competitorRole('linkedin.com', { ...DEVAICON, chosen: ['linkedin.com'] }).role).toBe('competitor');
  });
  it('one competitor list: Site settings + chosen - not a competitor', () => {
    const l = competitorList({ domain: 'devaicon.com', declared: ['edly.io'], kiRows: [{ compDomain: 'competenza.ae', status: 'chosen' }, { compDomain: 'edly.io', status: 'dismissed', statusBy: 'user' }, { compDomain: 'sisgain.ae', status: 'watch' }], notCompetitors: [] });
    expect(l.list).toEqual(['competenza.ae']);
    expect(l.removed).toContain('edly.io');
  });
  it('AI visibility splits competitors from software makers', () => {
    const s = splitAiNamed([{ domain: 'sap.com' }, { domain: 'edly.io' }, { domain: 'AIdeology' }, { domain: 'clutch.co' }], DEVAICON);
    expect(s.competitors.map((x) => x.domain)).toEqual(['edly.io', 'AIdeology']);
    expect(s.software.map((x) => x.domain)).toEqual(['sap.com']);
    expect(s.other.map((x) => x.domain)).toEqual(['clutch.co']);
  });
  it('left-out words never say "competing" for a non-competitor', () => {
    for (const c of ['listing', 'your_platform', 'software']) expect(leftOutWords(c)).not.toMatch(/competing/);
    expect(leftOutWords('competitor')).toMatch(/competitor/);
    expect(leftOutWords('')).toBe('');
    for (const w of Object.values(CMP.LEFT_OUT)) expect(w).not.toMatch(/[—“”…]/);
  });
  it('a retired prospect', () => {
    expect(isRetiredProspect({ retired_at: '2026-11-17T00:00:00.000Z' })).toBe(true);
    expect(isRetiredProspect({ retired_at: '' })).toBe(false);
    expect(isRetiredProspect(null)).toBe(false);
  });
});
