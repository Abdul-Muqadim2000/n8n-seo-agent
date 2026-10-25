import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { tutorialFilms } from '@/marketing/content/tutorial-films';
import {
  clock,
  courseNeighbours,
  isoDuration,
  matchesQuery,
  quickTips,
  tutorialBySlug,
  tutorials,
  tutorialSeries,
  videoUrl,
  whereInApp,
} from '@/marketing/content/tutorials';
import TutorialPage from '@/marketing/pages/TutorialPage';
import TutorialsPage from '@/marketing/pages/TutorialsPage';

// The video course on the website (/tutorials, 2026-10-24): the catalogue is whole and in order, every finished film belongs to a
// tutorial and its chapters fit inside it, a tutorial without a film never renders a player, and the copy follows the site's rules.

const text = (html: string) => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');
const render = (path: string) =>
  renderToString(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/tutorials" element={<TutorialsPage />} />
          <Route path="/tutorials/:slug" element={<TutorialPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
const BANNED = /[—–‘’“”…]|\.\.\.|seamless|empower|unlock|game-changer|cutting-edge|in today's|autonomous SEO|Ascentra/i;

describe('the course catalogue', () => {
  it('has numbered series and tutorials in course order, with unique slugs', () => {
    expect(tutorialSeries.length).toBeGreaterThanOrEqual(11);
    tutorialSeries.forEach((s, i) => {
      expect(s.id).toBe(String(i + 1));
      s.tutorials.forEach((t, k) => expect(t.id).toBe(`${s.id}.${k + 1}`));
    });
    expect(new Set(tutorials.map((t) => t.slug)).size).toBe(tutorials.length);
    tutorials.forEach((t, i) => {
      expect(t.index).toBe(i);
      expect(t.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(t.chapters.length, t.id).toBeGreaterThan(0);
      expect(t.minutes, t.id).toBeGreaterThan(0);
    });
  });

  it('every finished film belongs to a tutorial, and its chapters start at 0 and run in order inside the film', () => {
    for (const [slug, film] of Object.entries(tutorialFilms)) {
      expect(tutorialBySlug(slug), slug).toBeDefined();
      expect(film.cover).toBe(`/tutorials/covers/${slug}.webp`);
      expect(film.captions).toBe(`/tutorials/captions/${slug}.vtt`);
      expect(film.published).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(film.chapters[0]?.start).toBe(0);
      film.chapters.forEach((c, i) => {
        if (i) expect(c.start).toBeGreaterThan(film.chapters[i - 1].start);
        expect(c.start).toBeLessThan(film.durationSeconds);
      });
    }
  });

  it('a YouTube id, when a film has one, is a real 11-character id and no two films share one', () => {
    const ids = Object.values(tutorialFilms).flatMap((f) => (f.youtubeId === undefined ? [] : [f.youtubeId]));
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9_-]{11}$/);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('follows the writing rules', () => {
    const all = [...tutorialSeries.flatMap((s) => [s.title, s.summary, ...s.tutorials.flatMap((t) => [t.title, t.summary, ...t.chapters])]), ...quickTips];
    for (const line of all) expect(line.match(BANNED)?.[0], line).toBeUndefined();
  });
});

describe('helpers', () => {
  it('formats lengths for people and for structured data', () => {
    expect(clock(63)).toBe('1:03');
    expect(clock(3725)).toBe('1:02:05');
    expect(isoDuration(59)).toBe('PT59S');
    expect(isoDuration(120)).toBe('PT2M');
    expect(isoDuration(125)).toBe('PT2M5S');
  });

  it('searches number, title, steps and series, every word', () => {
    const first = tutorials[0];
    expect(matchesQuery(first, '1.1')).toBe(true);
    expect(matchesQuery(first, 'ACCOUNT create')).toBe(true);
    expect(matchesQuery(first, 'account zzzz')).toBe(false);
    expect(tutorials.filter((t) => matchesQuery(t, 'ladder')).length).toBeGreaterThan(0);
  });

  it('names the place in the app in its own words', () => {
    expect(whereInApp('/signup')).toBe('The sign-up page');
    expect(whereInApp('/o/<company>/sites/<website>/ai')).toBe('AI visibility');
    expect(whereInApp('/o/<company>/settings/credits')).toBe('Company settings');
    expect(whereInApp('/somewhere')).toBe('');
  });

  it('walks the whole course: nothing before the first, nothing after the last', () => {
    expect(courseNeighbours(tutorials[0]).prev).toBeUndefined();
    expect(courseNeighbours(tutorials[0]).next).toBe(tutorials[1]);
    expect(courseNeighbours(tutorials[tutorials.length - 1]).next).toBeUndefined();
  });
});

describe('the pages', () => {
  it('/tutorials lists every series and tutorial, with the tagline and the start-here path', () => {
    const html = render('/tutorials');
    const t = text(html);
    expect(t).toContain('Rank in search. Get recommended by AI.');
    expect(t).toContain('Start here');
    for (const s of tutorialSeries) expect(t).toContain(s.title);
    for (const tu of tutorials) expect(html).toContain(`/tutorials/${tu.slug}`);
    expect(t.match(BANNED)?.[0]).toBeUndefined();
  });

  it('a filtered address shows only the matching tutorials', () => {
    const html = render('/tutorials?level=Advanced');
    const shown = tutorials.filter((x) => x.level === 'Advanced');
    const hidden = tutorials.filter((x) => x.level !== 'Advanced' && x.series.id !== '1' && x.position > 1);
    expect(shown.length).toBeGreaterThan(0);
    for (const x of shown) expect(html).toContain(`href="/tutorials/${x.slug}"`);
    // series 1 is also the start-here path, and each shown series links to its first tutorial ("Start this series")
    for (const x of hidden) expect(html, x.id).not.toContain(`href="/tutorials/${x.slug}"`);
  });

  it('a tutorial with a film has the player, its chapters, captions off by default and a VideoObject', () => {
    // a film on YouTube shows its cover until played (tutorialsYouTube.test.tsx); this one is a film served from the site
    const withFilm = tutorials.find((x) => x.film && !x.film.youtubeId);
    if (!withFilm) return;
    const html = render(`/tutorials/${withFilm.slug}`);
    expect(html).toContain('<video');
    expect(html).toMatch(/<track kind="captions"[^>]*>/);
    expect(html).not.toMatch(/<track[^>]*\bdefault\b/);
    expect(html).toContain(`src="${videoUrl(withFilm)}"`);
    expect(html).toContain('"@type":"VideoObject"');
    expect(html).toContain('"@type":"Clip"');
    for (const c of withFilm.film!.chapters) expect(text(html)).toContain(c.title.replace(/'/g, '&#x27;'));
    for (const step of withFilm.chapters) expect(text(html)).toContain(step.replace(/'/g, '&#x27;'));
  });

  it('a tutorial without a film says its video is on its way and shows its written steps, never a player', () => {
    const noFilm = tutorials.find((x) => !x.film);
    if (!noFilm) return;
    const html = render(`/tutorials/${noFilm.slug}`);
    expect(html).not.toContain('<video');
    expect(html).not.toContain('VideoObject');
    expect(text(html)).toContain('The video is on its way.');
    expect(text(html)).toContain('Step by step');
    for (const step of noFilm.chapters) expect(text(html)).toContain(step.replace(/'/g, '&#x27;'));
  });

  it('a finished film: the written steps are its step chapters, and the step count says the same everywhere', () => {
    for (const t of tutorials.filter((x) => x.film)) {
      const steps = t.film!.chapters.filter((c) => c.kind === 'step').map((c) => c.title);
      if (steps.length) expect(t.chapters, t.id).toEqual(steps);
    }
  });

  it('the hero counts only what is ready, and "Videos ready" keeps only tutorials with a film', () => {
    const films = tutorials.filter((x) => x.film);
    const t = text(render('/tutorials'));
    expect(t).not.toMatch(/About \d+(\.5)? hours? in all/);
    if (films.length === tutorials.length) {
      // every video is ready: the hero counts videos, and nothing says a video is still to come
      expect(t).toContain(`${tutorials.length} short videos`);
      expect(t).not.toMatch(/Videos ready|video soon|coming soon|on its way|more every week/i);
      return;
    }
    expect(t).toContain(`${films.length} video${films.length === 1 ? '' : 's'} ready`);
    if (!films.length) return;
    const html = render('/tutorials?video=ready&series=11');
    for (const x of tutorials.filter((y) => y.series.id === '11' && !y.film && y.position > 1)) expect(html, x.id).not.toContain(`href="/tutorials/${x.slug}"`);
  });

  it('no tutorial with a film says its video is coming', () => {
    for (const x of tutorials.filter((y) => y.film)) {
      const t = text(render(`/tutorials/${x.slug}`));
      expect(t, x.id).not.toMatch(/video is on its way|video soon|coming soon/i);
    }
  });

  it('an unknown tutorial is the not-found page', () => {
    expect(text(render('/tutorials/no-such-tutorial'))).toContain('Page not found');
  });
});
