// AI visibility wave 2 (W2-A, 2026-10-23, WAVE2_CONTRACTS.md §2): the panels for the engine's new blocks. Each renders only when its
// block is on the latest run (an older run keeps today's view), every rate travels with its n, nothing is shown as 0 that was not
// measured, sentiment is withheld under 12 answers, and an action's effect is "likely helped" / "can't tell" / "likely hurt" with its
// control and interval, never "caused".
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Ban, FileText, FileUp, FlaskConical, Library, Megaphone, MessageSquareQuote, Route, ShoppingBag, Sigma, Trophy, Upload, Users } from 'lucide-react';
import {
  AI_IMPORT_SOURCE_LABEL,
  AI_SENTIMENT_EARLY,
  AI_SENTIMENT_MIN,
  AI_SOURCE_TYPE_LABEL,
  compactNumber,
  type AiAdsLocalPanel,
  type AiDemandPanel,
  type AiFanoutGapPanel,
  type AiImpactItem,
  type AiPersonaEffect,
  type AiSentimentPanel,
  type AiShoppingPanel,
  type AiSourcesPanel,
  type AiSovPanel,
  type AiUrlsPanel,
} from '@seo/shared';
import { GuideButton } from '@/components/guide';
import { DistributionBar, DistributionLegend, SEQ } from '@/components/insight';
import { errorMessage } from '@/lib/api';
import { useAiImport, useAiImports } from '@/lib/queries';
import { fmtDate } from '@/lib/utils';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { DataTable, type Column } from '@/components/ui/table';
import { Chips, Kind, Panel, useSitePage } from './kit';
import { pct, urlPath } from './format';
import { RankedBars } from './visuals';
import { engineLabel } from './ai';

const range = (lo: number | null, hi: number | null, digits = 0) => (lo != null && hi != null ? `${pct(lo, digits)} to ${pct(hi, digits)}` : null);
const n0 = (n: number) => n.toLocaleString('en-GB');

/** Share of voice against the fixed set the owner chose, with both denominators. */
export function CompetitorsPanel({ sov, domain, ownShare }: { sov: AiSovPanel; domain: string; ownShare: number | null }) {
  const items = [
    ...sov.byEntity.filter((e) => e.share != null).map((e) => ({ label: e.name, value: e.share!, sub: `${e.n}${e.position != null ? ` · avg place ${e.position.toFixed(1)}` : ''}` })),
    ...(ownShare != null && !sov.byEntity.some((e) => e.name === domain) ? [{ label: domain, value: ownShare, sub: '' }] : []),
    ...(sov.othersShare != null ? [{ label: 'Every other brand', value: sov.othersShare, sub: '' }] : []),
  ].sort((a, b) => b.value - a.value);
  const d = sov.denominators;
  return (
    <Panel title="Competitors" icon={<Trophy />} description={sov.set.length ? `Share of voice against the ${sov.set.length} brands you track, the rest as one group` : 'Share of voice per brand'} info="Share of voice is your mentions among the brand mentions counted. Two bases are given: all answers, and only the answers that named any brand at all (an answer naming nobody says nothing about who leads).">
      <RankedBars items={items} you={domain} />
      <dl className="mt-3 grid grid-cols-1 gap-2 text-xs text-ink-3 sm:grid-cols-2">
        {d.allAnswers != null && (
          <div>
            <dt>All answers counted</dt>
            <dd className="font-medium tabular text-ink">{n0(d.allAnswers)}</dd>
          </div>
        )}
        {d.answersNamingAnyBrand != null && (
          <div>
            <dt>Answers that named any brand</dt>
            <dd className="font-medium tabular text-ink">{n0(d.answersNamingAnyBrand)}</dd>
          </div>
        )}
        {sov.namedOfBrandedRate != null && (
          <div className="sm:col-span-2">
            <dt>You among the answers that named a brand</dt>
            <dd className="font-medium text-ink">{pct(sov.namedOfBrandedRate)}</dd>
          </div>
        )}
      </dl>
      <p className="mt-2 text-xs text-ink-3">The number after a bar is answers naming the brand; "avg place" is where it is named on average when it is named (1 = first).</p>
    </Panel>
  );
}

