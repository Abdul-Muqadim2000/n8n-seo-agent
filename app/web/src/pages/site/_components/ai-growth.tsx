// AI growth (v4.12, n8n/seo-agent/AI_GROWTH_SPEC.md): what the weekly loop did so the website gets named and cited in AI answers, and what
// to do next, pages sent to Bing / IndexNow, the key pages' AI readiness, the exact pages AI cites without naming the business (with outreach
// drafts), the questions queued for an AI answer page, the entity check.
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, ChevronDown, FileCheck2, Globe, Library, MailPlus, Megaphone, PenSquare, Rocket, Send, ShieldCheck, Target } from 'lucide-react';
import { GuideButton } from '@/components/guide';
import { SiteTaskRow, useSiteTasks } from '@/components/site/SiteTasks';
import { fmtAgo, fmtDate } from '@/lib/utils';
import type { AiEarnedPage, AiGrowth, AiPageStat, AiTargetStat, IndexNowCheck } from '@seo/shared';
import { api, toastError } from '@/lib/api';
import { useSiteAdmin } from '@/lib/queries';
import { useCycleDay } from '@/lib/cycle-day';
import { Badge, StatusBadge, type Tone } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Callout } from '@/components/ui/feedback';
import { CopyButton, Meter, scoreTone } from '@/components/ui/misc';
import { DataTable, type Column } from '@/components/ui/table';
import { Panel, SectionHeading, useSitePage } from './kit';
import { urlPath } from './format';
import { FigureTile } from './visuals';
import { engineLabel } from './ai';

const KIND: Record<string, string> = { list: '"Best of" list', article: 'Article', news: 'News', review: 'Review site', forum: 'Forum thread', video: 'Video', social: 'Social post', official: 'Official list', encyclopedia: 'Encyclopedia', competitor: 'Competitor page' };
/** the prospect statuses of an earned page (seo_link_prospects), in the person's words */
const EARNED_STATUS: Record<string, { label: string; tone: Tone }> = { new: { label: 'To send', tone: 'accent' }, contacted: { label: 'Sent', tone: 'neutral' }, replied: { label: 'Replied', tone: 'accent' }, won: { label: 'Names you', tone: 'good' }, rejected: { label: 'Declined', tone: 'neutral' }, ignored: { label: 'Not a fit', tone: 'neutral' } };
const STATUS_TONE: Record<string, Tone> = { won: 'good', contacted: 'accent', new: 'neutral', declined: 'neutral', queued: 'accent', writing: 'accent', written: 'accent', skipped: 'neutral' };

export function AiGrowthSection({ growth }: { growth: AiGrowth | null }) {
  const { can, page } = useSitePage();
  const day = useCycleDay();
  if (!growth)
    return (
      <Panel title="AI growth" icon={<Rocket />} description="The weekly work that gets you named and cited in AI answers">
        <p className="text-[13px] leading-relaxed text-ink-2">
          Runs {day.every}, after the AI visibility check: it sends new and updated pages to Bing and IndexNow, checks your key pages can be read and quoted by AI, lists the exact pages AI cites without naming you (with outreach drafts) and queues the questions to win for the weekly content run. The first results appear here after its first run.
        </p>
        {can('admin') && (
          <div className="mt-3">
            <ButtonLink to={page('settings/tracking')} size="sm" variant="secondary">
              AI growth settings
            </ButtonLink>
          </div>
        )}
      </Panel>
    );
  const g = growth;
  const sent = g.submitted.bing.submitted + g.submitted.indexnow.submitted;
  const bad = g.alerts.filter((a) => a.level === 'high' || a.level === 'medium');
  const good = g.alerts.filter((a) => a.level === 'good');
  return (
    <section className="space-y-4">
      <SectionHeading
        icon={<Rocket />}
        title="AI growth"
        description={`The weekly work that gets you named and cited in AI answers · ${fmtAgo(g.checkedAt)}`}
        info="Earned media (other sites that name you) moves AI answers most; then pages that answer the question first, cover what AI searches for and stay fresh. Schema and llms.txt show no measurable effect, so they are not scored."
      />
      {bad.length > 0 && (
        <Callout tone="warning" title="Needs attention">
          <ul className="space-y-1">{bad.map((a) => <li key={a.text}>{a.text}</li>)}</ul>
        </Callout>
      )}
      {good.length > 0 && (
        <Callout tone="good" title="Wins">
          <ul className="space-y-1">{good.map((a) => <li key={a.text}>{a.text}</li>)}</ul>
        </Callout>
      )}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <FigureTile
          icon={<Send />}
          label="Sent to Bing / IndexNow"
          value={sent}
          hint={!g.submitted.bing.enabled ? 'Bing key not set' : !g.submitted.bing.inAccount ? 'site not in the Bing account' : sent ? 'new and updated pages this week' : 'nothing new to send this week'}
        />
        <FigureTile icon={<FileCheck2 />} label="Key pages AI-ready" value={g.avgScore != null ? `${g.avgScore}/100` : '-'} hint={`${g.pagesChecked} page(s) checked this week`} />
        <FigureTile icon={<Megaphone />} label="Pages citing others, not you" value={g.earned.filter((e) => e.kind !== 'competitor' && e.mentionsUs !== true).length} hint={`${new Set(g.earned.filter((e) => e.drafted && e.kind !== 'competitor').map((e) => e.host)).size} site(s) with an outreach draft`} />
        <FigureTile icon={<PenSquare />} label="AI pages this month" value={`${g.writtenThisMonth} / ${g.pagesPerMonth}`} hint={`${g.targets.filter((t) => t.status === 'queued').length} question(s) queued`} />
      </div>
      {g.submitted.indexnow.key && <IndexNowStep keyUrl={g.submitted.indexnow.keyUrl} k={g.submitted.indexnow.key} weeklyFound={g.submitted.indexnow.verified} />}
      <EarnedPanel earned={g.earned} />
      <TargetsPanel targets={g.targets} perMonth={g.pagesPerMonth} />
      <PagesPanel pages={g.pages} />
      {g.entity && (
        <Panel title="Entity" icon={<Globe />} description={`Wikidata · checked ${fmtDate(g.entity.checkedAt)}`}>
          <p className="text-[13px] leading-relaxed text-ink-2">
            {g.entity.found ? (
              <>
                Wikidata item <b className="text-ink">{g.entity.qid}</b> lists your website as its official website, so knowledge graphs and AI can resolve your business.
              </>
            ) : (
              <>
                No Wikidata item has your website as its official website{g.entity.byName.length ? ` (similar names: ${g.entity.byName.slice(0, 3).map((x) => x.label + (x.description ? ` (${x.description})` : '')).join('; ')})` : ''}. Wikidata accepts organisations that independent sources (press, registries) cover: once you have that coverage, create the item with your website, founding date and location.
              </>
            )}
          </p>
        </Panel>
      )}
    </section>
  );
}

