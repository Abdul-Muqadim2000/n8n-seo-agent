import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { useMe } from '@/lib/queries';
import { footerNav, site } from '../content/site';
import { Logo } from './Logo';
import { Container } from './Section';
import { ThemeSegmented } from './ThemeSwitch';

/** Big site footer: logo + descriptor, link columns (Platform / Solutions / Company / Legal), copyright and the theme switch. */
export function SiteFooter() {
  const signedIn = !!useMe().data;
  return (
    <footer className="border-t border-line bg-surface">
      <Container className="pb-10 pt-16 sm:pt-20">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1.3fr)_repeat(4,minmax(0,1fr))] lg:gap-8">
          <div className="max-w-sm">
            <Link to="/" className="-ml-1 inline-block rounded-md p-1" aria-label="Ascentra home">
              <Logo className="h-9" />
            </Link>
            <p className="mt-5 font-display text-lg font-semibold tracking-[-0.01em] text-ink">{site.descriptor}</p>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
              Research, content, technical audits, AI search visibility and backlinks — one weekly loop for every website you run.
            </p>
            <Link to={signedIn ? '/' : '/signup'} className="group mt-6 inline-flex min-h-10 items-center gap-1.5 text-[14px] font-medium text-accent-text hover:text-accent-hover sm:min-h-0">
              {signedIn ? 'Open app' : 'Start free'}
              <ArrowRight className="size-4 transition-transform duration-200 ease-brand group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4 lg:contents">
            {footerNav.map((col) => (
              <nav key={col.title} aria-label={col.title}>
                <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3">{col.title}</p>
                <ul className="mt-3 sm:mt-4 sm:space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.to}>
                      {/* 40px tall rows on phones (tap targets), the compact list from sm up */}
                      <Link to={l.to} className="flex min-h-10 items-center text-[14px] text-ink-2 transition-colors duration-150 ease-brand hover:text-ink sm:inline sm:min-h-0">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
        {/* phones: links on top, then copyright and the theme switch on one row; from sm: copyright left, links and switch right */}
        <div className="mt-16 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-t border-line pt-6 sm:flex sm:gap-5">
          <div className="col-span-2 flex flex-wrap items-center gap-x-5 text-[13px] sm:order-2 sm:ml-auto">
            <Link to={signedIn ? '/' : '/login'} className="inline-flex min-h-10 items-center text-ink-2 transition-colors duration-150 ease-brand hover:text-ink sm:min-h-0">
              {signedIn ? 'Open app' : 'Sign in'}
            </Link>
            <a href={`mailto:${site.salesEmail}`} className="inline-flex min-h-10 items-center text-ink-2 transition-colors duration-150 ease-brand hover:text-ink sm:min-h-0">
              {site.salesEmail}
            </a>
          </div>
          <p className="text-[13px] text-ink-3 sm:order-1">{site.copyright}</p>
          <ThemeSegmented labels="never" className="justify-self-end sm:order-3" />
        </div>
      </Container>
    </footer>
  );
}
