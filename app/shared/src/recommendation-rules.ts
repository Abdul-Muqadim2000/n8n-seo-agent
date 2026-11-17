// Recommendations you can finish (CR17-H, client report 2026-11-17 Q4). The client's words: "the recommendations are not understandable,
// cannot be answered, are High but never confirmed resolved". Each item was recomputed on every read, carried its source's own badge, had no
// state, and one page Google had not indexed was asked about four times in four wordings. This file is the one rule for all of it:
//
// - REC_RULES: a rule per family (matched on the id prefix, longest first): why it matters in plain words, how to do it (the guide), and
//   how we check it is done (which of our existing checks, and when). A family nothing checks can be dismissed but never "resolved".
// - issueKeyOf / foldByIssue: one card per issue (a page, an AI question, a link, a search); the other sources become "Also reported by".
// - nextRecState: the state machine (open, in progress, waiting for Google, resolved, failed, dismissed, expired), the same shape as Search
//   Console's own "Validate fix" (Not started / Started / Passed / Failed): an item is resolved only when a check of ours confirms it, with
//   the date and the evidence; an item its source stops reporting that no check confirms is "expired", never "resolved".
// - RecVerifier: the adapter each source plugs in (server/src/services/recommendationStates.ts holds today's verifiers; packages that own a
//   source replace theirs with `registerRecVerifier`).
// Pure: no I/O, no clock unless passed.
import type { GuideId } from './guides';
import type { Priority, Recommendation, RecommendationRuleView } from './data';
import { priorityFromScore } from './queue';

export type RecommendationState = 'open' | 'in_progress' | 'waiting_for_google' | 'resolved' | 'failed' | 'dismissed' | 'expired';
export const RECOMMENDATION_STATES: readonly RecommendationState[] = ['open', 'in_progress', 'waiting_for_google', 'resolved', 'failed', 'dismissed', 'expired'];
/** the states shown in To do (failed: a check says it is still there; in progress: you or a run of ours started it) */
export const TODO_STATES: ReadonlySet<RecommendationState> = new Set(['open', 'in_progress', 'failed']);

/** Which existing check confirms a family is done. Each maps onto machinery the app already runs for free. */
export type RecCheckKind =
  /** the daily index check (Google's own inspection of the page, read by the engine every day) */
  | 'index'
  /** the step's own check on your website (daily, and "I've done it, check now") */
  | 'site_task'
  /** the audit finding re-checked on the live pages, else the next audit */
  | 'finding'
  /** the AI question's page: written, live, won (the AI target) */
  | 'ai_target'
  /** our own link check (two reads of the linking page) */
  | 'link'
  /** the connection or setting exists (Search Console, GA4, a mailbox, the profile, tracking) */
  | 'connection'
  /** the content log: the page published, the draft finished */
  | 'content'
  /** the keyword ladder: the rung written, a keyword chosen */
  | 'ladder'
  /** the next Search Console reading of the search */
  | 'search'
  /** the weekly rank check */
  | 'rank'
  /** the pitches and replies on the Link building / AI pages (sent, answered) */
  | 'pitches'
  /** the first scheduled result arrived */
  | 'schedule';

export interface RecRule {
  /** the id prefix this rule covers (`tech:` covers `tech:<finding key>`; the longest matching prefix wins) */
  prefix: string;
  /** why it matters, in plain words (the card's "Why" when the item's own detail is about the instance) */
  why: string;
  /** how to do it: one line, and the guide when the work happens outside the app */
  how: { text: string; guide?: GuideId };
  /** how we check it is done, and when; null: nothing checks it (at most Low, never resolved) */
  check: { kind: RecCheckKind; text: string; when: string; now?: true } | null;
  /** when the item is no longer produced, its condition is gone for sure (it is computed from the current state, not a weekly report):
   *  then its absence is the evidence (`doneText`); otherwise a verifier must confirm it or it expires */
  absentMeansDone?: string;
  /** a measure, not a task: shown as the page's KPI, never in the to-do list */
  kpi?: true;
  /** a fact makes it urgent (someone waits for an answer, a written page is not live): it may stay High on a rule-only score */
  urgent?: true;
  /** what one card is about: a page (`page:`), an AI question (`aiq:`), a linking site (`link:`), a search (`kw:`), or the item itself */
  issue: 'page' | 'question' | 'link' | 'search' | 'self';
  /** the source's name for "Also reported by" */
  source: string;
}

