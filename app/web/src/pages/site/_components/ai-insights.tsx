// AI visibility v4.9 panels: what AI visits are worth (GA4), how AI describes the business, AI crawler access, buyer stages and topics,
// the market-wide index (the AI-answer database), what AI searched before answering, and real questions worth tracking.
import { useState } from 'react';
import { toast } from 'sonner';
import { AtSign, Bot, Coins, Globe, Layers, Link2, MessageSquareQuote, PieChart, Plus, Scale, ShieldAlert, ShieldCheck, Target, Users } from 'lucide-react';
import { compactNumber, formatPercent, titleCase, type AiAccess, type AiGroup, type AiIndex, type AiPerception, type AiTraffic } from '@seo/shared';
import { errorMessage } from '@/lib/api';
import { useSiteAdmin } from '@/lib/queries';
import { cn, fmtDate } from '@/lib/utils';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Callout } from '@/components/ui/feedback';
import { DataTable, type Column } from '@/components/ui/table';
import { Chips, Kind, Panel, useSitePage } from './kit';
import { FigureTile, RankedBars } from './visuals';

const pct0 = (v: number) => formatPercent(v, 0);

/** Visits, key events and revenue that AI assistants send (GA4, last 28 days). */
export function AiTrafficPanel({ traffic }: { traffic: AiTraffic | null }) {
  const { can, page } = useSitePage();
  if (!traffic)
    return (
      <Panel title="What AI visits are worth" icon={<Coins />} description="Visits, key events and revenue from ChatGPT, Perplexity, Gemini, Copilot, Claude and other assistants (GA4)">
        <p className="text-[13px] text-ink-2">Shown from the next weekly AI visibility run (Monday 07:00), when GA4 is connected for this website.</p>
      </Panel>
    );
  if (!traffic.connected)
    return (
      <Panel title="What AI visits are worth" icon={<Coins />} description="Visits, key events and revenue from ChatGPT, Perplexity, Gemini, Copilot, Claude and other assistants (GA4)">
        <Callout tone="info" title="GA4 is not connected for this website" action={can('admin') ? <ButtonLink to={page('settings/tracking')} size="sm" variant="secondary">Connect GA4</ButtonLink> : undefined}>
          {traffic.error && !/not connected/i.test(traffic.error) ? `${traffic.error}. ` : ''}Give the service account Viewer access to your GA4 property; the next weekly run shows what AI answers are worth.
        </Callout>
      </Panel>
    );
  const t = traffic;
  const better = t.organicConvRate > 0 ? t.convRate / t.organicConvRate : null;
  return (
    <Panel
      title="What AI visits are worth"
      icon={<Coins />}
      description={`GA4, ${t.period ? `${fmtDate(t.period.start)} – ${fmtDate(t.period.end)}` : 'last 28 days'}. Google AI Overviews and AI Mode count as organic search in GA4.`}
      flush
    >
      <div className="grid grid-cols-2 gap-2.5 px-4 pb-4 sm:grid-cols-4">
        <FigureTile icon={<Users />} label="AI visits" value={compactNumber(t.sessions)} hint={t.changePct != null ? `${t.changePct >= 0 ? '+' : ''}${t.changePct}% vs the 28 days before` : 'no earlier period'} />
        <FigureTile icon={<Target />} label="Key events" value={compactNumber(t.keyEvents)} hint={`${pct0(t.convRate)} of AI visits convert`} />
        <FigureTile icon={<Coins />} label="Revenue" value={t.revenue ? compactNumber(t.revenue) : '–'} hint={t.revenue ? 'in the property’s currency' : 'no purchases recorded'} />
        <FigureTile icon={<Scale />} label="vs organic search" value={better ? `${better.toFixed(1)}×` : '–'} hint={`organic converts at ${pct0(t.organicConvRate)} · AI is ${formatPercent(t.shareOfSessions, 1)} of all visits`} />
      </div>
      <div className="grid grid-cols-1 gap-4 border-t border-line p-4 lg:grid-cols-2">
        <DataTable
          rows={t.assistants}
          rowKey={(a) => a.name}
          dense
          pageSize={8}
          empty="No visits from AI assistants yet."
          columns={[
            { key: 'name', header: 'Assistant', sortValue: (a) => a.name, cell: (a) => <span className="font-medium text-ink">{a.name}</span> },
            { key: 'sessions', header: 'Visits', align: 'right', sortValue: (a) => a.sessions, cell: (a) => <span className="tabular">{compactNumber(a.sessions)}</span> },
            { key: 'prev', header: 'Before', align: 'right', hideOnMobile: true, sortValue: (a) => a.prevSessions, cell: (a) => <span className="tabular text-ink-3">{compactNumber(a.prevSessions)}</span> },
            { key: 'ke', header: 'Key events', align: 'right', sortValue: (a) => a.keyEvents, cell: (a) => <span className="tabular">{compactNumber(a.keyEvents)}</span> },
            { key: 'rev', header: 'Revenue', align: 'right', hideOnMobile: true, sortValue: (a) => a.revenue, cell: (a) => <span className="tabular">{a.revenue ? compactNumber(a.revenue) : '–'}</span> },
          ]}
          initialSort={{ key: 'sessions', dir: 'desc' }}
        />
        <DataTable
          rows={t.landing}
          rowKey={(l) => l.page}
          dense
          pageSize={8}
          empty="No landing pages yet."
          columns={[
            {
              key: 'page',
              header: 'Landing page from AI',
              sortValue: (l) => l.page,
              cell: (l) => (
                <span className="inline-flex min-w-0 flex-wrap items-center gap-1.5">
                  <span className="max-w-[16rem] truncate text-[13px] text-ink" title={l.page}>
                    {l.page}
                  </span>
                  {l.citedByAi && <Kind>cited by AI</Kind>}
                </span>
              ),
            },
            { key: 'sessions', header: 'Visits', align: 'right', sortValue: (l) => l.sessions, cell: (l) => <span className="tabular">{compactNumber(l.sessions)}</span> },
            { key: 'ke', header: 'Key events', align: 'right', sortValue: (l) => l.keyEvents, cell: (l) => <span className="tabular">{compactNumber(l.keyEvents)}</span> },
          ]}
          initialSort={{ key: 'sessions', dir: 'desc' }}
        />
      </div>
    </Panel>
  );
}

