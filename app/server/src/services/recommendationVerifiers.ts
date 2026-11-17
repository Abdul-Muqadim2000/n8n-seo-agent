// The package checks behind the recommendation states (CR17 integration, client report 2026-11-17 Q4). recommendationStates.ts owns the
// state machine and the storage; each check kind whose source belongs to another package reads that package's own shared rule here, so a
// card is resolved by exactly what its page says:
// - index (package C, Index coverage): a page is done when Google has it, when its address now redirects (moved) or when it is left out on
//   purpose; it is waiting while Search Console's "Validate fix" would say waiting (we saw the fix, you improved it, you asked Google);
//   failed when Google read it after that and still left it out (indexing.ts indexValidationOf / indexReasonOf).
// - link (package E): a lost link is won back only when OUR check finds it on their page again (ledger row live + found), never on an
//   index's word.
// - pitches (package E): the pitch numbers of the one link status model (link-status.ts), as evidence while the card stands.
// - ai_target (package G): the AI question's stored target, overtaken by a live page that answers it (aiAnsweredView); a question with no
//   target goes through the shared resolver (aiQuestionAction), the same decision the AI visibility page and the write form make.
// Only type imports from recommendationStates.ts (it imports these functions: no import cycle at run time).
import {
  aiAnsweredView,
  aiQuestionAction,
  aiQuestionInputsOf,
  indexDayText,
  indexMovedAway,
  indexPageOf,
  indexPath,
  indexReasonOf,
  indexValidationOf,
  normKeyword,
  pageKey,
  type AiQuestionInputs,
  type IndexPage,
  type RecVerdict,
} from '@seo/shared';
import type { RecItem, RecVerifier, RecVerifyContext } from './recommendationStates';

const UNKNOWN: RecVerdict = { outcome: 'unknown' };
const day = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : '';
};

// ------------------------------------------------------------------------------------------------ index (package C)

/** done for this card: in Google, moved to another address of the site, or left out on purpose (nothing to do) */
const indexDone = (p: IndexPage): 'indexed' | 'moved' | 'left_out' | '' => {
  if (p.state === 'indexed') return 'indexed';
  const r = indexReasonOf(p);
  if (r === 'moved' || (indexMovedAway(p) && p.finalUrl)) return 'moved';
  if (r === 'left_out') return 'left_out';
  return '';
};
const doneLine = (p: IndexPage): string => {
  const d = indexDone(p);
  if (d === 'moved') return `${indexPath(p.url)} now redirects to ${indexPath(p.finalUrl)}`;
  if (d === 'left_out') return `${indexPath(p.url)} is left out on purpose`;
  return `${indexPath(p.url)} is in Google${p.indexedSince ? ` since ${indexDayText(p.indexedSince)}` : ''}`;
};

export const indexVerifier: RecVerifier = async ({ rec }: RecItem, ctx: RecVerifyContext): Promise<RecVerdict> => {
  const urls = (rec.subjects?.length ? rec.subjects : [rec.action?.href ?? '']).filter(Boolean);
  if (!urls.length) return UNKNOWN;
  const rows = await ctx.indexPages();
  const read = urls.map((u) => rows.get(pageKey(u))).filter((r): r is NonNullable<typeof r> => !!r);
  if (read.length < urls.length) return UNKNOWN;
  const now = Date.parse(ctx.now) || Date.now();
  const pages = read.map((r) => indexPageOf(r));
  const done = pages.filter((p) => indexDone(p));
  if (done.length === pages.length) {
    const at = pages.map((p) => p.indexedSince || p.checkedAt || '').filter(Boolean).sort().pop();
    return { outcome: 'resolved', evidence: `${pages.slice(0, 3).map(doneLine).join(', ')}${pages.length > 3 ? ` and ${pages.length - 3} more` : ''}.`, ...(at ? { at } : {}) };
  }
  const open = pages.filter((p) => !indexDone(p)).map((p) => ({ p, v: indexValidationOf(p, now) }));
  const failed = open.filter((o) => o.v.state === 'failed');
  if (failed.length) return { outcome: 'failed', evidence: `${indexPath(failed[0].p.url)}: ${failed[0].v.why}${failed.length > 1 ? ` ${failed.length - 1} more page${failed.length === 2 ? '' : 's'} too.` : ''}`, ...(failed[0].v.at ? { at: failed[0].v.at } : {}) };
  const waiting = open.filter((o) => o.v.state === 'waiting');
  if (waiting.length === open.length)
    return { outcome: 'waiting', evidence: `${done.length} of ${pages.length} done; ${waiting.length === 1 ? `${indexPath(waiting[0].p.url)}: ${waiting[0].v.why}` : `${waiting.length} pages wait for Google to read them again.`}` };
  return { outcome: 'open', evidence: done.length ? `${done.length} of ${pages.length} pages are done.` : '' };
};

