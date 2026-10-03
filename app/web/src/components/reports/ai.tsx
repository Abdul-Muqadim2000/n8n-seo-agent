import type { ReactNode } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, CircleMinus, Globe, Link2, MessageSquareQuote, XCircle } from 'lucide-react';
import { AI_ENGINES, type ReportDetail } from '@seo/shared';
import { fmtDateTime } from '@/lib/utils';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Callout } from '@/components/ui/feedback';
import { Delta, ExternalLink, StatTile } from '@/components/ui/misc';
import { DataTable, type Column } from '@/components/ui/table';
import { ShareBars } from '@/components/charts';
import { ActionList, BriefCard } from './actions';
import { AlertList, Block, Chips, Empty, has, n, num, obj, objs, pct, SectionTitle, shortUrl, str, strs, type P } from './kit';

const ENGINE_ORDER = AI_ENGINES.map((e) => e.value as string);
const engineRank = (k: string) => {
  const i = ENGINE_ORDER.indexOf(k);
  return i < 0 ? 99 : i;
};
const engineName = (key: string, engines: P) => str(obj(engines[key]).name) || AI_ENGINES.find((e) => e.value === key)?.label || key;

const CELL: Record<string, { label: string; cls: string; icon: ReactNode }> = {
  cited: { label: 'Cited', cls: 'bg-good-soft text-good-text', icon: <Link2 className="size-3.5" aria-hidden /> },
  mentioned: { label: 'Named', cls: 'bg-good-soft text-good-text', icon: <CheckCircle2 className="size-3.5" aria-hidden /> },
  absent: { label: 'Not named', cls: 'bg-surface-2 text-ink-3', icon: <XCircle className="size-3.5" aria-hidden /> },
  error: { label: 'Error', cls: 'bg-warning-soft text-warning-text', icon: <AlertTriangle className="size-3.5" aria-hidden /> },
  monthly: { label: 'Monthly', cls: 'bg-surface-2 text-ink-3', icon: <CalendarClock className="size-3.5" aria-hidden /> },
  none: { label: 'No answer', cls: 'bg-surface-2 text-ink-3', icon: <CircleMinus className="size-3.5" aria-hidden /> },
};

function AnswerCell({ value }: { value: string }) {
  const c = CELL[value] ?? CELL.none;
  return (
    <span className={`inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-md px-1.5 text-xs font-medium ${c.cls}`}>
      {c.icon}
      {c.label}
    </span>
  );
}

const ptsDelta = (v: unknown) => (num(v) == null ? undefined : <Delta value={num(v)} suffix=" pts" digits={1} label="vs last check" />);