const C = {
  index: { kind: 'index' as const, text: 'The daily index check reads Google\'s own view of each page and ticks it off when Google has it in search.', when: 'every day' },
  siteTask: { kind: 'site_task' as const, text: 'We open your website and look for the change ourselves.', when: 'every day, and at once when you press Check now', now: true as const },
  finding: { kind: 'finding' as const, text: 'We read the affected pages again on your live website; the next audit confirms it too.', when: 'every day for the pages we read, monthly for the audit', now: true as const },
  aiTarget: { kind: 'ai_target' as const, text: 'We follow the page for this question: written, published and read by the AI assistants.', when: 'every week' },
  link: { kind: 'link' as const, text: 'Our own link check opens the linking page and looks for your link.', when: 'every week' },
  pitches: { kind: 'pitches' as const, text: 'We see each pitch and reply on the page as you send or answer it.', when: 'as soon as you act' },
  search: { kind: 'search' as const, text: 'The next Search Console reading shows whether the search moved.', when: 'every week' },
  rank: { kind: 'rank' as const, text: 'The weekly rank check reads the position on Google again.', when: 'every week' },
  content: { kind: 'content' as const, text: 'We see the page in your content list as you publish it or finish it, and our publish check opens the live page.', when: 'as soon as you report it, and weekly' },
  ladder: { kind: 'ladder' as const, text: 'The keyword ladder records the page once it is written.', when: 'as soon as it is written' },
  schedule: { kind: 'schedule' as const, text: 'It is done when the first result arrives.', when: 'on its scheduled day' },
  connection: (what: string) => ({ kind: 'connection' as const, text: `We check ${what} each time this page loads.`, when: 'each time you open it', now: true as const }),
};

/**
 * The registry. Every id `recommend()` builds matches one prefix here (the completeness test builds every family and asserts it). Order
 * does not matter: `recRuleFor` takes the longest matching prefix.
 */
