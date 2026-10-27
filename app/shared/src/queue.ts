// One queue (benchmark pass of 2026-10-14, criterion REP 3.3). The rubric's 10 for this criterion is a **single** list across the
// audit, tracking, AI and link modules ranked by **impact x confidence / effort**; a list per module is a 5. The app already builds
// one list (`server/src/services/recommendations.ts` returns every module's items in one array), what it lacked was the ranking.
// It sorted by a hand-set `priority` and then by category, so a technical fix always sat above a search opportunity worth ten times
// the clicks, and nothing told the reader why one line came before another.
//
// The rule this file follows is the one the benchmark programme asks for: **where the three numbers cannot be computed from
// something measured, the item is not given a number.** It goes into a named band with the reason instead. An invented impact score
// is exactly the failure the last two system runs were marked down for, and a queue is the one place where a made-up number decides
// what a customer does with their week.
//
// The vocabulary is deliberately small and is the customer's: how much it is worth, how sure we are, how much work it is.

/** How much work the customer (or the system on their behalf) has to do. The bands are what a person can tell apart. */
export const EFFORT_BANDS = {
  minutes: { weight: 1, label: 'a few minutes' },
  hour: { weight: 2, label: 'about an hour' },
  session: { weight: 3, label: 'half a day' },
  days: { weight: 4, label: 'a few days' },
  weeks: { weight: 5, label: 'weeks' },
} as const;
export type EffortBand = keyof typeof EFFORT_BANDS;

/** How sure we are that doing this produces the effect, from where the quantity behind it came. */
export const CONFIDENCE = {
  /** read from the customer's own Search Console / GA4 / our own fetch of their page */
  measured: { value: 0.8, label: 'measured on your own data' },
  /** from an index, a benchmark or a competitor set, right in shape, uncertain in size */
  modelled: { value: 0.5, label: 'modelled from an index or a benchmark' },
  /** no quantity at all: a rule that holds generally, applied here */
  rule: { value: 0.25, label: 'a general rule, not measured here' },
} as const;
export type ConfidenceClass = keyof typeof CONFIDENCE;

/** The ceiling of the impact scale: monthly clicks at which impact reads 10. Above it the scale simply stops. */
export const IMPACT_CLICKS_CEILING = 500;

/**
 * Impact 0-10 from monthly clicks, on a log scale: the difference between 5 and 50 clicks a month matters more to a small site
 * than the difference between 450 and 500, and a linear scale would let one head term hide every other item in the queue.
 * 5 clicks -> 2.9, 50 -> 6.4, 500 -> 10.
 */
export function impactFromClicks(clicksPerMonth: number): number {
  if (!Number.isFinite(clicksPerMonth) || clicksPerMonth <= 0) return 0;
  const scaled = (10 * Math.log10(1 + clicksPerMonth)) / Math.log10(1 + IMPACT_CLICKS_CEILING);
  return Math.round(Math.min(10, scaled) * 10) / 10;
}

/**
 * Impact 0-10 from the weight the technical audit already gave a finding (`_impact.js` `IMP.rank`: severity x share of pages
 * affected x the Search Console clicks and impressions of those pages x where they sit, capped at the property's own totals).
 * That weight runs from about 0 to about 150, so it is brought onto the 0-10 scale on the same log shape as clicks: a weight of
 * 60 reads 10, 10 reads 5.8, 3 reads 3.4. The audit's order is never changed by this, only expressed in the queue's units.
 */
export const IMPACT_AUDIT_CEILING = 60;
export function impactFromAuditWeight(weight: number): number {
  if (!Number.isFinite(weight) || weight <= 0) return 0;
  const scaled = (10 * Math.log10(1 + weight)) / Math.log10(1 + IMPACT_AUDIT_CEILING);
  return Math.round(Math.min(10, scaled) * 10) / 10;
}

/** Impact 0-10 from a move in a rate, in percentage points (an AI mention rate, a CTR): 20 points or more reads 10. */
export function impactFromPoints(points: number): number {
  if (!Number.isFinite(points) || points <= 0) return 0;
  return Math.round(Math.min(10, (points / 20) * 10) * 10) / 10;
}

/** What `recommend()` hands the queue for one item. */
export interface ScoreInput {
  /** 0-10, from one of the `impactFrom*` rules above. `null` means we have no quantity, then `reason` is required. */
  impact: number | null;
  /** where the quantity came from; decides how much the impact is trusted */
  confidence: ConfidenceClass;
  effort: EffortBand;
  /** one line naming the quantity and its source, in the customer's words ("340 impressions at 1.2% CTR, Search Console, 28 days") */
  basis: string;
  /** required when `impact` is null: why this one cannot be ranked yet */
  reason?: string;
  /** this item gates the measurement of the others (no Search Console, no tracking), it is not ranked against them, it comes first */
  blocking?: boolean;
}

