import { NavLink, useLocation } from 'react-router';
import { cn } from '@/lib/utils';
import { Container, Eyebrow } from '../components';
import { ArrowLink } from '../components/company/PageHero';
import { fmtLongDate } from '../components/company/changelog-utils';
import { publicSources, retention, selfHosted, servicesYouConnect, subprocessors, TRUST_FACTS_AS_OF } from '../content/trust';
import { useSeo } from '../useSeo';

// /subprocessors and /data-retention: dated facts from the code and the deployment (content/trust.ts), not legal text. The Privacy
// policy, the Terms and a DPA are counsel's and stay drafts until signed off.

type DocPath = '/subprocessors' | '/data-retention';

const DOCS: Record<DocPath, { title: string; description: string; lead: string }> = {
  '/subprocessors': {
    title: 'Subprocessors',
    description: 'The companies that process customer data for Alaventra: what each one does, which data it receives and where it processes it. Facts as of the date shown.',
    lead: 'The companies that process customer data for Alaventra, what each one does and which data it receives. Where a location is not set by us, the vendor\'s own data processing terms say where it processes data.',
  },
  '/data-retention': {
    title: 'Data retention',
    description: 'How long Alaventra keeps each kind of data, from sign-in sessions to backups, and what is deleted when you delete a website, a company or your account.',
    lead: 'How long Alaventra keeps each kind of data, and what is deleted when you delete a website, a company or your account.',
  },
};

const th = 'border-b border-line bg-surface-2 px-4 py-3.5 text-left text-[12px] font-medium text-ink-3 sm:px-5';
const td = 'border-t border-line px-4 py-4 align-top text-[14px] leading-relaxed text-ink-2 sm:px-5';

function SubprocessorTable() {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="min-w-[640px] overflow-hidden rounded-xl border border-line bg-surface shadow-card">
        <table className="w-full border-separate border-spacing-0">
          <caption className="sr-only">Subprocessors</caption>
          <thead>
            <tr>
              <th scope="col" className={th}>Company</th>
              <th scope="col" className={th}>What it does for Alaventra</th>
              <th scope="col" className={th}>Data it receives</th>
              <th scope="col" className={th}>Where</th>
            </tr>
          </thead>
          <tbody>
            {subprocessors.map((s, i) => (
              <tr key={s.name}>
                <th scope="row" className={cn(td, 'font-medium text-ink', i === 0 && 'border-t-0')}>
                  {s.name}
                </th>
                <td className={cn(td, i === 0 && 'border-t-0')}>{s.purpose}</td>
                <td className={cn(td, i === 0 && 'border-t-0')}>{s.data}</td>
                <td className={cn(td, i === 0 && 'border-t-0')}>{s.location}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlainList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="mt-12">
      <h2 className="font-display text-[1.375rem] font-semibold leading-snug tracking-[-0.01em] text-ink">{title}</h2>
      <ul className="mt-4 space-y-2.5">
        {items.map((t) => (
          <li key={t} className="flex gap-3 text-[15px] leading-relaxed text-ink-2">
            <span className="mt-[10px] size-1.5 shrink-0 rounded-full bg-ink-3" aria-hidden />
            {t}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Subprocessors() {
  return (
    <>
      <SubprocessorTable />
      <PlainList title="Run on our own servers" items={selfHosted} />
      <section className="mt-12">
        <h2 className="font-display text-[1.375rem] font-semibold leading-snug tracking-[-0.01em] text-ink">Public sources we read</h2>
        <p className="mt-4 max-w-[70ch] text-[15px] leading-relaxed text-ink-2">
          We look things up in {publicSources.join(', ')}. We send them a domain or a search, never personal data.
        </p>
      </section>
      <PlainList title="Services you connect" items={servicesYouConnect} />
      <p className="mt-4 max-w-[70ch] text-[14px] leading-relaxed text-ink-3">These are your own accounts. Alaventra uses them only as you set them up, and stops when you remove the connection.</p>
    </>
  );
}

function Retention() {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="min-w-[520px] overflow-hidden rounded-xl border border-line bg-surface shadow-card">
        <table className="w-full border-separate border-spacing-0">
          <caption className="sr-only">How long each kind of data is kept</caption>
          <thead>
            <tr>
              <th scope="col" className={cn(th, 'w-[38%]')}>Data</th>
              <th scope="col" className={th}>Kept</th>
            </tr>
          </thead>
          <tbody>
            {retention.map((r, i) => (
              <tr key={r.data}>
                <th scope="row" className={cn(td, 'font-medium text-ink', i === 0 && 'border-t-0')}>
                  {r.data}
                </th>
                <td className={cn(td, i === 0 && 'border-t-0')}>{r.kept}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Serves both /subprocessors and /data-retention (chosen by the path).
export default function DataFactsPage() {
  const { pathname } = useLocation();
  const path: DocPath = pathname === '/data-retention' ? '/data-retention' : '/subprocessors';
  const doc = DOCS[path];
  useSeo({ title: doc.title, description: doc.description, path });
  return (
    <>
      <section className="border-b border-line bg-page">
        <Container className="pb-12 pt-12 sm:pb-14 sm:pt-16 lg:pt-20">
          <Eyebrow>Trust</Eyebrow>
          <nav aria-label="Data facts" className="mt-6">
            <ul className="inline-flex rounded-full border border-line bg-surface p-1 shadow-card">
              {(Object.keys(DOCS) as DocPath[]).map((p) => (
                <li key={p}>
                  <NavLink
                    to={p}
                    className={({ isActive }) =>
                      cn('inline-flex h-10 items-center rounded-full px-4 text-[13px] font-medium transition-colors duration-200 ease-brand sm:h-8', isActive ? 'bg-ink text-page' : 'text-ink-2 hover:text-ink')
                    }
                  >
                    {DOCS[p].title}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <h1 className="mt-7 font-display text-[2.5rem] font-semibold leading-[1.08] tracking-[-0.02em] text-ink sm:text-5xl">{doc.title}</h1>
          <p className="mt-4 font-mono text-[12px] text-ink-3">Facts as of {fmtLongDate(TRUST_FACTS_AS_OF)}</p>
          <p className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-ink-2">{doc.lead}</p>
        </Container>
      </section>
      <section className="bg-surface pb-24 pt-12 sm:pb-32 sm:pt-16">
        <Container>
          {path === '/subprocessors' ? <Subprocessors /> : <Retention />}
          <div className="mt-16 flex flex-col gap-4 rounded-xl border border-line bg-page p-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-[70ch] text-[14px] leading-relaxed text-ink-2">
              This page states facts about how Alaventra works today. It is not a contract: the Privacy policy and the Terms are still drafts under review by counsel.
            </p>
            <ArrowLink to="/security" className="shrink-0 text-[14px]">
              How we protect your data
            </ArrowLink>
          </div>
        </Container>
      </section>
    </>
  );
}