// ------------------------------------------------------------------------------------------------ link + pitches (package E)

export const linkVerifier: RecVerifier = ({ rec }: RecItem, ctx: RecVerifyContext): RecVerdict => {
  if (!rec.id.startsWith('bl:lost:')) return UNKNOWN;
  const d = (rec.issueKey ?? '').startsWith('link:') ? rec.issueKey!.slice(5) : rec.id.slice('bl:lost:'.length).toLowerCase().replace(/^www\./, '');
  const ref = ctx.x.backlinks.refs.find((r) => r.refDomain.toLowerCase().replace(/^www\./, '') === d);
  // our own reading, never an index's word (link-status.ts: a link counts only when our check found it)
  if (ref && ref.status === 'live' && ref.verify === 'found')
    return { outcome: 'resolved', evidence: `Our link check found your link on ${d} again${ref.verifiedAt || ref.lastSeen ? ` on ${day(ref.verifiedAt || ref.lastSeen)}` : ''}.`, ...(ref.verifiedAt || ref.lastSeen ? { at: ref.verifiedAt || ref.lastSeen } : {}) };
  return UNKNOWN;
};

export const pitchesVerifier: RecVerifier = ({ rec, present }: RecItem, ctx: RecVerifyContext): RecVerdict => {
  const c = ctx.x.links?.counts;
  if (!present || !c || !rec.id.startsWith('links:')) return UNKNOWN;
  const parts = [c.waitingForYou ? `${c.waitingForYou} waiting for you` : '', c.sent ? `${c.sent} sent` : '', c.replied ? `${c.replied} replied` : '', c.won ? `${c.won} won (link checked)` : ''].filter(Boolean);
  return { outcome: 'open', ...(parts.length ? { evidence: `Pitches: ${parts.join(', ')}.` } : {}) };
};

// ------------------------------------------------------------------------------------------------ AI questions (package G)

/** the inputs the AI visibility page decides with (server aiData), the ladder heads falling back to the rankings' ladders */
export function aiInputsOf(ctx: Pick<RecVerifyContext, 'x' | 'site'>): AiQuestionInputs {
  const x = ctx.x;
  return { ...aiQuestionInputsOf(x.ai, ctx.site.country ?? ''), ladderHeads: x.ai.ladderHeads?.length ? x.ai.ladderHeads : x.rankings.ladders.map((l) => l.headKeyword).filter(Boolean) };
}

export const aiTargetVerifier: RecVerifier = ({ rec }: RecItem, ctx: RecVerifyContext): RecVerdict => {
  const q = rec.issueKey?.startsWith('aiq:') ? rec.issueKey.slice(4) : '';
  if (!q) return UNKNOWN;
  const inputs = aiInputsOf(ctx);
  const t = (inputs.targets ?? []).find((x) => normKeyword(x.keyword) === normKeyword(q) || normKeyword(x.question) === normKeyword(q));
  if (t) {
    // a live page that answers the question overtakes the stored weekly state (the same rule as the AI page's badge)
    const view = aiAnsweredView(t, inputs);
    if (view) return { outcome: 'resolved', evidence: view.sentence, ...(view.date ? { at: view.date } : {}) };
    const st = String(t.state ?? t.status);
    if (st === 'won') return { outcome: 'resolved', evidence: 'AI answers name you for this question now.' };
    if (st === 'live' || st === 'named' || st === 'covered') return { outcome: 'resolved', evidence: t.statePageUrl ? `Your page for it is live: ${t.statePageUrl}` : 'Your page for it is live.' };
    if (st === 'writing' || st === 'written' || st === 'needs_fix') return { outcome: 'in_progress', evidence: st === 'writing' ? 'The page for it is being written.' : 'The page for it is written and waits to be published.' };
    return { outcome: 'open' };
  }
  // no stored target: the shared resolver, on the question itself
  const prefill = (rec.action?.prefill ?? {}) as Record<string, unknown>;
  const aiT = (prefill.aiTarget ?? null) as Record<string, unknown> | null;
  const question = String(aiT?.question ?? '') || q;
  const a = aiQuestionAction({ question, keyword: String(prefill.keyword ?? '') || undefined }, inputs);
  if (a.step === 'open' && a.pageUrl) return { outcome: 'resolved', evidence: a.note || `Answered by ${a.pageUrl}.`, ...(a.since ? { at: a.since } : {}) };
  if (a.step === 'publish') return { outcome: 'in_progress', evidence: a.note || 'The page for it is written and waits to be published.' };
  return UNKNOWN;
};