/**
 * Site tasks (app/docs/SITE_TASKS.md): the IndexNow file is a step on the website like the Pipeline's, with the same stored check. A server
 * from before site tasks (no tasks endpoint) keeps the older callout below.
 */
function IndexNowStep({ keyUrl, k, weeklyFound }: { keyUrl: string; k: string; weeklyFound: boolean }) {
  const tasks = useSiteTasks();
  const task = tasks.data?.find((t) => t.key === 'indexnow');
  // still loading: nothing yet; an older server, an error or a query that cannot run: the callout from before site tasks
  if (tasks.isPending && tasks.fetchStatus !== 'idle') return null;
  if (!task) return weeklyFound ? null : <IndexNowSetup keyUrl={keyUrl} k={k} />;
  // done and the weekly run agrees: nothing to say; done by our check before the weekly run saw it: say so once
  if (task.state === 'done' && weeklyFound) return null;
  if (task.state === 'done')
    return (
      <Callout tone="good" title="IndexNow is ready">
        {task.lastCheck?.message ?? 'The file is in place.'} From the next AI growth run every new or updated page is sent through IndexNow too.
      </Callout>
    );
  if (task.state === 'skipped') return null;
  return (
    <ul className="overflow-hidden rounded-lg border border-line">
      <SiteTaskRow task={task} />
    </ul>
  );
}

function IndexNowSetup({ keyUrl, k }: { keyUrl: string; k: string }) {
  const { org, site } = useSitePage();
  const file = `${k}.txt`;
  const [result, setResult] = useState<IndexNowCheck | null>(null);
  const check = useMutation({
    mutationFn: () => api<IndexNowCheck>(`/api/orgs/${org.id}/sites/${site.id}/ai/indexnow/check`, { method: 'POST', body: {} }),
    onSuccess: (r) => {
      setResult(r);
      if (r.verified) toast.success('IndexNow is ready');
    },
    onError: (e) => toastError(e),
  });
  if (result?.verified)
    return (
      <Callout tone="good" title="IndexNow is ready">
        {result.message}
      </Callout>
    );
  return (
    <Callout tone="info" title="One file to add: IndexNow">
      <p>
        Put a file named <code className="rounded bg-surface-2 px-1">{file}</code> containing only <code className="rounded bg-surface-2 px-1">{k}</code> at <span className="break-all">{keyUrl}</span>. From then on every new or updated page reaches Bing (and Copilot), Yandex, Naver and the other IndexNow engines the same week.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <CopyButton text={k} label="Copy the key" />
        <a href={`data:text/plain;charset=utf-8,${encodeURIComponent(k)}`} download={file} className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-2 text-xs font-medium text-ink-2 shadow-card hover:bg-surface-2 hover:text-ink">
          Download {file}
        </a>
        <Button size="sm" variant="secondary" loading={check.isPending} onClick={() => check.mutate()}>
          Check the file
        </Button>
        <GuideButton
          id="indexnow-key-file"
          vars={{ domain: site.domain, indexNowKey: k, indexNowFile: file, indexNowUrl: keyUrl }}
          label="Show me how"
          finish={{ label: 'Check the file', onClick: () => check.mutate() }}
        />
      </div>
      {result && !result.verified && <p className="mt-2 text-[13px] text-warning-text">{result.message}</p>}
    </Callout>
  );
}