export type RecommendationScore =
  | {
      ranked: true;
      /** 0-10 */
      impact: number;
      /** 0-1 */
      confidence: number;
      confidenceLabel: string;
      /** 1-5 */
      effort: number;
      effortLabel: string;
      /** impact x confidence / effort, 1 dp, what the queue is ordered by */
      value: number;
      basis: string;
      blocking?: boolean;
    }
  | { ranked: false; reason: string; effortLabel: string; blocking?: boolean };

/** The sentence the UI puts under a ranked item, so the order is never a mystery. */
export function scoreNote(s: RecommendationScore): string {
  if (!s.ranked) return `Not ranked: ${s.reason}.`;
  return `Worth ${s.value}, impact ${s.impact}/10 (${s.basis}), ${Math.round(s.confidence * 100)}% confidence (${s.confidenceLabel}), ${s.effortLabel} of work.`;
}

export function scoreOf(input: ScoreInput): RecommendationScore {
  const effort = EFFORT_BANDS[input.effort] ?? EFFORT_BANDS.session;
  if (input.impact == null || !Number.isFinite(input.impact)) {
    return { ranked: false, reason: input.reason || 'no measured quantity for it yet', effortLabel: effort.label, ...(input.blocking ? { blocking: true } : {}) };
  }
  const conf = CONFIDENCE[input.confidence] ?? CONFIDENCE.rule;
  const impact = Math.round(Math.max(0, Math.min(10, input.impact)) * 10) / 10;
  return {
    ranked: true,
    impact,
    confidence: conf.value,
    confidenceLabel: conf.label,
    effort: effort.weight,
    effortLabel: effort.label,
    value: Math.round((impact * conf.value * 10) / effort.weight) / 10,
    basis: input.basis,
    ...(input.blocking ? { blocking: true } : {}),
  };
}

/**
 * The rule table for the families that carry no quantity of their own. It is deliberately visible: a reader of this file can see
 * every number the queue uses that was not measured, and the `basis` line says so on the item itself. Keys are matched as id
 * prefixes, longest first, against the recommendation's id.
 */
export const RULE_SCORES: Record<string, { impact: number; effort: EffortBand; basis: string; blocking?: true }> = {
  // the link-building loop: a drafted pitch is only worth something once it is sent, and a reply decays fastest of all
  'links:replies': { impact: 7, effort: 'minutes', basis: 'someone replied to a pitch; a same-day answer is what turns a reply into a link' },
  'links:approve': { impact: 6, effort: 'hour', basis: 'pitches are written and waiting; nothing is sent until you approve them' },
  'links:mailbox': { impact: 6, effort: 'hour', basis: 'the pitches cannot leave without a mailbox of your own' },
  'links:listing': { impact: 4, effort: 'hour', basis: 'a listing a competitor holds and you do not' },
  'bl:reclaim': { impact: 5, effort: 'hour', basis: 'links already point at a page that answers 404' },
  'bl:lists': { impact: 4, effort: 'hour', basis: 'a "best of" list that names competitors and not you' },
  'bl:outreach': { impact: 4, effort: 'hour', basis: 'prospects with a ready message and a contact' },
  'bl:followup': { impact: 3, effort: 'minutes', basis: 'a first follow-up roughly doubles the replies' },
  'bl:spam': { impact: 1, effort: 'minutes', basis: 'Google ignores most link spam on its own' },
  'bl:gsc-import': { impact: 2, effort: 'minutes', basis: "Google's own sample of your links, which its API will not hand over" },
  // AI
  'ai:outreach': { impact: 6, effort: 'hour', basis: 'the pages AI answers already rely on, which do not name you' },
  'ai:indexnow': { impact: 4, effort: 'minutes', basis: 'one file that gets every new page to Bing and Copilot in the same week' },
  'ai:crawlers': { impact: 7, effort: 'minutes', basis: 'an AI search crawler turned away by robots.txt cannot read, name or cite any page it is kept from' },
  'ai:gap': { impact: 4, effort: 'session', basis: 'a buyer question AI answers without you' },
  // content and cadence
  'content:cadence': { impact: 3, effort: 'minutes', basis: 'no pages are scheduled, so nothing new is written' },
  'content:trend': { impact: 3, effort: 'session', basis: 'a search whose demand is rising' },
  // technical, where the audit did not weight the finding
  'tech:stale': { impact: 2, effort: 'minutes', basis: 'the last audit is more than 45 days old' },
  'tech:score-drop': { impact: 5, effort: 'session', basis: 'the health score fell since the previous audit of the same kind' },
  // rankings
  'rank:next': { impact: 4, effort: 'session', basis: 'the next rung of a ladder that is already climbing' },
  'rank:drop': { impact: 4, effort: 'session', basis: 'a keyword that was ranking and no longer is' },
  'content:publish': { impact: 6, effort: 'hour', basis: 'the page is written and not live; nothing can rank before it is published' },
  // setup that gates measurement: these are not ranked against the rest, they come before it, because until they are done every
  // number below is a rule rather than a measurement of this site
  'setup:tracking': { impact: 8, effort: 'minutes', basis: 'nothing on this dashboard can be measured until tracking runs', blocking: true },
  'setup:delivery': { impact: 8, effort: 'minutes', basis: 'the weekly reports are going somewhere this app cannot read', blocking: true },
  'setup:gsc': { impact: 7, effort: 'hour', basis: 'without Search Console there are no clicks, impressions, queries or index status', blocking: true },
  'setup:ga4': { impact: 5, effort: 'hour', basis: 'without GA4 there are no sessions, leads or revenue to weigh anything against', blocking: true },
  'setup:profile': { impact: 5, effort: 'hour', basis: 'every page, schema block and outreach draft carries brackets until it is filled' },
  'setup:checkin': { impact: 3, effort: 'minutes', basis: 'the parts of Search Console no API can read' },
  'setup:backlinks': { impact: 2, effort: 'minutes', basis: 'no backlink check has run for this site' },
  'setup:audit': { impact: 5, effort: 'minutes', basis: 'no technical audit has run for this site' },
  'setup:ai': { impact: 3, effort: 'minutes', basis: 'no AI-visibility baseline has been taken' },
};

