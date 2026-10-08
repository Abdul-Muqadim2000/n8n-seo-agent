import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { ChevronDown, FilePenLine, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Container, Eyebrow } from '../components';
import { ArrowLink } from '../components/company/PageHero';
import { fmtLongDate } from '../components/company/changelog-utils';
import { legalDocs, type LegalDoc, type LegalSection } from '../components/company/legal';
import { useSeo } from '../useSeo';

/** The id of the section nearest the top of the viewport (under the sticky header). */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const visible = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.set(e.target.id, e.boundingClientRect.top);
          else visible.delete(e.target.id);
        }
        const first = ids.find((id) => visible.has(id));
        if (first) setActive(first);
      },
      { rootMargin: '-110px 0px -55% 0px', threshold: 0 },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [ids]);
  return active;
}

function Paragraph({ text }: { text: string }) {
  if (text.startsWith('[')) {
    return (
      <p className="rounded-lg border border-dashed border-line-strong bg-surface-2/60 px-4 py-3 text-[14px] leading-relaxed text-ink-3">
        <span className="mr-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink-2">To do</span>
        {text.slice(1, -1)}
      </p>
    );
  }
  return <p className="text-[15.5px] leading-[1.75] text-ink-2">{text}</p>;
}

function SectionBody({ s, n }: { s: LegalSection; n: number }) {
  // consecutive "• " lines become one list
  const blocks: (string | string[])[] = [];
  for (const line of s.body) {
    if (line.startsWith('• ')) {
      const last = blocks[blocks.length - 1];
      if (Array.isArray(last)) last.push(line.slice(2));
      else blocks.push([line.slice(2)]);
    } else blocks.push(line);
  }
  return (
    <section id={s.id} aria-labelledby={`${s.id}-h`} className="group/sec scroll-mt-28 border-t border-line pt-10 first:border-t-0 first:pt-0 lg:scroll-mt-32">
      <h2 id={`${s.id}-h`} className="flex items-baseline gap-3 font-display text-[1.375rem] font-semibold leading-snug tracking-[-0.01em] text-ink">
        <span className="font-mono text-[13px] font-medium text-ink-3 tabular">{String(n).padStart(2, '0')}</span>
        <span>{s.title}</span>
        <a
          href={`#${s.id}`}
          aria-label={`Link to “${s.title}”`}
          className="inline-flex size-6 items-center justify-center self-center rounded-md text-ink-3 opacity-0 transition-[opacity,color] duration-150 ease-brand hover:text-accent-text focus-visible:opacity-100 group-hover/sec:opacity-100 [@media(hover:none)]:hidden"
        >
          <Hash className="size-4" aria-hidden />
        </a>
      </h2>
      <div className="mt-5 space-y-4">
        {blocks.map((b, i) =>
          Array.isArray(b) ? (
            <ul key={i} className="space-y-2.5 pl-1">
              {b.map((li) => (
                <li key={li} className="flex gap-3 text-[15.5px] leading-[1.7] text-ink-2">
                  <span className="mt-[11px] size-1.5 shrink-0 rounded-full bg-ink-3" aria-hidden />
                  {li}
                </li>
              ))}
            </ul>
          ) : (
            <Paragraph key={i} text={b} />
          ),
        )}
      </div>
    </section>
  );
}

function Toc({ doc, active, className }: { doc: LegalDoc; active: string; className?: string }) {
  return (
    <ol className={cn('space-y-0.5', className)}>
      {doc.sections.map((s, i) => {
        const on = s.id === active;
        return (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              aria-current={on ? 'location' : undefined}
              className={cn(
                'relative flex gap-3 rounded-md py-1.5 pl-4 pr-2 text-[13.5px] leading-snug transition-colors duration-150 ease-brand',
                on ? 'font-medium text-ink' : 'text-ink-3 hover:text-ink',
              )}
            >
              <span aria-hidden className={cn('absolute inset-y-1.5 left-0 w-0.5 rounded-full transition-colors duration-200 ease-brand', on ? 'bg-accent' : 'bg-line')} />
              <span className="font-mono text-[11.5px] tabular text-ink-3">{String(i + 1).padStart(2, '0')}</span>
              {s.title}
            </a>
          </li>
        );
      })}
    </ol>
  );
}

