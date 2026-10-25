import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TutorialPlayer, YouTubeFrame } from '@/marketing/components/tutorials/TutorialPlayer';
import { isYouTubeId, readPlayerMessage, YOUTUBE_EMBED_ORIGIN, YouTubeBridge, youtubeEmbedUrl } from '@/marketing/components/tutorials/youtube';
import { tutorials } from '@/marketing/content/tutorials';
import TutorialPage from '@/marketing/pages/TutorialPage';

// The tutorial films on YouTube (2026-10-26): until someone presses play the page shows our own cover and makes no request to
// YouTube; then the privacy-enhanced embed plays from the chosen moment, and the chapter list seeks it by postMessage (no YouTube
// script, so the CSP keeps script-src 'self'). The id below is an obvious test value, only in this file: never put it in the film list.

const TEST_ID = 'TEST_ID_000';
vi.mock('@/marketing/content/tutorial-films', async (importOriginal) => {
  const real = (await importOriginal()) as typeof import('@/marketing/content/tutorial-films');
  const [first, ...rest] = Object.entries(real.tutorialFilms);
  return { tutorialFilms: Object.fromEntries([[first[0], { ...first[1], youtubeId: 'TEST_ID_000' }], ...rest]) };
});

const onYouTube = tutorials.find((t) => t.film?.youtubeId)!;
const page = (path: string) =>
  renderToString(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/tutorials/:slug" element={<TutorialPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
const withoutJsonLd = (html: string) => html.replace(/<script[\s\S]*?<\/script>/g, '');

describe('a film on YouTube', () => {
  it('shows our cover and a play button first, and asks nothing of YouTube before the click', () => {
    expect(onYouTube).toBeDefined();
    const html = renderToString(<TutorialPlayer tutorial={onYouTube} />);
    expect(html).toMatch(/<button[^>]*aria-label="Play Tutorial /);
    expect(html).toContain(`src="${onYouTube.film!.cover}"`);
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('<video');
    expect(html).not.toMatch(/youtube|ytimg/i);
  });

  it('the page: the facade, the chapters as buttons, and a VideoObject naming the YouTube addresses', () => {
    const html = page(`/tutorials/${onYouTube.slug}`);
    expect(withoutJsonLd(html)).not.toMatch(/<iframe|youtube/i);
    expect(html).toContain(`"embedUrl":"https://www.youtube.com/embed/${TEST_ID}"`);
    expect(html).toContain(`"contentUrl":"https://www.youtube.com/watch?v=${TEST_ID}"`);
    expect(html).toContain('"@type":"Clip"');
    for (const c of onYouTube.film!.chapters.slice(1)) expect(html).toMatch(new RegExp(`<button[^>]*aria-label="[^"]*at ${Math.floor(c.start / 60)}:`));
  });

  it('after the click: the privacy-enhanced embed, playing from the moment chosen, with a name and no full referrer', () => {
    const html = renderToString(<YouTubeFrame youtubeId={TEST_ID} title="Tutorial 1.1: Create your account" start={24.6} origin="https://alaventra.com" />);
    expect(html).toContain(`src="https://www.youtube-nocookie.com/embed/${TEST_ID}?rel=0&amp;modestbranding=1&amp;playsinline=1&amp;enablejsapi=1&amp;origin=https%3A%2F%2Falaventra.com&amp;autoplay=1&amp;start=24"`);
    expect(html).toContain('title="Tutorial 1.1: Create your account"');
    expect(html).toMatch(/allow="autoplay; encrypted-media; picture-in-picture; fullscreen"/);
    expect(html).toContain('referrerPolicy="strict-origin-when-cross-origin"');
    expect(youtubeEmbedUrl(TEST_ID, { origin: '' })).toBe(`${YOUTUBE_EMBED_ORIGIN}/embed/${TEST_ID}?rel=0&modestbranding=1&playsinline=1&enablejsapi=1`);
  });

  it('only a real 11-character id plays from YouTube; anything else keeps the site player', () => {
    expect(isYouTubeId(TEST_ID)).toBe(true);
    for (const bad of ['', 'short', 'TEST_ID_000x', 'TEST_ID/000', '"><script>', undefined, 42]) expect(isYouTubeId(bad), String(bad)).toBe(false);
    const html = renderToString(<TutorialPlayer tutorial={{ ...onYouTube, film: { ...onYouTube.film!, youtubeId: 'nope' } }} />);
    expect(html).not.toMatch(/youtube/i);
  });
});

describe('seeking the YouTube player by postMessage', () => {
  const fakeWindow = () => ({ postMessage: vi.fn() });
  const sent = (w: { postMessage: ReturnType<typeof vi.fn> }) => w.postMessage.mock.calls.map(([m, o]) => [JSON.parse(m as string), o]);

  it('says hello, waits for the player, then seeks and plays, always to the player origin', () => {
    const player = fakeWindow();
    const bridge = new YouTubeBridge(() => player as unknown as Window);
    bridge.hello();
    bridge.seek(42);
    expect(sent(player)).toEqual([[{ event: 'listening', id: 1, channel: 'widget' }, YOUTUBE_EMBED_ORIGIN]]);
    const m = bridge.receive({ origin: YOUTUBE_EMBED_ORIGIN, source: player, data: JSON.stringify({ event: 'initialDelivery', info: { currentTime: 0 } }) });
    expect(m?.event).toBe('initialDelivery');
    expect(sent(player).slice(1)).toEqual([
      [{ event: 'command', func: 'seekTo', args: [42, true], id: 1, channel: 'widget' }, YOUTUBE_EMBED_ORIGIN],
      [{ event: 'command', func: 'playVideo', args: [], id: 1, channel: 'widget' }, YOUTUBE_EMBED_ORIGIN],
    ]);
    bridge.seek(7);
    expect(sent(player).slice(3).map(([x]) => x.func)).toEqual(['seekTo', 'playVideo']);
    expect(sent(player)[3][0].args).toEqual([7, true]);
  });

  it('ignores messages from another window, another origin, or not in the player protocol', () => {
    const player = fakeWindow();
    const other = fakeWindow();
    const ok = JSON.stringify({ event: 'infoDelivery', info: { currentTime: 12.5 } });
    expect(readPlayerMessage({ origin: YOUTUBE_EMBED_ORIGIN, source: other, data: ok }, player as unknown as Window)).toBeNull();
    expect(readPlayerMessage({ origin: 'https://evil.example', source: player, data: ok }, player as unknown as Window)).toBeNull();
    expect(readPlayerMessage({ origin: 'https://www.youtube-nocookie.com.evil.example', source: player, data: ok }, player as unknown as Window)).toBeNull();
    expect(readPlayerMessage({ origin: YOUTUBE_EMBED_ORIGIN, source: player, data: 'not json' }, player as unknown as Window)).toBeNull();
    expect(readPlayerMessage({ origin: YOUTUBE_EMBED_ORIGIN, source: player, data: '{"x":1}' }, player as unknown as Window)).toBeNull();
    expect(readPlayerMessage({ origin: YOUTUBE_EMBED_ORIGIN, source: player, data: ok }, null)).toBeNull();
    expect(readPlayerMessage({ origin: YOUTUBE_EMBED_ORIGIN, source: player, data: ok }, player as unknown as Window)?.info?.currentTime).toBe(12.5);
    // a stranger's message does not unlock the queued commands
    const bridge = new YouTubeBridge(() => player as unknown as Window);
    bridge.seek(5);
    bridge.receive({ origin: 'https://evil.example', source: player, data: ok });
    expect(player.postMessage).not.toHaveBeenCalled();
    expect(bridge.isReady).toBe(false);
  });
});