/** Where the answers' citations come from: source types and the domains, with how long each stays cited. */
export function SourcesPanel2({ sources }: { sources: AiSourcesPanel }) {
  const segs = sources.types.map((t, i) => ({ label: AI_SOURCE_TYPE_LABEL[t.type] ?? t.type, value: t.n, color: SEQ[Math.max(0, SEQ.length - 1 - i)] }));
  type Dom = AiSourcesPanel['domains'][number];
  const cols: Column<Dom>[] = [
    { key: 'host', header: 'Domain', sortValue: (x) => x.host, cell: (x) => <span className="font-medium text-ink">{x.host}</span> },
    { key: 'type', header: 'Type', sortValue: (x) => x.type, cell: (x) => <Kind>{AI_SOURCE_TYPE_LABEL[x.type] ?? x.type}</Kind> },
    { key: 'cited', header: 'Citations', align: 'right', sortValue: (x) => x.citedN, cell: (x) => <span className="tabular">{x.citedN}{x.share != null ? <span className="text-xs text-ink-3"> ({pct(x.share)})</span> : null}</span> },
    { key: 'seen', header: 'Cited between', hideOnMobile: true, sortValue: (x) => x.lastSeen, cell: (x) => <span className="text-[13px] text-ink-2">{x.firstSeen ? `${fmtDate(x.firstSeen)} and ${fmtDate(x.lastSeen)}` : '-'}</span> },
    { key: 'half', header: 'Half-life', align: 'right', hideOnMobile: true, sortValue: (x) => x.halfLifeDays ?? -1, cell: (x) => (x.halfLifeDays != null ? <span className="tabular">{Math.round(x.halfLifeDays)} days</span> : <span className="text-xs text-ink-3">not enough history</span>) },
  ];
  return (
    <Panel title="Where the answers' sources come from" icon={<Library />} description={`${n0(sources.n)} citations in the latest run, by type of site`} info="Half-life: how many days until half the citations a domain had are gone, from the answers stored over time. A short half-life means fresh pages win; a long one means the same reference keeps being used.">
      {segs.length > 0 && (
        <>
          <DistributionBar segments={segs} label="Citations by type of site" />
          <DistributionLegend segments={segs} className="mt-2" format={(v) => `${v}`} />
        </>
      )}
      <div className="mt-3">
        <DataTable rows={sources.domains} columns={cols} rowKey={(x) => x.host} dense pageSize={10} initialSort={{ key: 'cited', dir: 'desc' }} empty="No domain cited." />
      </div>
    </Panel>
  );
}

