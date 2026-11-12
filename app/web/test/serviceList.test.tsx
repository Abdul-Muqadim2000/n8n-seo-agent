import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { TagInput } from '@/components/ui/tag-input';

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
