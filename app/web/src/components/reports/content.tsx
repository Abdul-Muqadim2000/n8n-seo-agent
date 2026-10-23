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
import { CmsPublishPanel } from './CmsPublish';
import { draftNextStep, ownerEdits } from '@seo/shared';
import { Block, Bullets, Chips, Facts, has, CreditsCard, n, num, obj, objs, str, strs, usd, verdictLabel, type P } from './kit';
import { keywordPrefill } from './meta';
import { ChartTitle, ReportHero, ScoreMark, TickGrid, WordValue } from './visuals';
import { AUTOPILOT_SCREEN_GUIDES } from '@seo/shared/guide-links';
import { GuideButton } from '@/components/guide';

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
  // R11 (re-rating, 2026-10-13): a run that used up its editing rounds with the quality gate still failing is delivered as a DRAFT.
  // Exec 521 shipped a page with 12 placeholders and 40% topic coverage against a target of 68 while the app showed only
  // "Quality check: 6 item(s) to review". The engine now says so outright (`qa_not_ready`, `qa_label`, `qa_reasons`, meta.quality,
  // meta.publishable), with the LAST quality round's counts, and this page leads with it.
  const quality = obj(p.qa_quality ?? meta.quality);
  const notReady = p.qa_not_ready === true || quality.not_ready === true;
  const publishable = p.qa_publishable === true || meta.publishable === true || quality.publishable === true;
  const qaLabel = str(p.qa_label) || str(quality.label);
  const qaReasons = strs(p.qa_reasons ?? quality.reasons);
  const qaOk = !notReady && (publishable || /passed/i.test(qa));
  const country = str(p.country);
  const volume = num(kd.search_volume);
  const kdValue = num(kd.keyword_difficulty);
  const words = num(meta.word_count);
  const contentScore = num(meta.content_score);
  const avoid = verdict.toUpperCase() === 'AVOID';

  // Pre-launch run 2026-10-21 (B1): a page the quality check refused is a draft to finish by hand, never a page to publish as it is. It
  // offers no "Send it now", its content score is not the headline, and its next step is the engine's own
  // (`qa_next_step`, with each bracket in `qa_owner_edits`): edit the draft, never a paid re-run (E-QA). Older reports get the same advice.
  const nextStep = notReady ? draftNextStep(p) : '';
  const edits = notReady ? ownerEdits(p) : [];
  // 2026-10-23 (techand.ai on production): a client finished a not-ready draft in the Word file, published it, and found no way here to
  // say so (B1 had removed the button while this page still told them to use it). The draft is finished OUTSIDE the app, so the button
  // is back on it too, second to the edits: the live check reads the published page and names any bracket still on it. It carries the
  // draft's keyword and the engine request id that wrote it, so the check marks this draft published, whatever is typed.
  const publishLink = html && can('member') && (
    <ButtonLink
      to={paths.tool(org.id, 'published', {
        siteId: report.siteId,
        // the form asks for a full https:// address: prefill only one built from the website's domain, never a bare path
        prefill: {
          keyword,
          publishedUrl: absolutePageUrl(str(meta.suggested_url), str(p.domain) || str(meta.domain) || report.siteDomain || ''),
          ...(/^[A-Za-z0-9:_.-]{1,120}$/.test(str(p.request_id)) ? { contentRequestId: str(p.request_id) } : {}),
        },
      })}
      variant={notReady ? 'secondary' : 'primary'}
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
  const eyebrowExtra = [pageRole && pageRole !== 'standard' ? `${pageRole.replace(/_/g, ' ')} page` : '', ladderHead ? `${rung != null ? `Rung ${rung} · ` : ''}ladder for "${ladderHead}"` : ''].filter(Boolean).join(' · ');

  return (
    <Stagger className="space-y-5">
      <ReportHero
        report={report}
        eyebrow={eyebrowExtra ? <span className="normal-case">{eyebrowExtra}</span> : undefined}
        title={html ? (notReady ? <>The draft for "{keyword || 'this keyword'}" needs your edits before you publish it</> : <>The page for "{keyword || 'this keyword'}" is written</>) : verdict ? <>{verdictLabel(verdict)}: "{keyword || 'Keyword'}"</> : keyword || 'Keyword'}
        description={details.length ? details.join(' · ') : undefined}
        aside={
          html && notReady ? (
            <ScoreMark
              score={null}
              label="Quality check"
              status="Not ready to publish"
              statusTone="critical"
              caption={edits.length ? `${edits.length} ${edits.length === 1 ? 'bracket' : 'brackets'} to fill in or delete by hand: see the list below` : qaReasons.length ? `${qaReasons.length} ${qaReasons.length === 1 ? 'point' : 'points'} to finish by hand: see the list below` : 'Finish it by hand before you publish: see the list below'}
            />
          ) : html ? (
            <ScoreMark
              score={contentScore}
              label="Content score"
              status={notReady ? 'Not ready to publish' : qa ? (qaOk ? 'Quality check passed' : 'To review') : undefined}
              statusTone={notReady ? 'critical' : qa ? (qaOk ? 'good' : 'warning') : undefined}
              caption={qa ? qa.replace(/^Quality check:\s*/i, 'Quality check: ') : undefined}
            />
          ) : verdict || score != null ? (
            <ScoreMark score={score} label="Opportunity score" verdict={verdict || undefined} caption={avoid ? 'The research advises against a page for this keyword.' : 'From the competitor, keyword and live Google research.'} />
          ) : undefined
        }
        actions={
          publishLink || writeLink ? (
            <>
              {publishLink}
              {writeLink}
              {html && can('member') && (
                <span className="text-xs leading-snug text-on-ink-2">
                  {notReady
                    ? 'Finish it in the downloaded Word or HTML file first: fill in or delete every bracket listed below. Once it is live on your website, press "I published this page": we check the live page and start tracking it.'
                    : 'After publishing, report the link: we check it live and start tracking its position.'}
                </span>
              )}
            </>
          ) : html && notReady ? (
            <span className="text-xs leading-snug text-on-ink-2">Finish it in the downloaded Word or HTML file: fill in or delete every bracket listed below, then publish it. A member of your team reports its address here once it is live.</span>
          ) : undefined
        }
        stats={
          <>
            <HeroStat
              label="Searches / month"
              value={volume != null ? <CountUp value={volume} format={(v) => n(Math.round(v))} /> : '-'}
              delta={num(kd.trend_yearly_pct) != null ? <Delta value={num(kd.trend_yearly_pct)} digits={0} label="year" /> : undefined}
              hint={country ? `Google, ${country}` : 'Google'}
            />
            {html ? (
              <>
                <HeroStat label="Words" value={words != null ? <CountUp value={words} /> : '-'} hint={str(meta.page_type) ? <span className="line-clamp-2">{str(meta.page_type)}</span> : undefined} />
                <HeroStat label="Opportunity score" value={score != null ? <CountUp value={score} /> : '-'} hint={verdict ? `Verdict: ${verdictLabel(verdict)}` : undefined} />
                <HeroStat label="Internal links" value={objs(meta.internal_links).length} hint={`${objs(meta.external_links).length} sources cited`} />
              </>
            ) : (
              <>
                <HeroStat label="Difficulty" value={kdValue != null ? `${kdValue}/100` : <WordValue>{str(kd.difficulty_label) || '-'}</WordValue>} hint={kdValue != null ? str(kd.difficulty_label) || undefined : 'Keyword difficulty'} />
                <HeroStat label="Cost per click" value={num(kd.cpc) != null ? usd(kd.cpc) : '-'} hint={str(kd.ads_competition) ? `Ads competition ${str(kd.ads_competition).toLowerCase()}` : undefined} />
                <HeroStat label="Search intent" value={<WordValue><span className="capitalize">{str(kd.google_intent) || '-'}</span></WordValue>} hint={str(p.recommended_page) ? <span className="line-clamp-2">{str(p.recommended_page)}</span> : undefined} />
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
                { icon: <BarChart3 />, label: 'Difficulty', value: kdValue != null ? `${kdValue}/100` : str(kd.difficulty_label) || '-', hint: kdValue != null ? str(kd.difficulty_label) : undefined },
                { icon: <MousePointerClick />, label: 'Cost per click', value: num(kd.cpc) != null ? usd(kd.cpc) : '-' },
                { label: 'Search intent', value: <span className="capitalize">{str(kd.google_intent) || '-'}</span> },
                { label: 'Ads competition', value: str(kd.ads_competition).toLowerCase() || '-' },
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
                      '-'
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

      {/* R11: the page is here to finish by hand, not to publish as it is, said before the SEO checks and the page itself */}
      {html && notReady && (
        <Callout
          tone="critical"
          title={qaLabel || 'This page did not pass the quality check and is not ready to publish'}
          action={<GuideButton id={AUTOPILOT_SCREEN_GUIDES.pageNotReady} vars={{ domain: str(p.domain) || report.siteDomain || '' }} label="How to finish it" />}
        >
          It is delivered as a draft to finish by hand. What the quality check found:
          {qaReasons.length > 0 && (
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5 [overflow-wrap:anywhere]">
              {qaReasons.slice(0, 5).map((r, i) => (
                <li key={`${i}-${r.slice(0, 32)}`}>{r}</li>
              ))}
            </ul>
          )}
          {edits.length > 0 && (
            <>
              <p className="mt-2 font-medium text-ink">Edit these by hand</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 [overflow-wrap:anywhere]">
                {edits.slice(0, 8).map((e, i) => (
                  <li key={`${i}-${e.token}`}>{e.text}</li>
                ))}
              </ul>
            </>
          )}
          <p className="mt-2 [overflow-wrap:anywhere]">
            <span className="font-medium text-ink">Next step: </span>
            {nextStep}
          </p>
        </Callout>
      )}

      {html && <PageChecks html={html} meta={meta} qa={qa} qaOk={qaOk} notReady={notReady} qaLabel={qaLabel} ledger={obj(p.run_ledger)} />}

      {/* G2: send the page to the website's CMS, drafts by default, live only for owners and admins, never a page the checks refuse */}
      {/* G5: publishing is the agency's act, never a client person's (their portal has Approvals) */}
      {html && report.siteId && can('viewer') && <CmsPublishPanel report={report} />}

      {html ? (
        <Block
          title="The page"
          icon={<FileText />}
          description={[words != null ? `${words.toLocaleString()} words` : '', str(meta.page_type), contentScore != null ? `content score ${contentScore}/100${notReady ? ', but the quality check did not pass' : ''}` : ''].filter(Boolean).join(' · ')}
        >
          <ArticleViewer html={html} markdown={markdown} meta={meta} files={report.files} slug={slug} />
        </Block>
      ) : (
        verdict && (
          <Callout tone="info" title="No page in this report">
            This run checked the keyword without writing a page.
            {avoid ? ' The verdict advises against a page for this keyword: pick one of the secondary keywords or run keyword discovery.' : ' "Write this page" starts the full run with competitor research, the brief and a QA-checked page.'}
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

      <CreditsCard p={p} />
    </Stagger>
  );
}

/**
 * The written page's SEO checks as ticks (title and description lengths, H1, structured data, links, image plan, placeholders,
 * the quality check) and the chain of AI steps that wrote it. Every tick is a fact from meta.json, stated next to it.
 */
function PageChecks({ html, meta, qa, qaOk, notReady, qaLabel, ledger }: { html: string; meta: P; qa: string; qaOk: boolean; notReady?: boolean; qaLabel?: string; ledger: P }) {
  const placeholders = useMemo(() => findPlaceholders(`${html}\n${JSON.stringify(meta)}`), [html, meta]);
  const phCount = placeholders.reduce((s, x) => s + x.count, 0);
  const titleLen = num(meta.title_length) ?? (str(meta.title).length || null);
  const descLen = num(meta.meta_description_length) ?? (str(meta.meta_description).length || null);
  const internal = objs(meta.internal_links).length;
  const external = objs(meta.external_links).length;
  const schema = objs(meta.schema_blocks).length;
  const images = objs(meta.images);
  const withAlt = images.filter((i) => str(i.alt_text)).length;
  // FIX_PLAN G30 / G5 / G33 (2026-10-13): the images the run produced, how much of the draft matches another page, and the coverage
  // target taken from the best competitor page. Each one is shown with the number the engine measured and what it measured it against.
  const produced = images.filter((i) => i.produced === true).length;
  const orig = obj(meta.originality);
  const origPct = num(orig.highest_pct);
  const origLimit = num(orig.threshold_pct);
  const cov = obj(meta.coverage);
  const covPct = num(cov.pct);
  const covTarget = num(cov.target_pct);
  const covBest = obj(cov.best_competitor);
  const covMissing = strs(cov.subtopics_missing);
  const items = [
    { ok: titleLen == null ? null : titleLen >= 30 && titleLen <= 60, label: 'Title tag length', detail: titleLen != null ? `${titleLen} characters (aim for 30-60)` : 'No title in meta.json' },
    { ok: descLen == null ? null : descLen >= 120 && descLen <= 160, label: 'Meta description length', detail: descLen != null ? `${descLen} characters (aim for 120-160)` : 'No description in meta.json' },
    { ok: str(meta.h1) ? true : null, label: 'Main heading (H1)', detail: str(meta.h1) || 'Not in meta.json' },
    { ok: schema > 0 ? true : null, label: 'Structured data', detail: schema ? `${schema} JSON-LD block${schema === 1 ? '' : 's'} (${objs(meta.schema_blocks).map((b) => str(b.type)).filter(Boolean).join(', ') || 'see Meta'})` : 'No JSON-LD blocks' },
    { ok: internal > 0 ? true : null, label: 'Internal links', detail: `${internal} in the article` },
    { ok: external > 0 ? true : null, label: 'Sources cited', detail: `${external} external source${external === 1 ? '' : 's'}` },
    ...(images.length
      ? [
          produced
            ? { ok: produced === images.length, label: 'Images produced', detail: `${produced} of ${images.length} attached as WebP under the planned file names, ${withAlt} with alt text` }
            : { ok: withAlt === images.length ? null : false, label: 'Image plan with alt text', detail: `${withAlt} of ${images.length} images planned; none could be produced in this run` },
        ]
      : []),
    ...(origLimit != null
      ? [
          {
            ok: orig.passed === true ? true : orig.passed === false ? false : null,
            label: 'Originality',
            detail:
              orig.passed == null
                ? 'Could not be checked: no competitor or own page text was available in this run'
                : `${origPct ?? 0}% of the page matches ${str(orig.highest_source) || 'another page'} word for word (limit ${origLimit}%, measured in ${num(orig.window_words) ?? 8}-word runs over ${num(orig.pages_compared) ?? 0} page(s) this run read)`,
          },
        ]
      : []),
    ...(covTarget != null && covPct != null
      ? [
          {
            ok: covPct >= covTarget,
            label: 'Topic coverage vs the best competitor',
            detail: `${covPct}% of the ${num(cov.terms_total) ?? 0} terms the top pages share, target ${covTarget}% from ${str(covBest.domain) || 'the best page'}${num(covBest.rank) != null ? ` (position ${num(covBest.rank)})` : ''}${covMissing.length ? ` · subtopics still missing: ${covMissing.slice(0, 2).join('; ')}` : ''}`,
          },
        ]
      : []),
    { ok: phCount === 0, label: 'Placeholders to fill', detail: phCount ? `${phCount} left (see the preview)` : 'None' },
    // R11: the gate's own verdict, from the last quality round, "to review" never stands in for "did not pass"
    ...(qa || notReady ? [{ ok: notReady ? false : qaOk, label: 'Quality check', detail: notReady ? qaLabel || 'Did not pass, not ready to publish' : qa.replace(/^Quality check:\s*/i, '') }] : []),
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
                <span
                  className={
                    qaOk
                      ? 'inline-flex h-7 items-center gap-1.5 rounded-full bg-good-soft px-2.5 text-xs font-medium text-good-text'
                      : notReady
                        ? 'inline-flex h-7 items-center gap-1.5 rounded-full bg-critical-soft px-2.5 text-xs font-medium text-critical-text'
                        : 'inline-flex h-7 items-center gap-1.5 rounded-full bg-warning-soft px-2.5 text-xs font-medium text-warning-text'
                  }
                >
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
