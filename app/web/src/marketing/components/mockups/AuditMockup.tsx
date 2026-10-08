import { Download, FileArchive } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Drawn, MockBadge, MockDelta } from './parts';

const ISSUES: { t: string; tone: 'critical' | 'warning' | 'neutral'; sev: string; pages: number }[] = [
  { t: 'Sitemap lists URLs that return 404', tone: 'critical', sev: 'Critical', pages: 4 },
  { t: 'Crawled, currently not indexed', tone: 'warning', sev: 'High', pages: 12 },
  { t: 'Redirect chains', tone: 'warning', sev: 'High', pages: 8 },
  { t: 'Missing Organization schema', tone: 'neutral', sev: 'Medium', pages: 1 },
];
const FILES = ['robots.txt', 'llms.txt', 'redirects.csv', 'schema.json', 'internal-links.csv'];

/** A technical audit summary: health score with the change since last audit, issues by severity and the fix pack (sample data). */
export function AuditMockup({ className }: { className?: string }) {
  const score = 86;
  return (
    <Drawn
      label="A technical audit with sample data: 1,000 pages crawled, health score 86, up 4 since the last audit, four issues by severity and a fix pack with robots.txt, llms.txt, redirects, schema and internal links."
      className={cn('rounded-xl border border-line bg-surface p-4 text-ink shadow-overlay sm:p-6', className)}
    >
      <div className="flex flex-wrap items-center gap-5">
        <span className="relative inline-flex size-[76px] items-center justify-center">
          <svg viewBox="0 0 76 76" className="absolute inset-0 size-full -rotate-90" fill="none">
            <circle cx={38} cy={38} r={30} strokeWidth={6} className="stroke-surface-2" />
            <circle cx={38} cy={38} r={30} strokeWidth={6} strokeLinecap="round" pathLength={1} strokeDasharray={`${score / 100} 1`} className="stroke-accent" />
          </svg>
          <span className="font-display text-xl font-semibold">{score}</span>
        </span>
        <div className="min-w-0 flex-1">
          <span className="block text-[11px] text-ink-3">Technical audit · 1,000 pages · JavaScript on</span>
          <span className="mt-0.5 block font-display text-[15px] font-semibold">Site health</span>
          <span className="mt-1 flex items-center gap-2 text-[11.5px] text-ink-2">
            <MockDelta value="4" suffix="" /> since the last audit
          </span>
        </div>
      </div>
      <ul className="mt-5 divide-y divide-line border-y border-line">
        {ISSUES.map((it, i) => (
          <li key={it.t} className="mk-pop flex items-center justify-between gap-3 py-2.5" style={{ ['--mk-i' as string]: i }}>
            <span className="min-w-0">
              <span className="block truncate text-[12.5px] font-medium">{it.t}</span>
              <span className="font-mono text-[10.5px] text-ink-3 tabular">
                {it.pages} {it.pages === 1 ? 'page' : 'pages'}
              </span>
            </span>
            <MockBadge tone={it.tone}>{it.sev}</MockBadge>
          </li>
        ))}
      </ul>
      <div className="mk-pop mt-4 rounded-lg border border-line bg-page p-3" style={{ ['--mk-i' as string]: 5 }}>
        <span className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[12px] font-semibold">
            <FileArchive className="size-3.5 text-accent-text" />
            Fix pack
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-[11px] font-medium text-accent-ink">
            <Download className="size-3" />
            Download
          </span>
        </span>
        <span className="mt-2.5 flex flex-wrap gap-1.5">
          {FILES.map((f) => (
            <span key={f} className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[10.5px] text-ink-2">
              {f}
            </span>
          ))}
        </span>
      </div>
      <p className="mt-3 text-right font-mono text-[11px] text-ink-3">Sample data</p>
    </Drawn>
  );
}
