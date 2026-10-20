import { AUTOMATIONS, MODES, type AutomationId, type ModeId } from './constants';
import type { PipelineData, QueueItem } from './data';
import { keywordsOverlap } from './ladders';
import { cycleNorm } from './cycles';

// What a manual run means for the website's automatic pipeline, shown on the tool forms before the run starts: nobody pays twice
// for what the schedule already does, nobody writes a second page that competes with one already written, and everyone sees how
// the pipeline adapts. Every sentence states what n8n really does:
// - The weekly work runs in the website's own 7-day cycle (2026-10-19, SCHEDULING_KEYWORDS_PLAN.md §4): the monthly extras run in its
//   monthly cycle, decided by the Cycle Dispatcher, never moved by a run started by hand.
// - AI visibility (AI_Plan.js): an on-demand check asks every engine; the cycle's run asks Claude, the brand question and the market-wide
//   index in the monthly cycle only.
// - Backlinks (BL_Plan.js): an on-demand check is always the full report with a fresh link gap; the cycle's full report runs in the
//   monthly cycle, the other weeks are light, and the gap is refreshed again after 85 days.
// - Audits (Audit_Sched_Plan.js): every audit is stored; the monthly cycle's audit skips a website audited less than 25 days before.
// - Pages (Cadence_Plan.js + services/runs.ts recordPageInEngine): a page written from the app is logged in seo_content_log, so the
//   Content Cadence skips that keyword for 90 days; a typed ladder keyword is written as that ladder page.
// - Ladders (shared/src/ladders.ts): a new main keyword that is the same search as another ladder's main or page keyword (same
//   words, or 75%+ the same) plans pages that compete with the ones already planned (one search, one page).

export interface PipelineNotice {
  id: string;
  /** 'info': the pipeline does this too, or adapts to it. 'warning': most likely a duplicate; the run starts after a tick. */
  tone: 'info' | 'warning';
  title: string;
  body: string;
  /** a few words for the run summary */
  short: string;
  /** warnings: the checkbox label the person ticks to start anyway */
  confirm?: string;
  link?: { label: string; reportId?: string; runId?: string; page?: 'pipeline'; ladderId?: string };
  /** keyword pages: the pipeline's own plan for this keyword, to apply to the form */
  usePlan?: { label: string; pageType: string; existingPageUrl: string };
}

/** The form values the notices look at. */
export interface NoticeInput {
  keyword?: string;
  existingPageUrl?: string;
  receiveContent?: boolean;
  ladder?: unknown;
}

export interface NoticeFormat {
  /** a date and time, e.g. "Mon 6 Oct, 07:00" */
  when: (iso: string) => string;
  /** a day, e.g. "Mon 6 Oct" */
  day: (iso: string) => string;
  /** relative, e.g. "5 minutes ago" */
  ago: (iso: string) => string;
}

const ISO_FORMAT: NoticeFormat = {
  when: (iso) => iso.slice(0, 16).replace('T', ' '),
  day: (iso) => iso.slice(0, 10),
  ago: (iso) => `at ${iso.slice(0, 16).replace('T', ' ')}`,
};

/** The comparison key of a keyword: the Content Cadence's own rule (cycles.ts cycleNorm), so case, punctuation and spacing do not matter
 *  and a keyword in any script keeps its letters (an Arabic keyword used to become '' and match every other one). */
export const normKeyword = (s: string) => cycleNorm(s);

const urlKey = (u: string) =>
  String(u || '')
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?/, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '');

