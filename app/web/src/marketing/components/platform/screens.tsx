// Product screens drawn in code for the platform / how-it-works pages (sample data only), in the same style as ../mockups.
import {
  CalendarDays,
  CircleCheck,
  Clock,
  FileText,
  Flag,
  Globe,
  Inbox,
  Info,
  KeyRound,
  ListChecks,
  RefreshCcw,
  ShieldCheck,
  Target,
  TrendingUp,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Drawn, MockBadge, MockDelta } from '../mockups/parts';

const shell = 'rounded-xl border border-line bg-surface p-4 text-ink shadow-overlay sm:p-6';
const sub = 'rounded-lg border border-line';
const pop = (i: number) => ({ ['--mk-i' as string]: i });
const SampleNote = () => <p className="mt-3 text-right font-mono text-[11px] text-ink-3">Sample data</p>;

/** Header row of a screen: icon, title, the website and a right-hand slot. */
function ScreenHead({ icon: Icon, title, meta, right }: { icon: LucideIcon; title: string; meta: string; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <span className="flex min-w-0 items-center gap-2.5">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-text">
          <Icon className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-display text-[15px] font-semibold">{title}</span>
          <span className="block truncate text-[11px] text-ink-3">{meta}</span>
        </span>
      </span>
      {right}
    </div>
  );
}

/** Fake button inside a mockup (not interactive). */
function MockButton({ children, primary }: { children: ReactNode; primary?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center rounded-md px-2.5 text-[10.5px] font-medium',
        primary ? 'bg-accent text-accent-ink' : 'border border-line-strong bg-surface text-ink',
      )}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
const THIS_WEEK = [
  { kw: 'invoice software for small teams', why: 'Ladder rung 3', icon: Flag, badge: <MockBadge tone="accent">Writing</MockBadge> },
  { kw: 'invoice approval checklist', why: 'Striking distance · #12', icon: Target, badge: <MockBadge tone="good">Ready</MockBadge> },
];
const NEEDS_YOU = [
  { what: 'Approve the page', kw: 'best invoice automation tools', action: 'Approve' },
  { what: 'Choose the next keyword', kw: '3 recommended for your site', action: 'Review' },
];
const ALWAYS_ON = ['AI Pulse · daily', 'Rank tracking · Mon', 'Audit · monthly'];
// 4-week calendar: posts per week (filled = written, hollow = planned)
const WEEKS = [
  { w: 'Wk 41', posts: [true, false] },
  { w: 'Wk 42', posts: [false, false] },
  { w: 'Wk 43', posts: [false, false] },
  { w: 'Wk 44', posts: [false, false] },
];

