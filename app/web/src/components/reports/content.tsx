import { useMemo } from 'react';
import { format, isValid, parseISO } from 'date-fns';
import { ArrowRight, Layers, PenLine, Rocket, ShieldAlert } from 'lucide-react';
import type { ReportDetail } from '@seo/shared';
import { useOrgCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Callout } from '@/components/ui/feedback';
import { Delta, ExternalLink, KeyValue } from '@/components/ui/misc';
import { ChartCard, TimeSeriesChart } from '@/components/charts';
import { ArticleViewer } from './article';
import { Block, Bullets, Chips, Facts, has, LedgerCard, n, num, obj, objs, ScoreMeter, str, strs, usd, VerdictBadge, type P } from './kit';
import { keywordPrefill } from './meta';

const monthLabel = (m: unknown) => {
  const d = parseISO(`${String(m)}-01`);
  return isValid(d) ? format(d, 'MMM yy') : String(m ?? '');
};

/** Verdict, keyword data and (for page runs) the finished article. Also used for verdict-only runs and case-study pages. */
export function ContentReport({ report }: { report: ReportDetail }) {
  const { org, can } = useOrgCtx();
  const p = report.payload;
  const kd = obj(p.keyword_data);
  const meta = obj(p.meta);
  const html = str(p.html);
  const markdown = str(p.markdown);
  const keyword = str(p.keyword) || str(meta.primary_keyword);
  const verdict = str(p.verdict);
  const score = num(p.score);
  const reasons = strs(p.reasons);
  const risks = strs(p.risks);
  const secondary = strs(p.secondary_keywords);
  const trend = useMemo(
    () =>
      objs(kd.monthly_trend)
        .map((m) => ({ month: str(m.month), searches: num(m.searches) }))
        .filter((m) => m.month)
        .sort((a, b) => a.month.localeCompare(b.month)),
    [kd.monthly_trend],
  );
  const cbs = obj(kd.competitor_backlink_strength);
  const ladderHead = str(p.ladder_head) || str(obj(meta.ladder).head_keyword);
  const rung = num(p.ladder_rung) ?? num(obj(meta.ladder).rung);
  const slug = str(meta.slug) || keyword.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'page';
  const existing = obj(p.existing_page);
  const pageRole = str(meta.page_role);
  const qa = str(p.qa_summary) || str(meta.qa_summary);
  const qaOk = /passed/i.test(qa);
  const country = str(p.country);

  return (
    <div className="space-y-5">
      <Card>
        <CardBody className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <VerdictBadge verdict={verdict} />
              {pageRole && pageRole !== 'standard' && <Badge tone="accent">{pageRole.replace(/_/g, ' ')}</Badge>}
              {ladderHead && (
                <Badge icon={<Layers className="size-3" aria-hidden />}>
                  {rung != null ? `Rung ${rung} · ` : ''}ladder for “{ladderHead}”
                </Badge>
              )}
            </div>
            <h2 className="mt-3 font-display text-xl font-semibold tracking-[-0.01em] text-ink">{keyword || 'Keyword'}</h2>
            <KeyValue
              className="mt-3"
              items={[
                ...(str(p.recommended_page) ? [{ label: 'Recommended page', value: str(p.recommended_page) }] : []),
                ...(country ? [{ label: 'Market', value: country }] : []),
                ...(str(p.domain) ? [{ label: 'Website', value: str(p.domain) }] : []),
                ...(qa ? [{ label: 'Quality check', value: <StatusBadge tone={qaOk ? 'good' : 'warning'}>{qa.replace(/^Quality check:\s*/i, '')}</StatusBadge> }] : []),
                ...(str(p.emailed_to) ? [{ label: 'E-mailed to', value: str(p.emailed_to) }] : []),
              ]}
            />
          </div>
          <div className="space-y-4 rounded-xl bg-surface-2/60 p-4">
            <ScoreMeter score={score} label="Opportunity score" size="lg" />
            <div className="flex flex-col gap-2">
              {!can('member') ? null : html ? (
                <ButtonLink
                  to={paths.tool(org.id, 'published', { siteId: report.siteId, prefill: { keyword, publishedUrl: str(meta.suggested_url) } })}
                  variant="primary"
                  size="sm"
                  icon={<Rocket className="size-4" />}
                >
                  I published this page
                </ButtonLink>
              ) : (
                keyword &&
                verdict.toUpperCase() !== 'AVOID' && (
                  <ButtonLink
                    to={paths.tool(org.id, 'keyword', { siteId: report.siteId, prefill: keywordPrefill({ keyword, pageType: p.recommended_page, country }) })}
                    variant="primary"
                    size="sm"
                    icon={<PenLine className="size-4" />}
                  >
                    Write this page
                  </ButtonLink>
                )
              )}
              {html && can('member') && <p className="text-xs leading-snug text-ink-3">After publishing, report the link: we check it live and start tracking its position.</p>}
            </div>
          </div>
        </CardBody>
      </Card>

      {(reasons.length > 0 || risks.length > 0) && (
        <div className="grid gap-5 lg:grid-cols-2">
          {reasons.length > 0 && (
            <Block title="Why" description="What the research found">
              <Bullets items={reasons} tone="good" />
            </Block>
          )}
          {risks.length > 0 && (
            <Block title="Risks" description="What could hold the page back" icon={<ShieldAlert className="size-4" />}>
              <Bullets items={risks} tone="warning" />
            </Block>
          )}
        </div>
      )}

      {has(kd) && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Block title="Keyword data" description={country ? `Google, ${country}` : 'Google'}>
            <Facts
              cols="sm:grid-cols-3"
              items={[
                { label: 'Searches / month', value: n(kd.search_volume) },
                { label: 'Difficulty', value: num(kd.keyword_difficulty) != null ? `${num(kd.keyword_difficulty)}/100` : str(kd.difficulty_label) || '–', hint: num(kd.keyword_difficulty) != null ? str(kd.difficulty_label) : undefined },
                { label: 'Cost per click', value: num(kd.cpc) != null ? usd(kd.cpc) : '–' },
                { label: 'Search intent', value: str(kd.google_intent) || '–' },
                { label: 'Ads competition', value: str(kd.ads_competition).toLowerCase() || '–' },
                {
                  label: 'Trend',
                  value:
                    num(kd.trend_yearly_pct) != null || num(kd.trend_quarterly_pct) != null ? (
                      <span className="flex flex-col gap-0.5">
                        {num(kd.trend_yearly_pct) != null && <Delta value={num(kd.trend_yearly_pct)} digits={0} label="year" />}
                        {num(kd.trend_quarterly_pct) != null && <Delta value={num(kd.trend_quarterly_pct)} digits={0} label="quarter" />}
                      </span>
                    ) : (
                      '–'
                    ),
                },
              ]}
            />
            {(num(cbs.avg_referring_domains) != null || num(cbs.avg_backlinks) != null) && (
              <p className="mt-4 text-[13px] leading-relaxed text-ink-2">
                Pages ranking now average <strong className="text-ink">{n(cbs.avg_referring_domains)}</strong> referring domains and{' '}
                <strong className="text-ink">{n(cbs.avg_backlinks)}</strong> backlinks ({n(cbs.avg_dofollow)} dofollow).
              </p>
            )}
          </Block>
          {trend.length > 1 ? (
            <ChartCard
              title="Searches per month"
              description="Last 12 months"
              table={{ columns: [{ key: 'month', label: 'Month', format: (v) => monthLabel(v) }, { key: 'searches', label: 'Searches', align: 'right', format: (v) => n(v) }], rows: trend }}
            >
              <TimeSeriesChart data={trend} xKey="month" xFormat={monthLabel} series={[{ key: 'searches', label: 'Searches' }]} area height={220} />
            </ChartCard>
          ) : (
            <Block title="Searches per month">
              <p className="text-sm text-ink-3">No monthly history for this keyword.</p>
            </Block>
          )}
        </div>
      )}

      {secondary.length > 0 && (
        <Block title="Secondary keywords" description="Related searches the page should also answer">
          <Chips items={secondary} />
        </Block>
      )}

      {has(existing) && (
        <Block title="Existing page" description="The page this run improves">
          <ExistingPage page={existing} />
        </Block>
      )}

      {html ? (
        <Block title="The page" description={[num(meta.word_count) != null ? `${num(meta.word_count)!.toLocaleString()} words` : '', str(meta.page_type), num(meta.content_score) != null ? `content score ${num(meta.content_score)}/100` : ''].filter(Boolean).join(' · ')}>
          <ArticleViewer html={html} markdown={markdown} meta={meta} files={report.files} slug={slug} />
        </Block>
      ) : (
        verdict && (
          <Callout tone="info" title="No page in this report">
            This run checked the keyword without writing a page.
            {verdict.toUpperCase() === 'AVOID' ? ' The verdict advises against a page for this keyword: pick one of the secondary keywords or run keyword discovery.' : ' “Write this page” starts the full run with competitor research, the brief and a QA-checked page.'}
            {verdict.toUpperCase() === 'AVOID' && (
              <span className="mt-1 block">
                <ButtonLink variant="link" to={paths.tool(org.id, 'discover', { siteId: report.siteId })} icon={<ArrowRight className="size-3.5" />}>
                  Find better keywords
                </ButtonLink>
              </span>
            )}
          </Callout>
        )
      )}

      <LedgerCard ledger={p.run_ledger} />
    </div>
  );
}

function ExistingPage({ page }: { page: P }) {
  const items = Object.entries(page)
    .filter(([, v]) => v != null && v !== '' && (typeof v !== 'object' || Array.isArray(v)))
    .slice(0, 12)
    .map(([k, v]) => ({
      label: k.replace(/_/g, ' '),
      value: Array.isArray(v) ? strs(v).join(', ') || `${v.length} items` : /^https?:\/\//.test(String(v)) ? <ExternalLink href={String(v)} /> : String(v),
    }));
  return <KeyValue items={items} />;
}