/** Our pages: cited, read but not cited (with the page cited instead). */
export function OurPagesPanel({ urls }: { urls: AiUrlsPanel }) {
  type Own = AiUrlsPanel['own'][number];
  const cols: Column<Own>[] = [
    { key: 'url', header: 'Page', sortValue: (x) => x.url, cell: (x) => <a href={x.url} target="_blank" rel="noopener noreferrer" className="block max-w-[18rem] truncate text-accent-text hover:underline" title={x.url}>{urlPath(x.url)}</a> },
    { key: 'cited', header: 'Cited', align: 'right', sortValue: (x) => x.citedN, cell: (x) => <span className="tabular">{x.citedN}</span> },
    { key: 'retrieved', header: 'Read', align: 'right', sortValue: (x) => x.retrievedN, cell: (x) => <span className="tabular">{x.retrievedN}</span> },
    { key: 'rate', header: 'Cited when read', align: 'right', hideOnMobile: true, sortValue: (x) => x.citedRate ?? -1, cell: (x) => (x.citedRate != null && x.answersN >= 12 ? <span className="tabular">{pct(x.citedRate)}</span> : <span className="text-xs text-ink-3">too few answers</span>) },
    { key: 'engines', header: 'Engines', hideOnMobile: true, cell: (x) => <span className="text-[13px] text-ink-2">{x.engines.map((e) => engineLabel(e)).join(', ') || '-'}</span> },
    { key: 'instead', header: 'Cited instead', hideOnMobile: true, cell: (x) => <Chips items={x.rivalCitedInstead.map((r) => r.host)} max={2} /> },
  ];
  return (
    <Panel title="Your pages in AI answers" icon={<FileText />} description="Which of your pages the engines read, and which they cite" info="Read: the engine retrieved the page while answering. Cited: the answer links to it. A page read but not cited lost to the page listed beside it.">
      <DataTable rows={urls.own} columns={cols} rowKey={(x) => x.url} dense pageSize={10} initialSort={{ key: 'cited', dir: 'desc' }} empty="No page of yours was read or cited in the latest run." />
      {urls.retrievedNotCited.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-[13px] font-medium text-ink">Read but not cited</p>
          <ul className="divide-y divide-line text-[13px]">
            {urls.retrievedNotCited.slice(0, 10).map((u) => (
              <li key={u.url} className="flex flex-wrap items-baseline justify-between gap-2 py-1.5">
                <a href={u.url} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate text-accent-text hover:underline" title={u.url}>
                  {urlPath(u.url)}
                </a>
                <span className="text-xs text-ink-3">
                  read {u.retrievedN}x · cited instead: {u.topCompeting.slice(0, 2).map((c) => `${c.host} (${c.n})`).join(', ') || '-'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

export function ShoppingPanel({ shopping }: { shopping: AiShoppingPanel }) {
  if (shopping.status === 'no shopping results')
    return (
      <Panel title="Shopping in AI answers" icon={<ShoppingBag />} description={`No product cards in ${n0(shopping.answersN)} answers`}>
        <p className="text-[13px] text-ink-2">No shopping results were shown for your questions in the latest run, so there is no rate to give.</p>
      </Panel>
    );
  return (
    <Panel title="Shopping in AI answers" icon={<ShoppingBag />} description={`${n0(shopping.productsN)} product cards in ${n0(shopping.answersN)} answers`}>
      <dl className="grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-3">
        <div>
          <dt className="text-ink-3">Answers with product cards</dt>
          <dd className="font-medium text-ink">{shopping.triggerRate != null ? `${pct(shopping.triggerRate)} (${shopping.triggerN} of ${shopping.answersN})` : '-'}</dd>
        </div>
        <div>
          <dt className="text-ink-3">Your products shown</dt>
          <dd className="font-medium text-ink">{shopping.ownPresenceRate != null ? pct(shopping.ownPresenceRate) : 'not matched'}</dd>
        </div>
        <div>
          <dt className="text-ink-3">Your average place</dt>
          <dd className="font-medium text-ink">{shopping.ownAvgPosition != null ? shopping.ownAvgPosition.toFixed(1) : '-'}</dd>
        </div>
      </dl>
      {shopping.merchants.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-xs font-medium text-ink-3">Merchants shown</p>
          <RankedBars items={shopping.merchants.slice(0, 8).map((m) => ({ label: m.merchant, value: m.share ?? 0, sub: String(m.n) }))} />
        </div>
      )}
      {shopping.byEngine.length > 0 && <p className="mt-2 text-xs text-ink-3">{shopping.byEngine.map((e) => `${engineLabel(e.engine)}: ${e.triggerRate != null ? pct(e.triggerRate) : '-'} of ${e.answersN}`).join(' · ')}</p>}
    </Panel>
  );
}

export function AdsLocalPanel({ adsLocal }: { adsLocal: AiAdsLocalPanel }) {
  return (
    <Panel title="Ads and local cards" icon={<Megaphone />} description="Who advertises on your questions, and which local businesses are shown">
      <div className="grid gap-4 sm:grid-cols-2">
        {adsLocal.ads && (
          <div>
            <p className="text-[13px] font-medium text-ink">Ads</p>
            <p className="text-xs text-ink-3">{adsLocal.ads.seenN ? `${adsLocal.ads.seenN} ads in ${adsLocal.ads.answersN} answers` : `No ads seen in ${adsLocal.ads.answersN} answers`}</p>
            <ul className="mt-1.5 space-y-0.5 text-[13px] text-ink-2">
              {adsLocal.ads.advertisers.slice(0, 8).map((a) => (
                <li key={a.name + a.host}>
                  {a.name || a.host} <span className="text-xs text-ink-3">({a.n})</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {adsLocal.local && (
          <div>
            <p className="text-[13px] font-medium text-ink">Local business cards</p>
            <p className="text-xs text-ink-3">{adsLocal.local.seenN ? `${adsLocal.local.seenN} cards in ${adsLocal.local.answersN} answers, ${adsLocal.local.ownN} of them yours` : `No local cards in ${adsLocal.local.answersN} answers`}</p>
            <ul className="mt-1.5 space-y-0.5 text-[13px] text-ink-2">
              {adsLocal.local.rivals.slice(0, 8).map((r) => (
                <li key={r.name}>
                  {r.name} <span className="text-xs text-ink-3">({r.n})</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Panel>
  );
}

export function SentimentPanel2({ sentiment }: { sentiment: AiSentimentPanel }) {
  if (sentiment.withheld)
    return (
      <Panel title="How AI describes you" icon={<MessageSquareQuote />} description="Sentiment by aspect and against each competitor">
        <p className="text-[13px] text-ink-2">
          Withheld: {sentiment.n} {sentiment.n === 1 ? 'answer names' : 'answers name'} you, and sentiment needs at least {AI_SENTIMENT_MIN} before it says anything.
        </p>
      </Panel>
    );
  const r = range(sentiment.netLo, sentiment.netHi);
  // R-A2: until the engine says its reading is validated, the figure is an early reading and its objections are not findings
  const early = !sentiment.validated;
  return (
    <Panel title="How AI describes you" icon={<MessageSquareQuote />} description={`Net sentiment over ${sentiment.n} answers naming you`} info="Net sentiment: positive minus negative mentions, as a share of all mentions (-100 to 100), with its 95% range. Aspects are what the answer talked about.">
      {early && (
        <div className="mb-2">
          <Badge tone="warning">{sentiment.label || AI_SENTIMENT_EARLY}</Badge>
          <p className="mt-1 text-xs text-ink-3">
            The reader that labels these answers has not yet been checked against answers labelled by people, so treat this as a first look, not a finding.
          </p>
        </div>
      )}
      <p className="text-sm text-ink">
        Net sentiment <span className="font-display text-xl font-semibold">{sentiment.net != null ? (sentiment.net > 0 ? '+' : '') + sentiment.net.toFixed(0) : '-'}</span>
        {r && <span className="ml-2 text-xs text-ink-3">95% range {sentiment.netLo!.toFixed(0)} to {sentiment.netHi!.toFixed(0)}</span>}
      </p>
      {sentiment.note && <p className="mt-1 text-xs text-ink-3">{sentiment.note}</p>}
      {sentiment.unreadNote && <p className="mt-1 text-xs text-ink-3">{sentiment.unreadNote}</p>}
      {sentiment.byAspect.length > 0 && (
        <table className="mt-3 w-full text-[13px]">
          <thead>
            <tr className="text-left text-xs text-ink-3">
              <th className="py-1 font-medium">Aspect</th>
              <th className="py-1 text-right font-medium">Positive</th>
              <th className="py-1 text-right font-medium">Negative</th>
              <th className="py-1 text-right font-medium">Net</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {sentiment.byAspect.map((a) => (
              <tr key={a.aspect}>
                <td className="py-1.5 text-ink">{a.aspect}</td>
                <td className="py-1.5 text-right tabular">{a.pos}</td>
                <td className="py-1.5 text-right tabular">{a.neg}</td>
                <td className="py-1.5 text-right tabular">{a.n >= AI_SENTIMENT_MIN && a.net != null ? a.net.toFixed(0) : <span className="text-xs text-ink-3">too few</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {sentiment.byRival.length > 0 && <p className="mt-3 text-xs text-ink-3">Competitors: {sentiment.byRival.map((x) => `${x.id} ${x.n >= AI_SENTIMENT_MIN && x.net != null ? x.net.toFixed(0) : '(too few)'}`).join(' · ')}</p>}
      {sentiment.objections.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-ink-3">Objections AI raises about you</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[13px] text-ink-2">
            {sentiment.objections.slice(0, 6).map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        </div>
      )}
      {early && sentiment.objectionsHeld > 0 && (
        <p className="mt-3 text-xs text-ink-3">
          {sentiment.objectionsHeld} {sentiment.objectionsHeld === 1 ? 'objection was' : 'objections were'} read in these answers. They are listed once the reading is validated.
        </p>
      )}
      {(sentiment.method || sentiment.kappa != null || sentiment.kappaRules != null) && (
        <p className="mt-2 text-xs text-ink-3">
          {[
            sentiment.method,
            sentiment.kappa != null
              ? `agreement with a hand-labelled set: kappa ${sentiment.kappa.toFixed(2)}${sentiment.kappaGate != null ? ` (bar ${sentiment.kappaGate.toFixed(2)})` : ''}`
              : 'agreement with a hand-labelled set: not measured yet',
            sentiment.kappaRules != null ? `second-opinion rules: kappa ${sentiment.kappaRules.toFixed(2)}` : '',
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}
    </Panel>
  );
}

const VERDICT_TONE = { 'likely helped': 'good', "can't tell": 'neutral', 'likely hurt': 'warning' } as const;

/** Did an action work: the treated questions against matched untreated ones, before and after, with the interval. */
export function ImpactPanel({ impact, questionText }: { impact: AiImpactItem[]; questionText: (id: string) => string }) {
  return (
    <Panel title="Did it work?" icon={<FlaskConical />} description="Each action's questions against similar questions the action did not touch" info="Difference in differences: the change on the action's questions minus the change on the control questions, with a 95% interval from resampling the questions. The words are 'likely helped', 'can't tell' or 'likely hurt': an AI answer has many causes, so none of this says the action caused the change.">
      <ul className="divide-y divide-line">
        {impact.map((x) => (
          <li key={x.actionId} className="py-2.5 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={VERDICT_TONE[x.verdict]}>{x.verdict === "can't tell" ? "Can't tell" : x.verdict === 'likely helped' ? 'Likely helped' : 'Likely hurt'}</StatusBadge>
              <span className="text-[13px] font-medium text-ink">{x.kind ? `${x.kind}: ` : ''}{x.targetQuestions.slice(0, 2).map(questionText).join('; ') || x.actionId}</span>
            </div>
            <p className="mt-1 text-xs text-ink-3">
              Named in {x.before.rate != null ? pct(x.before.rate) : '-'} ({x.before.n} answers) before, {x.after.rate != null ? pct(x.after.rate) : '-'} ({x.after.n}) after
              {x.windowDays != null ? `, ${x.windowDays} days each side` : ''} · against {x.controlQuestions.length} control {x.controlQuestions.length === 1 ? 'question' : 'questions'}
              {x.did.effect != null ? ` · effect ${x.did.effect > 0 ? '+' : ''}${x.did.effect.toFixed(1)} points${x.did.lo != null && x.did.hi != null ? ` (95% interval ${x.did.lo.toFixed(1)} to ${x.did.hi.toFixed(1)})` : ''}` : ''}
            </p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** The searches the engines ran before answering, and whether you rank for them. */
export function FanoutGapPanel({ gap }: { gap: AiFanoutGapPanel }) {
  type Q = AiFanoutGapPanel['queries'][number];
  const cols: Column<Q>[] = [
    { key: 'query', header: 'Search the engine ran', sortValue: (x) => x.query, cell: (x) => <span className="text-[13px] font-medium text-ink">{x.query}</span> },
    { key: 'freq', header: 'Times', align: 'right', sortValue: (x) => x.freq, cell: (x) => <span className="tabular">{x.freq}</span> },
    { key: 'rank', header: 'Your Google place', align: 'right', sortValue: (x) => x.ourRank ?? 99, cell: (x) => (x.ourRank != null ? <span className="tabular">#{x.ourRank}</span> : <span className="text-xs text-ink-3">not in the top 10</span>) },
    { key: 'cited', header: 'Cited?', sortValue: (x) => (x.cited ? 1 : 0), cell: (x) => (x.cited ? <StatusBadge tone="good">Cited</StatusBadge> : x.ourRank != null && x.ourRank <= 3 ? <StatusBadge tone="warning">Ranks, not cited</StatusBadge> : <span className="text-xs text-ink-3">No</span>) },
    { key: 'page', header: 'Page', hideOnMobile: true, cell: (x) => <span className="block max-w-[14rem] truncate text-[13px] text-ink-2" title={x.ourUrl ?? x.targetUrl ?? ''}>{x.ourUrl ? urlPath(x.ourUrl) : x.targetUrl ? `write: ${urlPath(x.targetUrl)}` : '-'}</span> },
    { key: 'top', header: 'Ranking instead', hideOnMobile: true, cell: (x) => <Chips items={x.topDomains} max={3} /> },
  ];
  return (
    <Panel title="Searches behind the answers" icon={<Route />} description={`${gap.checkedN} of the searches the engines ran, checked in Google`} info="Assistants search the web before they answer. A page in Google's top results for those searches is far more likely to be cited. A search you rank for but are not cited on is flagged on its own.">
      <DataTable rows={gap.queries} columns={cols} rowKey={(x) => x.query} dense pageSize={10} initialSort={{ key: 'freq', dir: 'desc' }} empty="No searches checked yet." />
    </Panel>
  );
}

/** Demand as a range from several proxies, each named. */
export function DemandPanel({ demand, questionText }: { demand: AiDemandPanel; questionText: (id: string) => string }) {
  return (
    <Panel title="How often these questions are asked" icon={<Sigma />} description="A range from several estimates, each named with its date" info="No one publishes how often a question is asked in AI assistants. The range comes from several stand-ins (AI search volume, Search Console impressions of the same question, Google's own figures), each shown with what it is.">
      <ul className="divide-y divide-line">
        {demand.questions.slice(0, 12).map((q) => (
          <li key={q.promptId} className="py-2 first:pt-0">
            <p className="text-[13px] font-medium text-ink">{questionText(q.promptId)}</p>
            <p className="text-xs text-ink-3">
              {q.lo != null && q.hi != null ? `${compactNumber(q.lo)} to ${compactNumber(q.hi)} a month` : 'no range'} · {q.proxies.map((p) => `${p.source}: ${p.value != null ? compactNumber(p.value) : '-'}${p.asOf ? ` (${fmtDate(p.asOf)})` : ''}${p.note ? `, ${p.note}` : ''}`).join(' · ')}
            </p>
          </li>
        ))}
      </ul>
      {demand.market.topBrands.length > 0 && <p className="mt-2 text-xs text-ink-3">Brands AI names most across the market: {demand.market.topBrands.slice(0, 6).map((b) => b.name).join(', ')}</p>}
      {demand.note && <p className="mt-1 text-xs text-ink-3">{demand.note}</p>}
    </Panel>
  );
}

/** Each buyer role sent as context to the API engines, asked with and without it. */
export function PersonaEffectPanel({ effect }: { effect: AiPersonaEffect[] }) {
  return (
    <Panel title="Does the buyer's role change the answer?" icon={<Users />} description="Asked with and without each role as context" info="These answers come from the engines' APIs, which take a role as context; the consumer apps cannot. They show how a role shifts the answer, not what a person in the app sees.">
      <Badge tone="accent" className="mb-2">API answers</Badge>
      <ul className="divide-y divide-line text-[13px]">
        {effect.map((x) => (
          <li key={x.role} className="flex flex-wrap items-baseline justify-between gap-2 py-1.5">
            <span className="font-medium text-ink">{x.role}</span>
            <span className="text-xs text-ink-3">
              named {x.withRate != null ? pct(x.withRate) : '-'} with the role ({x.withN}) vs {x.withoutRate != null ? pct(x.withoutRate) : '-'} without ({x.withoutN}) ·{' '}
              {x.significant === true && x.delta != null ? `${x.delta > 0 ? '+' : ''}${x.delta.toFixed(1)} points${x.lo != null && x.hi != null ? ` (95% ${x.lo.toFixed(1)} to ${x.hi.toFixed(1)})` : ''}` : 'no measurable difference'}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

// ---------------- the owner's AI report uploads (§5) ----------------

export function AiReportsCard() {
  const { org, site, can } = useSitePage();
  const list = useAiImports(org.id, site.id);
  const upload = useAiImport(org.id, site.id);
  const [source, setSource] = useState<'' | 'bing_ai' | 'gsc_ai'>('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [dateOrder, setDateOrder] = useState<'' | 'dmy' | 'mdy'>('');
  const file = useRef<HTMLInputElement>(null);
  const send = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 15_000_000) return toast.error('The file is larger than 15 MB: export a shorter period');
    upload.mutate(
      { csv: await f.text(), fileName: f.name, source, periodEnd, dateOrder },
      {
        onSuccess: (r) =>
          toast.success(`${r.rows} rows from ${r.label}, ${fmtDate(r.days.from)} to ${fmtDate(r.days.to)}${r.skipped ? ` (${r.skipped} lines skipped)` : ''}`, {
            // R-A4 / R-A13: what an earlier upload lost to this one, and the queries a file without pages holds (is it the right website?)
            description: [
              r.replaced ? `${r.replaced} rows of an earlier upload with the same day, page and query were replaced.` : '',
              r.topQueries?.length ? `Top queries: ${r.topQueries.join(', ')}. A file without pages cannot be matched to a website, so check these are searches for ${site.domain}.` : '',
            ]
              .filter(Boolean)
              .join(' ') || undefined,
          }),
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };
  const rows = list.data?.sources ?? [];
  return (
    <Panel
      title="Your AI reports"
      icon={<FileUp />}
      description="Citations from Bing Webmaster Tools (Copilot and Bing's AI answers) and AI search figures from Search Console, uploaded by you"
      actions={<GuideButton id="ai-report-import" variant="chip" vars={{ domain: site.domain }} label="Show me how" />}
    >
      {rows.length > 0 ? (
        <ul className="mb-3 divide-y divide-line text-[13px]">
          {rows.map((r) => (
            <li key={r.source} className="flex flex-wrap items-baseline justify-between gap-2 py-1.5">
              <span className="font-medium text-ink">{AI_IMPORT_SOURCE_LABEL[r.source as 'bing_ai'] ?? r.source}</span>
              <span className="text-xs text-ink-3">
                {n0(r.rows)} rows, {r.from ? `${fmtDate(r.from)} to ${fmtDate(r.to)}` : '-'} · {r.citations ? `${n0(r.citations)} citations` : ''}
                {r.impressions ? ` ${n0(r.impressions)} impressions` : ''}
                {r.clicks ? `, ${n0(r.clicks)} clicks` : ''} · uploaded {fmtDate(r.importedAt)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-3 text-[13px] text-ink-2">Nothing uploaded yet. Neither report has an API: an export from each is the only way to bring Copilot's citations and Google's AI search figures in.</p>
      )}
      {can('member') ? (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
          <Field label="Report">
            {(p) => (
              <Select {...p} value={source} onChange={(e) => setSource(e.target.value as typeof source)}>
                <option value="">Recognise it from the file</option>
                <option value="bing_ai">{AI_IMPORT_SOURCE_LABEL.bing_ai}</option>
                <option value="gsc_ai">{AI_IMPORT_SOURCE_LABEL.gsc_ai}</option>
              </Select>
            )}
          </Field>
          <Field label="Last day of the period" optional hint="Needed for a file without dates (Search Console's Queries or Pages file)">
            {(p) => <Input {...p} type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />}
          </Field>
          <Field label="Dates in the file" hint="Only needed when every date could be either way round (like 05/10/2026)">
            {(p) => (
              <Select {...p} value={dateOrder} onChange={(e) => setDateOrder(e.target.value as typeof dateOrder)}>
                <option value="">Recognise them from the file</option>
                <option value="dmy">Day first (22/10/2026)</option>
                <option value="mdy">Month first (10/22/2026)</option>
              </Select>
            )}
          </Field>
          <div>
            <input ref={file} type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" className="sr-only" aria-label="Choose the exported CSV file" onChange={(e) => { void send(e.target.files?.[0]); e.target.value = ''; }} />
            <Button icon={<Upload className="size-4" />} loading={upload.isPending} onClick={() => file.current?.click()}>
              Upload a CSV
            </Button>
          </div>
        </div>
      ) : (
        <p className="flex items-center gap-1.5 text-xs text-ink-3">
          <Ban className="size-3.5" aria-hidden /> Members and admins can upload.
        </p>
      )}
    </Panel>
  );
}
