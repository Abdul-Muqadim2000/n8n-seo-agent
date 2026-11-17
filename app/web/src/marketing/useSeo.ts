import { createContext, useContext, useEffect } from 'react';
import { absoluteUrl } from '@/lib/siteOrigin';
import { site } from './content/site';

/** What one page puts in <head>: the browser applies it in an effect, the build-time prerender (entry-server.tsx) writes it into the
 *  page's HTML. One function, so both always agree. */
export interface SeoHead {
  /** "<title> | Alaventra" */
  title: string;
  /** clamped to what search results show */
  description: string;
  /** absolute, on the public origin (canonical and og:url) */
  url: string;
}

export interface SeoInput {
  title: string;
  description: string;
  path: string;
}

/** Receives the page's head while the prerender renders it (no effects run on the server). Unset in the browser. */
export const SeoSinkContext = createContext<((head: SeoHead) => void) | null>(null);

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

/** Search results show about 155-160 characters: the whole sentences that fit (when they say enough), else the text cut at a word with "...". */
export function metaDescription(text: string, max = 160): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  // a sentence ends at "." or "?" followed by a space and a capital (so "4.5", "1,000" and "e.g. this" do not end one)
  let end = 0;
  for (const m of t.matchAll(/[.?](?=\s+[A-Z""(]|$)/g)) {
    if (m.index + 1 > max) break;
    end = m.index + 1;
  }
  if (end >= 100) return t.slice(0, end);
  const cut = t.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[\s,;:—–-]+$/, '')}...`;
}

export function seoHead({ title, description, path }: SeoInput): SeoHead {
  return { title: `${title} | ${site.name}`, description: metaDescription(description), url: absoluteUrl(path) };
}

/** Page title ("<title> | Alaventra"), meta description (clamped to what search results show), Open Graph title / description / url and the
 *  canonical link, always on the public origin (SITE_ORIGIN), whichever host serves the page. */
export function useSeo(input: SeoInput) {
  const head = seoHead(input);
  const sink = useContext(SeoSinkContext);
  sink?.(head);
  const { title, description, url } = head;
  useEffect(() => {
    document.title = title;
    setMeta('name', 'description', description);
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', url);
    setCanonical(url);
  }, [title, description, url]);
}
