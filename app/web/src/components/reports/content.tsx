import { useMemo } from 'react';
import { format, isValid, parseISO } from 'date-fns';
import { ArrowRight, BarChart3, FileSearch, FileText, Lightbulb, ListChecks, MousePointerClick, PenLine, Rocket, Search, ShieldAlert, Tags, TrendingUp, Workflow } from 'lucide-react';
import type { ReportDetail } from '@seo/shared';
import { useOrgCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { ButtonLink } from '@/components/ui/button';
import { Callout } from '@/components/ui/feedback';
import { Delta, ExternalLink, KeyValue } from '@/components/ui/misc';
import { ChartCard, TimeSeriesChart } from '@/components/charts';
import { CountUp, HeroStat, Stagger } from '@/components/insight';
import { absolutePageUrl, ArticleViewer, findPlaceholders } from './article';
import { Block, Bullets, Chips, Facts, has, LedgerCard, n, num, obj, objs, str, strs, usd, verdictLabel, type P } from './kit';
import { keywordPrefill } from './meta';
import { ChartTitle, ReportHero, ScoreMark, TickGrid, WordValue } from './visuals';

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
  const volume = num(kd.search_volume);
  const kdValue = num(kd.keyword_difficulty);
  const words = num(meta.word_count);
  const contentScore = num(meta.content_score);
  const avoid = verdict.toUpperCase() === 'AVOID';

  const publishLink = html && can('member') && (
    <ButtonLink
      to={paths.tool(org.id, 'published', {
        siteId: report.siteId,
        // the form asks for a full https:// address: prefill only one built from the website's domain, never a bare path
        prefill: { keyword, publishedUrl: absolutePageUrl(str(meta.suggested_url), str(p.domain) || str(meta.domain) || report.siteDomain || '') },
      })}
      variant="primary"
      size="sm"
      icon={<Rocket className="size-4" />}
    >
      I published this page
    </ButtonLink>
  );
  const writeLink = !html && can('member') && keyword && !avoid && (
    <ButtonLink
      to={paths.tool(org.id, 'keyword', { siteId: report.siteId, prefill: keywordPrefill({ keyword, pageType: p.recommended_page, country }) })}
      variant="primary"
      size="sm"
      icon={<PenLine className="size-4" />}
    >
      Write this page
    </ButtonLink>
  );

  const details = [
    str(p.recommended_page) && `Recommended page: ${str(p.recommended_page)}`,
    country && `Market: ${country}`,
    str(p.domain) && str(p.domain) !== report.siteDomain && `Website: ${str(p.domain)}`,
    str(p.emailed_to) && `E-mailed to ${str(p.emailed_to)}`,
  ].filter(Boolean);
  const eyebrowExtra = [pageRole && pageRole !== 'standard' ? `${pageRole.replace(/_/g, ' ')} page` : '', ladderHead ? `${rung != null ? `Rung ${rung} · ` : ''}ladder for “${ladderHead}”` : ''].filter(Boolean).join(' · ');

  return (
    <Stagger className="space-y-5">
      <ReportHero
        report={report}
        eyebrow={eyebrowExtra ? <span className="normal-case">{eyebrowExtra}</span> : undefined}
        title={html ? <>The page for “{keyword || 'this keyword'}” is written</> : verdict ? <>{verdictLabel(verdict)}: “{keyword || 'Keyword'}”</> : keyword || 'Keyword'}
        description={details.length ? details.join(' · ') : undefined}
        aside={
          html ? (
            <ScoreMark score={contentScore} label="Content score" status={qa ? (qaOk ? 'Quality check passed' : 'To review') : undefined} statusTone={qa ? (qaOk ? 'good' : 'warning') : undefined} caption={qa ? qa.replace(/^Quality check:\s*/i, 'Quality check: ') : undefined} />
          ) : verdict || score != null ? (
            <ScoreMark score={score} label="Opportunity score" verdict={verdict || undefined} caption={avoid ? 'The research advises against a page for this keyword.' : 'From the competitor, keyword and live Google research.'} />
          ) : undefined
        }
        actions={
          publishLink || writeLink ? (
            <>
              {publishLink}
              {writeLink}
              {html && can('member') && <span className="text-xs leading-snug text-on-ink-2">After publishing, report the link: we check it live and start tracking its position.</span>}
            </>
          ) : undefined
        }
        stats={
          <>
            <HeroStat
              label="Searches / month"
              value={volume != null ? <CountUp value={volume} format={(v) => n(Math.round(v))} /> : '–'}
              delta={num(kd.trend_yearly_pct) != null ? <Delta value={num(kd.trend_yearly_pct)} digits={0} label="year" /> : undefined}
              hint={country ? `Google, ${country}` : 'Google'}
            />
            {html ? (
              <>
                <HeroStat label="Words" value={words != null ? <CountUp value={words} /> : '–'} hint={str(meta.page_type) ? <span className="line-clamp-2">{str(meta.page_type)}</span> : undefined} />
                <HeroStat label="Opportunity score" value={score != null ? <CountUp value={score} /> : '–'} hint={verdict ? `Verdict: ${verdictLabel(verdict)}` : undefined} />
                <HeroStat label="Internal links" value={objs(meta.internal_links).length} hint={`${objs(meta.external_links).length} sources cited`} />
              </>
            ) : (
              <>
                <HeroStat label="Difficulty" value={kdValue != null ? `${kdValue}/100` : <WordValue>{str(kd.difficulty_label) || '–'}</WordValue>} hint={kdValue != null ? str(kd.difficulty_label) || undefined : 'Keyword difficulty'} />
                <HeroStat label="Cost per click" value={num(kd.cpc) != null ? usd(kd.cpc) : '–'} hint={str(kd.ads_competition) ? `Ads competition ${str(kd.ads_competition).toLowerCase()}` : undefined} />
                <HeroStat label="Search intent" value={<WordValue><span className="capitalize">{str(kd.google_intent) || '–'}</span></WordValue>} hint={str(p.recommended_page) ? <span className="line-clamp-2">{str(p.recommended_page)}</span> : undefined} />
              </>
            )}
          </>
        }
      />

      {(reasons.length > 0 || risks.length > 0) && (
        <div className="grid gap-5 lg:grid-cols-2">
          {reasons.length > 0 && (
            <Block title="Why" description="What the research found" icon={<Lightbulb />}>
              <Bullets items={reasons} tone="good" />
            </Block>
          )}
          {risks.length > 0 && (
            <Block title="Risks" description="What could hold the page back" icon={<ShieldAlert />} iconTone="warning">
              <Bullets items={risks} tone="warning" />
            </Block>
          )}
        </div>
      )}

      {has(kd) && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Block title="Keyword data" description={country ? `Google, ${country}` : 'Google'} icon={<BarChart3 />}>
            <Facts
              cols="sm:grid-cols-3"
              items={[
                { icon: <Search />, label: 'Searches / month', value: n(kd.search_volume) },
                { icon: <BarChart3 />, label: 'Difficulty', value: kdValue != null ? `${kdValue}/100` : str(kd.difficulty_label) || '–', hint: kdValue != null ? str(kd.difficulty_label) : undefined },
                { icon: <MousePointerClick />, label: 'Cost per click', value: num(kd.cpc) != null ? usd(kd.cpc) : '–' },
                { label: 'Search intent', value: <span className="capitalize">{str(kd.google_intent) || '–'}</span> },
                { label: 'Ads competition', value: str(kd.ads_competition).toLowerCase() || '–' },
                {
                  icon: <TrendingUp />,
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
              <p className="mt-4 rounded-lg bg-accent-soft/60 px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-2">
                Pages ranking now average <strong className="text-ink">{n(cbs.avg_referring_domains)}</strong> referring domains and{' '}
                <strong className="text-ink">{n(cbs.avg_backlinks)}</strong> backlinks ({n(cbs.avg_dofollow)} dofollow).
              </p>
            )}
          </Block>
          {trend.length > 1 ? (
            <ChartCard
              title={<ChartTitle icon={<TrendingUp />}>Searches per month</ChartTitle>}
              description="Last 12 months"
              table={{ columns: [{ key: 'month', label: 'Month', format: (v) => monthLabel(v) }, { key: 'searches', label: 'Searches', align: 'right', format: (v) => n(v) }], rows: trend }}
            >
              {/* volumes start at 0: an axis from the lowest month made a quiet month sit on (or under) the x-axis */}
              <TimeSeriesChart data={trend} xKey="month" xFormat={monthLabel} series={[{ key: 'searches', label: 'Searches' }]} area height={220} yDomain={[0, 'auto']} />
            </ChartCard>
          ) : (
            <Block title="Searches per month" icon={<TrendingUp />}>
              <p className="text-sm text-ink-3">No monthly history for this keyword.</p>
            </Block>
          )}
        </div>
      )}

      {secondary.length > 0 && (
        <Block title="Secondary keywords" description="Related searches the page should also answer" icon={<Tags />}>
          <Chips items={secondary} />
        </Block>
      )}

      {has(existing) && (
        <Block title="Existing page" description="The page this run improves" icon={<FileSearch />}>
          <ExistingPage page={existing} />
        </Block>
      )}

      {html && <PageChecks html={html} meta={meta} qa={qa} qaOk={qaOk} ledger={obj(p.run_ledger)} />}

      {html ? (
        <Block
          title="The page"
          icon={<FileText />}
          description={[words != null ? `${words.toLocaleString()} words` : '', str(meta.page_type), contentScore != null ? `content score ${contentScore}/100` : ''].filter(Boolean).join(' · ')}
        >
          <ArticleViewer html={html} markdown={markdown} meta={meta} files={report.files} slug={slug} />
        </Block>
      ) : (
        verdict && (
          <Callout tone="info" title="No page in this report">
            This run checked the keyword without writing a page.
            {avoid ? ' The verdict advises against a page for this keyword: pick one of the secondary keywords or run keyword discovery.' : ' “Write this page” starts the full run with competitor research, the brief and a QA-checked page.'}
            {avoid && (
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
    </Stagger>
  );
}

/**
 * The written page's SEO checks as ticks (title and description lengths, H1, structured data, links, image plan, placeholders,
 * the quality check) and the chain of AI steps that wrote it. Every tick is a fact from meta.json, stated next to it.
 */
function PageChecks({ html, meta, qa, qaOk, ledger }: { html: string; meta: P; qa: string; qaOk: boolean; ledger: P }) {
  const placeholders = useMemo(() => findPlaceholders(`${html}\n${JSON.stringify(meta)}`), [html, meta]);
  const phCount = placeholders.reduce((s, x) => s + x.count, 0);
  const titleLen = num(meta.title_length) ?? (str(meta.title).length || null);
  const descLen = num(meta.meta_description_length) ?? (str(meta.meta_description).length || null);
  const internal = objs(meta.internal_links).length;
  const external = objs(meta.external_links).length;
  const schema = objs(meta.schema_blocks).length;
  const images = objs(meta.images);
  const withAlt = images.filter((i) => str(i.alt_text)).length;
  const items = [
    { ok: titleLen == null ? null : titleLen >= 30 && titleLen <= 60, label: 'Title tag length', detail: titleLen != null ? `${titleLen} characters (aim for 30-60)` : 'No title in meta.json' },
    { ok: descLen == null ? null : descLen >= 120 && descLen <= 160, label: 'Meta description length', detail: descLen != null ? `${descLen} characters (aim for 120-160)` : 'No description in meta.json' },
    { ok: str(meta.h1) ? true : null, label: 'Main heading (H1)', detail: str(meta.h1) || 'Not in meta.json' },
    { ok: schema > 0 ? true : null, label: 'Structured data', detail: schema ? `${schema} JSON-LD block${schema === 1 ? '' : 's'} (${objs(meta.schema_blocks).map((b) => str(b.type)).filter(Boolean).join(', ') || 'see Meta'})` : 'No JSON-LD blocks' },
    { ok: internal > 0 ? true : null, label: 'Internal links', detail: `${internal} in the article` },
    { ok: external > 0 ? true : null, label: 'Sources cited', detail: `${external} external source${external === 1 ? '' : 's'}` },
    ...(images.length ? [{ ok: withAlt === images.length, label: 'Image plan with alt text', detail: `${withAlt} of ${images.length} images` }] : []),
    { ok: phCount === 0, label: 'Placeholders to fill', detail: phCount ? `${phCount} left (see the preview)` : 'None' },
    ...(qa ? [{ ok: qaOk, label: 'Quality check', detail: qa.replace(/^Quality check:\s*/i, '') }] : []),
  ];
  const steps = strs(ledger.ai_nodes);
  return (
    <Block title="SEO checks" description="Read from the page's meta.json: what is ready and what to fix before publishing" icon={<ListChecks />}>
      <TickGrid items={items} />
      {steps.length > 0 && (
        <div className="mt-4 border-t border-line pt-4">
          <p className="mb-2.5 flex items-center gap-1.5 text-xs font-medium text-ink-3">
            <Workflow className="size-3.5" aria-hidden /> How it was written
          </p>
          <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
            {steps.map((s, i) => (
              <li key={`${s}-${i}`} className="flex items-center gap-1.5">
                <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-accent-soft pr-2.5 pl-1 text-xs font-medium text-accent-text">
                  <span className="flex size-5 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-accent-ink tabular">{i + 1}</span>
                  {s}
                </span>
                {i < steps.length - 1 && <ArrowRight className="size-3.5 text-ink-3" aria-hidden />}
              </li>
            ))}
            {qa && (
              <li className="flex items-center gap-1.5">
                <ArrowRight className="size-3.5 text-ink-3" aria-hidden />
                <span className={qaOk ? 'inline-flex h-7 items-center gap-1.5 rounded-full bg-good-soft px-2.5 text-xs font-medium text-good-text' : 'inline-flex h-7 items-center gap-1.5 rounded-full bg-warning-soft px-2.5 text-xs font-medium text-warning-text'}>
                  <ListChecks className="size-3.5" aria-hidden />
                  {qa}
                </span>
              </li>
            )}
          </ol>
        </div>
      )}
    </Block>
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
