import { useEffect } from 'react';
import { site } from './content/site';

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/** Search results show about 155–160 characters: the whole sentences that fit (when they say enough), else the text cut at a word with "…". */
export function metaDescription(text: string, max = 160): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  // a sentence ends at "." or "?" followed by a space and a capital (so "4.5", "1,000" and "e.g. this" do not end one)
  let end = 0;
  for (const m of t.matchAll(/[.?](?=\s+[A-Z“"(]|$)/g)) {
    if (m.index + 1 > max) break;
    end = m.index + 1;
  }
  if (end >= 100) return t.slice(0, end);
  const cut = t.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[\s,;:—–-]+$/, '')}…`;
}

/** Page title ("<title> — Ascentra"), meta description (clamped to what search results show), Open Graph title / description / url and the
 *  canonical link. */
export function useSeo({ title, description, path }: { title: string; description: string; path: string }) {
  useEffect(() => {
    const full = `${title} — ${site.name}`;
    const url = `${window.location.origin}${path}`;
    const desc = metaDescription(description);
    document.title = full;
    setMeta('name', 'description', desc);
    setMeta('property', 'og:title', full);
    setMeta('property', 'og:description', desc);
    setMeta('property', 'og:url', url);
    setCanonical(url);
  }, [title, description, path]);
}
