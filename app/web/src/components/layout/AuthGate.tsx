import type { ReactNode } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router';
import { Bot, TrendingUp, Wrench } from 'lucide-react';
import { useMe } from '@/lib/queries';
import { safeNext } from '@/pages/auth/shared';
import { PageLoader } from '../ui/feedback';
import { Brand } from './Brand';
import { ThemeMenu } from './ThemeMenu';

/** Signed-in area: sends visitors to /login?next=<where they wanted to go>. */
export function RequireAuth() {
  const me = useMe();
  const loc = useLocation();
  if (me.isPending) return <PageLoader fullPage />;
  if (!me.data) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  return <Outlet />;
}

/** Login / signup: signed-in users go to the app (or `next`). */
export function PublicOnly() {
  const me = useMe();
  const loc = useLocation();
  if (me.isPending) return <PageLoader fullPage />;
  if (me.data) {
    return <Navigate to={safeNext(new URLSearchParams(loc.search).get('next')) ?? '/'} replace />;
  }
  return <Outlet />;
}

const CAPABILITIES: { icon: ReactNode; title: string; text: string }[] = [
  {
    icon: <TrendingUp className="size-4" />,
    title: 'Keyword ladders',
    text: 'A plan of supporting pages that climbs to the term you want, with rankings checked every week.',
  },
  {
    icon: <Bot className="size-4" />,
    title: 'AI search visibility',
    text: 'Your buyers’ questions asked to ChatGPT, Gemini, Perplexity, Claude and Google AI Mode.',
  },
  {
    icon: <Wrench className="size-4" />,
    title: 'Technical audits with a fix pack',
    text: 'Crawl, Search Console coverage and speed, ending in robots.txt, redirects and schema ready to apply.',
  },
];

/** Auth pages: the brand panel on ink (wide screens) beside the form; one column with the header lockup on phones. */
export function AuthLayout() {
  return (
    <div className="min-h-dvh bg-page lg:grid lg:grid-cols-[minmax(440px,5fr)_7fr]">
      <aside className="relative hidden overflow-hidden bg-ink-surface text-on-ink [--ring:0_0_0_2px_var(--ink-surface),0_0_0_4px_var(--accent-on-ink)] lg:flex lg:min-h-dvh lg:flex-col lg:justify-between lg:px-12 lg:py-10 xl:px-16 xl:py-12">
        {/* the mark as a faint watermark (whole logo, never single rays) */}
        <img
          src="/brand/ascentra-mark-white.svg"
          alt=""
          aria-hidden
          draggable={false}
          className="pointer-events-none absolute -bottom-40 -right-52 w-[620px] max-w-none select-none opacity-[0.045]"
        />
        <Link to="/" className="relative inline-flex w-fit rounded-md">
          <img src="/brand/ascentra-logo-horizontal-white.svg" alt="Ascentra" width={153} height={40} draggable={false} className="h-10 w-auto select-none" />
        </Link>

        <div className="relative max-w-[460px] py-8">
          <p className="font-display text-[34px] font-semibold leading-[1.15] tracking-[-0.02em] text-on-ink xl:text-[40px]">Enterprise-grade autonomous SEO.</p>
          <p className="mt-4 text-[15px] leading-relaxed text-on-ink-2">
            Research, pages, audits and tracking for every website your company runs, with you approving what matters.
          </p>
          <ul className="mt-10 space-y-6">
            {CAPABILITIES.map((c) => (
              <li key={c.title} className="flex gap-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line-on-ink text-accent-on-ink" aria-hidden>
                  {c.icon}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-on-ink">{c.title}</span>
                  <span className="mt-0.5 block text-sm leading-relaxed text-on-ink-2">{c.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative border-t border-line-on-ink pt-5 text-xs leading-relaxed text-on-ink-2">
          Works with Google Search Console, Google Analytics 4, Bing Webmaster Tools and WordPress.
        </p>
      </aside>

      <div className="flex min-h-dvh flex-col">
        <header className="flex items-center justify-between gap-3 px-4 py-4 sm:px-8 sm:py-6">
          <Brand to="/" className="lg:hidden" />
          <div className="ml-auto">
            <ThemeMenu />
          </div>
        </header>
        <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-2 sm:items-center sm:px-8 sm:pt-0">
          <div className="w-full max-w-[440px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