const shortUrl = (u: string) => String(u || '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '');

/** Modes whose form shows notices (the others never touch the pipeline). */
export const NOTICE_MODES: readonly ModeId[] = ['keyword', 'ladder', 'ai_visibility', 'backlinks', 'audit'];

const AUTOMATION_OF: Partial<Record<ModeId, AutomationId>> = { ai_visibility: 'ai_visibility', backlinks: 'backlinks', audit: 'audit' };


export function pipelineNotices(
  mode: ModeId,
  input: NoticeInput,
  data: PipelineData | null | undefined,
  opts: { now?: Date; fmt?: NoticeFormat; /** credits (app/docs/CREDITS.md): the run's price as the customer reads it, e.g. "12 credits" */ costLabel?: string } = {},
): PipelineNotice[] {
  if (!data || !NOTICE_MODES.includes(mode)) return [];
  const now = opts.now ?? new Date();
  const f = opts.fmt ?? ISO_FORMAT;
  const kw = normKeyword(input.keyword ?? '');
  const keyed = mode === 'keyword' || mode === 'ladder';
  const out: PipelineNotice[] = [];

  // ---- the same run is already going (started in the app, not finished) ----
  const same = !keyed || kw ? data.activeRuns.find((r) => r.mode === mode && (!keyed || normKeyword(r.keyword) === kw)) : undefined;
  if (same)
    out.push({
      id: `active:${same.id}`,
      tone: 'warning',
      title: keyed ? `"${input.keyword?.trim()}" is already being worked on` : `A ${MODES[mode].title.toLowerCase()} for this website is already running`,
      body: `It was started ${f.ago(same.createdAt)} and has not finished yet. Starting it again does the same work twice and is charged twice; its results appear on the run page when it is done.`,
      short: 'Already running',
      confirm: 'Start another one anyway',
      link: { label: 'Open the running one', runId: same.id },
    });

  // ---- monitors the schedule runs anyway ----
  const autoId = AUTOMATION_OF[mode];
  if (autoId) {
    const a = data.automations.find((x) => x.id === autoId);
    const info = AUTOMATIONS.find((x) => x.id === autoId)!;
    const running = data.running.find((r) => r.automation === autoId);
    if (running)
      out.push({
        id: `running:${autoId}`,
        tone: 'warning',
        title: `The automatic ${info.title.toLowerCase()} is running right now`,
        body: `The schedule started it ${f.ago(running.startedAt)} for every website, this one included, and its results appear here when it finishes. Running it yourself now repeats the same work and is charged again.`,
        short: 'Automatic run in progress',
        confirm: 'Run it again anyway',
        link: { label: 'Open the pipeline', page: 'pipeline' },
      });
    else if (a?.state === 'on' && a.nextRunAt) {
      const next = new Date(a.nextRunAt);
      const nextIso = a.nextRunAt;
      const monthlyOnly = info.schedule.kind === 'cycle' ? !!info.schedule.monthlyOnly : info.schedule.kind === 'monthly';
      const when = `${monthlyOnly ? 'every month, in your monthly cycle' : 'every week, in your website\'s cycle'}: next on ${f.when(nextIso)}`;
      const last = a.lastRunAt ? `, last on ${f.day(a.lastRunAt)}${a.lastResult ? ` (${a.lastResult})` : ''}` : '';
      // the website's next monthly cycle (the monthly extras run there, whatever is started by hand)
      const monthly = (data.cycle?.upcoming ?? []).find((c) => c.monthly && Date.parse(c.at) > now.getTime() - 60_000) ?? null;
      const nextIsMonthly = !!monthly && Math.abs(Date.parse(monthly.at) - next.getTime()) < 36e5;
      let effect = '';
      if (autoId === 'ai_visibility')
        effect = `This run asks every engine now (Claude, the brand question, new questions and the market-wide index included). ${
          nextIsMonthly
            ? `The automatic check on ${f.day(nextIso)} is your monthly full run as usual.`
            : monthly
              ? `The automatic checks keep their own rhythm: the next full run is in your monthly cycle on ${f.day(monthly.at)}.`
              : 'The automatic checks keep their own rhythm: the full run is in your monthly cycle.'
        }`;
      else if (autoId === 'backlinks')
        effect = `This run is a full report. The automatic checks keep their own rhythm: the full report runs in your monthly cycle${monthly ? ` (next on ${f.day(monthly.at)})` : ''}, the other weeks only watch for lost and spammy links. It also refreshes the link gap, which the automatic runs then leave for about 3 months.`;
      else if (autoId === 'audit')
        effect =
          next.getTime() - now.getTime() < 25 * 864e5
            ? `The automatic audit on ${f.day(nextIso)} then skips this website (it was audited less than 25 days before); the one after compares with this audit.`
            : `The automatic audit on ${f.day(nextIso)} still runs when your site changed, and compares with this audit.`;
      const cost = opts.costLabel ? ` This run uses about ${opts.costLabel} on top of the automatic ones.` : '';
      out.push({
        id: `auto:${autoId}`,
        tone: 'info',
        title: 'Your pipeline already does this automatically',
        body: `It runs ${when}${last}. Running it now does not move or cancel the schedule. ${effect}${cost}`,
        short: `Also automatic · next ${f.day(nextIso)}`,
        link: a.lastReportId ? { label: 'Last automatic result', reportId: a.lastReportId } : { label: 'Open the pipeline', page: 'pipeline' },
      });
    }
  }

  // ---- a page for a keyword ----
  if (mode === 'keyword' && kw && input.receiveContent !== false && !same) {
    const done = data.written.find((w) => normKeyword(w.keyword) === kw);
    const rewrite = !!(done?.publishedUrl && input.existingPageUrl && urlKey(input.existingPageUrl) === urlKey(done.publishedUrl));
    if (done && !rewrite) {
      const by = done.source === 'cadence' ? ' by your weekly pages' : '';
      out.push({
        id: `written:${kw}`,
        tone: 'warning',
        title: done.status === 'published' ? `You already have a page for "${done.keyword}"` : `A page for "${done.keyword}" was already written`,
        body:
          (done.status === 'published'
            ? `It is live at ${shortUrl(done.publishedUrl) || 'your website'}${done.startedAt ? ` (written ${f.day(done.startedAt)}${by})` : ''}. To improve it, put its address in "Existing page" and the run rewrites it instead.`
            : `It was written ${done.startedAt ? `on ${f.day(done.startedAt)}` : 'earlier'}${by} and is waiting to be published: publish that one rather than writing it again.`) +
          ' A second page for the same search competes with the first in Google (keyword cannibalization), and usually neither ranks well.',
        short: 'Page already written',
        confirm: 'Write a second page anyway',
        link: { label: 'Open the pipeline', page: 'pipeline' },
      });
    } else if (!done) {
      const next = data.queue.next.find((q) => normKeyword(q.keyword) === kw);
      const queued = next ?? data.queue.later.find((q) => normKeyword(q.keyword) === kw);
      const cadence = data.automations.find((a) => a.id === 'content_cadence');
      const planned = queued?.ladder ? null : data.ladders.flatMap((l) => l.planned.map((p) => ({ ...p, head: l.head }))).find((p) => normKeyword(p.keyword) === kw);
      if (queued) {
        const nextWrite = next && cadence?.state === 'on' && cadence.nextRunAt ? cadence.nextRunAt : null;
        const plan = queuePlan(queued);
        out.push({
          id: `queued:${kw}`,
          tone: 'info',
          title: nextWrite ? `Your pipeline writes this on ${f.day(nextWrite)}` : 'This keyword is in your queue',
          body:
            `${nextWrite ? `It is one of the pages the ${f.day(nextWrite)} run writes` : `It waits in the queue${cadence?.state === 'on' ? ' for a coming week' : ' (weekly pages are off)'}`}: ${queued.why}. ` +
            `Writing it now takes it off the queue, so it is not written twice${nextWrite ? ' and that run writes the next topic instead' : ''}.` +
            (queued.ladder
              ? ` It is written as page ${queued.ladder.pageNo} of your keyword ladder "${queued.ladder.head}": linked to the ladder's other pages and tracked every week.`
              : queued.existingPageUrl
                ? ` The pipeline plans it as an update of ${shortUrl(queued.existingPageUrl)}, which already ranks for it.`
                : ''),
          short: nextWrite ? `Planned for ${f.day(nextWrite)}` : 'In the queue',
          usePlan: plan && urlKey(input.existingPageUrl ?? '') !== urlKey(plan.existingPageUrl) ? plan : undefined,
        });
      } else if (planned)
        out.push({
          id: `ladder:${kw}`,
          tone: 'info',
          title: `This is a page of your keyword ladder "${planned.head}"`,
          body: `It is written as that ladder page (page ${planned.pageNo}): linked to the ladder's other pages, tracked every week, and taken off the pipeline's queue so it is not written twice.`,
          short: 'Ladder page',
        });
    }
  }

  // ---- a keyword ladder ----
  if (mode === 'ladder' && kw && !same) {
    const l = data.ladders.find((x) => normKeyword(x.head) === kw);
    const hits = l ? [] : overlapping(data, input.keyword ?? '');
    if (l)
      out.push({
        id: `ladder-exists:${kw}`,
        tone: 'warning',
        title: `You already have a ladder for "${l.head}"`,
        body: `It has ${l.pages} pages: ${l.published} published${l.planned.length ? `, ${l.planned.length} still to write` : ''}. A second ladder plans and writes the same pages again. That means double cost, and pages that compete with each other in Google. To write its next page now, use "Write now" on the Pipeline page.`,
        short: 'Ladder already exists',
        confirm: 'Plan a second ladder anyway',
        link: { label: 'Open the pipeline', page: 'pipeline' },
      });
    else if (hits.length) {
      const near = hits.find((h) => h.head);
      const pages = hits
        .filter((h) => h.keywords.length)
        .map((h) => `${h.keywords.slice(0, 3).map((k) => `"${k}"`).join(', ')} in "${h.ladder.head}"`)
        .join('; ');
      out.push({
        id: `ladder-overlap:${kw}`,
        tone: 'warning',
        title: `"${input.keyword?.trim()}" overlaps your ladder "${(near ?? hits[0]).ladder.head}"`,
        body:
          (near ? `It is almost the same search as the main keyword of your ladder "${near.ladder.head}". ` : `It is almost the same search as pages your ladders already plan: ${pages}. `) +
          'A new ladder would write pages that compete with those in Google, and usually neither ranks well. Choose a different main keyword, or let the existing ladder cover it.',
        short: 'Overlaps a ladder',
        confirm: 'Plan this ladder anyway',
        link: { label: 'Open the ladder', page: 'pipeline', ladderId: (near ?? hits[0]).ladder.id },
      });
    } else
      out.push({
        id: 'ladder-next',
        tone: 'info',
        title: 'Your pipeline takes it from there',
        body:
          'The rank tracker checks every page of the ladder each week. ' +
          (data.queue.pagesPerWeek > 0
            ? `After the pages written now, your weekly pages continue with the ladder's next pages (${data.queue.pagesPerWeek} a week, ladder pages first).`
            : 'Weekly pages are off, so its other pages wait on the Pipeline page until you click "Write now" or set pages a week.'),
        short: 'Joins the pipeline',
      });
  }

  // ---- R42 (2026-10-16, re-rating 2026-10-15): the pile-up limit, before a page is written on request ----
  // The weekly posts stop while `maxWaiting` pages wait to be published (the pile-up guard, Cadence_Plan.js). A run started here is the
  // person's explicit request, so it is never blocked, but it is told: the live "ai consulting" ladder wrote a 4th waiting page at a
  // limit of 3 and said nothing. A page counts once it is written and not live (a draft that failed its quality check included).
  const writesPage = (mode === 'ladder' && !!kw) || (mode === 'keyword' && !!kw && input.receiveContent !== false);
  const waiting = data.queue.waiting ?? [];
  const maxWaiting = Math.max(1, Number(data.automation?.maxWaiting) || 3);
  if (writesPage && !same && waiting.length >= maxWaiting) {
    const names = waiting.slice(0, 4).map((w) => `"${w.keyword}"`).join(', ') + (waiting.length > 4 ? ` and ${waiting.length - 4} more` : '');
    out.push({
      id: `pileup:${kw}`,
      tone: 'warning',
      title: `${waiting.length} page${waiting.length === 1 ? ' is' : 's are'} already waiting to be published`,
      body:
        `${names} ${waiting.length === 1 ? 'is' : 'are'} written and not live yet, and your limit is ${maxWaiting}: the weekly pages are paused until fewer pages wait. ` +
        `This run writes ${mode === 'ladder' ? "the ladder's first page" : 'one more page'} on top of them (page ${waiting.length + 1} waiting). Publish the waiting pages first, or start it anyway.`,
      short: `${waiting.length} pages already waiting`,
      confirm: 'Write it anyway',
      link: { label: 'Open the pipeline', page: 'pipeline' },
    });
  }

  return out.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === 'warning' ? -1 : 1));
}

/** Ladders that already cover a search like this one: its main keyword (head) or page keywords that overlap. */
function overlapping(data: PipelineData, keyword: string): { ladder: PipelineData['ladders'][number]; head: boolean; keywords: string[] }[] {
  if (!normKeyword(keyword)) return [];
  return data.ladders
    .map((l) => {
      const pages = l.keywords ?? l.planned.map((p) => p.keyword);
      return { ladder: l, head: keywordsOverlap(keyword, l.head), keywords: [...new Set(pages.filter((k) => normKeyword(k) !== normKeyword(l.head) && keywordsOverlap(keyword, k)))] };
    })
    .filter((x) => x.head || x.keywords.length);
}

function queuePlan(q: QueueItem): PipelineNotice['usePlan'] | null {
  if (!q.existingPageUrl || q.ladder) return null;
  return { label: `Improve ${shortUrl(q.existingPageUrl)} instead`, pageType: q.pageType, existingPageUrl: q.existingPageUrl };
}