export const REC_RULES: readonly RecRule[] = [
  // ---- setup ----
  { prefix: 'setup:tracking', why: 'Nothing on this dashboard can be measured until weekly tracking runs.', how: { text: 'Save the tracking settings once.', guide: 'keywords-to-track' }, check: C.connection('that tracking runs'), absentMeansDone: 'Weekly tracking is running.', issue: 'self', source: 'setup' },
  { prefix: 'setup:delivery', why: 'Your weekly reports go to an address this app cannot read.', how: { text: 'Save the tracking settings once.', guide: 'keywords-to-track' }, check: C.connection('where the weekly reports go'), absentMeansDone: 'The weekly reports arrive here.', issue: 'self', source: 'setup' },
  { prefix: 'setup:gsc', why: 'Without Search Console there are no clicks, searches or index status to work from.', how: { text: 'Give our reading account access to your Search Console property.', guide: 'search-console-access' }, check: C.connection('Search Console access'), absentMeansDone: 'Search Console is connected.', issue: 'self', source: 'setup' },
  { prefix: 'setup:ga4', why: 'Without Google Analytics there are no visits or leads to weigh anything against.', how: { text: 'Give our reading account access to your GA4 property.', guide: 'ga4-access' }, check: C.connection('Google Analytics access'), absentMeansDone: 'Google Analytics is connected.', issue: 'self', source: 'setup' },
  { prefix: 'setup:profile', why: 'No page is written before the author profile is on file, and every page and outreach draft uses it.', how: { text: 'Fill in the business profile.', guide: 'business-profile' }, check: C.connection('the business profile'), absentMeansDone: 'The business profile is complete.', urgent: true, issue: 'self', source: 'setup' },
  { prefix: 'setup:audit', why: 'No technical audit has run for this website yet.', how: { text: 'Run the audit from the button.', guide: 'your-weekly-cycle' }, check: C.schedule, absentMeansDone: 'The first technical audit ran.', issue: 'self', source: 'setup' },
  { prefix: 'setup:ai', why: 'No AI visibility baseline has been taken yet.', how: { text: 'Run the AI visibility check from the button.', guide: 'your-weekly-cycle' }, check: C.schedule, absentMeansDone: 'The first AI visibility check ran.', issue: 'self', source: 'setup' },
  { prefix: 'setup:backlinks', why: 'No backlink check has run for this website yet.', how: { text: 'Run the backlink check from the button.', guide: 'your-weekly-cycle' }, check: C.schedule, absentMeansDone: 'The first backlink check ran.', issue: 'self', source: 'setup' },
  { prefix: 'setup:checkin', why: 'Search Console has parts no API can read: manual actions, security issues and the whole Pages report.', how: { text: 'Answer two questions and upload the Pages report.', guide: 'search-console-checkin' }, check: C.connection('whether this month\'s check-in is in'), absentMeansDone: 'This month\'s check-in is in.', issue: 'self', source: 'setup' },
  { prefix: 'auto:', why: 'Your autopilot runs this on its own in your weekly cycle.', how: { text: 'Nothing to do: see when it runs, or run it now if you need it sooner.', guide: 'your-weekly-cycle' }, check: C.schedule, absentMeansDone: 'The first result arrived.', issue: 'self', source: 'your autopilot' },
  // ---- AI ----
  { prefix: 'ai:indexnow', why: 'One small file lets every new page reach Bing and Copilot in the same week.', how: { text: 'Put the key file at the root of your website.', guide: 'indexnow-key-file' }, check: C.siteTask, issue: 'self', source: 'the AI growth run' },
  { prefix: 'ai:crawlers', why: 'An AI assistant cannot name or cite a page its crawler may not read.', how: { text: 'Remove the rule that blocks it from robots.txt.', guide: 'ai-crawler-access' }, check: C.siteTask, urgent: true, issue: 'self', source: 'the AI visibility check' },
  { prefix: 'ai:outreach', why: 'AI answers rely on these pages, and they do not name you yet.', how: { text: 'Send each draft from your own mailbox, then mark it as sent.', guide: 'link-pitches' }, check: C.pitches, absentMeansDone: 'No outreach draft is left waiting.', issue: 'self', source: 'the AI growth run' },
  { prefix: 'ai:low', why: 'How often AI assistants name you is a measure of the work, not a step on its own.', how: { text: 'See the questions on the AI visibility page.' }, check: null, kpi: true, issue: 'self', source: 'the AI visibility check' },
  { prefix: 'ai:gap', why: 'AI answers this buyer question without naming you.', how: { text: 'Write or improve the page that answers it.', guide: 'ai-answer-page' }, check: C.aiTarget, issue: 'question', source: 'the AI visibility check' },
  // ---- link building ----
  { prefix: 'links:replies', why: 'Someone answered your pitch; a same-day answer is what turns a reply into a link.', how: { text: 'Edit the suggested answer and send it in the same thread.', guide: 'link-pitches' }, check: C.pitches, absentMeansDone: 'Every reply is answered.', urgent: true, issue: 'self', source: 'link building' },
  { prefix: 'links:mailbox', why: 'The pitches can only go out from a mailbox of your own.', how: { text: 'Connect a mailbox in company settings.', guide: 'mailbox-connect' }, check: C.connection('that a mailbox is connected'), absentMeansDone: 'A mailbox is connected.', issue: 'self', source: 'link building' },
  { prefix: 'links:approve', why: 'Pitches are written and waiting; nothing is sent until you approve them.', how: { text: 'Read, edit and approve them on the Link building page.', guide: 'link-pitches' }, check: C.pitches, absentMeansDone: 'No pitch is left waiting for your approval.', issue: 'self', source: 'link building' },
  { prefix: 'links:listing', why: 'A competitor holds this listing and you do not.', how: { text: 'Submit your listing with the ready description.', guide: 'ai-rank-directory-profile' }, check: C.link, issue: 'self', source: 'link building' },
  // ---- search (Search Console) ----
  { prefix: 'search:striking', why: 'The search already shows your website; a better page moves it up faster than a new one would.', how: { text: 'Improve the page for this search and publish it at the same address.', guide: 'improve-ranking-page' }, check: C.search, issue: 'search', source: 'Search Console' },
  { prefix: 'search:ctr', why: 'The page shows near the top but few people click it.', how: { text: 'Rewrite its title and description.', guide: 'rewrite-title-description' }, check: C.search, issue: 'self', source: 'Search Console' },
  { prefix: 'search:drop', why: 'This search brought clicks and now brings half or fewer.', how: { text: 'Check the page and what moved above it, then refresh it.', guide: 'improve-ranking-page' }, check: C.search, issue: 'search', source: 'Search Console' },
  // ---- the engine's weekly actions ----
  { prefix: 'engine:site_tracker:index', why: 'Google has not put this page in search yet.', how: { text: 'Link to it from a page that is in Google; ask Google to read it only after a real change.', guide: 'index-coverage' }, check: C.index, issue: 'page', source: 'the weekly site report' },
  { prefix: 'engine:site_tracker', why: 'The weekly site report found this in your Search Console and rank data.', how: { text: 'Use the button on the card.', guide: 'improve-ranking-page' }, check: C.search, issue: 'search', source: 'the weekly site report' },
  { prefix: 'engine:rank_tracker', why: 'The rank check found the next step for this keyword ladder.', how: { text: 'Use the button on the card.', guide: 'your-weekly-cycle' }, check: C.rank, issue: 'search', source: 'the weekly rank check' },
  { prefix: 'engine:ai_visibility', why: 'AI answers this buyer question without naming you.', how: { text: 'Write or improve the page that answers it.', guide: 'ai-answer-page' }, check: C.aiTarget, issue: 'question', source: 'the AI visibility check' },
  { prefix: 'engine:', why: 'A weekly report recommended it.', how: { text: 'Use the button on the card.', guide: 'improve-ranking-page' }, check: C.search, issue: 'search', source: 'a weekly report' },
  // ---- technical ----
  { prefix: 'tech:score-drop', why: 'New issues appeared since the previous audit of the same kind.', how: { text: 'Start with the new critical and high findings.', guide: 'fix-pack' }, check: C.finding, issue: 'self', source: 'the technical audit' },
  { prefix: 'tech:stale', why: 'The last audit is old, so what it found may have changed.', how: { text: 'Run a new audit.', guide: 'your-weekly-cycle' }, check: C.schedule, absentMeansDone: 'A new audit ran.', issue: 'self', source: 'the technical audit' },
  { prefix: 'tech:', why: 'The audit found this on your live website.', how: { text: 'The audit report explains the fix; the fix pack has ready files where one applies.', guide: 'fix-pack' }, check: C.finding, issue: 'self', source: 'the technical audit' },
  // ---- index coverage ----
  { prefix: 'ix:not_indexed', why: 'Pages that are not in Google cannot be found in search or used by the AI assistants that search Google.', how: { text: 'The Indexing page says, page by page, what Google saw and the one next step: a link from a page in Google, a fix, or waiting for Google.', guide: 'index-coverage' }, check: C.index, issue: 'self', source: 'Index coverage' },
  { prefix: 'ix:site_fix', why: 'Something on your website keeps Google from reading or keeping these pages.', how: { text: 'Make the change on your website.', guide: 'index-coverage' }, check: C.siteTask, issue: 'self', source: 'Index coverage' },
  { prefix: 'ix:links', why: 'Google has not found these pages; a link from a page already in Google is how it finds them.', how: { text: 'Add a link to each page from a page in Google.', guide: 'index-add-internal-links' }, check: C.siteTask, issue: 'self', source: 'Index coverage' },
  { prefix: 'ix:merge', why: 'An old page and its improved version both open, so they compete for the same search.', how: { text: 'Redirect each old address to its improved version.', guide: 'index-merge-improved' }, check: C.siteTask, urgent: true, issue: 'self', source: 'Index coverage' },
  { prefix: 'ix:ask_google', why: 'For these pages, asking Google to read them again is the right next step.', how: { text: 'Ask Google in Search Console, then press "I asked Google" on the Indexing page.', guide: 'index-request-indexing' }, check: C.index, issue: 'self', source: 'Index coverage' },
  { prefix: 'ix:quality', why: 'Google read these pages and left them out of search.', how: { text: 'Improve one page at a time, at its own address.', guide: 'index-coverage' }, check: C.index, issue: 'self', source: 'Index coverage' },
  { prefix: 'ix:', why: 'The daily index check found pages Google treats this way.', how: { text: 'The Indexing page says what to do for each page.', guide: 'index-coverage' }, check: C.index, issue: 'self', source: 'Index coverage' },
  // ---- backlinks ----
  { prefix: 'bl:lost', why: 'A link from a trusted website is gone, checked twice on the page.', how: { text: 'Send the drafted note asking to restore it.', guide: 'win-back-link' }, check: C.link, issue: 'link', source: 'the backlink check' },
  { prefix: 'bl:reclaim', why: 'Other websites link to an address of yours that no longer opens.', how: { text: 'Redirect it to the page that replaced it.', guide: 'redirect-broken-page' }, check: C.siteTask, issue: 'self', source: 'the backlink check' },
  { prefix: 'bl:spam', why: 'Google ignores most link spam on its own: a measure to watch, not a step.', how: { text: 'See the links on the Backlinks page.' }, check: null, kpi: true, issue: 'self', source: 'the backlink check' },
  { prefix: 'bl:lists', why: 'These lists name your competitors and not you; AI answers and searchers read them first.', how: { text: 'Send the drafted pitch to each list.', guide: 'link-pitches' }, check: C.pitches, absentMeansDone: 'Every list has been pitched or named you.', issue: 'self', source: 'the backlink check' },
  { prefix: 'bl:outreach', why: 'These websites could link to you, and a message is ready for each.', how: { text: 'Send the messages, highest score first.', guide: 'link-pitches' }, check: C.pitches, absentMeansDone: 'No ready message is left unsent.', issue: 'self', source: 'the backlink check' },
  { prefix: 'bl:followup', why: 'One short follow-up roughly doubles the replies.', how: { text: 'Send the drafted follow-up.', guide: 'link-pitches' }, check: C.pitches, absentMeansDone: 'No follow-up is left due.', issue: 'self', source: 'the backlink check' },
  { prefix: 'bl:gsc-import', why: 'Google shows a sample of your links that its API will not hand over.', how: { text: 'Export Latest links from Search Console and upload the file.', guide: 'search-console-links-export' }, check: C.connection('whether Google\'s link sample is uploaded'), absentMeansDone: 'Google\'s link sample is uploaded.', issue: 'self', source: 'the backlink check' },
  // ---- content ----
  { prefix: 'content:fix', why: 'The draft did not pass the quality check, so it is not ready to publish.', how: { text: 'Finish it by hand from its report: each item to edit is listed.', guide: 'page-not-ready' }, check: C.content, absentMeansDone: 'The draft is finished.', urgent: true, issue: 'self', source: 'your pages' },
  { prefix: 'content:publish', why: 'The page is written but not live; nothing can rank before it is published.', how: { text: 'Publish it, then press I published it.', guide: 'publish-page' }, check: C.content, absentMeansDone: 'The page is published.', urgent: true, issue: 'self', source: 'your pages' },
  { prefix: 'content:cadence', why: 'Your keyword ladders have pages to write, but pages a week is 0.', how: { text: 'Set how many pages a week we write.', guide: 'your-weekly-cycle' }, check: C.connection('your pages a week'), absentMeansDone: 'Pages a week is set.', issue: 'self', source: 'your settings' },
  { prefix: 'content:trend', why: 'Demand for this search is rising.', how: { text: 'Write the page, or improve yours if you have one.', guide: 'improve-ranking-page' }, check: C.search, issue: 'search', source: 'Google Trends' },
  { prefix: 'keyword:', why: 'Nothing is written before you choose a keyword to be found for.', how: { text: 'Choose a keyword, or run keyword research first.', guide: 'choose-first-keyword' }, check: C.ladder, absentMeansDone: 'A keyword is chosen.', urgent: true, issue: 'self', source: 'your autopilot' },
  // ---- rankings ----
  { prefix: 'rank:next', why: 'Each written rung adds links and authority for the head keyword.', how: { text: 'The pipeline writes it with the ladder\'s links.', guide: 'your-weekly-cycle' }, check: C.ladder, issue: 'self', source: 'the keyword ladder' },
  { prefix: 'rank:drop', why: 'A keyword that was ranking dropped.', how: { text: 'Check the ranking page and what moved above it, then refresh it.', guide: 'improve-ranking-page' }, check: C.rank, issue: 'search', source: 'the weekly rank check' },
  // ---- keyword intelligence ----
  { prefix: 'ki:competitors', why: 'The keyword research compares you with the competitors you choose.', how: { text: 'Choose your competitors.', guide: 'ki-choose-competitors' }, check: C.connection('your chosen competitors'), absentMeansDone: 'Your competitors are chosen.', issue: 'self', source: 'keyword research' },
  { prefix: 'ki:quick-wins', why: 'You already show near the top of Google for these searches.', how: { text: 'Read the quick wins in your keyword research.', guide: 'ki-read-keyword-research' }, check: C.search, issue: 'self', source: 'keyword research' },
  { prefix: 'ki:', why: 'Your keyword research found this.', how: { text: 'Use the button on the card.', guide: 'ki-read-keyword-research' }, check: C.search, issue: 'self', source: 'keyword research' },
];

