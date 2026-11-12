import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { addEntries, TagInput } from '@/components/ui/tag-input';
import { serviceEntryError } from '@seo/shared';

// F-07 (prod review 2026-11-12): "What do you sell?" keeps a service with a comma as one chip, shows it whole (the chip's title carries the
// full name when it is too wide to show) and still counts the entries.
describe('TagInput for services', () => {
  const name = 'Microsoft Dynamics 365 Business Central, implementation and support for mid-sized companies in the GCC';

  it('renders a stored service with a comma as one chip, whole', () => {
    const html = renderToString(<TagInput value={[name, 'Payroll outsourcing']} onChange={() => {}} max={30} split="phrases" maxLength={120} />);
    expect(html).toContain(`title="${name}"`);
    expect(html).toContain(`Remove ${name}`);
    expect(html).toMatch(/2<!-- --> of <!-- -->30/);
  });

  it('shows no character counter before anything is typed', () => {
    const html = renderToString(<TagInput value={[]} onChange={() => {}} split="phrases" maxLength={120} />);
    expect(html).not.toContain('characters');
  });
});

// review N1 / N2 (2026-11-12)
describe('adding pasted entries', () => {
  const o = { split: 'phrases' as const, normalize: (s: string) => s.trim(), validate: serviceEntryError, max: 30 };
  it('a paste with one bad entry keeps the good ones and leaves the bad one in the field with the message', () => {
    const r = addEntries(['Payroll'], `ERP implementation\n${'y'.repeat(130)}\nVAT filing`, o)!;
    expect(r.next).toEqual(['Payroll', 'ERP implementation', 'VAT filing']);
    expect(r.draft).toBe('y'.repeat(130));
    expect(r.error).toMatch(/At most 120 characters/);
  });
  it('a clean paste adds everything and empties the field', () => {
    expect(addEntries([], 'accounting, payroll, invoicing', o)).toEqual({ next: ['accounting', 'payroll', 'invoicing'], draft: '', error: null });
  });
  it('the counter is not a live region; the screen reader region is empty until the entry is too long', () => {
    const html = renderToString(<TagInput value={[]} onChange={() => {}} split="phrases" maxLength={120} />);
    expect(html).toMatch(/<span class="sr-only" aria-live="polite"><\/span>/);
  });
});