/** The pipeline page: this week's posts, the "Needs you" queue, schedules that are always on and a 4-week calendar (sample data). */
export function PipelineMockup({ className }: { className?: string }) {
  return (
    <Drawn
      label="A pipeline with sample data: two posts this week, a ladder rung being written and a striking-distance page ready; two decisions waiting in Needs you; AI Pulse, rank tracking and the monthly audit always on; a four-week calendar of two posts a week."
      className={cn(shell, className)}
    >
      <ScreenHead
        icon={Workflow}
        title="Pipeline"
        meta="yourbrand.com · 2 posts a week"
        right={
          <span className="inline-flex items-center gap-1 rounded-full border border-line bg-page p-0.5 text-[10.5px] font-medium">
            <span className="rounded-full bg-accent px-2 py-0.5 text-accent-ink">Auto</span>
            <span className="px-2 py-0.5 text-ink-3">Manual</span>
          </span>
        }
      />
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className={cn(sub, 'p-3')}>
          <span className="flex items-center justify-between text-[11.5px] font-semibold">
            This week
            <span className="font-mono text-[10px] font-normal text-ink-3">Mon 10:00</span>
          </span>
          <ul className="mt-2.5 space-y-2">
            {THIS_WEEK.map((r, i) => (
              <li key={r.kw} className="mk-pop flex items-center gap-2.5 rounded-md bg-page px-2.5 py-2" style={pop(i)}>
                <r.icon className="size-3.5 shrink-0 text-accent-text" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11.5px] font-medium">{r.kw}</span>
                  <span className="block truncate text-[10px] text-ink-3">{r.why}</span>
                </span>
                {r.badge}
              </li>
            ))}
          </ul>
        </div>
        <div className={cn(sub, 'p-3')}>
          <span className="flex items-center justify-between text-[11.5px] font-semibold">
            <span className="flex items-center gap-1.5">
              <Inbox className="size-3.5 text-accent-text" />
              Needs you
            </span>
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-accent font-mono text-[10px] text-accent-ink">2</span>
          </span>
          <ul className="mt-2.5 space-y-2">
            {NEEDS_YOU.map((r, i) => (
              <li key={r.kw} className="mk-pop flex items-center gap-2 rounded-md border border-line px-2.5 py-2" style={pop(i + 2)}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11.5px] font-medium">{r.what}</span>
                  <span className="block truncate text-[10px] text-ink-3">{r.kw}</span>
                </span>
                <MockButton primary={i === 0}>{r.action}</MockButton>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className={cn(sub, 'mk-pop mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 p-3')} style={pop(5)}>
        <span className="text-[11.5px] font-semibold">Always on</span>
        {ALWAYS_ON.map((t) => (
          <span key={t} className="inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-[10.5px] text-ink-2">
            <span className="mk-pulse size-1.5 rounded-full bg-accent" />
            {t}
          </span>
        ))}
      </div>
      <div className={cn(sub, 'mt-3 p-3')}>
        <span className="flex items-center gap-1.5 text-[11.5px] font-semibold">
          <CalendarDays className="size-3.5 text-ink-3" />
          Next 4 weeks
        </span>
        <ol className="mt-2.5 grid grid-cols-4 gap-2">
          {WEEKS.map((wk, i) => (
            <li key={wk.w} className={cn('mk-pop rounded-md px-2 py-2', i === 0 ? 'bg-accent-soft' : 'bg-page')} style={pop(i + 6)}>
              <span className={cn('block truncate font-mono text-[10px]', i === 0 ? 'text-accent-text' : 'text-ink-3')}>{wk.w}</span>
              <span className="mt-1.5 flex gap-1">
                {wk.posts.map((done, j) => (
                  <span key={j} className={cn('h-1.5 flex-1 rounded-full', done ? 'bg-accent' : i === 0 ? 'bg-accent/30' : 'bg-line-strong')} />
                ))}
              </span>
            </li>
          ))}
        </ol>
      </div>
      <SampleNote />
    </Drawn>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
const REPORT_KPIS = [
  { label: 'Clicks', value: '12.4K', delta: '8.2' },
  { label: 'Avg. position', value: '9.1', delta: '0.7', suffix: '' },
  { label: 'AI mention rate', value: '34%', delta: '3', suffix: ' pts' },
];
const CHANGES: { tone: 'good' | 'warning' | 'accent'; label: string; text: string }[] = [
  { tone: 'good', label: 'Up', text: '3 ladder pages moved into the top 10' },
  { tone: 'warning', label: 'Lost', text: '1 link lost after two misses: the page was removed' },
  { tone: 'accent', label: 'New', text: 'Cited in AI Overviews for 2 more buyer questions' },
];
const NEXT = [
  { t: 'Refresh “invoice approval workflow”', c: 'est. $0.40' },
  { t: 'Reclaim the lost link with an outreach draft', c: 'est. $0.05' },
];

/** The Monday report: headline numbers, what changed and the next steps, exportable as PDF or Word (sample data). */
export function ReportMockup({ className }: { className?: string }) {
  return (
    <Drawn
      label="A Monday report with sample data: clicks, average position and AI mention rate with their changes; three changes of the week; two recommended next steps with their estimated cost; export as PDF or Word."
      className={cn(shell, className)}
    >
      <ScreenHead
        icon={FileText}
        title="Monday report"
        meta="yourbrand.com · week 41"
        right={
          <span className="flex gap-1.5">
            {['PDF', 'Word'].map((f) => (
              <span key={f} className="rounded-md border border-line px-2 py-0.5 font-mono text-[10px] text-ink-2">
                {f}
              </span>
            ))}
          </span>
        }
      />
      <dl className="mt-4 grid grid-cols-3 gap-2">
        {REPORT_KPIS.map((k, i) => (
          <div key={k.label} className="mk-pop rounded-lg border border-line bg-page px-3 py-2.5" style={pop(i)}>
            <dt className="min-h-[2.4em] text-[10.5px] leading-tight text-ink-3 sm:min-h-0">{k.label}</dt>
            <dd className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
              <span className="font-display text-base font-semibold tabular sm:text-lg">{k.value}</span>
              <MockDelta value={k.delta} suffix={k.suffix} />
            </dd>
          </div>
        ))}
      </dl>
      <div className={cn(sub, 'mt-3 p-3')}>
        <span className="block text-[11.5px] font-semibold">What changed</span>
        <ul className="mt-2.5 space-y-2">
          {CHANGES.map((c, i) => (
            <li key={c.text} className="mk-pop flex items-center gap-2.5 text-[11.5px] leading-snug" style={pop(i + 3)}>
              <MockBadge tone={c.tone} icon={c.tone === 'good' ? TrendingUp : undefined} className="w-[52px] justify-center">
                {c.label}
              </MockBadge>
              <span className="min-w-0 text-ink-2">{c.text}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className={cn(sub, 'mt-3 p-3')}>
        <span className="flex items-center gap-1.5 text-[11.5px] font-semibold">
          <ListChecks className="size-3.5 text-ink-3" />
          Next steps
        </span>
        <ol className="mt-2.5 space-y-2">
          {NEXT.map((n, i) => (
            <li key={n.t} className="mk-pop flex items-center gap-2.5" style={pop(i + 6)}>
              <span className="font-mono text-[10px] text-accent-text tabular">{String(i + 1).padStart(2, '0')}</span>
              <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium">{n.t}</span>
              <span className="hidden font-mono text-[10px] text-ink-3 tabular sm:inline">{n.c}</span>
              <MockButton primary={i === 0}>Start</MockButton>
            </li>
          ))}
        </ol>
      </div>
      <SampleNote />
    </Drawn>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
const PROOF = [
  { t: 'Search Console', d: 'You own the property', on: true },
  { t: 'DNS TXT record', d: 'Add one record at your DNS host', on: false },
  { t: 'Meta tag', d: 'Add one tag to your home page', on: false },
];
const LINKS = [
  { t: 'Google Search Console', d: 'Service account added as a user' },
  { t: 'Google Analytics 4', d: 'Property found for yourbrand.com' },
];

/** Connecting a website: proving ownership three ways, then Search Console and GA4 (sample data). */
export function ConnectMockup({ className }: { className?: string }) {
  return (
    <Drawn
      label="Connecting a website with sample data: ownership proven through Search Console, with DNS TXT record and meta tag as the other options; Google Search Console and Google Analytics 4 connected."
      className={cn(shell, className)}
    >
      <ScreenHead icon={Globe} title="Add a website" meta="yourbrand.com" right={<MockBadge tone="good" icon={ShieldCheck}>Verified</MockBadge>} />
      <div className={cn(sub, 'mt-4 p-3')}>
        <span className="flex items-center gap-1.5 text-[11.5px] font-semibold">
          <KeyRound className="size-3.5 text-ink-3" />
          Prove you own it
        </span>
        <ul className="mt-2.5 space-y-1.5">
          {PROOF.map((p, i) => (
            <li
              key={p.t}
              className={cn('mk-pop flex items-center gap-2.5 rounded-md border px-2.5 py-2', p.on ? 'border-accent bg-accent-soft' : 'border-line')}
              style={pop(i)}
            >
              <span className={cn('inline-flex size-3.5 shrink-0 items-center justify-center rounded-full border', p.on ? 'border-accent' : 'border-line-strong')}>
                {p.on && <span className="size-1.5 rounded-full bg-accent" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11.5px] font-medium">{p.t}</span>
                <span className="block truncate text-[10px] text-ink-3">{p.d}</span>
              </span>
              {p.on && <CircleCheck className="size-4 shrink-0 text-good-text" />}
            </li>
          ))}
        </ul>
      </div>
      <div className={cn(sub, 'mt-3 p-3')}>
        <span className="block text-[11.5px] font-semibold">Connect Google</span>
        <ul className="mt-2.5 space-y-2">
          {LINKS.map((l, i) => (
            <li key={l.t} className="mk-pop flex items-center justify-between gap-2" style={pop(i + 3)}>
              <span className="min-w-0">
                <span className="block truncate text-[11.5px] font-medium">{l.t}</span>
                <span className="block truncate text-[10px] text-ink-3">{l.d}</span>
              </span>
              <MockBadge tone="good">Connected</MockBadge>
            </li>
          ))}
        </ul>
      </div>
      <p className="mk-pop mt-3 flex items-center gap-1.5 text-[11px] text-ink-3" style={pop(5)}>
        <Info className="size-3.5 shrink-0" />
        Website data appears once ownership is verified.
      </p>
    </Drawn>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
const LIVE_CHECKS = ['Found in your sitemap', 'Title and meta description', 'Author box and expert reviewer', 'Article, Person and FAQ schema', '3 images with alt text', 'Links up the ladder'];

/** The live check of a published page (sample data). */
export function PublishCheckMockup({ className }: { className?: string }) {
  return (
    <Drawn
      label="A live check of a published page with sample data: found in the sitemap, title and meta description, author box and reviewer, schema, three images with alt text and links up the ladder all pass; rank tracking starts on Monday."
      className={cn(shell, className)}
    >
      <ScreenHead icon={CircleCheck} title="Live page check" meta="yourbrand.com/blog/invoice-approval-workflow" right={<MockBadge tone="good">Published</MockBadge>} />
      <ul className="mt-4 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {LIVE_CHECKS.map((c, i) => (
          <li key={c} className="mk-pop flex items-center gap-2 rounded-md border border-line bg-page px-2.5 py-2 text-[11.5px]" style={pop(i)}>
            <CircleCheck className="size-3.5 shrink-0 text-good-text" />
            <span className="truncate text-ink-2">{c}</span>
          </li>
        ))}
      </ul>
      <div className="mk-pop mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-3" style={pop(7)}>
        <span className="flex items-center gap-2 text-[11.5px]">
          <Clock className="size-3.5 text-accent-text" />
          <span>
            Rank tracking starts <span className="font-medium">Monday 08:00</span>
          </span>
        </span>
        <span className="flex gap-1.5">
          {['article.html', 'meta.json'].map((f) => (
            <span key={f} className="rounded-md border border-line px-2 py-0.5 font-mono text-[10px] text-ink-3">
              {f}
            </span>
          ))}
        </span>
      </div>
      <SampleNote />
    </Drawn>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
const REUSED = [
  { t: 'Domain ages', d: 'checked this year' },
  { t: 'Homepage description', d: 'read this month' },
];

/** Starting a paid run: the estimate, what is reused instead of paid again and the budget left (sample data). */
export function CostMockup({ className }: { className?: string }) {
  return (
    <Drawn
      label="Starting a full SEO report with sample data: an estimated cost and time, two results reused from earlier runs and not paid again, and the monthly budget with what is left."
      className={cn(shell, className)}
    >
      <ScreenHead icon={FileText} title="Full SEO report" meta="yourbrand.com · ready to start" />
      <dl className="mt-4 grid grid-cols-2 gap-2">
        <div className="mk-pop rounded-lg border border-line bg-page px-3 py-2.5" style={pop(0)}>
          <dt className="text-[10.5px] text-ink-3">Estimated cost</dt>
          <dd className="mt-1 font-display text-lg font-semibold tabular">$1.10</dd>
        </div>
        <div className="mk-pop rounded-lg border border-line bg-page px-3 py-2.5" style={pop(1)}>
          <dt className="text-[10.5px] text-ink-3">Estimated time</dt>
          <dd className="mt-1 font-display text-lg font-semibold tabular">≈ 12 min</dd>
        </div>
      </dl>
      <div className={cn(sub, 'mt-3 p-3')}>
        <span className="flex items-center gap-1.5 text-[11.5px] font-semibold">
          <RefreshCcw className="size-3.5 text-ink-3" />
          Reused, not paid again
        </span>
        <ul className="mt-2 space-y-1.5">
          {REUSED.map((r, i) => (
            <li key={r.t} className="mk-pop flex items-center justify-between gap-2 text-[11.5px]" style={pop(i + 2)}>
              <span className="flex items-center gap-1.5">
                <CircleCheck className="size-3.5 text-good-text" />
                {r.t}
              </span>
              <span className="text-[10.5px] text-ink-3">{r.d}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mk-pop mt-3 rounded-lg border border-line p-3" style={pop(4)}>
        <span className="flex items-baseline justify-between text-[11.5px]">
          <span className="font-semibold">Budget this month</span>
          <span className="font-mono text-ink-2 tabular">$184 of $400</span>
        </span>
        <span className="mt-2 block h-2 overflow-hidden rounded-full bg-surface-2">
          <span className="mk-grow-x block h-full w-[46%] rounded-full bg-accent" />
        </span>
      </div>
      <div className="mk-pop mt-4 flex items-center justify-end gap-2" style={pop(5)}>
        <MockButton>Cancel</MockButton>
        <MockButton primary>Start run</MockButton>
      </div>
      <SampleNote />
    </Drawn>
  );
}