export function AiVisibilityReport({ report }: { report: ReportDetail }) {
  const p = report.payload;
  const m = obj(p.metrics);
  const delta = obj(m.delta);
  const brand = obj(m.brand);
  const engines = obj(p.engines);
  const engineKeys = Object.keys(engines).sort((a, b) => engineRank(a) - engineRank(b));
  const questions = objs(p.questions);
  const competitors = objs(p.competitors);
  const sources = objs(p.sources);
  const ourPages = objs(p.our_pages);
  const gaps = objs(p.gaps);
  const market = obj(p.market);
  const domain = str(p.domain);

  const sourceCols: Column<P>[] = [
    { key: 'domain', header: 'Source', sortValue: (r) => str(r.domain), cell: (r) => <span className="font-medium text-ink">{str(r.domain)}</span> },
    { key: 'kind', header: 'Type', sortValue: (r) => str(r.kind), cell: (r) => <Badge tone={str(r.kind) === 'official' ? 'accent' : 'neutral'}>{str(r.kind) || 'site'}</Badge> },
    { key: 'citations', header: 'Citations', align: 'right', sortValue: (r) => num(r.citations), cell: (r) => n(r.citations) },
    { key: 'engines', header: 'Cited by', cell: (r) => <span className="text-[13px] text-ink-2">{strs(r.engines).join(', ')}</span>, hideOnMobile: true },
    { key: 'topics', header: 'For', cell: (r) => <span className="text-[13px] text-ink-3">{strs(r.topics).slice(0, 3).join(' · ')}</span>, hideOnMobile: true },
  ];

  const sov = [
    ...(num(m.share_of_voice) != null ? [{ label: domain || 'You', value: num(m.share_of_voice) ?? 0 }] : []),
    ...competitors.map((c) => ({ label: str(c.domain), value: num(c.share) ?? 0, sub: `${num(c.mentions) ?? 0} mentions` })),
  ].sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-5">
      {has(p.brief) && <BriefCard brief={obj(p.brief)} />}
      <AlertList alerts={objs(p.alerts)} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Named in AI answers" value={pct(m.mention_rate)} delta={ptsDelta(delta.mention_rate)} hint={`${num(m.mentioned) ?? 0} of ${num(m.answered) ?? 0} answers`} />
        <StatTile label="Cited with a link" value={pct(m.citation_rate)} delta={ptsDelta(delta.citation_rate)} hint={`${num(m.cited) ?? 0} answers link to your site`} />
        <StatTile label="Share of voice" value={pct(m.share_of_voice)} delta={ptsDelta(delta.share_of_voice)} hint="Your mentions among all brands named" />
        <StatTile
          label="AI knows your brand"
          value={num(brand.answered) ? `${num(brand.known) ?? 0} / ${num(brand.answered)}` : m.brand_known === true ? 'Yes' : m.brand_known === false ? 'No' : '–'}
          hint={num(brand.answered) ? 'assistants that describe you correctly' : undefined}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Google AI Overviews shown" value={pct(m.aio_presence)} hint={`on your buyer questions · cite you ${pct(m.aio_citation_rate)}`} />
        <StatTile label="Answers collected" value={`${num(m.answered) ?? 0} / ${num(m.asked) ?? 0}`} hint={num(m.errors) ? `${num(m.errors)} failed and will be retried` : 'questions × assistants'} />
        <StatTile label="Average rank when named" value={num(m.avg_rank) ? `#${num(m.avg_rank)}` : '–'} hint="position in the answer's list of brands" />
      </div>

      {questions.length > 0 && (
        <Block title="Buyer questions × AI assistants" description={`Who names ${domain || 'you'} when buyers ask${str(p.checked_at) ? ` · ${fmtDateTime(str(p.checked_at))}` : ''}`} icon={<MessageSquareQuote className="size-4" />}>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-surface-2">
                <tr>
                  <th scope="col" className="border-b border-line px-3 py-2 text-left text-xs font-medium text-ink-3">
                    Question
                  </th>
                  {engineKeys.map((k) => (
                    <th key={k} scope="col" className="whitespace-nowrap border-b border-line px-2 py-2 text-left text-xs font-medium text-ink-3">
                      {engineName(k, engines)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {questions.map((q, i) => {
                  const cells = obj(q.engines);
                  return (
                    <tr key={i} className="border-b border-line align-top last:border-0">
                      <td className="min-w-[260px] px-3 py-2.5">
                        <p className="text-ink">{str(q.prompt)}</p>
                        <p className="mt-0.5 text-xs text-ink-3">
                          {[str(q.kind), str(q.topic)].filter(Boolean).join(' · ')}
                          {q.won === true && <span className="ml-1.5 font-medium text-good-text">· won</span>}
                        </p>
                        {strs(q.competitors).length > 0 && <p className="mt-1 text-xs text-ink-3">Named instead: {strs(q.competitors).slice(0, 4).join(', ')}</p>}
                      </td>
                      {engineKeys.map((k) => (
                        <td key={k} className="px-2 py-2.5">
                          <AnswerCell value={str(cells[k]) || 'none'} />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-ink-3">Named = the answer mentions you; Cited = it also links to your site; Monthly = asked on the monthly full check (Gemini and Claude).</p>
        </Block>
      )}

      {engineKeys.length > 0 && (
        <Block title="By assistant">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-ink-3">
                  <th className="border-b border-line px-2 py-1.5 text-left font-medium">Assistant</th>
                  <th className="border-b border-line px-2 py-1.5 text-right font-medium">Answered</th>
                  <th className="border-b border-line px-2 py-1.5 text-right font-medium">Named</th>
                  <th className="border-b border-line px-2 py-1.5 text-right font-medium">Cited</th>
                  <th className="border-b border-line px-2 py-1.5 text-left font-medium">Knows brand</th>
                </tr>
              </thead>
              <tbody>
                {engineKeys.map((k) => {
                  const e = obj(engines[k]);
                  return (
                    <tr key={k} className="border-b border-line last:border-0">
                      <td className="px-2 py-2 text-ink">
                        {engineName(k, engines)} {e.carried === true && <Badge className="ml-1">monthly result</Badge>}
                      </td>
                      <td className="px-2 py-2 text-right tabular">
                        {num(e.answered) ?? 0}/{num(e.asked) ?? 0}
                      </td>
                      <td className="px-2 py-2 text-right tabular">{pct(e.mention_rate)}</td>
                      <td className="px-2 py-2 text-right tabular">{pct(e.citation_rate)}</td>
                      <td className="px-2 py-2">{e.knows_brand === true ? <StatusBadge tone="good">Yes</StatusBadge> : e.knows_brand === false ? <StatusBadge tone="warning">No</StatusBadge> : <span className="text-xs text-ink-3">–</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Block>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {sov.length > 0 && (
          <Block title="Share of voice" description="Brands AI names on your buyer questions">
            <ShareBars items={sov} highlight={domain || 'You'} />
          </Block>
        )}
        {ourPages.length > 0 ? (
          <Block title="Your pages AI cites">
            <ul className="space-y-1.5 text-sm">
              {ourPages.map((x, i) => (
                <li key={i} className="flex items-center justify-between gap-3">
                  <ExternalLink href={str(x.url)} className="text-[13px]">
                    {shortUrl(str(x.url))}
                  </ExternalLink>
                  <span className="shrink-0 tabular text-ink-2">{num(x.citations) ?? 0}×</span>
                </li>
              ))}
            </ul>
          </Block>
        ) : (
          <Block title="Your pages AI cites">
            <Empty>No page of {domain || 'your site'} was cited this time. Pages that answer the question directly, cite official sources and carry clear facts get cited first.</Empty>
          </Block>
        )}
      </div>

      {sources.length > 0 && (
        <Block title="Sources AI trusts" description="The sites assistants cite for your topics: get mentioned or linked there" icon={<Globe className="size-4" />}>
          <DataTable rows={sources} columns={sourceCols} rowKey={(r, i) => `${str(r.domain)}-${i}`} initialSort={{ key: 'citations', dir: 'desc' }} pageSize={10} />
        </Block>
      )}

      {gaps.length > 0 && (
        <Block title="Questions you are losing" description="Every assistant answered these without you">
          <ul className="divide-y divide-line">
            {gaps.map((g, i) => (
              <li key={i} className="py-3">
                <p className="text-sm text-ink">{str(g.prompt)}</p>
                <div className="mt-1.5 grid gap-2 text-xs sm:grid-cols-2">
                  {strs(g.competitors).length > 0 && (
                    <div>
                      <SectionTitle className="mb-1">Named instead</SectionTitle>
                      <Chips items={strs(g.competitors)} max={6} />
                    </div>
                  )}
                  {strs(g.sources).length > 0 && (
                    <div>
                      <SectionTitle className="mb-1">Sources used</SectionTitle>
                      <Chips items={strs(g.sources)} max={6} />
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Block>
      )}

      <ActionList actions={objs(p.actions)} siteId={report.siteId} />

      {has(market) && !str(market.error) && objs(market.top).length > 0 && (
        <Block
          title="Market view"
          description={`Who AI mentions most for “${str(market.keyword)}” across all its answers (${n(market.total_mentions)} mentions, ${n(market.ai_search_volume)} AI searches)${market.carried === true ? ' · monthly data' : ''}`}
        >
          <ShareBars items={objs(market.top).map((t) => ({ label: str(t.domain), value: num(t.mentions) ?? 0 }))} valueFormat={(v) => `${n(v)} mentions`} />
          {market.you == null && <p className="mt-3 text-[13px] text-ink-3">{domain || 'Your site'} is not among the domains AI mentions for this topic yet.</p>}
        </Block>
      )}
      {str(market.error) && <Callout tone="warning">Market data was not available: {str(market.error)}</Callout>}
    </div>
  );
}
