// KI (2026-11-08, DESIGN.md §6): one competitor in a side panel (full screen on phones), loaded only when opened: what it is and why it is
// on the list, its size, its top pages, the searches it ranks for (sort, filter, CSV) and where it overlaps with you.
import { useState } from 'react';
import { KI_CLASSES, KI_SIZE_LABELS, KI_VERDICTS, compactNumber, type KiSizeTag, type KiVerdict as Verdict } from '@seo/shared';
import { Sheet } from '@/components/ui/overlay';
import { DataTable, type Column } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { KiVerdict } from '@/components/site/KiVerdict';
import { kiBasisLine, pctText, type KiComp, type KiKw } from '@/lib/ki';
import { Skeleton } from '@/components/ui/feedback';
import { FilterChips } from '../kit';
import { KiFigure } from './common';

/** PERF_SAFETY L6: a link from provider data opens only an http(s) address (React does not block `javascript:`). */
const safeHref = (u: string): string | undefined => (/^https?:\/\//i.test(u) ? u : undefined);

interface ProfileRow {
  key: string;
  keyword: string;
  theirs: number;
  yours: number | null;
  volume: number | null;
  verdict: Verdict;
  url: string;
}

/** The searches this competitor ranks for among your keyword research, with your own place beside theirs. */
export function competitorKeywordRows(domain: string, rows: readonly KiKw[]): ProfileRow[] {
  const d = domain.replace(/^www\./, '');
  return rows
    .map((r) => {
      const c = r.competitors.find((x) => x.domain.replace(/^www\./, '') === d);
      return c ? { key: r.key, keyword: r.keyword, theirs: c.position, yours: r.gscPosition, volume: r.volume ?? r.gscImpressions, verdict: r.verdict, url: c.url } : null;
    })
    .filter((x): x is ProfileRow => !!x);
}

/** Overlap in three plain counts: both of you rank, only they rank, only you rank. */
export function overlapOf(domain: string, rows: readonly KiKw[]) {
  const theirs = competitorKeywordRows(domain, rows);
  const both = theirs.filter((r) => r.yours != null && r.yours <= 100).length;
  const mine = rows.filter((r) => r.gscPosition != null && r.gscPosition <= 100).length;
  return { both, onlyThem: theirs.length - both, onlyYou: Math.max(0, mine - both) };
}

const position = (n: number | null) => (n == null || n <= 0 ? '-' : `#${Math.round(n)}`);

export default function CompetitorDrawer({ comp, keywords, loading, open, onOpenChange, ownDomain }: { comp: KiComp; keywords: readonly KiKw[]; loading?: boolean; open: boolean; onOpenChange: (o: boolean) => void; ownDomain: string }) {
  const p = comp.profile;
  const b = (k: string) => kiBasisLine(p?.basis?.[k] ?? 'provider_estimate', 'our keyword data', p?.fetched_at);
  const all = competitorKeywordRows(comp.domain, keywords);
  // review UX M4: one filter = chips above the table (no second full-screen sheet on a phone)
  const [verdict, setVerdict] = useState<'' | Verdict>('');
  const rows = verdict ? all.filter((r) => r.verdict === verdict) : all;
  const ov = overlapOf(comp.domain, keywords);
  const verdicts = (['go', 'months', 'hard', 'unknown'] as const).filter((v) => all.some((r) => r.verdict === v));
  const cols: Column<ProfileRow>[] = [
    { key: 'keyword', header: 'Search', sortValue: (r) => r.keyword, cell: (r) => <span className="font-medium">{r.keyword}</span> },
    { key: 'theirs', header: 'Their place', align: 'right', sortValue: (r) => r.theirs, cell: (r) => position(r.theirs), csv: (r) => r.theirs },
    { key: 'yours', header: 'Your place', align: 'right', sortValue: (r) => r.yours ?? 999, cell: (r) => position(r.yours), csv: (r) => r.yours ?? '' },
    { key: 'volume', header: 'Searches a month', align: 'right', sortValue: (r) => r.volume ?? -1, cell: (r) => (r.volume == null ? '-' : compactNumber(r.volume)), csv: (r) => r.volume ?? '' },
    {
      key: 'verdict',
      header: 'For you',
      sortValue: (r) => r.verdict,
      cell: (r) => <KiVerdict verdict={r.verdict} size="sm" />,
      csv: (r) => KI_VERDICTS[r.verdict],
    },
  ];
  return (
    <Sheet open={open} onOpenChange={onOpenChange} wide title={comp.domain} description={`${KI_CLASSES[comp.cls]} · ${KI_SIZE_LABELS[(comp.sizeTag as KiSizeTag) in KI_SIZE_LABELS ? (comp.sizeTag as KiSizeTag) : 'unknown']}`}>
      <div className="space-y-6">
        {comp.reasons.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-ink">Why it is on your list</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-2">
              {comp.reasons.slice(0, 5).map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h3 className="text-sm font-semibold text-ink">Its size</h3>
          {p ? (
            <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { l: 'Visits a month from Google', v: p.etv == null ? '-' : compactNumber(p.etv), tip: 'About how many visits a month its pages get from Google searches.', k: 'etv' },
                { l: 'Searches it ranks for', v: p.keywords == null ? '-' : compactNumber(p.keywords), tip: 'How many different searches show one of its pages in the first 100 results.', k: 'keywords' },
                { l: 'Websites linking to it', v: p.refdomains == null ? '-' : compactNumber(p.refdomains), tip: 'How many different websites link to it. More links usually means it is harder to outrank.', k: 'refdomains' },
                { l: 'New pages a month', v: p.pace_per_month == null ? '-' : String(Math.round(p.pace_per_month)), tip: 'About how many new or updated pages it publishes a month, from its sitemap.', k: 'pace_per_month' },
              ].map((f) => (
                <div key={f.l} className="rounded-lg border border-line bg-page p-3">
                  <dt className="text-xs text-ink-3">{f.l}</dt>
                  <dd className="mt-1 font-display text-lg font-semibold text-ink">
                    <KiFigure value={f.v} tip={f.tip} basis={b(f.k)} />
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-2 text-sm text-ink-3">Its size is read when you choose it as one of your competitors.</p>
          )}
          {p?.brand_share != null && <p className="mt-2 text-xs text-ink-3">{pctText(p.brand_share)} of its visits come from people searching for its own name.</p>}
        </section>

        {p?.top_pages?.length ? (
          <section>
            <h3 className="text-sm font-semibold text-ink">Its pages that bring the most visits</h3>
            <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
              {p.top_pages.slice(0, 10).map((t) => (
                <li key={t.url} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <a href={safeHref(t.url)} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-accent-text hover:underline" title={t.url}>
                    {t.url.replace(/^https?:\/\/(www\.)?/, '')}
                  </a>
                  {t.page_type && <Badge className="h-5 px-1.5 font-normal">{t.page_type.replace(/_/g, ' ')}</Badge>}
                  <span className="text-xs tabular text-ink-3">{t.etv == null ? '' : `about ${compactNumber(t.etv)} visits a month`}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section>
          <h3 className="text-sm font-semibold text-ink">Where you overlap</h3>
          {/* review UX M9: counted on the searches the page read, said so */}
          <p className="mt-0.5 text-xs text-ink-3">Among your {keywords.length >= 200 ? '200 best' : keywords.length} researched searches.</p>
          <dl className="mt-2 grid grid-cols-3 gap-3">
            {[
              { l: 'You both rank', v: ov.both, tip: 'Searches from your research where you and this competitor are both in the first 100 results.' },
              { l: 'Only they rank', v: ov.onlyThem, tip: 'Searches where this competitor shows up and you do not yet: the clearest openings.' },
              { l: 'Only you rank', v: ov.onlyYou, tip: 'Searches where you show up and this competitor does not.' },
            ].map((f) => (
              <div key={f.l} className="rounded-lg border border-line bg-page p-3">
                <dt className="text-xs text-ink-3">{f.l}</dt>
                <dd className="mt-1 font-display text-lg font-semibold text-ink">
                  {loading ? <Skeleton className="h-6 w-10" /> : <KiFigure value={f.v} tip={f.tip} basis={`measured, among your ${keywords.length >= 200 ? '200 best' : keywords.length} researched searches`} />}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-ink">Searches it ranks for</h3>
          <p className="mt-0.5 text-xs text-ink-3">From your keyword research. Your place is from your Search Console.</p>
          {verdicts.length > 1 && (
            <FilterChips
              label="For you"
              className="mt-2 [&>button]:max-md:h-10"
              value={verdict}
              onChange={setVerdict}
              options={[{ value: '' as const, label: 'All', count: all.length }, ...verdicts.map((v) => ({ value: v, label: KI_VERDICTS[v], count: all.filter((r) => r.verdict === v).length }))]}
            />
          )}
          <div className="mt-2">
            {loading ? <Skeleton className="h-40 rounded-lg" /> : (
            <DataTable
              rows={rows}
              columns={cols}
              rowKey={(r) => r.key}
              initialSort={{ key: 'volume', dir: 'desc' }}
              pageSize={15}
              searchable
              searchPlaceholder="Search these searches"
              searchText={(r) => r.keyword}
              csv={{ fileName: `${comp.domain}-searches.csv` }}
              stickyFirst
              dense
              mobileCard={(r) => (
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0 font-medium text-ink">{r.keyword}</span>
                    <KiVerdict verdict={r.verdict} size="sm" className="shrink-0 items-end" />
                  </div>
                  <p className="text-xs text-ink-3">
                    Their place {position(r.theirs)} · your place {position(r.yours)}
                    {r.volume != null ? ` · ${compactNumber(r.volume)} searches a month` : ''}
                  </p>
                </div>
              )}
              empty={keywords.length ? `None of your researched searches shows ${comp.domain} yet.` : 'Run Keyword research to see the searches it ranks for.'}
            />
            )}
          </div>
        </section>
        <p className="text-xs text-ink-3">Your website: {ownDomain}</p>
      </div>
    </Sheet>
  );
}
