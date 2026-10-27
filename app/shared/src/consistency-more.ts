import type { ModeId } from './constants';
import type { LadderCard, PipelineData } from './data';
import type { ConsistencyCheck, ConsistencyCtx, Warning, WarningChange, WarningSeverity } from './consistency';
import { cycleNorm } from './cycles';
import { formatCredits } from './billing';
import { FIT_FAMILIES, fitGate } from './fit-gate';
import { keywordsOverlap } from './ladders';
import { countryOf } from './markets';
import { cleanDomain, registrableDomain, urlOnDomain } from './domain';
import { readinessPage } from './readiness';

// The remaining cases of the mismatch audit (n8n/seo-agent/docs/mismatch-audit-2026-10-27/AUDIT.md §3: D1-D7, S1-S8, C1, I1-I3, I7, B1,
// M5's profile address, M7's duplicate market). They are entries of THE registry (consistency.ts CONSISTENCY_CHECKS spreads EARLY_CHECKS
// first and MORE_CHECKS last): same Warning shape, same ids `<code>:<subject>`, same 409 `confirm_needed`, same Accept / Continue anyway.
// Pure: the server (services/consistency.ts) puts what they read into the context; nothing here reads the network or a clock.
//
// This file imports only TYPES from consistency.ts (it is imported by it), so the two modules never load each other at run time.

/** How a start came in and what it costs (the server fills it; a form preview leaves it out). */
export interface StartCtx {
  /** a keyword proposal approved or swapped on the Pipeline page */
  proposal?: boolean;
  /** started by the system on the owner's behalf: it never answers a warning, it waits for the client instead */
  auto?: boolean;
  /** the person may choose a ladder's Auto / Manual (admins) */
  admin?: boolean;
  /** this start's quote in credits, as it will run (null: not known) */
  credits?: number | null;
  /** the quote of the same ladder planned without writing a page */
  planCredits?: number | null;
}

/** A live page of the website that already answers a keyword (the Content Cadence's own matcher, run by the server). */
export interface LivePage {
  keyword: string;
  url: string;
  title: string;
  matchedBy: 'query' | 'slug' | 'title';
}

/** C1: the company's credits and what this website's schedules use a day, before and after the change. */
export interface CreditsCtx {
  enforced: boolean;
  /** credits available now (balance less what running analyses hold) */
  available: number;
  /** credits used a day across the company, now and with the change */
  dailyBefore: number;
  dailyAfter: number;
  /** the values that put the setting back as it was (Accept) */
  revert?: Record<string, unknown>;
}

/** What a settings save sends to the checks (`setting` says which control). */
export interface SettingsInput {
  setting: 'cadence' | 'automation' | 'ladder' | 'monitors';
  pagesPerWeek?: number;
  autopilotLevel?: 1 | 2 | 3;
  defaultMode?: 'auto' | 'manual';
  maxActiveLadders?: number;
  maxWaiting?: number;
  ladderId?: string;
  mode?: 'auto' | 'manual';
  status?: 'active' | 'paused';
  aiMarkets?: string[];
}

