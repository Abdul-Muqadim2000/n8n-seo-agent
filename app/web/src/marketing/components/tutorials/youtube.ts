// The tutorial films on YouTube, without YouTube's script: the page's CSP keeps `script-src 'self'`, so the player is driven through
// the IFrame API's own postMessage protocol (the one www.youtube.com/iframe_api speaks underneath): we say "listening", the player
// answers with its state (current time, playing or not), and takes `command` messages (seekTo, playVideo). Every message we accept
// must come from the player's own window and from a YouTube origin; every message we send names the player's origin.

/** the privacy-enhanced player: no YouTube cookies until someone plays the film */
export const YOUTUBE_EMBED_ORIGIN = 'https://www.youtube-nocookie.com';
const PLAYER_ORIGINS = new Set([YOUTUBE_EMBED_ORIGIN, 'https://www.youtube.com']);

export const isYouTubeId = (id: unknown): id is string => typeof id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(id);

/** the embed address: plays inline, no related films from other channels, the JS API on (origin = this page, so it answers us) */
export function youtubeEmbedUrl(id: string, { origin, start = 0, autoplay = false }: { origin: string; start?: number; autoplay?: boolean }): string {
  const q = new URLSearchParams({ rel: '0', modestbranding: '1', playsinline: '1', enablejsapi: '1' });
  if (origin) q.set('origin', origin);
  if (autoplay) q.set('autoplay', '1');
  const from = Math.max(0, Math.floor(start));
  if (from) q.set('start', String(from));
  return `${YOUTUBE_EMBED_ORIGIN}/embed/${encodeURIComponent(id)}?${q.toString()}`;
}
/** the public addresses search engines read (schema.org VideoObject embedUrl / contentUrl) */
export const youtubePublicEmbed = (id: string) => `https://www.youtube.com/embed/${id}`;
export const youtubeWatchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;

export interface YouTubeInfo {
  currentTime?: number;
  /** -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued */
  playerState?: number;
}
export interface YouTubeEvent {
  event: string;
  info?: YouTubeInfo;
}

/** a message from the player, or null when it is not one (wrong window, wrong origin, not the widget protocol) */
export function readPlayerMessage(e: { origin: string; source: unknown; data: unknown }, player: Window | null | undefined): YouTubeEvent | null {
  if (!player || e.source !== player || !PLAYER_ORIGINS.has(e.origin)) return null;
  let m: unknown = e.data;
  if (typeof m === 'string') {
    try {
      m = JSON.parse(m);
    } catch {
      return null;
    }
  }
  if (!m || typeof m !== 'object' || typeof (m as YouTubeEvent).event !== 'string') return null;
  const info = (m as { info?: unknown }).info;
  return { event: (m as YouTubeEvent).event, info: info && typeof info === 'object' ? (info as YouTubeInfo) : undefined };
}

type Target = Pick<Window, 'postMessage'>;

/**
 * Talks to one embedded player. Commands sent before the player has answered wait in order and go out on its first answer, so a
 * chapter clicked while the film is still loading still lands.
 */
export class YouTubeBridge {
  private ready = false;
  private queue: string[] = [];
  constructor(private readonly player: () => Target | null | undefined) {}

  get isReady() {
    return this.ready;
  }
  private post(msg: object) {
    this.player()?.postMessage(JSON.stringify({ ...msg, id: 1, channel: 'widget' }), YOUTUBE_EMBED_ORIGIN);
  }
  /** ask the player to report its state to us (repeat until it answers: it ignores messages sent before it has loaded) */
  hello() {
    this.post({ event: 'listening' });
  }
  command(func: 'seekTo' | 'playVideo' | 'pauseVideo', args: unknown[] = []) {
    const msg = JSON.stringify({ event: 'command', func, args, id: 1, channel: 'widget' });
    if (this.ready) this.player()?.postMessage(msg, YOUTUBE_EMBED_ORIGIN);
    else this.queue.push(msg);
  }
  /** jump to a moment and play from there */
  seek(seconds: number) {
    this.command('seekTo', [Math.max(0, seconds), true]);
    this.command('playVideo');
  }
  /** feed a window `message` event; returns the player's event when it was one */
  receive(e: { origin: string; source: unknown; data: unknown }): YouTubeEvent | null {
    const target = this.player();
    const m = readPlayerMessage(e, target as Window | null | undefined);
    if (!m) return null;
    if (!this.ready) {
      this.ready = true;
      const waiting = this.queue.splice(0);
      for (const msg of waiting) target?.postMessage(msg, YOUTUBE_EMBED_ORIGIN);
    }
    return m;
  }
}
