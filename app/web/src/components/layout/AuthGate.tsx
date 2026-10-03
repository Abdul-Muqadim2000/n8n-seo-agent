import { Navigate, Outlet, useLocation } from 'react-router';
import { useMe } from '@/lib/queries';
import { safeNext } from '@/pages/auth/shared';
import { PageLoader } from '../ui/feedback';
import { Brand } from './Brand';
import { ThemeMenu } from './ThemeMenu';

/** Signed-in area: sends visitors to /login?next=<where they wanted to go>. */
export function RequireAuth() {
  const me = useMe();
  const loc = useLocation();
  if (me.isPending) return <PageLoader />;
  if (!me.data) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  return <Outlet />;
}

/** Login / signup: signed-in users go to the app (or `next`). */
export function PublicOnly() {
  const me = useMe();
  const loc = useLocation();
  if (me.isPending) return <PageLoader />;
  if (me.data) {
    return <Navigate to={safeNext(new URLSearchParams(loc.search).get('next')) ?? '/'} replace />;
  }
  return <Outlet />;
}

/** Centered card layout for the auth pages, with a short product pitch beside it on wide screens. */
export function AuthLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-page">
      <header className="flex items-center justify-between px-6 py-5">
        <Brand />
        <ThemeMenu />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-4 sm:items-center sm:pt-0">
        <div className="grid w-full max-w-5xl items-center gap-12 lg:grid-cols-[1fr_440px]">
          <aside className="hidden lg:block">
            <h1 className="text-3xl font-semibold leading-tight tracking-tight text-ink">
              Everything your SEO needs,
              <br />
              in one place.
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink-2">
              Keyword research and verdicts, finished pages with QA, technical audits with a fix pack, weekly Search Console and GA4 tracking, AI-search visibility and backlink
              monitoring — with dashboards and clear next steps for every website your company runs.
            </p>
            <ul className="mt-8 space-y-3 text-sm text-ink-2">
              {[
                'Sign in with Google or e-mail, invite your team',
                'Connect Search Console and GA4 in two minutes',
                'One dashboard per website: traffic, rankings, health, AI answers, links',
                'Recommendations you can run with one click',
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </aside>
          <div className="w-full">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
