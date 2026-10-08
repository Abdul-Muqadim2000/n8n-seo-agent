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

/** Page title ("<title> — Ascentra"), meta description, Open Graph title / description / url and the canonical link. */
export function useSeo({ title, description, path }: { title: string; description: string; path: string }) {
  useEffect(() => {
    const full = `${title} — ${site.name}`;
    const url = `${window.location.origin}${path}`;
    document.title = full;
    setMeta('name', 'description', description);
    setMeta('property', 'og:title', full);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', url);
    setCanonical(url);
  }, [title, description, path]);
}