// ---------------- helpers ----------------

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const q = (s: string) => `"${s}"`;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const credits = (n: number | null | undefined) => (n == null ? '' : `about ${formatCredits(n)}`);
const list = (a: readonly string[]) => (a.length <= 1 ? (a[0] ?? '') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);
const urlKey = (u: string) =>
  str(u)
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?/, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '');
const shortUrl = (u: string) => str(u).replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '');
const hostOf = (u: string) => str(u).trim().match(/^(?:[a-z][a-z0-9+.-]*:\/\/)?(?:[^@/?#]*@)?([^/?#:]+)/i)?.[1]?.toLowerCase().replace(/^www\./, '') ?? '';
const fp = (parts: readonly string[]): string => {
  let h = 2166136261;
  for (const ch of [...parts].sort().join('|')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h.toString(36);
};

function warning(w: Omit<Warning, 'message' | 'tone'> & { tone?: Warning['tone'] }): Warning {
  const tone = w.tone ?? 'warning';
  return { ...w, tone, message: `${w.title}. ${w.body}` };
}

const check = (code: string, severity: WarningSeverity, on: ConsistencyCheck['on'], run: ConsistencyCheck['run']): ConsistencyCheck => ({ code, severity, on, run });

/** The product family words of a keyword (ERP, e-invoicing, CRM, VAT): the engine's own FIT_FAMILIES, not the wide ones (AI, IT). */
const FAMILY_NAME: [RegExp, string][] = [
  [/invoic|peppol|fatoora/, 'e-invoicing'],
  [/\berp|business central|netsuite|odoo/, 'ERP'],
  [/\bcrm|salesforce|hubspot/, 'CRM'],
  [/\bvat\b|value added/, 'VAT'],
];
export function productFamilies(keyword: string): string[] {
  const t = ` ${str(keyword).toLowerCase().replace(/&/g, ' and ').replace(/\s+/g, ' ').trim()} `;
  const out: string[] = [];
  for (const f of FIT_FAMILIES) {
    if (f.wide?.length || !(f.cat || f.anchors.length)) continue;
    if (!f.re.test(t)) continue;
    const name = FAMILY_NAME.find(([re]) => re.test(f.re.source))?.[1] ?? f.anchors[0] ?? '';
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}

/** The ladder's mode as this start will run it: the request's, else the website's default (null: not known). */
function startMode(input: Record<string, unknown>, p: PipelineData | null | undefined): 'auto' | 'manual' | null {
  const m = str(input.ladderMode) || str((input.ladderPrefs as { mode?: unknown } | undefined)?.mode);
  if (m === 'auto' || m === 'manual') return m;
  if (input.pagesHeld === 'manual') return 'manual';
  const d = p?.automation?.defaultMode;
  return d === 'auto' || d === 'manual' ? d : null;
}
const pagesNowOf = (input: Record<string, unknown>) => Math.min(3, Math.max(1, num(input.pagesNow) ?? 1));
/** Ladders that get the weekly pages (Auto, pages left, not paused / won / queued): autoStart.ts activeAutoLadders, the same rule. */
const activeAuto = (cards: readonly Pick<LadderCard, 'mode' | 'status' | 'counts'>[]) =>
  cards.filter((c) => c.mode === 'auto' && !['paused', 'won', 'queued'].includes(c.status) && c.counts.planned > 0).length;
const isMode = (input: Record<string, unknown>, ...m: ModeId[]) => m.includes(str(input.mode) as ModeId);
/** A run that writes a page for its keyword now (a page, not a report; not a rewrite of a page named in the form). */
const writesNewPage = (input: Record<string, unknown>) => isMode(input, 'keyword') && input.receiveContent !== false && !!str(input.keyword).trim();

// ---------------- D1: a keyword proposal starts a new ladder (production 2026-10-26, techand.ai) ----------------

/**
 * D1: "Start this ladder" on a suggestion planned a second ladder and wrote a page in one click (techand.ai, 2026-10-26: "erp & crm
 * software" next to "dynamics 365 erp system", about 111 credits). Approve and swap now always ask first, in plain words: a NEW ladder,
 * its first page written NOW, the quote, the ladders it joins and the one it overlaps. The safe choice is Accept (plan it, write nothing)
 * or Cancel (nothing starts). An automatic level-3 start is the announcement itself: never asked here.
 */
const NEW_LADDER = check('money.new_ladder', 'money', ['run'], (_a, input, ctx) => {
  const kw = str(input.keyword).trim();
  if (!isMode(input, 'ladder') || !kw || !ctx.start?.proposal || ctx.start.auto) return [];
  if (str(input.ladderMode) === 'manual') return [];   // the person chose to plan it without a page, knowing the quote
  const p = ctx.pipeline;
  const mode = startMode(input, p);
  const held = mode !== 'manual' && !!p?.readiness && !p.readiness.ready;
  const writesNow = mode !== 'manual' && !held;
  const cards = p?.ladderCards ?? [];
  const heads = cards.map((c) => c.head);
  const fam = productFamilies(kw);
  const near = cards.find((c) => keywordsOverlap(c.head, kw) || productFamilies(c.head).some((f) => fam.includes(f)));
  const nearFam = near ? productFamilies(near.head).find((f) => fam.includes(f)) : undefined;
  const total = ctx.start.credits ?? null;
  const plan = ctx.start.planCredits ?? null;
  const n = pagesNowOf(input);
  const body = [
    heads.length
      ? `${q(kw)} becomes keyword ladder number ${heads.length + 1}, next to ${list(heads.slice(0, 3).map(q))}${heads.length > 3 ? ` and ${heads.length - 3} more` : ''}.`
      : `${q(kw)} becomes your website's first keyword ladder.`,
    writesNow
      ? `Starting it plans the ladder and writes ${n === 1 ? 'its first page' : `its first ${n} pages`} now${total != null ? `: ${credits(total)} in total` : ''}${plan != null && total != null && total > plan ? ` (${credits(plan)} to plan it, the rest for the page${n === 1 ? '' : 's'})` : ''}. After that, its pages use your weekly pages.`
      : held
        ? `Starting it plans the ladder now${plan != null ? ` (${credits(plan)})` : ''}. Its first page waits until ${p!.readiness!.missingText} ${p!.readiness!.missing.length === 1 ? 'is' : 'are'} on file, and is then written and charged.`
        : `New ladders on your website are Manual, so starting it plans the ladder now${plan != null ? ` (${credits(plan)})` : total != null ? ` (${credits(total)})` : ''} and every page waits for your OK.`,
    near
      ? keywordsOverlap(near.head, kw)
        ? `It is almost the same search as your ladder ${q(near.head)}, so their pages would compete with each other in Google.`
        : `It is about ${nearFam} like your ladder ${q(near.head)}, so their pages compete for the same buyers.`
      : '',
    'Nothing has started yet.',
  ]
    .filter(Boolean)
    .join(' ');
  return [
    warning({
      id: `money.new_ladder:${cycleNorm(kw)}`,
      code: 'money.new_ladder',
      severity: 'money',
      title: `This starts a new keyword ladder for ${q(kw)}`,
      body,
      short: writesNow ? `New ladder and a page now${total != null ? `, ${credits(total)}` : ''}` : 'New ladder',
      confirm: writesNow ? `Start it and write the first page now${total != null ? ` (${credits(total)})` : ''}` : 'Start this ladder',
      ...(writesNow ? { accept: { label: `Plan it without writing a page${plan != null ? ` (${credits(plan)})` : ''}`, change: { kind: 'fields' as const, set: { ladderMode: 'manual' } } } } : {}),
    }),
  ];
});

// ---------------- D2: a new ladder in the same product family as an existing one ----------------

/** D2: word overlap is under 75% ("erp & crm software" vs "dynamics 365 erp system" share 1 word of 6), but both are about ERP. */
const SAME_FAMILY = check('money.same_family', 'money', ['run'], (_a, input, ctx) => {
  const kw = str(input.keyword).trim();
  if (!isMode(input, 'ladder') || !kw) return [];
  const fam = productFamilies(kw);
  if (!fam.length) return [];
  const out: Warning[] = [];
  for (const l of ctx.pipeline?.ladders ?? []) {
    // the same search (or 75% the same) is the forms' own "overlaps your ladder" warning already
    if (cycleNorm(l.head) === cycleNorm(kw) || keywordsOverlap(l.head, kw) || (l.keywords ?? []).some((k) => keywordsOverlap(k, kw))) continue;
    const shared = productFamilies(l.head).find((f) => fam.includes(f));
    if (!shared) continue;
    const change: WarningChange | null =
      ctx.start?.admin !== false && ctx.siteApi
        ? { kind: 'call', method: 'POST', path: `${ctx.siteApi}/ladders/${l.id}/keywords`, body: { keyword: kw }, instead: true }
        : null;
    out.push(
      warning({
        id: `money.same_family:${cycleNorm(kw)}:${l.id}`,
        code: 'money.same_family',
        severity: 'money',
        title: `${q(kw)} and your ladder ${q(l.head)} are both about ${shared}`,
        body: `Two ladders about ${shared} write pages that compete for the same buyers in Google, and usually neither ranks as well as one ladder would. Adding ${q(kw)} as a page of ${q(l.head)} keeps them together and starts nothing new.`,
        short: `Also about ${shared}`,
        confirm: 'Start a separate ladder anyway',
        ...(change ? { accept: { label: `Add it to ${q(l.head)} instead`, change } } : {}),
      }),
    );
    break;   // one family warning is enough: the first ladder in priority order
  }
  return out;
});

// ---------------- D3: the keyword is already answered by a live page of the website ----------------

const PAGE_EXISTS = check('money.page_exists', 'money', ['run', 'ladder_add'], (action, input, ctx) => {
  const kw = str(input.keyword).trim();
  if (!kw) return [];
  const ladder = action === 'run' && isMode(input, 'ladder');
  if (action === 'run' && !ladder && !(writesNewPage(input) && !str(input.existingPageUrl).trim() && !input.ladder)) return [];
  const page = (ctx.livePages ?? []).find((x) => cycleNorm(x.keyword) === cycleNorm(kw));
  if (!page) return [];
  // a page this system wrote for the same keyword is the forms' own "already written" warning
  if ((ctx.pipeline?.written ?? []).some((w) => cycleNorm(w.keyword) === cycleNorm(kw))) return [];
  const why = page.matchedBy === 'query' ? 'Google already shows it to people who search this.' : `Its ${page.matchedBy === 'slug' ? 'address' : 'title'} is about the same search.`;
  return [
    warning({
      id: `money.page_exists:${cycleNorm(kw)}:${urlKey(page.url)}`,
      code: 'money.page_exists',
      severity: 'money',
      title: `Your page ${shortUrl(page.url)} already answers ${q(kw)}`,
      body:
        `${why} A second page for the same search competes with it in Google, and usually neither ranks well. ` +
        (ladder ? `A ladder for ${q(kw)} plans a new main page for it; improving ${shortUrl(page.url)} with "Write a page" may be all it needs.` : action === 'ladder_add' ? 'Adding it to the ladder plans a new page for it.' : 'Improving that page usually does more than a new one.'),
      short: 'A live page answers it',
      confirm: ladder ? 'Plan the ladder anyway' : action === 'ladder_add' ? 'Add it anyway' : 'Write a new page anyway',
      ...(!ladder && action === 'run' ? { accept: { label: `Improve ${shortUrl(page.url)} instead`, change: { kind: 'fields' as const, set: { existingPageUrl: page.url } } } } : {}),
    }),
  ];
});

// ---------------- D4: "Add to my ladder" ----------------

const LADDER_ADD = check('money.ladder_add', 'money', ['ladder_add'], (_a, input, ctx) => {
  const kw = str(input.keyword).trim();
  const target = str(input.ladderId);
  if (!kw) return [];
  const out: Warning[] = [];
  const other = (ctx.pipeline?.ladders ?? []).find((l) => l.id !== target && [l.head, ...(l.keywords ?? [])].some((k) => k && (cycleNorm(k) === cycleNorm(kw) || keywordsOverlap(k, kw))));
  if (other)
    out.push(
      warning({
        id: `money.ladder_add_overlap:${cycleNorm(kw)}:${other.id}`,
        code: 'money.ladder_add_overlap',
        severity: 'money',
        title: `${q(kw)} is already covered by your ladder ${q(other.head)}`,
        body: `That ladder already plans a page for this search, or one almost the same. A second page for it in another ladder competes with the first in Google.`,
        short: 'Covered by another ladder',
        confirm: 'Add it anyway',
      }),
    );
  if (ctx.site?.domain) {
    const fit = fitGate(kw, { own_domain: ctx.site.domain, competitors: [...(ctx.site.competitors ?? [])], market: countryOf(ctx.site.country)?.iso });
    // off topic / too broad need the website's topics, and other markets are the market checks' (M4): only the hard reasons here
    if (!fit.ok && ['government', 'portal', 'navigational', 'other brand', 'own brand', 'job search'].includes(fit.reason ?? ''))
      out.push(
        warning({
          id: `money.ladder_add_fit:${cycleNorm(kw)}`,
          code: 'money.ladder_add_fit',
          severity: 'money',
          title: `${q(kw)} is not a search a page of yours can win`,
          body: `${fit.detail ? `${fit.detail.charAt(0).toUpperCase()}${fit.detail.slice(1).replace(/\.$/, '')}. ` : ''}People who search it want another website, so a page for it is written and charged but brings few visitors.`,
          short: 'Not a search you can win',
          confirm: 'Add it anyway',
        }),
      );
  }
  return out;
});

// ---------------- D5: rewriting a page that is the published page of another keyword ----------------

const PAGE_OWNED = check('data.page_owned', 'data', ['run'], (_a, input, ctx) => {
  const kw = str(input.keyword).trim();
  const url = str(input.existingPageUrl).trim();
  if (!isMode(input, 'keyword') || !kw || !url) return [];
  const owner = (ctx.pipeline?.written ?? []).find((w) => w.publishedUrl && urlKey(w.publishedUrl) === urlKey(url) && cycleNorm(w.keyword) !== cycleNorm(kw));
  if (!owner) return [];
  return [
    warning({
      id: `data.page_owned:${urlKey(url)}:${cycleNorm(kw)}`,
      code: 'data.page_owned',
      severity: 'data',
      title: `${shortUrl(url)} is your page for ${q(owner.keyword)}`,
      body: `Rewriting it for ${q(kw)} changes what it ranks for, and it can lose the visitors it gets now for ${q(owner.keyword)}.`,
      short: `Page of "${owner.keyword}"`,
      confirm: `Rewrite it for ${q(kw)} anyway`,
      accept: { label: 'Write a new page instead', change: { kind: 'fields', set: { existingPageUrl: '' } } },
    }),
  ];
});

// ---------------- D7: watching a keyword a ladder already checks every week ----------------

const WATCH_DUP = check('money.watch_dup', 'money', ['run'], (_a, input, ctx) => {
  if (!isMode(input, 'track') || !Array.isArray(input.keywords)) return [];
  const ladders = ctx.pipeline?.ladders ?? [];
  const keywords = input.keywords.map(str).map((k) => k.trim()).filter(Boolean);
  const out: Warning[] = [];
  for (const k of keywords) {
    const l = ladders.find((x) => [x.head, ...(x.keywords ?? [])].some((y) => y && (cycleNorm(y) === cycleNorm(k) || keywordsOverlap(y, k))));
    if (!l) continue;
    out.push(
      warning({
        id: `money.watch_dup:${cycleNorm(k)}`,
        code: 'money.watch_dup',
        severity: 'money',
        title: `${q(k)} is already checked every week in your ladder ${q(l.head)}`,
        body: `Watching it here too checks the same search twice a week, and both checks are charged.`,
        short: 'Already checked by a ladder',
        confirm: 'Watch it anyway',
        accept: { label: `Stop watching ${q(k)} here`, change: { kind: 'fields', set: { keywords: keywords.filter((x) => x !== k) } } },
      }),
    );
  }
  return out;
});

// ---------------- S6: pages asked for now, but new ladders are Manual ----------------

const MANUAL_PAGES_NOW = check('pipeline.manual_pages_now', 'money', ['run'], (_a, input, ctx) => {
  const kw = str(input.keyword).trim();
  if (!isMode(input, 'ladder') || !kw || ctx.start?.proposal || ctx.start?.auto) return [];
  if (str(input.ladderMode) || (input.ladderPrefs as { mode?: unknown } | undefined)?.mode) return [];   // the person chose a mode
  if (ctx.pipeline?.automation?.defaultMode !== 'manual') return [];
  const n = pagesNowOf(input);
  return [
    warning({
      id: `pipeline.manual_pages_now:${cycleNorm(kw)}`,
      code: 'pipeline.manual_pages_now',
      severity: 'money',
      title: 'No page is written now',
      body: `New keyword ladders on ${ctx.site?.domain ?? 'your website'} are Manual, so this start plans ${q(kw)} and writes none of its pages now, although you asked for ${plural(n, 'page')}. Its pages wait for your OK on the Pipeline page.`,
      short: 'Planned only (Manual)',
      confirm: 'Start it as Manual',
      ...(ctx.start?.admin !== false ? { accept: { label: `Write ${plural(n, 'page')} now (Auto for this ladder)`, change: { kind: 'fields' as const, set: { ladderMode: 'auto' } } } } : {}),
    }),
  ];
});

// ---------------- S8: a page without the author profile or the business facts ----------------

const NOT_READY = check('content.not_ready', 'data', ['run'], (_a, input, ctx) => {
  const r = ctx.pipeline?.readiness;
  if (!r || r.ready || !ctx.site) return [];
  const page = readinessPage(r);
  if (writesNewPage(input))
    return [
      warning({
        id: `content.not_ready:${r.missing.join(',')}`,
        code: 'content.not_ready',
        severity: 'data',
        title: 'Your page would be written with blanks',
        body: `${cap(r.missingText)} ${r.missing.length === 1 ? 'is' : 'are'} not on file, so the page arrives with blanks to fill and may not pass its quality check. It is charged either way.`,
        short: 'Profile or facts missing',
        confirm: 'Write it anyway',
        accept: { label: 'Add them first', change: { kind: 'link', sitePage: page } },
      }),
    ];
  if (isMode(input, 'ladder') && startMode(input, ctx.pipeline) !== 'manual' && !ctx.start?.proposal)
    return [
      warning({
        id: `content.not_ready_ladder:${r.missing.join(',')}`,
        code: 'content.not_ready',
        severity: 'data',
        tone: 'info',
        title: "The ladder's first page waits for your profile",
        body: `${cap(r.missingText)} ${r.missing.length === 1 ? 'is' : 'are'} not on file, so the ladder is planned now and its first page is written once ${r.missing.length === 1 ? 'it is' : 'they are'} added. You are charged for the plan only until then.`,
        short: 'First page waits',
        accept: { label: 'Add them now', change: { kind: 'link', sitePage: page } },
      }),
    ];
  return [];
});

// ---------------- B1: the run's own business text differs from the website's ----------------

const words = (s: string) => new Set(str(s).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2));
/** share of the run's words the website's text also has (1 = same words) */
const shareOf = (run: string, site: string) => {
  const a = words(run), b = words(site);
  if (!a.size || !b.size) return 1;
  let hit = 0;
  for (const w of a) if (b.has(w)) hit++;
  return hit / a.size;
};
const RUN_BUSINESS = check('data.run_business', 'cosmetic', ['run'], (_a, input, ctx) => {
  if (!ctx.site || isMode(input, 'profile', 'track', 'published')) return [];
  const fields = (['business', 'customers', 'businessFacts'] as const).filter((f) => {
    const mine = str(input[f]).trim();
    const site = str(ctx.site?.[f]).trim();
    return mine && site && shareOf(mine, site) < 0.5;
  });
  if (!fields.length) return [];
  const label: Record<string, string> = { business: 'what you sell', customers: 'who buys', businessFacts: 'business facts' };
  return [
    warning({
      id: `data.run_business:${fp(fields.map((f) => str(input[f])))}`,
      code: 'data.run_business',
      severity: 'cosmetic',
      tone: 'info',
      title: 'This describes your business differently from your website settings',
      body: `The ${list(fields.map((f) => label[f]!))} in this form ${fields.length === 1 ? 'is' : 'are'} not what your website settings say. Pages and research use the text sent here, so they may describe your business differently from your other pages.`,
      short: 'Other business text',
      accept: { label: 'Use my website settings', change: { kind: 'fields', set: Object.fromEntries(fields.map((f) => [f, str(ctx.site?.[f])])) } },
    }),
  ];
});

// ---------------- M5 (profile): the profile's address is in another country ----------------

const PROFILE_ADDRESS = check('market.profile_address', 'market', ['run'], (_a, input, ctx) => {
  if (!isMode(input, 'profile') || !ctx.site) return [];
  const mine = countryOf(ctx.site.country);
  const addr = countryOf(str(input.country));
  if (!mine || !addr || mine.iso === addr.iso) return [];
  return [
    warning({
      id: `market.profile_address:${addr.iso}:${mine.iso}`,
      code: 'market.profile_address',
      severity: 'market',
      tone: 'info',
      title: `Your business address is in ${addr.name}, your main country is ${mine.name}`,
      body: `Local pages and your business details on every page name ${addr.name}, while rankings and research are measured for ${mine.name}. That is right when you serve ${mine.name} from ${addr.name}; otherwise change one of them.`,
      short: `Address in ${addr.name}`,
    }),
  ];
});

// ---------------- settings: S1, S2, S3, S4, S5, S7, C1, M7 (extra market) ----------------

const settingOf = (input: Record<string, unknown>) => str(input.setting) as SettingsInput['setting'];

/** S7: weekly pages switched off while an Auto ladder still has pages to write. S1: weekly pages on, but nothing will be written. S2: above the pile-up limit. */
const CADENCE = check('pipeline.cadence', 'cosmetic', ['settings'], (_a, input, ctx) => {
  if (settingOf(input) !== 'cadence') return [];
  const p = ctx.pipeline;
  const ppw = num(input.pagesPerWeek);
  if (!p || ppw == null) return [];
  const before = p.queue?.pagesPerWeek ?? 0;
  const cards = p.ladderCards ?? [];
  const waiting = (p.queue?.waiting ?? []).length;
  const maxWaiting = Math.max(1, Number(p.automation?.maxWaiting) || 3);
  const level = p.autopilot?.level ?? p.automation?.autopilotLevel ?? 2;
  const out: Warning[] = [];
  if (ppw === 0) {
    const stuck = cards.filter((c) => c.mode === 'auto' && c.counts.planned > 0 && !['paused', 'won'].includes(c.status));
    if (stuck.length)
      out.push(
        warning({
          id: `pipeline.ladders_stop:${fp(stuck.map((c) => c.id))}`,
          code: 'pipeline.ladders_stop',
          severity: 'cosmetic',
          title: `Your ${stuck.length === 1 ? 'ladder' : 'ladders'} ${list(stuck.slice(0, 3).map((c) => q(c.head)))} stop${stuck.length === 1 ? 's' : ''} moving`,
          body: `${stuck.length === 1 ? 'It still has' : 'They still have'} ${plural(stuck.reduce((t, c) => t + c.counts.planned, 0), 'page')} to write, and with weekly pages off nothing is written until you click "Write now" on the Pipeline page.`,
          short: 'Ladders stop',
          confirm: 'Switch weekly pages off anyway',
          accept: { label: 'Keep 1 page a week', change: { kind: 'fields', set: { pagesPerWeek: Math.max(1, before) } } },
        }),
      );
    return out;
  }
  // S1: on, but nothing will be written (the first reason that holds)
  const why: { key: string; text: string; accept?: { label: string; change: WarningChange } } | null =
    ctx.site && p.tracking?.status === 'paused'
      ? { key: 'paused', text: 'the website is paused, so its weekly work does not run.' }
      : p.readiness && !p.readiness.ready
        ? { key: 'profile', text: `${p.readiness.missingText} ${p.readiness.missing.length === 1 ? 'is' : 'are'} not on file, and no page is written on its own without them.`, accept: { label: 'Add them first', change: { kind: 'link', sitePage: readinessPage(p.readiness) } } }
        : waiting >= maxWaiting
          ? { key: 'pileup', text: `${plural(waiting, 'page')} already wait${waiting === 1 ? 's' : ''} to be published and your limit is ${maxWaiting}, so the weekly pages are paused until you publish some.`, accept: { label: 'Publish the waiting pages', change: { kind: 'link', sitePage: 'pipeline' } } }
          : level < 3 && !activeAuto(cards)
            ? {
                key: 'no_keyword',
                text: cards.length
                  ? 'none of your keyword ladders is on Auto with pages left to write, and only those get the weekly pages.'
                  : 'you have not chosen a keyword yet, and the weekly pages are written for the keywords you choose.',
                accept: { label: 'Choose a keyword', change: { kind: 'link', sitePage: 'pipeline/new' } },
              }
            : null;
  if (why)
    out.push(
      warning({
        id: `pipeline.writes_nothing:${why.key}:${ppw}`,
        code: 'pipeline.writes_nothing',
        severity: 'cosmetic',
        title: `${plural(ppw, 'page')} a week, but nothing will be written yet`,
        body: `Nothing is written because ${why.text}`,
        short: 'Writes nothing yet',
        confirm: 'Save it anyway',
        ...(why.accept ? { accept: why.accept } : {}),
      }),
    );
  // S2: more pages a week than the pile-up limit lets through
  const room = Math.max(0, maxWaiting - waiting);
  if (!why && ppw > room)
    out.push(
      warning({
        id: `pipeline.over_pileup:${ppw}:${maxWaiting}:${waiting}`,
        code: 'pipeline.over_pileup',
        severity: 'cosmetic',
        title: `At most ${plural(room, 'page')} a week until you publish some`,
        body: `Your limit stops new pages when ${maxWaiting} wait to be published${waiting ? ` (${waiting} wait now)` : ''}, so the weekly run writes at most ${plural(room, 'page')} until you publish the ones written.`,
        short: 'Above the waiting limit',
        confirm: 'Save it anyway',
        ...(ctx.siteApi && ctx.start?.admin !== false ? { accept: { label: `Raise the limit to ${ppw + waiting}`, change: { kind: 'call' as const, method: 'PATCH' as const, path: `${ctx.siteApi}/automation`, body: { maxWaiting: ppw + waiting } } } } : {}),
      }),
    );
  return out;
});

/** S3: the limit lowered below what is writing now. S4: level 3 with Manual new ladders; level lowered while ladders we started write. */
const AUTOMATION = check('pipeline.automation', 'cosmetic', ['settings'], (_a, input, ctx) => {
  if (settingOf(input) !== 'automation') return [];
  const p = ctx.pipeline;
  if (!p) return [];
  const out: Warning[] = [];
  const cards = p.ladderCards ?? [];
  const active = activeAuto(cards);
  const maxActive = num(input.maxActiveLadders);
  if (maxActive != null && maxActive < active) {
    const writing = cards.filter((c) => c.mode === 'auto' && !['paused', 'won', 'queued'].includes(c.status) && c.counts.planned > 0);
    const queued = writing.slice(maxActive).map((c) => q(c.head));
    out.push(
      warning({
        id: `pipeline.limit_below_active:${maxActive}:${active}`,
        code: 'pipeline.limit_below_active',
        severity: 'cosmetic',
        title: `${plural(active, 'ladder')} are getting pages now`,
        body: `With a limit of ${maxActive}, ${list(queued)} ${queued.length === 1 ? 'waits' : 'wait'} as Queued and get${queued.length === 1 ? 's' : ''} no weekly pages until another ladder is done or paused.`,
        short: 'Some ladders wait',
        confirm: 'Lower the limit anyway',
        accept: { label: `Keep the limit at ${active}`, change: { kind: 'fields', set: { maxActiveLadders: active } } },
      }),
    );
  }
  const before = (p.autopilot?.level ?? p.automation?.autopilotLevel ?? 2) as number;
  const level = num(input.autopilotLevel) ?? before;
  const defaultMode = str(input.defaultMode) || p.automation?.defaultMode;
  if (level === 3 && defaultMode === 'manual' && (before !== 3 || input.defaultMode !== undefined))
    out.push(
      warning({
        id: 'pipeline.level3_manual',
        code: 'pipeline.level3_manual',
        severity: 'cosmetic',
        title: 'Full autopilot starts keywords, but new ladders are Manual',
        body: 'The autopilot will start new keyword ladders for you, and each starts Manual, so its pages wait for your OK and nothing is written on its own.',
        short: 'New ladders wait',
        confirm: 'Keep new ladders Manual',
        accept: { label: 'Make new ladders Auto', change: { kind: 'fields', set: { defaultMode: 'auto' } } },
      }),
    );
  const ours = p.autopilot?.notChosen ?? [];
  if (before === 3 && level < 3 && ours.length)
    out.push(
      warning({
        id: `pipeline.level_drop_system:${level}:${fp(ours)}`,
        code: 'pipeline.level_drop_system',
        severity: 'cosmetic',
        title: `The weekly pages of ${list(ours.slice(0, 3).map(q))} stop`,
        body: `We started ${ours.length === 1 ? 'that ladder' : 'those ladders'} for you on full autopilot, and ${ours.length === 1 ? 'its' : 'their'} pages are written only at that level. ${ours.length === 1 ? 'It keeps' : 'They keep'} what ${ours.length === 1 ? 'it has' : 'they have'}, but no new page is written until you approve each one.`,
        short: 'Started ladders stop',
        confirm: 'Lower the level anyway',
      }),
    );
  return out;
});

/** S5: a ladder switched to Auto or resumed while the limit is full: it waits as Queued. */
const LADDER_QUEUED = check('pipeline.ladder_queued', 'cosmetic', ['settings'], (_a, input, ctx) => {
  if (settingOf(input) !== 'ladder') return [];
  const p = ctx.pipeline;
  const card = (p?.ladderCards ?? []).find((c) => c.id === str(input.ladderId));
  if (!p || !card) return [];
  const mode = str(input.mode) || card.mode;
  const status = str(input.status) || (card.status === 'paused' ? 'paused' : 'active');
  const wasGettingPages = card.mode === 'auto' && !['paused', 'won', 'queued'].includes(card.status) && card.counts.planned > 0;
  if (mode !== 'auto' || status !== 'active' || wasGettingPages || card.counts.planned === 0) return [];
  const maxActive = Math.max(1, Number(p.automation?.maxActiveLadders) || 2);
  const active = activeAuto(p.ladderCards);
  if (active < maxActive) return [];
  return [
    warning({
      id: `pipeline.ladder_queued:${card.id}:${maxActive}`,
      code: 'pipeline.ladder_queued',
      severity: 'cosmetic',
      title: `${q(card.head)} will wait as Queued`,
      body: `${plural(active, 'ladder')} already get${active === 1 ? 's' : ''} the weekly pages and your limit is ${maxActive}, so this one gets pages only when another is done or paused. Raise the limit or move it up in the order to write it sooner.`,
      short: 'Waits as Queued',
      confirm: 'Save it anyway',
      ...(ctx.siteApi ? { accept: { label: `Raise the limit to ${maxActive + 1}`, change: { kind: 'call' as const, method: 'PATCH' as const, path: `${ctx.siteApi}/automation`, body: { maxActiveLadders: maxActive + 1 } } } } : {}),
    }),
  ];
});

/** M7: an extra AI market that is the website's own market (it adds nothing, the own market is always asked). */
const AI_MARKET_DUP = check('ai.extra_market_same', 'cosmetic', ['settings'], (_a, input, ctx) => {
  if (settingOf(input) !== 'monitors' || !Array.isArray(input.aiMarkets)) return [];
  const mine = countryOf(ctx.site?.country);
  if (!mine) return [];
  const markets = input.aiMarkets.map(str);
  const same = markets.filter((m) => m.slice(0, 2).toUpperCase() === mine.iso);
  if (!same.length) return [];
  return [
    warning({
      id: `ai.extra_market_same:${mine.iso}`,
      code: 'ai.extra_market_same',
      severity: 'cosmetic',
      title: `${mine.name} is already your own market`,
      body: `Your AI questions are always asked in ${mine.name}, so adding it as an extra market asks nothing new.`,
      short: 'Own market twice',
      confirm: 'Keep it anyway',
      accept: { label: `Remove ${same.join(', ')}`, change: { kind: 'fields', set: { aiMarkets: markets.filter((m) => !same.includes(m)) } } },
    }),
  ];
});

/** C1: schedules switched on whose use outruns the balance (the credit guard then pauses the website). */
export const RUNWAY_DAYS_MIN = 14;
const CREDITS_RUNWAY = check('money.credits_runway', 'money', ['settings'], (_a, input, ctx) => {
  const c = ctx.credits;
  if (!c || !c.enforced || !(c.dailyAfter > c.dailyBefore + 1e-9)) return [];
  const daysAfter = c.dailyAfter > 0 ? Math.floor(Math.max(0, c.available) / c.dailyAfter) : null;
  if (daysAfter == null || daysAfter >= RUNWAY_DAYS_MIN) return [];
  const daysBefore = c.dailyBefore > 0 ? Math.floor(Math.max(0, c.available) / c.dailyBefore) : null;
  return [
    warning({
      id: `money.credits_runway:${settingOf(input)}:${Math.round(c.dailyAfter * 10)}`,
      code: 'money.credits_runway',
      severity: 'money',
      title: `With this change your credits last about ${plural(daysAfter, 'day')}`,
      body:
        `Your schedules would use about ${formatCredits(c.dailyAfter)} a day${daysBefore != null ? `, so the ${formatCredits(c.available)} you have last about ${plural(daysAfter, 'day')} instead of ${plural(daysBefore, 'day')}` : ` and you have ${formatCredits(c.available)}`}. ` +
        "When they run out, the website's weekly work pauses until credits are added (Settings > Credits).",
      short: `Credits last ${plural(daysAfter, 'day')}`,
      confirm: 'Save it anyway',
      ...(c.revert ? { accept: { label: 'Keep my current setting', change: { kind: 'fields' as const, set: c.revert } } } : {}),
    }),
  ];
});

// ---------------- integrations: I1, I2, I3; I7 (the website's address redirects) ----------------

const FREE_MAIL = new Set(['gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'yahoo.com', 'icloud.com', 'me.com', 'proton.me', 'protonmail.com', 'aol.com', 'zoho.com', 'gmx.com', 'yandex.com']);

const INTEGRATIONS = check('data.integration', 'data', ['integration'], (_a, input, ctx) => {
  const domain = cleanDomain(ctx.site?.domain ?? '');
  if (!domain) return [];
  const kind = str(input.kind);
  const out: Warning[] = [];
  if (kind === 'cms') {
    // I1: where the pages appear (the public address pattern, and a WordPress site's own address) must be the website
    const urls = [str(input.publicUrlTemplate), str(input.platform) === 'wordpress' ? str(input.baseUrl) : ''].filter((u) => u.trim());
    const off = urls.map((u) => ({ u, h: hostOf(u.replace(/\{[^}]*\}/g, 'x')) })).find((x) => x.h && !urlOnDomain(`https://${x.h}/`, domain));
    if (off)
      out.push(
        warning({
          id: `data.cms_domain:${off.h}`,
          code: 'data.cms_domain',
          severity: 'data',
          title: `This connection publishes to ${off.h}, not to ${domain}`,
          body: `Pages sent through it would not appear on your website, and their rankings would never be found for ${domain}.`,
          short: `Publishes to ${off.h}`,
          confirm: `Use ${off.h} anyway`,
          ...(str(input.publicUrlTemplate) && !urlOnDomain(`https://${hostOf(str(input.publicUrlTemplate).replace(/\{[^}]*\}/g, 'x'))}/`, domain)
            ? { accept: { label: `Use https://${domain} in the page address`, change: { kind: 'fields' as const, set: { publicUrlTemplate: str(input.publicUrlTemplate).replace(/^(?:https?:\/\/)?[^/]+/i, `https://${domain}`) } } } }
            : {}),
        }),
      );
  }
  if (kind === 'mailbox') {
    // I2: outreach for this website sent from an address of another website
    const addr = str(input.address).trim().toLowerCase();
    const mailDomain = addr.split('@')[1] ?? '';
    const reg = registrableDomain(mailDomain);
    if (mailDomain && reg !== registrableDomain(domain)) {
      const other = (ctx.companyDomains ?? []).find((d) => registrableDomain(d) === reg);
      if (other || !FREE_MAIL.has(reg))
        out.push(
          warning({
            id: `data.mailbox_domain:${reg}:${registrableDomain(domain)}`,
            code: 'data.mailbox_domain',
            severity: 'data',
            title: `Outreach for ${domain} would be sent from ${addr}`,
            body: `That is an address of ${other ?? reg}. People you write to will not connect it with ${domain}, so they are less likely to answer or to link to it.`,
            short: `Sent from ${reg}`,
            confirm: 'Send from it anyway',
          }),
        );
    }
  }
  if (kind === 'link_import') {
    // I3: a backlinks file whose target column names another website
    const targets = (Array.isArray(input.targets) ? input.targets : []).map((t) => hostOf(str(t))).filter(Boolean);
    if (targets.length >= 3) {
      const on = targets.filter((h) => urlOnDomain(`https://${h}/`, domain)).length;
      if (on / targets.length < 0.2) {
        const counts = new Map<string, number>();
        for (const h of targets) counts.set(registrableDomain(h), (counts.get(registrableDomain(h)) ?? 0) + 1);
        const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
        out.push(
          warning({
            id: `data.import_other_site:${top}:${domain}`,
            code: 'data.import_other_site',
            severity: 'data',
            title: `This file lists links to ${top}, not to ${domain}`,
            body: `${on ? `Only ${on} of its ${targets.length} rows point` : `None of its ${targets.length} rows points`} to ${domain}. Loading it would count another website's links as yours.`,
            short: `File of ${top}`,
            confirm: 'Load it anyway',
          }),
        );
      }
    }
  }
  return out;
});

/** I7: the website's address sends visitors to another domain (checked once when the website is added). */
const REDIRECTS = check('data.domain_redirects', 'data', ['site_update'], (_a, input, ctx) => {
  const to = cleanDomain(ctx.redirectTo ?? '');
  const from = cleanDomain(str(input.domain) || ctx.site?.domain || '');
  if (!to || !from || registrableDomain(to) === registrableDomain(from)) return [];
  return [
    warning({
      id: `data.domain_redirects:${from}:${to}`,
      code: 'data.domain_redirects',
      severity: 'data',
      title: `${from} sends visitors to ${to}`,
      body: `Search engines rank the address people land on, so the pages, rankings and reports of ${from} would describe a website nobody sees. Track ${to} instead?`,
      short: `Redirects to ${to}`,
      confirm: `Add ${from} anyway`,
      accept: { label: `Add ${to} instead`, change: { kind: 'fields', set: { domain: to } } },
    }),
  ];
});

/** First in the registry: the new-ladder confirmation is the first thing a person reads. */
export const EARLY_CHECKS: readonly ConsistencyCheck[] = [NEW_LADDER];

/** Last in the registry, in the order shown. */
export const MORE_CHECKS: readonly ConsistencyCheck[] = [
  SAME_FAMILY,
  PAGE_EXISTS,
  LADDER_ADD,
  PAGE_OWNED,
  WATCH_DUP,
  MANUAL_PAGES_NOW,
  NOT_READY,
  CREDITS_RUNWAY,
  CADENCE,
  AUTOMATION,
  LADDER_QUEUED,
  AI_MARKET_DUP,
  INTEGRATIONS,
  REDIRECTS,
  RUN_BUSINESS,
  PROFILE_ADDRESS,
];

/** for tests and the type checker: the context fields these checks read */
export type MoreCtx = Pick<ConsistencyCtx, 'start' | 'livePages' | 'credits' | 'redirectTo' | 'companyDomains'>;