function EarnedPanel({ earned }: { earned: AiEarnedPage[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const { org, site, can } = useSitePage();
  const admin = useSiteAdmin(org.id, site.id);
  const mark = (e: AiEarnedPage, status: 'contacted' | 'ignored' | 'new') =>
    admin.mutate(
      { action: 'prospect', prospectDomain: e.host, type: 'ai_source', status },
      {
        onSuccess: (r) => (r.ok ? toast.success(`${e.host}: ${EARNED_STATUS[status].label.toLowerCase()}`) : toast.error(r.error ?? 'Not updated')),
        onError: (err) => toastError(err),
      },
    );
  const rows = earned.filter((e) => e.kind !== 'competitor');
  const cols: Column<AiEarnedPage>[] = [
    {
      key: 'page',
      header: 'Page AI cites · next step',
      cell: (e) => (
        <div className="min-w-[16rem] max-w-[34rem] space-y-1">
          <a href={e.url} target="_blank" rel="noopener noreferrer" className="block font-medium text-accent-text hover:underline [overflow-wrap:anywhere]" title={e.url}>
            {e.title || urlPath(e.url)}
          </a>
          <span className="block text-xs text-ink-3">
            {e.host} · {KIND[e.kind] ?? e.kind}
          </span>
          <p className="text-[13px] text-ink-2">{e.action}</p>
          {e.draft && (
            <button type="button" onClick={() => setOpen(open === e.url ? null : e.url)} className="inline-flex items-center gap-1 text-xs font-medium text-accent-text hover:underline" aria-expanded={open === e.url}>
              <MailPlus className="size-3.5" aria-hidden /> {open === e.url ? 'Hide the draft' : 'Show the draft'} <ChevronDown className="size-3" aria-hidden />
            </button>
          )}
          {e.draft && open === e.url && (
            <div className="rounded-lg bg-surface-2 p-3 text-[13px] text-ink-2">
              {e.draft.subject && <p className="mb-1 font-medium text-ink">{e.draft.subject}</p>}
              <p className="whitespace-pre-line [overflow-wrap:anywhere]">{e.draft.body}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <CopyButton text={(e.draft.subject ? e.draft.subject + '\n\n' : '') + e.draft.body} />
                {e.draft.subject && (
                  <a
                    href={`mailto:${encodeURIComponent(e.contactEmail)}?subject=${encodeURIComponent(e.draft.subject)}&body=${encodeURIComponent(e.draft.body)}`}
                    className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-2 text-xs font-medium text-ink-2 shadow-card hover:bg-surface-2 hover:text-ink"
                  >
                    <MailPlus className="size-3.5" aria-hidden /> Open in your e-mail{e.contactEmail ? ` (${e.contactEmail})` : ''}
                  </a>
                )}
                {can('admin') && (e.status === 'new' || !e.status) && (
                  <>
                    <Button size="sm" variant="secondary" loading={admin.isPending} onClick={() => mark(e, 'contacted')}>
                      Mark as sent
                    </Button>
                    <Button size="sm" variant="ghost" disabled={admin.isPending} onClick={() => mark(e, 'ignored')}>
                      Not a fit
                    </Button>
                  </>
                )}
              </div>
              <p className="mt-1.5 text-xs text-ink-3">Nothing is sent for you: send it from your own mailbox (or post the reply yourself), then mark it as sent. Follow-ups are drafted on the Backlinks page after 7 and 14 days.</p>
            </div>
          )}
        </div>
      ),
    },
    { key: 'cited', header: 'Cited', align: 'right', sortValue: (e) => e.citations, cell: (e) => <span className="block min-w-[5.5rem] tabular text-xs text-ink-2">{e.citations}× · {e.engines.map((x) => engineLabel(x, x)).join(', ')}</span> },
    {
      key: 'names',
      header: 'Names',
      cell: (e) => (e.mentionsUs === true ? <StatusBadge tone="good">You</StatusBadge> : <span className="block min-w-[7rem] text-xs text-ink-2">{e.competitorsNamed.join(', ') || (e.mentionsUs === false ? 'not you' : '-')}</span>),
    },
    { key: 'status', header: 'Status', cell: (e) => { const st = EARNED_STATUS[e.mentionsUs === true ? 'won' : e.status || 'new'] ?? EARNED_STATUS.new; return <Badge tone={st.tone}>{e.drafted || st.label !== 'To send' ? st.label : 'No draft yet'}</Badge>; } },
  ];
  return (
    <Panel title="Pages AI cites without naming you" icon={<Library />} description="Earned media is what AI answers rely on most: be named on these pages and the answers can name you" flush>
      <div className="px-4 pb-4">
        <DataTable rows={rows} rowKey={(e) => e.url} columns={cols} dense pageSize={8} empty="No third-party pages cited without you this week." />
      </div>
    </Panel>
  );
}

function TargetsPanel({ targets, perMonth }: { targets: AiTargetStat[]; perMonth: number }) {
  const { tool, can } = useSitePage();
  const shown = targets.filter((t) => t.status !== 'skipped').slice(0, 10);
  return (
    <Panel title="Questions to win" icon={<Target />} description={perMonth > 0 ? `The weekly content run picks the most valuable one (${perMonth} a month)` : 'AI pages are off: write them from here'}>
      {shown.length ? (
        <ul className="divide-y divide-line">
          {shown.map((t) => (
            <li key={t.targetId} className="flex flex-col gap-2 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{t.question}</p>
                <p className="mt-0.5 text-xs text-ink-3">
                  {t.kind === 'refresh' ? `Refresh ${urlPath(t.pageUrl)}` : /^written as the keyword ladder page/.test(t.reason) ? 'Keyword ladder page' : 'New answer page'} · {t.reason}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge tone={STATUS_TONE[t.status] ?? 'neutral'} icon={t.status === 'won' ? <CheckCircle2 className="size-3" aria-hidden /> : undefined}>
                  {t.status === 'won' ? 'Won' : t.status === 'writing' ? 'Being written' : t.status === 'queued' ? 'Queued' : t.status}
                </Badge>
                {/^written as the keyword ladder page/.test(t.reason) && t.status === 'queued' && <Badge>Via the ladder</Badge>}
                {t.status === 'queued' && can('member') && !/^written as the keyword ladder page/.test(t.reason) && (
                  <ButtonLink
                    size="sm"
                    variant="secondary"
                    to={tool('keyword', {
                      keyword: t.keyword,
                      pageType: t.kind === 'refresh' ? 'Service Page' : t.pageType || 'Guide',
                      existingPageUrl: t.kind === 'refresh' ? t.pageUrl : '',
                      receiveReport: true,
                      receiveContent: true,
                      aiTarget: { question: t.question, kind: t.kind, targetId: t.targetId, fanout: t.fanout, sources: t.sources, competitors: t.competitors },
                    })}
                  >
                    Write it now
                  </ButtonLink>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-ink-2">No lost questions this week. AI names you for every tracked question.</p>
      )}
    </Panel>
  );
}

function PagesPanel({ pages }: { pages: AiPageStat[] }) {
  const cols: Column<AiPageStat>[] = [
    {
      key: 'page',
      header: 'Page',
      cell: (p) => (
        <a href={p.url} target="_blank" rel="noopener noreferrer" className="block max-w-[22rem] truncate text-accent-text hover:underline" title={p.url}>
          {urlPath(p.url)}
        </a>
      ),
    },
    {
      key: 'score',
      header: 'AI-ready',
      sortValue: (p) => p.score ?? -1,
      cell: (p) => (p.status >= 200 && p.status < 300 && p.score != null ? <Meter value={p.score} tone={scoreTone(p.score)} label={`${p.score}/100`} className="min-w-28" /> : <StatusBadge tone="critical">{p.status ? `HTTP ${p.status}` : 'no answer'}</StatusBadge>),
    },
    { key: 'updated', header: 'Updated', sortValue: (p) => p.updatedOn, cell: (p) => <span className="text-xs text-ink-2">{p.updatedOn ? fmtDate(p.updatedOn) : 'no date'}</span> },
    { key: 'bing', header: 'Bing', cell: (p) => <span className="text-xs text-ink-2">{p.bingCrawledAt ? `crawled ${fmtDate(p.bingCrawledAt)}` : p.submittedAt ? `sent ${fmtDate(p.submittedAt)}` : '-'}</span> },
    { key: 'fix', header: 'Fix first', cell: (p) => <span className="text-[13px] text-ink-2">{p.issues[0] ?? 'Nothing, it is ready to be quoted'}</span> },
  ];
  return (
    <Panel title="Can AI read and quote your key pages?" icon={<ShieldCheck />} description="The raw page as AI fetchers get it (no JavaScript): the answer first, a visible update date, question headings, sourced figures" flush>
      <div className="px-4 pb-4">
        <DataTable rows={pages} rowKey={(p) => p.url} columns={cols} dense pageSize={8} empty="No key pages checked yet." />
      </div>
    </Panel>
  );
}
