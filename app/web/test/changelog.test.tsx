import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { changelog } from '@/marketing/content/changelog';
import { features } from '@/marketing/content/features';
import ChangelogPage from '@/marketing/pages/ChangelogPage';
import AboutPage from '@/marketing/pages/AboutPage';

// The public release history (2026-10-22): releases are named by version only, no date is rendered anywhere, dates in the data stay true
// (never before the first real release, newest first), and the copy follows the site's writing rules.

const MONTHS = /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\b/;
const ISO = /\b20\d\d-\d\d-\d\d\b/;
const text = (html: string) => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');
const render = (el: React.ReactNode) =>
  renderToString(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })}>
      <MemoryRouter initialEntries={['/changelog']}>{el}</MemoryRouter>
    </QueryClientProvider>,
  );

describe('changelog data', () => {
  it('every release has a unique version, newest first, with true dates in order', () => {
    const versions = changelog.map((e) => e.version);
    expect(versions.every((v) => typeof v === 'string' && /^\d+\.\d+$/.test(v))).toBe(true);
    expect(new Set(versions).size).toBe(versions.length);
    const num = (v: string) => v.split('.').map(Number);
    for (let i = 1; i < changelog.length; i++) {
      const [a, b] = [num(changelog[i - 1].version!), num(changelog[i].version!)];
      expect(a[0] > b[0] || (a[0] === b[0] && a[1] > b[1]), `${changelog[i - 1].version} before ${changelog[i].version}`).toBe(true);
      expect(changelog[i - 1].date >= changelog[i].date).toBe(true);
    }
    expect(changelog[changelog.length - 1].date >= '2026-09-30').toBe(true);
  });

  it('major releases are few, with a tagline and 2 to 4 sections that are their highlights', () => {
    const majors = changelog.filter((e) => e.major);
    expect(majors.length).toBeGreaterThan(0);
    expect(majors.length).toBeLessThanOrEqual(5);
    for (const e of majors) {
      expect(e.tagline, e.version).toBeTruthy();
      expect(e.sections?.length ?? 0).toBeGreaterThanOrEqual(2);
      expect(e.sections?.length ?? 0).toBeLessThanOrEqual(4);
      expect(e.sections!.flatMap((s) => s.items)).toEqual(e.highlights);
    }
  });

  it('only real capability slugs, and the writing rules hold', () => {
    const slugs = new Set(features.map((f) => f.slug));
    const banned = /[—–‘’“”…]|\.\.\.|seamless|empower|unlock|game-changer|cutting-edge|in today's|Ascentra/i;
    for (const e of changelog) {
      for (const f of e.features) expect(slugs.has(f), `${e.version}: ${f}`).toBe(true);
      const all = [e.title, e.summary, e.tagline ?? '', ...e.highlights, ...(e.sections ?? []).map((s) => s.heading)].join('\n');
      expect(all.match(banned)?.[0], e.version).toBeUndefined();
    }
  });
});

describe('no date is shown', () => {
  it('the changelog page renders versions and no date', () => {
    const html = render(<ChangelogPage />);
    const t = text(html);
    expect(t).toContain(changelog[0].title);
    expect(t).toContain(changelog[0].version!);
    expect(t).toContain('Major release');
    expect(html).not.toMatch(/<time\b|dateTime=|datePublished/);
    expect(t).not.toMatch(MONTHS);
    expect(t).not.toMatch(ISO);
    expect(html).not.toMatch(ISO);
  });

  it("the About page's latest releases show versions, not dates", () => {
    const html = render(<AboutPage />);
    const t = text(html);
    for (const e of changelog.slice(0, 3)) {
      expect(t).toContain(e.title);
      expect(html).not.toContain(e.date);
    }
    expect(html).not.toMatch(/<time\b/);
  });
});