function LegalDocument({ doc }: { doc: LegalDoc }) {
  const ids = doc.sections.map((s) => s.id);
  const [stableIds] = useState(ids);
  const active = useActiveSection(stableIds);
  const other = doc.path === '/privacy' ? legalDocs['/terms'] : legalDocs['/privacy'];
  return (
    <>
      <section className="border-b border-line bg-page">
        <Container className="pb-12 pt-12 sm:pb-14 sm:pt-16 lg:pt-20">
          <div className="animate-fade-up">
            <Eyebrow>Legal</Eyebrow>
          </div>
          {/* switch between the two documents */}
          <nav aria-label="Legal documents" className="mt-6 animate-fade-up" style={{ animationDelay: '50ms' }}>
            <ul className="inline-flex rounded-full border border-line bg-surface p-1 shadow-card">
              {[legalDocs['/privacy'], legalDocs['/terms']].map((d) => (
                <li key={d.path}>
                  <NavLink
                    to={d.path}
                    className={({ isActive }) =>
                      cn(
                        'inline-flex h-8 items-center rounded-full px-4 text-[13px] font-medium transition-colors duration-200 ease-brand',
                        isActive ? 'bg-ink text-page' : 'text-ink-2 hover:text-ink',
                      )
                    }
                  >
                    {d.title}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <h1 className="mt-7 font-display text-[2.5rem] font-semibold leading-[1.08] tracking-[-0.02em] text-ink animate-fade-up sm:text-5xl" style={{ animationDelay: '100ms' }}>
            {doc.title}
          </h1>
          <p className="mt-4 font-mono text-[12px] text-ink-3 animate-fade-up" style={{ animationDelay: '150ms' }}>
            Last updated: draft of {fmtLongDate(doc.updated)}
          </p>
          <div
            role="note"
            className="mt-8 flex max-w-3xl gap-4 rounded-xl border border-warning-text/30 bg-warning-soft px-5 py-4 animate-fade-up"
            style={{ animationDelay: '200ms' }}
          >
            <FilePenLine className="mt-0.5 size-5 shrink-0 text-warning-text" aria-hidden />
            <div>
              <p className="text-[15px] font-semibold text-ink">Draft — to be reviewed by counsel before launch</p>
              <p className="mt-1 text-[14px] leading-relaxed text-ink-2">
                This page shows the planned structure with placeholder text. It is not yet a binding policy, and the sections marked “To do” are still to be written.
              </p>
            </div>
          </div>
        </Container>
      </section>

      <section className="bg-surface pb-24 pt-12 sm:pb-32 sm:pt-16">
        <Container>
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-16">
            {/* contents: a collapsible list on small screens, a sticky column with the current section marked on wide ones */}
            <details className="group/toc rounded-xl border border-line bg-page lg:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[14px] font-medium text-ink [&::-webkit-details-marker]:hidden">
                On this page
                <ChevronDown className="size-4 text-ink-3 transition-transform duration-200 ease-brand group-open/toc:rotate-180" aria-hidden />
              </summary>
              <div className="border-t border-line px-2 py-3">
                <Toc doc={doc} active={active} />
              </div>
            </details>
            <nav aria-label="On this page" className="hidden lg:block">
              <div className="sticky top-28">
                <p className="mb-3 pl-4 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3">On this page</p>
                <Toc doc={doc} active={active} />
              </div>
            </nav>

            <article className="min-w-0 max-w-[70ch]">
              <p className="text-lg leading-relaxed text-ink">{doc.intro}</p>
              <div className="mt-12 space-y-10">
                {doc.sections.map((s, i) => (
                  <SectionBody key={s.id} s={s} n={i + 1} />
                ))}
              </div>
              <div className="mt-16 flex flex-col gap-4 rounded-xl border border-line bg-page p-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[14px] leading-relaxed text-ink-2">
                  Questions about this page?{' '}
                  <Link to="/contact" className="font-medium text-accent-text underline-offset-4 hover:underline">
                    Contact us
                  </Link>
                  .
                </p>
                <ArrowLink to={other.path} className="text-[14px]">
                  Read the {other.title.toLowerCase()}
                </ArrowLink>
              </div>
            </article>
          </div>
        </Container>
      </section>
    </>
  );
}

// Serves both /privacy and /terms (chosen by the path).
export default function LegalPage() {
  const { pathname } = useLocation();
  const doc = pathname === '/terms' ? legalDocs['/terms'] : legalDocs['/privacy'];
  useSeo({ title: doc.title, description: doc.description, path: doc.path });
  return <LegalDocument key={doc.path} doc={doc} />;
}
