import { describe, expect, it } from 'vitest';
import { isShortCommaList, pasteHasSeveral, SERVICE_MAX_CHARS, SERVICE_SENTENCE_HINT, serviceEntryError, serviceLooksLikeSentence, splitListEntries } from './list-entries';
import { siteBusinessSchema, trackInput, updateSiteSchema } from './schemas';

// F-07 (prod review 2026-11-12): the onboarding form's "What do you sell?" cut services at commas and at 80 characters.
describe('splitListEntries', () => {
  it("'items' (domains, keywords) still splits at every comma, semicolon and new line", () => {
    expect(splitListEntries('a.example, b.example;c.example\nd.example')).toEqual(['a.example', 'b.example', 'c.example', 'd.example']);
  });

  it('a service name with a comma stays one entry', () => {
    expect(splitListEntries('Microsoft Dynamics 365 Business Central, implementation', 'phrases')).toEqual(['Microsoft Dynamics 365 Business Central, implementation']);
    expect(splitListEntries('ERP implementation, support and training', 'phrases')).toEqual(['ERP implementation, support and training']);
  });

  it('a pasted sentence stays one entry (the length check then refuses it), never six fragments', () => {
    const prose = 'We provide custom AI solutions, automation, data engineering, cloud migration and ongoing managed IT support. Every solution is built for you.';
    const out = splitListEntries(prose, 'phrases');
    expect(out).toEqual([prose]);
    expect(serviceEntryError(out[0])).toMatch(/At most 120 characters/);
  });

  it('a plain list of short items is split at its commas', () => {
    expect(splitListEntries('accounting software, payroll, invoicing', 'phrases')).toEqual(['accounting software', 'payroll', 'invoicing']);
    expect(splitListEntries('ERP, CRM, HR and payroll, and VAT filing', 'phrases')).toEqual(['ERP', 'CRM', 'HR and payroll', 'VAT filing']);
  });

  it('new lines, semicolons, tabs and bullets always separate entries; commas inside a line follow the list rule', () => {
    expect(splitListEntries('Microsoft Dynamics 365 Business Central, implementation\n- Payroll outsourcing\n• VAT filing; ERP audits', 'phrases')).toEqual([
      'Microsoft Dynamics 365 Business Central, implementation',
      'Payroll outsourcing',
      'VAT filing',
      'ERP audits',
    ]);
  });

  it('two short pieces are not a list (the comma may be part of the name)', () => {
    expect(isShortCommaList('Design, build')).toBe(false);
    expect(splitListEntries('Design, build', 'phrases')).toEqual(['Design, build']);
  });

  it('a piece of five words or more than 40 characters keeps the commas', () => {
    expect(isShortCommaList('ERP, CRM, cloud migration for mid sized companies')).toBe(false);
    expect(isShortCommaList('ERP, CRM, a very long product name that goes past forty characters')).toBe(false);
  });

  it('a version number or a product with a dot is not a sentence', () => {
    expect(splitListEntries('Node.js, React, Vue', 'phrases')).toEqual(['Node.js', 'React', 'Vue']);
  });

  it('never shortens an entry', () => {
    const long = 'x'.repeat(200);
    expect(splitListEntries(long, 'phrases')[0]).toHaveLength(200);
    expect(splitListEntries(long)[0]).toHaveLength(200);
  });
});

describe('pasteHasSeveral', () => {
  it('splits a paste into chips only when it holds several entries', () => {
    expect(pasteHasSeveral('Microsoft Dynamics 365 Business Central, implementation', 'phrases')).toBe(false);
    expect(pasteHasSeveral('accounting, payroll, invoicing', 'phrases')).toBe(true);
    expect(pasteHasSeveral('ERP\nCRM', 'phrases')).toBe(true);
    expect(pasteHasSeveral('a, b')).toBe(true);
  });
});

describe('serviceEntryError and the schemas', () => {
  it('accepts up to the limit and refuses longer with a message, never cutting', () => {
    expect(serviceEntryError('x')).toBe('Use at least 2 characters');
    expect(serviceEntryError('y'.repeat(SERVICE_MAX_CHARS))).toBeNull();
    expect(serviceEntryError('y'.repeat(SERVICE_MAX_CHARS + 1))).toMatch(/Shorten it, or press Enter between two services/);
  });

  it('the website and "Track my site" schemas take the same limit as the form', () => {
    const ok = 'Microsoft Dynamics 365 Business Central implementation, support and training for mid-sized companies in the GCC';
    expect(ok.length).toBeGreaterThan(80);
    expect(ok.length).toBeLessThanOrEqual(SERVICE_MAX_CHARS);
    expect(siteBusinessSchema.partial().safeParse({ services: [ok] }).success).toBe(true);
    expect(siteBusinessSchema.partial().safeParse({ services: ['z'.repeat(SERVICE_MAX_CHARS + 1)] }).success).toBe(false);
    const shape = (trackInput as unknown as { shape: Record<string, { safeParse: (v: unknown) => { success: boolean } }> }).shape;
    expect(shape.services.safeParse([ok]).success).toBe(true);
    expect(shape.services.safeParse(['z'.repeat(SERVICE_MAX_CHARS + 1)]).success).toBe(false);
  });
});

// Client report 2026-11-16 (F12): devaicon's services held "We provide custom AI solutions" and "and ongoing managed IT support. Every solution
// is built around your business nee" (a sentence split at its commas); the engine built AI questions and a page keyword from them.
describe('a service entry that reads like a sentence', () => {
  it('is refused with a plain hint when it is added', () => {
    for (const s of ['We provide custom AI solutions', 'and ongoing managed IT support. Every solution is built around your business nee', 'Our team builds apps', 'one two three four five six seven eight nine ten eleven twelve thirteen'])
      expect(serviceEntryError(s)).toBe(SERVICE_SENTENCE_HINT);
    expect(SERVICE_SENTENCE_HINT).not.toMatch(/—|\.\.\.|[‘’“”]/);
  });
  it('a service name is kept, commas and product names included', () => {
    for (const s of ['AI chatbot development', 'Microsoft Dynamics 365 Business Central, implementation', 'ERP implementation, support and training', 'Node.js development', 'cloud and Microsoft enterprise systems'])
      expect(serviceLooksLikeSentence(s)).toBe(false);
  });
  it('a list saved before the check still passes the schema (only new entries are refused, in the form)', () => {
    expect(updateSiteSchema.safeParse({ services: ['We provide custom AI solutions', 'automation'] }).success).toBe(true);
  });
});