/** How the answers speak about the business, the words they use, and what they get wrong (read by Claude against the business profile). */
export function PerceptionPanel({ perception }: { perception: AiPerception | null }) {
  const { can, page } = useSitePage();
  if (!perception) return null;
  const p = perception;
  const total = p.positive + p.neutral + p.negative;
  const bar = (n: number, cls: string, label: string) => (n ? <span className={cn('h-full', cls)} style={{ width: `${(100 * n) / total}%` }} title={`${n} ${label}`} /> : null);
  return (
    <Panel title="How AI describes you" icon={<MessageSquareQuote />} description="The answers that name you, read for tone and checked against your business profile">
      {total ? (
        <div className="space-y-4">
          <div>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${p.positive} positive, ${p.neutral} neutral, ${p.negative} negative answers`}>
              {bar(p.positive, 'bg-good', 'positive')}
              {bar(p.neutral, 'bg-line-strong', 'neutral')}
              {bar(p.negative, 'bg-critical', 'negative')}
            </div>
            <p className="mt-1.5 text-xs text-ink-3">
              {p.positive} positive · {p.neutral} neutral · {p.negative} negative{p.score != null ? ` · score ${p.score > 0 ? '+' : ''}${p.score} (−100 to +100)` : ''}
            </p>
          </div>
          {p.descriptors.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-ink-3">Words AI uses for you</p>
              <Chips items={p.descriptors} max={8} />
            </div>
          )}
        </div>
      ) : (
        <p className="text-[13px] text-ink-2">No answer named you in the latest run, so there is nothing to read yet.</p>
      )}
      {p.issues.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-critical-text">
            <ShieldAlert className="size-4" aria-hidden /> What AI gets wrong
          </p>
          <ul className="space-y-2">
            {p.issues.map((i) => (
              <li key={i.text} className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-[13px]">
                <span className="text-ink">{i.text}</span>
                <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
                  {i.new && <StatusBadge tone="critical">New</StatusBadge>}
                  {i.engines.join(', ')}
                  {i.questions[0] ? ` · “${i.questions[0]}”` : ''}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-3">
            State the right fact plainly on your About and service pages and in your profiles.{' '}
            {can('admin') && (
              <ButtonLink to={page('settings/profile')} variant="link">
                Check the business profile
              </ButtonLink>
            )}
          </p>
        </div>
      )}
      {p.negatives.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-medium text-ink-3">Negative answers</p>
          <ul className="space-y-2">
            {p.negatives.map((x, k) => (
              <li key={k} className="text-[13px]">
                <span className="font-medium text-ink">{x.engine}</span> · {x.prompt}
                <span className="mt-0.5 block rounded-md bg-surface-2 px-2 py-1 text-xs text-ink-2">{x.excerpt}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

/** Whether the AI crawlers may read the site: robots.txt per bot, llms.txt, and a firewall / CDN test of the homepage. */
export function AccessPanel({ access }: { access: AiAccess | null }) {
  if (!access) return null;
  const a = access;
  const answer = a.bots.filter((b) => b.group === 'answer'), training = a.bots.filter((b) => b.group === 'training');
  const columns: Column<AiAccess['bots'][number]>[] = [
    { key: 'bot', header: 'Crawler', sortValue: (b) => b.bot, cell: (b) => <span className="font-medium text-ink">{b.bot}</span> },
    { key: 'owner', header: 'Used for', hideOnMobile: true, sortValue: (b) => b.owner, cell: (b) => <span className="text-[13px] text-ink-2">{b.owner}</span> },
    {
      key: 'robots',
      header: 'robots.txt',
      sortValue: (b) => (b.allowed ? (b.blockedPaths.length ? 1 : 0) : 2),
      cell: (b) => (b.allowed ? b.blockedPaths.length ? <StatusBadge tone="warning">Some pages blocked</StatusBadge> : <StatusBadge tone="good">Allowed</StatusBadge> : <StatusBadge tone="critical">Blocked</StatusBadge>),
    },
    {
      key: 'fetch',
      header: 'Homepage test',
      sortValue: (b) => (b.fetchBlocked ? 1 : 0),
      cell: (b) => (b.fetchStatus == null ? <span className="text-xs text-ink-3">–</span> : b.fetchBlocked ? <StatusBadge tone="critical">Turned away ({b.fetchStatus || 'no answer'})</StatusBadge> : <span className="tabular text-[13px] text-ink-2">{b.fetchStatus}</span>),
    },
  ];
  return (
    <Panel
      title="Can AI read your site?"
      description={`An assistant can only cite a page its crawler may fetch · checked ${fmtDate(a.checkedAt)}`}
      icon={a.ok ? <ShieldCheck className="size-4" /> : <ShieldAlert className="size-4" />}
      iconTone={a.ok ? 'good' : 'critical'}
      flush
    >
      <div className="flex flex-wrap gap-2 px-4 pb-3">
        {a.ok ? <StatusBadge tone="good">AI search crawlers can read the site</StatusBadge> : <StatusBadge tone="critical">Some AI crawlers are blocked</StatusBadge>}
        <Badge>robots.txt {a.robotsFound ? 'found' : 'missing'}</Badge>
        <Badge>llms.txt {a.llmsTxt ? 'found' : 'missing'}</Badge>
      </div>
      {a.issues.length > 0 && (
        <ul className="space-y-2 px-4 pb-3">
          {a.issues.map((i) => (
            <li key={i.text} className="rounded-lg border border-line px-3 py-2 text-[13px]">
              <span className="flex items-start gap-2">
                <StatusBadge tone={i.level === 'critical' || i.level === 'high' ? 'critical' : i.level === 'medium' ? 'warning' : 'neutral'}>{titleCase(i.level)}</StatusBadge>
                <span className="text-ink">{i.text}</span>
              </span>
              <span className="mt-1 block text-xs text-ink-3">{i.fix}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="px-4 pb-4">
        <DataTable rows={answer} columns={columns} rowKey={(b) => b.bot} dense pageSize={10} />
        <p className="mt-2 text-xs text-ink-3">
          Training crawlers ({training.map((b) => `${b.bot}${b.allowed ? '' : ' – blocked'}`).join(', ')}) are your choice: blocking them keeps your content out of model training but does not remove you from AI answers. The homepage test runs from our server, so a block seen there is a likely firewall or CDN rule (e.g. “block AI bots”).
        </p>
      </div>
    </Panel>
  );
}

/** Visibility by buyer stage and topic cluster, with the demand behind each and who is named most instead. */
export function GroupsPanel({ stages, clusters }: { stages: AiGroup[]; clusters: AiGroup[] }) {
  const [view, setView] = useState<'stage' | 'topic'>('stage');
  const rows = view === 'stage' ? stages : clusters;
  if (!stages.length && !clusters.length) return null;
  return (
    <Panel
      title={view === 'stage' ? 'By buyer stage' : 'By topic'}
      icon={<Layers />}
      description="Where in the buyer journey AI names you, the monthly AI searches behind the questions, and who AI names most instead"
      actions={
        <div className="flex gap-1">
          <Button size="sm" variant={view === 'stage' ? 'secondary' : 'ghost'} onClick={() => setView('stage')}>
            Stage
          </Button>
          <Button size="sm" variant={view === 'topic' ? 'secondary' : 'ghost'} onClick={() => setView('topic')}>
            Topic
          </Button>
        </div>
      }
      flush
    >
      <div className="px-4 pb-4">
        <DataTable
          rows={rows}
          rowKey={(g) => g.key}
          dense
          pageSize={12}
          columns={[
            { key: 'key', header: view === 'stage' ? 'Stage' : 'Topic', sortValue: (g) => g.key, cell: (g) => <span className="font-medium text-ink">{titleCase(g.key)}</span> },
            { key: 'q', header: 'Questions', align: 'right', sortValue: (g) => g.questions, cell: (g) => <span className="tabular">{g.questions}</span> },
            { key: 'm', header: 'Named in', align: 'right', sortValue: (g) => g.mentionRate, cell: (g) => <span className="tabular">{pct0(g.mentionRate)}</span> },
            { key: 'v', header: 'AI searches / mo', align: 'right', hideOnMobile: true, sortValue: (g) => g.volume, cell: (g) => <span className="tabular">{g.volume ? compactNumber(g.volume) : '–'}</span> },
            { key: 'l', header: 'Named most instead', hideOnMobile: true, sortValue: (g) => g.leader, cell: (g) => <span className="text-[13px] text-ink-2">{g.leader || '–'}</span> },
          ]}
          initialSort={{ key: 'v', dir: 'desc' }}
        />
      </div>
    </Panel>
  );
}

/** The AI-answer database: how often answers across the market cite each business, beyond the tracked questions. */
export function IndexPanel({ index, domain }: { index: AiIndex | null; domain: string }) {
  if (!index || (!index.brands.length && !index.questions.length)) return null;
  const x = index;
  const shares = x.brands.filter((b) => b.share != null).map((b) => ({ label: b.label, value: b.share ?? 0, sub: compactNumber(b.mentions) }));
  const byName = x.brands.find((b) => b.key.startsWith('name:'));
  return (
    <Panel
      icon={<Globe />}
      title="Market-wide: every AI answer"
      description={`How often answers across the AI-answer database (Google AI Overviews${x.platforms.includes('chat_gpt') ? ' and ChatGPT' : ''}) cite each business — far more questions than your tracked ones · ${x.carried ? 'monthly, ' : ''}${fmtDate(x.checkedAt)}`}
    >
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <FigureTile icon={<PieChart />} label="Your share" value={x.sov != null ? formatPercent(x.sov, 1) : '–'} hint="of the answers citing you or a competitor" />
        <FigureTile icon={<Link2 />} label="Answers citing you" value={compactNumber(x.answersCitingYou)} hint="real questions in the database" />
        {byName && <FigureTile icon={<AtSign />} label="Named without a link" value={compactNumber(byName.mentions)} hint={`answers that say “${byName.label.replace(/^“|” by name$/g, '')}”`} />}
      </div>
      {shares.length > 1 && (
        <div className="mt-4">
          <RankedBars items={shares.sort((a, b) => b.value - a.value)} you={domain} />
        </div>
      )}
      {x.questions.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-medium text-ink-3">Real questions where AI cites you</p>
          <ul className="space-y-1 text-[13px]">
            {x.questions.slice(0, 8).map((q) => (
              <li key={q.question} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 text-ink">{q.question}</span>
                <span className="shrink-0 text-xs tabular text-ink-3">{compactNumber(q.volume)}/mo</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

/** What the assistants searched before answering (fan-out), and real questions the panel does not track yet (one click to add). */
export function DiscoveryPanel({ index, tracked }: { index: AiIndex | null; tracked: readonly string[] }) {
  const { org, site, can } = useSitePage();
  const admin = useSiteAdmin(org.id, site.id);
  const [added, setAdded] = useState<string[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  if (!index || (!index.fanout.length && !index.suggestions.length)) return null;
  const known = new Set([...tracked, ...added].map((t) => t.toLowerCase()));
  const suggestions = index.suggestions.filter((s) => !known.has(s.question.toLowerCase()));
  const add = (q: string) => {
    setPending(q);
    admin.mutate(
      { action: 'ai_prompts', add: [q.length < 10 ? `${q}?` : q], remove: [] },
      {
        onSuccess: (r) => (r.ok ? (setAdded((a) => [...a, q]), toast.success('Question added — asked from the next run')) : toast.error(r.error ?? 'The question was not saved')),
        onError: (e) => toast.error(errorMessage(e)),
        onSettled: () => setPending(null),
      },
    );
  };
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
      {index.fanout.length > 0 && (
        <Panel title="What AI searched before answering" description="The searches the assistants ran to write their answers: a page that ranks for these is the page they read and cite" icon={<Bot className="size-4" />}>
          <ul className="space-y-2 text-[13px]">
            {index.fanout.slice(0, 10).map((f) => (
              <li key={f.query}>
                <span className="font-medium text-ink">{f.query}</span>
                <span className="block text-xs text-ink-3">
                  {f.count}× · {f.engines.join(', ')}
                  {f.questions[0] ? ` · for “${f.questions[0]}”` : ''}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      {suggestions.length > 0 && (
        <Panel title="Questions worth tracking" icon={<Plus />} description="Real questions people ask AI about your topics (AI-answer database) that your panel does not track yet">
          <ul className="space-y-2">
            {suggestions.slice(0, 10).map((s) => (
              <li key={s.question} className="flex items-start justify-between gap-3 text-[13px]">
                <span className="min-w-0">
                  <span className="text-ink">{s.question}</span>
                  <span className="block text-xs text-ink-3">
                    {compactNumber(s.volume)} AI searches / month{s.youCited ? ' · AI already cites you here' : ''}
                  </span>
                </span>
                {can('admin') && (
                  <Button size="sm" variant="ghost" icon={<Plus className="size-3.5" />} onClick={() => add(s.question)} loading={pending === s.question} aria-label={`Track: ${s.question}`}>
                    Track
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
