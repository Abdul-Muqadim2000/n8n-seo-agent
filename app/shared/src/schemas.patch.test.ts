import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import * as schemas from './schemas';
import * as admin from './admin';
import * as cms from './cms';
import * as integrations from './integrations';
import { adminActionSchema, mailboxPatchSchema, patchOf, siteBusinessSchema, updateOrgSchema, updateSiteSchema } from './schemas';

// D1 (paid pre-launch run 2026-10-21): zod 4 applies an inner `.default()` to an ABSENT key after `.partial()`, so every partial PATCH
// reset the fields it did not send (the onboarding Tracking step wiped the business facts, a GA4 save in Website settings cleared them
// in the engine too). A PATCH body parses to exactly the keys that were sent.

describe('a partial PATCH parses to exactly the keys it was sent (D1)', () => {
  it('a website: the facts alone, the GA4 ID alone, the Tracking step body', () => {
    expect(updateSiteSchema.parse({ businessFacts: 'x' })).toEqual({ businessFacts: 'x' });
    expect(updateSiteSchema.parse({ ga4PropertyId: '123' })).toEqual({ ga4PropertyId: '123' });
    expect(updateSiteSchema.parse({ services: ['CRM implementation'] })).toEqual({ services: ['CRM implementation'] });
    const tracking = { keywords: ['crm uae'], ga4PropertyId: '', competitors: ['rival.com'], brandNames: ['Acme'] };
    expect(updateSiteSchema.parse(tracking)).toEqual(tracking);
    expect(updateSiteSchema.parse({})).toEqual({});
  });

  it('a mailbox: one setting changed sends no port, window or limit default', () => {
    expect(mailboxPatchSchema.parse({ windowStart: 9 })).toEqual({ windowStart: 9 });
    expect(mailboxPatchSchema.parse({ label: 'Sales' })).toEqual({ label: 'Sales' });
    expect(mailboxPatchSchema.parse({})).toEqual({});
  });

  it('a company and the monitor settings', () => {
    expect(updateOrgSchema.parse({ name: 'Acme' })).toEqual({ name: 'Acme' });
    const a = adminActionSchema.parse({ action: 'monitors', monitors: { aiPulse: false } });
    expect(a).toEqual({ action: 'monitors', monitors: { aiPulse: false } });
  });

  it('a CMS connection: a new label keeps the stored public URL template (found by the guard below)', () => {
    expect(cms.cmsConnectionUpdateSchema.parse({ label: 'Blog' })).toEqual({ label: 'Blog' });
    expect(cms.cmsConnectionUpdateSchema.parse({ publicUrlTemplate: '' })).toEqual({ publicUrlTemplate: '' });
    expect(cms.cmsConnectionUpdateSchema.safeParse({ publicUrlTemplate: 'http://x.com/blog' }).success).toBe(false);
  });

  it('every check of the create schema still applies: trim, lengths, the time zone, the domain list', () => {
    expect(updateSiteSchema.parse({ business: '  CRM  ' })).toEqual({ business: 'CRM' });
    expect(updateSiteSchema.safeParse({ business: 'x'.repeat(501) }).success).toBe(false);
    expect(updateSiteSchema.safeParse({ timezone: 'Mars/Base' }).success).toBe(false);
    expect(updateSiteSchema.parse({ timezone: 'Asia/Dubai' })).toEqual({ timezone: 'Asia/Dubai' });
    expect(updateSiteSchema.safeParse({ goal: 'nonsense' }).success).toBe(false);
    expect(updateSiteSchema.safeParse({ competitors: ['a.com', 'b.com', 'c.com', 'd.com'] }).success).toBe(false);
    expect(updateSiteSchema.parse({ competitors: ['https://www.Rival.com/x'] })).toEqual({ competitors: ['rival.com'] });
    expect(updateSiteSchema.safeParse({ keywords: Array.from({ length: 21 }, (_, i) => `k${i}`) }).success).toBe(false);
    expect(mailboxPatchSchema.safeParse({ smtpPort: 0 }).success).toBe(false);
    expect(mailboxPatchSchema.safeParse({ dailyMax: 51 }).success).toBe(false);
    expect(updateOrgSchema.safeParse({ name: 'A' }).success).toBe(false);
    expect(adminActionSchema.safeParse({ action: 'monitors', monitors: { aiPromptsMax: 1 } }).success).toBe(false);
  });

  it('the create schema itself keeps its defaults (only the PATCH drops them)', () => {
    const full = siteBusinessSchema.parse({ country: 'United States' });
    expect(full).toMatchObject({ business: '', goal: 'leads', competitors: [] });
    expect(patchOf(siteBusinessSchema).parse({ country: 'United States' })).toEqual({ country: 'United States' });
  });

  it('guard: every exported update / patch schema that accepts an empty body parses it to an empty body', () => {
    const all = { ...schemas, ...admin, ...cms, ...integrations } as Record<string, unknown>;
    const names = Object.keys(all).filter((n) => /(Patch|[Uu]pdate)\w*Schema$/.test(n) && all[n] instanceof z.ZodType);
    expect(names.length).toBeGreaterThanOrEqual(10);
    const filled: string[] = [];
    for (const n of names) {
      const r = (all[n] as z.ZodType).safeParse({});
      if (r.success && JSON.stringify(r.data) !== '{}') filled.push(`${n}: ${JSON.stringify(r.data)}`);
    }
    expect(filled).toEqual([]);
  });
});
