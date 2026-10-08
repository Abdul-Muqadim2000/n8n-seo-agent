import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { ThemeMenu } from '@/components/layout/ThemeMenu';
import { footerNav, site } from '../content/site';
import { Logo } from './Logo';
import { Container } from './Section';

/** Big site footer: logo + descriptor, link columns (Platform / Solutions / Company / Legal), copyright and the theme switch. */
export function SiteFooter() {
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
            <Link to="/signup" className="group mt-6 inline-flex items-center gap-1.5 text-[14px] font-medium text-accent-text">
              Start free
              <ArrowRight className="size-4 transition-transform duration-200 ease-brand group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4 lg:contents">
            {footerNav.map((col) => (
              <nav key={col.title} aria-label={col.title}>
                <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3">{col.title}</p>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.to}>
                      <Link to={l.to} className="text-[14px] text-ink-2 transition-colors duration-150 ease-brand hover:text-ink">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
        <div className="mt-16 flex flex-col-reverse items-start justify-between gap-4 border-t border-line pt-6 sm:flex-row sm:items-center">
          <p className="text-[13px] text-ink-3">{site.copyright}</p>
          <div className="flex items-center gap-4 text-[13px]">
            <Link to="/login" className="text-ink-2 hover:text-ink">
              Sign in
            </Link>
            <a href={`mailto:${site.salesEmail}`} className="text-ink-2 hover:text-ink">
              {site.salesEmail}
            </a>
            <ThemeMenu />
          </div>
        </div>
      </Container>
    </footer>
  );
}
