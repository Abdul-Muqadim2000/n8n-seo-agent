import { useEffect, type ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router';
import { SiteFooter } from './components/SiteFooter';
import { SiteHeader } from './components/SiteHeader';
import './marketing.css';

/** New page → top of the page (or the #hash target). */
function useScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (el) {
        el.scrollIntoView();
        return;
      }
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname, hash]);
}

/** Public website shell: skip link, sticky header, page, footer. Route layout (renders the matched page) or a wrapper (`children`). */
export default function MarketingLayout({ children }: { children?: ReactNode }) {
  useScrollToTop();
  return (
    <div className="flex min-h-dvh flex-col bg-page text-ink">
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main')?.focus();
        }}
        className="sr-only rounded-md bg-surface px-4 py-2 text-sm font-medium text-ink shadow-overlay focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[60]"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        {children ?? <Outlet />}
      </main>
      <SiteFooter />
    </div>
  );
}