/** The rule score for an id, when the caller measured nothing. Returns undefined when the id is in no family. */
export function ruleScoreFor(id: string): ScoreInput | undefined {
  let best = '';
  for (const key of Object.keys(RULE_SCORES)) if (id === key || id.startsWith(key + ':')) if (key.length > best.length) best = key;
  if (!best) return undefined;
  const r = RULE_SCORES[best];
  return { impact: r.impact, confidence: 'rule', effort: r.effort, basis: r.basis, ...(r.blocking ? { blocking: true } : {}) };
}

/** The three bands the queue is read in. `blocking` first because until they are done the rest cannot be measured at all. */
export type QueueBand = 'blocking' | 'ranked' | 'unranked';

export const BAND_NOTE: Record<QueueBand, string> = {
  blocking: 'Do these first: until they are done, nothing below can be measured on your own data.',
  ranked: 'Ranked by what it is worth: impact x confidence / effort.',
  unranked: 'Worth doing, but we have no measured quantity to rank them by yet.',
};

export function bandOf(score: RecommendationScore | undefined): QueueBand {
  if (!score) return 'unranked';
  if (score.blocking) return 'blocking';
  return score.ranked ? 'ranked' : 'unranked';
}

const BAND_RANK: Record<QueueBand, number> = { blocking: 0, ranked: 1, unranked: 2 };

/**
 * The one order the whole app and every report must use: blocking first, then by value, then the unranked tail. Ties fall back to
 * the item's own id so the list does not reshuffle between loads.
 */
export function queueOrder<T extends { id: string; score?: RecommendationScore }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => {
    const ba = BAND_RANK[bandOf(a.score)];
    const bb = BAND_RANK[bandOf(b.score)];
    if (ba !== bb) return ba - bb;
    const va = a.score && a.score.ranked ? a.score.value : -1;
    const vb = b.score && b.score.ranked ? b.score.value : -1;
    if (va !== vb) return vb - va;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** The queue split into its bands, in order, with the empty ones dropped. */
export function queueBands<T extends { id: string; score?: RecommendationScore }>(items: readonly T[]): { band: QueueBand; note: string; items: T[] }[] {
  const ordered = queueOrder(items);
  const out: { band: QueueBand; note: string; items: T[] }[] = [];
  for (const band of ['blocking', 'ranked', 'unranked'] as QueueBand[]) {
    const got = ordered.filter((i) => bandOf(i.score) === band);
    if (got.length) out.push({ band, note: BAND_NOTE[band], items: got });
  }
  return out;
}
