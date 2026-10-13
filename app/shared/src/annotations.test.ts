import { describe, expect, it } from 'vitest';
import { buildAnnotations, dataBreaksIn, DATA_BREAKS, GOOGLE_UPDATES, inWindow, SEO_EVENTS_UPDATED } from './annotations';

// G12 (2026-10-13, system review FIX_PLAN; criteria 3.5 / 2.12): the charts are marked with what happened, from stored rows and the
// dated registry — and with nothing else. The engine's own scenario S56 checks the same rules on its copy of this logic.
describe('chart annotations (G12)', () => {
  const window = { from: '2026-09-01', to: '2026-10-13' };

  it('marks a page that went live on its own date, with the keyword and the page', () => {
    const marks = buildAnnotations({
      ...window,
      published: [{ publishedAt: '2026-09-25T10:00:00.000Z', keyword: 'peppol uae', url: 'https://x.ae/peppol-uae/', source: 'ladder' }],
    }).filter((m) => m.kind === 'publish');
    expect(marks).toHaveLength(1);
    expect(marks[0]).toMatchObject({ date: '2026-09-25', dateEnd: '2026-09-25', label: 'Published: "peppol uae"', url: 'https://x.ae/peppol-uae/', tone: 'good' });
    expect(marks[0]!.detail).toContain('keyword-ladder page');
  });

  it('leaves out a page published before the window the chart covers', () => {
    const marks = buildAnnotations({ ...window, published: [{ publishedAt: '2026-07-02', keyword: 'older', url: 'https://x.ae/old/' }] });
    expect(marks.filter((m) => m.kind === 'publish')).toHaveLength(0);
  });

  it('marks an audit with the findings it cleared since the audit before', () => {
    const marks = buildAnnotations({
      ...window,
      audits: [
        { auditedAt: '2026-08-01T06:00:00Z', healthScore: 64, findings: 40 },
        { auditedAt: '2026-09-18T06:00:00Z', healthScore: 81, findings: 34 },
      ],
    }).filter((m) => m.kind === 'fix');
    expect(marks).toHaveLength(1);
    expect(marks[0]!.label).toBe('Audit fixes: 6 findings gone');
    expect(marks[0]!.detail).toBe('health 64 → 81 · 6 fewer findings than the audit before');
  });

  it('says "Technical audit" when there is nothing to compare with, and counts findings that came back', () => {
    const one = buildAnnotations({ ...window, audits: [{ auditedAt: '2026-09-18', healthScore: 81, findings: 34 }] }).filter((m) => m.kind === 'fix');
    expect(one[0]!.label).toBe('Technical audit');
    expect(one[0]!.detail).toBe('health 81/100');
    const worse = buildAnnotations({ ...window, audits: [{ auditedAt: '2026-09-01', healthScore: 81, findings: 30 }, { auditedAt: '2026-09-18', healthScore: 70, findings: 36 }] }).filter((m) => m.kind === 'fix');
    expect(worse[1]!.detail).toContain('6 more findings than the audit before');
  });

  it('marks a Google update with its own start and end, and never claims it caused anything', () => {
    const marks = buildAnnotations(window).filter((m) => m.kind === 'google_update');
    expect(marks).toHaveLength(1);
    expect(marks[0]).toMatchObject({ label: 'Google: September 2026 core update', date: '2026-09-15', dateEnd: '2026-09-30', tone: 'warning' });
    expect(marks[0]!.detail).toContain('cannot be proven from these numbers');
  });

  it('marks the num=100 data break, and reports that a window over it is not comparable', () => {
    const marks = buildAnnotations({ from: '2025-08-15', to: '2025-10-15' }).filter((m) => m.kind === 'data_break');
    expect(marks).toHaveLength(1);
    expect(marks[0]).toMatchObject({ label: 'Data break: num=100 stopped working', date: '2025-09-10', dateEnd: '2025-09-19' });
    expect(marks[0]!.detail).toContain('not comparable');
    expect(dataBreaksIn('2025-08-15', '2025-10-15')).toHaveLength(1);
    expect(dataBreaksIn('2026-01-01', '2026-10-13')).toHaveLength(0);
  });

  it('produces nothing at all for a window where nothing happened', () => {
    expect(buildAnnotations({ from: '2026-11-01', to: '2026-11-20', published: [], audits: [] })).toEqual([]);
  });

  it('sorts the marks oldest first, whatever order they arrived in', () => {
    const marks = buildAnnotations({
      ...window,
      published: [{ publishedAt: '2026-10-02', keyword: 'later', url: '' }, { publishedAt: '2026-09-03', keyword: 'earlier', url: '' }],
      audits: [{ auditedAt: '2026-09-18', healthScore: 81, findings: 34 }],
    });
    expect(marks.map((m) => m.date)).toEqual([...marks.map((m) => m.date)].sort());
  });

  it('keeps one dated registry, with real dates, shared with the engine', () => {
    expect(GOOGLE_UPDATES.length).toBeGreaterThanOrEqual(7);
    expect(DATA_BREAKS.length).toBeGreaterThanOrEqual(1);
    expect(SEO_EVENTS_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const e of [...GOOGLE_UPDATES, ...DATA_BREAKS]) {
      expect(e.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.start <= e.end).toBe(true);
      expect(e.name.length).toBeGreaterThan(3);
    }
  });

  it('counts a dated range as inside the window when it overlaps it at all', () => {
    expect(inWindow('2026-09-20', '2026-09-25', '2026-09-15', '2026-09-30')).toBe(true);
    expect(inWindow('2026-10-01', '2026-10-13', '2026-09-15', '2026-09-30')).toBe(false);
    expect(inWindow('', '', '2026-09-15', '2026-09-30')).toBe(true);
    expect(inWindow('2026-09-01', '2026-10-13', '', '')).toBe(false);
  });
});