/** The rule for an id: the longest matching prefix (undefined: no family, which the completeness test forbids). */
export function recRuleFor(id: string): RecRule | undefined {
  let best: RecRule | undefined;
  for (const r of REC_RULES) if (id.startsWith(r.prefix) && (!best || r.prefix.length > best.prefix.length)) best = r;
  return best;
}

/** What a card shows of its rule. */
export function recRuleView(id: string): RecommendationRuleView | undefined {
  const r = recRuleFor(id);
  if (!r) return undefined;
  return { why: r.why, how: r.how.text, guide: r.how.guide ?? '', check: r.check?.text ?? '', checkWhen: r.check?.when ?? '', canCheckNow: !!r.check?.now };
}

/** A page address as one key (host without www, path without a trailing slash, no query): the same page from two sources is one issue. */
export function pageKey(url: string): string {
  const m = String(url ?? '').trim().toLowerCase().match(/^(?:https?:\/\/)?(?:www\.)?([^/?#\s]+)([^?#\s]*)/);
  if (!m) return '';
  return `${m[1]}${m[2].replace(/\/+$/, '')}`;
}
const normSearch = (s: string) => String(s ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/**
 * What one card is about. Two items with the same key are one card: e.g. the weekly report's "Request indexing for /x" and the audit's
 * page-level ask are both `page:devaicon.com/x`; "Move 'erp dubai' into the top 3" and the rank tracker's step for the same search are
 * `kw:erp dubai`. Items about different things never share a key.
 */
export function issueKeyOf(rec: Pick<Recommendation, 'id' | 'action' | 'evidence'>): string {
  const rule = recRuleFor(rec.id);
  const tail = (prefixParts: number) => rec.id.split(':').slice(prefixParts).join(':');
  switch (rule?.issue) {
    case 'page': {
      const url = rec.action?.href ?? (String(rec.evidence ?? '').match(/https?:\/\/\S+/) ?? [''])[0];
      const k = pageKey(url);
      return k ? `page:${k}` : rec.id;
    }
    case 'question': {
      // engine:ai_visibility:<type>:<keyword> and ai:gap:<question>
      const q = rec.id.startsWith('engine:') ? tail(3) : tail(2);
      return q ? `aiq:${normSearch(q)}` : rec.id;
    }
    case 'link':
      return `link:${tail(2).toLowerCase().replace(/^www\./, '')}`;
    case 'search': {
      const q = rec.id.startsWith('engine:') ? tail(3) : tail(2);
      return q ? `kw:${normSearch(q)}` : rec.id;
    }
    default:
      return rec.id;
  }
}

/** The family's source name, for "Also reported by". */
export const recSourceOf = (id: string): string => recRuleFor(id)?.source ?? 'another check';

/**
 * One card per issue. Items are taken in queue order (the caller's order): the first of each issue stays, with the others' sources in
 * `alsoFrom` and their evidence appended when it adds something. Items whose issue is themselves pass through untouched.
 */
export function foldByIssue(recs: readonly Recommendation[]): Recommendation[] {
  const out: Recommendation[] = [];
  const at = new Map<string, number>();
  for (const r0 of recs) {
    const key = r0.issueKey ?? issueKeyOf(r0);
    const r = { ...r0, issueKey: key };
    const i = at.get(key);
    if (i == null) {
      at.set(key, out.length);
      out.push(r);
      continue;
    }
    const keep = out[i];
    const from = recSourceOf(r.id);
    const also = [...new Set([...(keep.alsoFrom ?? []), from])].filter((s) => s !== recSourceOf(keep.id));
    out[i] = { ...keep, alsoFrom: also };
  }
  return out;
}

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
/**
 * A recommendation with its rule, its issue and its badge (KPI families return null). The badge is the queue score's (`priorityFromScore`),
 * and the source's own priority can only lower it, never raise it: no source makes an item High on its own number any more, and an item
 * its source calls Low (a run the autopilot already has scheduled) stays Low.
 */
export function withRule(rec: Recommendation): Recommendation | null {
  const rule = recRuleFor(rec.id);
  if (rule?.kpi) return null;
  const fromScore = priorityFromScore(rec.score, { checked: !!rule?.check, urgent: !!rule?.urgent && rec.priority === 'high' });
  const priority: Priority = PRIORITY_RANK[fromScore] >= PRIORITY_RANK[rec.priority] ? fromScore : rec.priority;
  return { ...rec, priority, issueKey: rec.issueKey ?? issueKeyOf(rec), ...(rule ? { rule: recRuleView(rec.id) } : {}) };
}

// ------------------------------------------------------------------------------------------------------------------- the state machine

/** What a check found about one item. `unknown`: no check could tell (then an item gone from its source expires, never resolves). */
export interface RecVerdict {
  outcome: 'open' | 'in_progress' | 'waiting' | 'failed' | 'resolved' | 'dismissed' | 'unknown';
  /** one plain line: what we saw ("Google indexed /about on 20 Nov", "The file was found.") */
  evidence?: string;
  /** when the thing happened (Google's date, our check's time); absent: now */
  at?: string;
}

/** The stored state of one item (table recommendation_states). */
export interface RecStateRow {
  recKey: string;
  issueKey: string;
  state: RecommendationState;
  firstSeenAt: string;
  lastSeenAt: string;
  stateAt: string;
  evidence: string;
  dismissedReason: string;
}

/** A dismissed item that is still reported comes back after this long (the client may have dismissed a problem that is still there). */
export const DISMISS_DAYS = 90;
/** Resolved and expired items stay on their tab this long. */
export const RESOLVED_SHOWN_DAYS = 90;

/**
 * The next state of one item. `present`: the source still reports it this time. `verdict`: what its check says (see `RecVerdict`).
 * - Present: open, or in progress / waiting for Google / failed when the check says so. A resolved item reported again is open again
 *   ("it came back"); a dismissed one stays dismissed for DISMISS_DAYS.
 * - Gone from its source: resolved only on a check's word (or for a family whose absence is itself the evidence); waiting for Google
 *   when the fix is seen and Google has not read it again; otherwise expired. A dismissed item stays dismissed.
 */
export function nextRecState(prev: Pick<RecStateRow, 'state' | 'stateAt' | 'evidence'> | null, obs: { present: boolean; verdict: RecVerdict; now: string }): { state: RecommendationState; stateAt: string; evidence: string } {
  const at = obs.verdict.at || obs.now;
  const keep = prev ? { state: prev.state, stateAt: prev.stateAt, evidence: prev.evidence } : null;
  const to = (state: RecommendationState, evidence = obs.verdict.evidence ?? '', when = at) =>
    keep && keep.state === state && keep.evidence === evidence ? keep : { state, stateAt: when, evidence };
  if (prev?.state === 'dismissed') {
    const old = Date.parse(obs.now) - Date.parse(prev.stateAt) > DISMISS_DAYS * 864e5;
    if (obs.present && old) return to('open', 'Reported again after you dismissed it more than 90 days ago.', obs.now);
    return keep!;
  }
  if (obs.verdict.outcome === 'dismissed') return to('dismissed', obs.verdict.evidence ?? 'Skipped on your website steps.');
  if (obs.present) {
    switch (obs.verdict.outcome) {
      case 'in_progress':
        return to('in_progress');
      case 'waiting':
        return to('waiting_for_google');
      case 'failed':
        return to('failed');
      case 'resolved':
        // the check says done while the source still lists it (a weekly report older than the fix): the check is newer, trust it
        return to('resolved');
      default:
        if (prev && (prev.state === 'resolved' || prev.state === 'expired')) return to('open', `It came back on ${obs.now.slice(0, 10)}.`, obs.now);
        // a reopened item keeps its "came back" line until something new happens to it
        if (keep && keep.state === 'open') return keep;
        return { state: 'open', stateAt: obs.now, evidence: '' };
    }
  }
  switch (obs.verdict.outcome) {
    case 'resolved':
      return to('resolved');
    case 'waiting':
      return to('waiting_for_google');
    default:
      if (prev && (prev.state === 'resolved' || prev.state === 'expired' || prev.state === 'waiting_for_google')) return keep!;
      return to('expired', obs.verdict.evidence || 'No longer reported by its source, and no check of ours confirmed it fixed.', obs.now);
  }
}

/** The dismiss reasons (the client picks one; "other" asks for a line). */
export const DISMISS_REASONS: readonly { id: string; label: string }[] = [
  { id: 'not_relevant', label: 'Not relevant to my business' },
  { id: 'done_elsewhere', label: 'Already done another way' },
  { id: 'not_possible', label: 'Not possible on my website' },
  { id: 'disagree', label: 'I disagree with this advice' },
  { id: 'other', label: 'Another reason' },
];
export const dismissReasonLabel = (id: string): string => DISMISS_REASONS.find((r) => r.id === id)?.label ?? 'Dismissed';
