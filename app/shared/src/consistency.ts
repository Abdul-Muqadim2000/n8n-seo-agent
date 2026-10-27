import type { ModeId } from './constants';
import type { PipelineData } from './data';
import { cycleNorm } from './cycles';
import { pipelineNotices, type NoticeFormat, type NoticeInput, type PipelineNotice } from './pipeline-notices';
import {
  countryOf,
  countryOfCode,
  domainCountryIso,
  domainEnding,
  englishReading,
  isSupportedIso,
  languageName,
  marketOfText,
  marketsNamed,
  placesIn,
  placesLabel,
  scriptOf,
  tzCountryIso,
} from './markets';

// ONE mechanism for "you are about to do something inconsistent" (n8n/seo-agent/docs/mismatch-audit-2026-10-27/AUDIT.md §2).
//
// The owner's rule: when a person (or an API caller, or an automatic start) is about to do something that contradicts what the system
// already knows, the system says so in plain words and offers two choices: **Accept** (the correction is applied) or **Continue anyway**
// (it goes ahead, and the choice is recorded on the run and in the audit log). Everything below is pure: the server builds the context
// (services/consistency.ts) and enforces it (409 `confirm_needed` until the warning ids come back in `acknowledge`); the web shows the
// same warnings live with the existing Callout + "... anyway" tick (PipelineNotices), and a dialog for a 409 from any request.
//
// To add a case: write a `ConsistencyCheck` (code, severity, the actions it runs on, `run`) and put it in CONSISTENCY_CHECKS. Nothing else.
// Ids are `<code>:<subject>`: what `acknowledge` names, stable for the same facts, new when the facts change (so a choice made about
// Pakistan vs the UAE does not silence a later Pakistan vs India).

export type WarningSeverity = 'money' | 'market' | 'data' | 'cosmetic';

/** What Accept does. Data, never code: the client (web, API caller, MCP assistant) applies it. */
export type WarningChange =
  /** rewrite the request's fields and send it again */
  | { kind: 'fields'; set: Record<string, unknown> }
  /** a call to make first (path is the app API's, absolute), then send the request again */
  | { kind: 'call'; method: 'POST' | 'PATCH'; path: string; body?: Record<string, unknown> }
  /** a page of the app where the person makes the correction (a tool form, a settings page) */
  | { kind: 'link'; tool?: ModeId; sitePage?: string };

export interface Warning extends PipelineNotice {
  /** the rule that fired, e.g. `market.run_country` */
  code: string;
  severity: WarningSeverity;
  /** title and body as one plain sentence (for API callers and logs) */
  message: string;
  /** the system's correction; absent when no correction is safe to apply for the person */
  accept?: { label: string; change: WarningChange };
}

/** Where a check can run: a run start, the paid keyword check, a website save, the website's standing state, AI question edits. */
export type ConsistencyAction = 'run' | 'keyword_check' | 'site_update' | 'site_standing' | 'ai_questions';

export interface ConsistencySite {
  domain: string;
  country: string;
  business?: string;
  customers?: string;
  businessFacts?: string;
  services?: readonly string[];
  cta?: string;
  timezone?: string;
}

export interface ConsistencyCtx {
  /** the website as stored (null: a run without a website, or a website being created) */
  site: ConsistencySite | null;
  /** '/api/orgs/<org>/sites/<site>': where an Accept's call goes */
  siteApi?: string;
  /** the website is tracked by the engine (weekly checks on) */
  tracked?: boolean;
  /** the engine's own row of the website (seo_sites): the market every weekly job reads */
  engine?: { country?: string; locationCode?: number | null; languageCode?: string } | null;
  /** the website's keyword ladders, with the market each one is measured in */
  ladders?: readonly { id: string; head: string; country: string }[];
  /** the country the keyword suggestions were researched in (latest keyword research) */
  research?: { country: string | null } | null;
  /** the AI question panel (active questions) */
  aiPrompts?: readonly { promptId: string; prompt: string; market?: string; status?: string }[];
  /** the pipeline data the forms' duplicate warnings read */
  pipeline?: PipelineData | null;
  pipelineOpts?: { now?: Date; fmt?: NoticeFormat; costLabel?: string };
}

export interface ConsistencyCheck {
  code: string;
  severity: WarningSeverity;
  on: readonly ConsistencyAction[];
  run: (action: ConsistencyAction, input: Record<string, unknown>, ctx: ConsistencyCtx) => Warning[];
}

// ---------------- helpers ----------------

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const q = (s: string) => `"${s}"`;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
/** a short, stable fingerprint of a list (for ids that must change when the list does) */
export function fingerprint(parts: readonly string[]): string {
  let h = 2166136261;
  for (const ch of [...parts].sort().join('|')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h.toString(36);
}

function warning(w: Omit<Warning, 'message' | 'tone'> & { tone?: Warning['tone'] }): Warning {
  const tone = w.tone ?? 'warning';
  return { ...w, tone, message: `${w.title}. ${w.body}` };
}

/** The keywords an action is about (a run's keyword, the keywords to watch, the keyword checked). */
function keywordsOf(action: ConsistencyAction, input: Record<string, unknown>): { keyword: string; field: 'keyword' | 'keywords' }[] {
  if (action === 'keyword_check') return str(input.keyword).trim() ? [{ keyword: str(input.keyword).trim(), field: 'keyword' }] : [];
  if (action !== 'run') return [];
  const mode = str(input.mode);
  if ((mode === 'keyword' || mode === 'ladder' || mode === 'verdict') && str(input.keyword).trim()) return [{ keyword: str(input.keyword).trim(), field: 'keyword' }];
  if (mode === 'track' && Array.isArray(input.keywords)) return input.keywords.map((k) => ({ keyword: str(k).trim(), field: 'keywords' as const })).filter((k) => k.keyword);
  return [];
}

/** The market a run measures: the country it is sent with, else the website's. */
const marketOf = (input: Record<string, unknown>, ctx: ConsistencyCtx) => countryOf(str(input.country)) ?? countryOf(ctx.site?.country);

/** Replaces one keyword of a list (the "keywords to watch" field). */
const replaced = (list: unknown, from: string, to: string): string[] =>
  (Array.isArray(list) ? list.map(str) : []).flatMap((k) => (k.trim() === from ? (to ? [to] : []) : [k]));

// ---------------- the checks ----------------

/** D6: the forms' own duplicate warnings (pipeline-notices.ts), unchanged ids and texts, now enforced for every start. */
const PIPELINE: ConsistencyCheck = {
  code: 'pipeline',
  severity: 'money',
  on: ['run'],
  run: (_a, input, ctx) =>
    pipelineNotices(str(input.mode) as ModeId, input as NoticeInput, ctx.pipeline, ctx.pipelineOpts).map((n) =>
      warning({
        ...n,
        code: `pipeline.${n.id.split(':')[0]}`,
        severity: n.tone === 'warning' ? 'money' : 'cosmetic',
        ...(n.usePlan ? { accept: { label: n.usePlan.label, change: { kind: 'fields', set: { pageType: n.usePlan.pageType, existingPageUrl: n.usePlan.existingPageUrl } } } } : {}),
      }),
    ),
};

/** M1: a run sent with a country that is not the website's. */
const RUN_COUNTRY: ConsistencyCheck = {
  code: 'market.run_country',
  severity: 'market',
  on: ['run', 'keyword_check'],
  run: (action, input, ctx) => {
    if (!ctx.site || (action === 'run' && str(input.mode) === 'profile')) return [];
    const mine = countryOf(ctx.site.country);
    const sent = countryOf(str(input.country));
    if (!mine || !sent || mine.iso === sent.iso) return [];
    const track = action === 'run' && str(input.mode) === 'track';
    return [
      warning({
        id: `market.run_country:${sent.iso}:${mine.iso}`,
        code: 'market.run_country',
        severity: 'market',
        title: `This runs for ${sent.name}, but your website's market is ${mine.name}`,
        body:
          `Rankings, search volumes and competitors are different in every country. Running this for ${sent.name} measures a market your website settings do not target` +
          (track
            ? `, and it moves every weekly check of ${ctx.site.domain} to ${sent.name}. If your buyers really are in ${sent.name}, change your main country in Business details instead.`
            : '.'),
        short: `Runs for ${sent.name}`,
        confirm: `Run it for ${sent.name} anyway`,
        accept: { label: `Use ${mine.name}`, change: { kind: 'fields', set: { country: mine.name } } },
      }),
    ];
  },
};

/** M4: a keyword that names a place outside the market (or a market the product cannot measure). */
const KEYWORD_PLACE: ConsistencyCheck = {
  code: 'market.keyword_place',
  severity: 'market',
  on: ['run', 'keyword_check'],
  run: (action, input, ctx) => {
    const market = marketOf(input, ctx);
    if (!market) return [];
    const out: Warning[] = [];
    for (const { keyword, field } of keywordsOf(action, input)) {
      const mk = marketOfText(keyword, market.iso);
      if (mk.ok) continue;
      const outside = mk.places.filter((p) => !p.iso.includes(market.iso));
      const unsupported = outside.every((p) => !p.iso.some(isSupportedIso));
      const code = unsupported ? 'market.keyword_unsupported' : 'market.keyword_place';
      const label = placesLabel(outside.map((p) => p.word));
      const fixed = mk.without && mk.without !== keyword.toLowerCase() && mk.without.length >= 2 ? mk.without : '';
      out.push(
        warning({
          id: `${code}:${cycleNorm(keyword)}:${market.iso}`,
          code,
          severity: 'market',
          title: `${q(keyword)} is a search about ${label}, not about ${market.name}`,
          body:
            `Your website's market is ${market.name}. A page for ${q(keyword)} competes for searchers in ${label}, and we measure it in ${market.name}, where few people search it.` +
            (unsupported ? ` We cannot measure rankings in ${label}, so this keyword's position cannot be tracked.` : ''),
          short: `About ${label}`,
          confirm: `Keep ${q(keyword)}`,
          ...(fixed
            ? { accept: { label: `Use ${q(fixed)}`, change: { kind: 'fields' as const, set: field === 'keywords' ? { keywords: replaced(input.keywords, keyword, fixed) } : { keyword: fixed } } } }
            : {}),
        }),
      );
    }
    return out;
  },
};

/** M8: a keyword in a script the market's searches are not read in. */
const KEYWORD_SCRIPT: ConsistencyCheck = {
  code: 'lang.script',
  severity: 'data',
  on: ['run', 'keyword_check'],
  run: (action, input, ctx) => {
    const market = marketOf(input, ctx);
    if (!market) return [];
    const out: Warning[] = [];
    for (const { keyword, field } of keywordsOf(action, input)) {
      const s = scriptOf(keyword);
      if (!s.script || s.langs.includes(market.lang)) continue;
      const english = s.script === 'arabic' ? englishReading(keyword) : '';
      out.push(
        warning({
          id: `lang.script:${cycleNorm(keyword)}:${market.lang}`,
          code: 'lang.script',
          severity: 'data',
          title: `${q(keyword)} is written in ${s.name}, but searches in ${market.name} are read in ${languageName(market.lang)}`,
          body: `Rankings for it would be checked on the ${languageName(market.lang)} results page of ${market.name}, where few people search it this way.${english ? ` In ${languageName(market.lang)} it reads ${q(english)}.` : ''}`,
          short: `Written in ${s.name}`,
          confirm: `Keep ${q(keyword)}`,
          ...(english
            ? { accept: { label: `Use ${q(english)}`, change: { kind: 'fields' as const, set: field === 'keywords' ? { keywords: replaced(input.keywords, keyword, english) } : { keyword: english } } } }
            : {}),
        }),
      );
    }
    return out;
  },
};

/** The website's text the market checks read (what it sells and to whom), the stored values with the request's changes on top. */
function siteText(input: Record<string, unknown>, site: ConsistencySite | null) {
  const pick = (k: keyof ConsistencySite) => (input[k] !== undefined ? input[k] : site?.[k]);
  const services = pick('services');
  return {
    country: str(pick('country')),
    domain: str(pick('domain')),
    timezone: str(pick('timezone')),
    parts: [
      { text: str(pick('business')), weight: 1 },
      { text: str(pick('customers')), weight: 2 },
      { text: Array.isArray(services) ? services.map(str).join('. ') : str(services), weight: 2 },
      { text: str(pick('businessFacts')), weight: 1 },
      { text: str(pick('cta')), weight: 1 },
    ],
  };
}

/** M5: the description names other markets than the main country. */
const BUSINESS_TEXT: ConsistencyCheck = {
  code: 'market.business_text',
  severity: 'market',
  on: ['site_update', 'site_standing'],
  run: (action, input, ctx) => {
    const t = siteText(action === 'site_update' ? input : {}, ctx.site);
    const mine = countryOf(t.country);
    if (!mine) return [];
    const places = t.parts.flatMap((p) => placesIn(p.text));
    if (!places.length || places.some((p) => p.iso.includes(mine.iso))) return [];
    const words = [...new Set(places.map((p) => p.word))];
    const best = marketsNamed(t.parts).map((m) => countryOf(m.iso)).find((c) => !!c);
    const label = placesLabel(words);
    const change: WarningChange | null = best
      ? action === 'site_update'
        ? { kind: 'fields', set: { country: best.name } }
        : ctx.siteApi
          ? { kind: 'call', method: 'PATCH', path: ctx.siteApi, body: { country: best.name } }
          : null
      : null;
    return [
      warning({
        id: `market.business_text:${mine.iso}:${fingerprint(words)}`,
        code: 'market.business_text',
        severity: 'market',
        title: `Your description talks about ${label}, but your main country is ${mine.name}`,
        body: `We measure rankings, search volumes and AI answers where your customers search. If your buyers are in ${best?.name ?? label}, choose it as your main country. If they are in ${mine.name}, update the description so pages and research speak to them.`,
        short: `Description is about ${label}`,
        confirm: `Keep ${mine.name}`,
        ...(change && best ? { accept: { label: `Make ${best.name} my main country`, change } } : {}),
      }),
    ];
  },
};

/** M5 (info): the address ending or the time zone names another country. */
const OTHER_SIGNALS: ConsistencyCheck = {
  code: 'market.signals',
  severity: 'cosmetic',
  on: ['site_update', 'site_standing'],
  run: (action, input, ctx) => {
    const t = siteText(action === 'site_update' ? input : {}, ctx.site);
    const mine = countryOf(t.country);
    if (!mine) return [];
    const out: Warning[] = [];
    const tld = countryOf(domainCountryIso(t.domain || ctx.site?.domain));
    if (tld && tld.iso !== mine.iso)
      out.push(
        warning({
          id: `market.domain_ending:${tld.iso}:${mine.iso}`,
          code: 'market.domain_ending',
          severity: 'cosmetic',
          tone: 'info',
          title: `Your address ends in .${domainEnding(t.domain || ctx.site?.domain)}, an address of ${tld.name}`,
          body: `Your main country is ${mine.name}. Search engines link a country ending with that country, which is fine when you also serve ${tld.name}. Check that your main country is where your buyers are.`,
          short: `Address of ${tld.name}`,
        }),
      );
    const tz = countryOf(tzCountryIso(t.timezone));
    if (tz && tz.iso !== mine.iso)
      out.push(
        warning({
          id: `market.timezone:${tz.iso}:${mine.iso}`,
          code: 'market.timezone',
          severity: 'cosmetic',
          tone: 'info',
          title: `Your time zone is in ${tz.name}, your main country is ${mine.name}`,
          body: `Weekly checks run at 06:00 in your time zone, wherever your market is. This is only a reminder to check that ${mine.name} is where your buyers are.`,
          short: `Time zone of ${tz.name}`,
        }),
      );
    return out;
  },
};

/** M2 (on save): the main country changes; what moves with it and what stays. */
const COUNTRY_CHANGE: ConsistencyCheck = {
  code: 'market.country_change',
  severity: 'market',
  on: ['site_update'],
  run: (_a, input, ctx) => {
    const before = countryOf(ctx.site?.country);
    const after = countryOf(str(input.country));
    if (!ctx.site || !before || !after || before.iso === after.iso || !ctx.tracked) return [];
    const ladders = (ctx.ladders ?? []).filter((l) => countryOf(l.country)?.iso === before.iso);
    return [
      warning({
        id: `market.country_change:${before.iso}:${after.iso}`,
        code: 'market.country_change',
        severity: 'market',
        tone: 'info',
        title: `Your weekly checks move to ${after.name}`,
        body:
          `Changing your main country to ${after.name} also moves your weekly report, rank checks, AI questions and weekly pages to ${after.name}.` +
          (ladders.length ? ` Your ${plural(ladders.length, 'keyword ladder')} keep ${before.name} until you move them.` : '') +
          ` What was measured in ${before.name} stays in your history, and a new baseline starts with the next weekly check.`,
        short: `Moves to ${after.name}`,
      }),
    ];
  },
};

/** M2: the engine still measures the website in another country (a country change that never reached it, tracking saved elsewhere). */
const ENGINE_DRIFT: ConsistencyCheck = {
  code: 'market.engine_drift',
  severity: 'market',
  on: ['site_standing'],
  run: (_a, _input, ctx) => {
    const mine = countryOf(ctx.site?.country);
    const e = ctx.engine;
    if (!mine || !e) return [];
    const theirs = countryOfCode(e.locationCode) ?? countryOf(e.country);
    if (!theirs || theirs.iso === mine.iso) return [];
    return [
      warning({
        id: `market.engine_drift:${theirs.iso}:${mine.iso}`,
        code: 'market.engine_drift',
        severity: 'market',
        title: `Your weekly checks still measure ${theirs.name}`,
        body:
          `Your website's main country is ${mine.name}, but the weekly report, rank checks, AI answers and weekly pages are still measured for ${theirs.name}. ` +
          `Update them so every check uses your market. What was measured in ${theirs.name} stays in your history, and a new baseline starts with the next weekly check.`,
        short: `Measures ${theirs.name}`,
        confirm: `Keep measuring ${theirs.name}`,
        ...(ctx.siteApi ? { accept: { label: `Measure in ${mine.name}`, change: { kind: 'call' as const, method: 'POST' as const, path: `${ctx.siteApi}/market/sync` } } } : {}),
      }),
    ];
  },
};

/** M3: a keyword ladder measured in another country than the website. */
const LADDER_COUNTRY: ConsistencyCheck = {
  code: 'market.ladder_country',
  severity: 'market',
  on: ['site_standing'],
  run: (_a, _input, ctx) => {
    const mine = countryOf(ctx.site?.country);
    if (!mine) return [];
    return (ctx.ladders ?? []).flatMap((l) => {
      const theirs = countryOf(l.country);
      if (!theirs || theirs.iso === mine.iso) return [];
      return [
        warning({
          id: `market.ladder_country:${l.id}:${theirs.iso}:${mine.iso}`,
          code: 'market.ladder_country',
          severity: 'market',
          title: `Your ladder ${q(l.head)} is tracked in ${theirs.name}, not in ${mine.name}`,
          body: `Its pages are written and ranked for searchers in ${theirs.name}. If you move it to ${mine.name}, its ranking history starts again from the next weekly check; what was measured in ${theirs.name} stays in its history.`,
          short: `Ladder in ${theirs.name}`,
          confirm: `Keep ${theirs.name} for this ladder`,
          ...(ctx.siteApi ? { accept: { label: `Move this ladder to ${mine.name}`, change: { kind: 'call' as const, method: 'POST' as const, path: `${ctx.siteApi}/ladders/${l.id}/market` } } } : {}),
        }),
      ];
    });
  },
};

/** M6: the keyword suggestions were researched in another country. */
const RESEARCH_COUNTRY: ConsistencyCheck = {
  code: 'market.research_country',
  severity: 'market',
  on: ['site_standing'],
  run: (_a, _input, ctx) => {
    const mine = countryOf(ctx.site?.country);
    const theirs = countryOf(ctx.research?.country);
    if (!mine || !theirs || theirs.iso === mine.iso) return [];
    return [
      warning({
        id: `market.research_country:${theirs.iso}:${mine.iso}`,
        code: 'market.research_country',
        severity: 'market',
        title: `Your keyword suggestions were researched for ${theirs.name}`,
        body: `Your main country is ${mine.name}, so their search volumes and chances are for the wrong country. A new ladder always runs in ${mine.name}, whatever the suggestion says.`,
        short: `Suggestions for ${theirs.name}`,
        confirm: `Use these suggestions anyway`,
        accept: { label: `Find fresh keywords for ${mine.name}`, change: { kind: 'link', tool: 'discover' } },
      }),
    ];
  },
};

/** M7: AI questions that ask about other places than the website's market. */
const AI_QUESTION_PLACE: ConsistencyCheck = {
  code: 'ai.question_place',
  severity: 'market',
  on: ['site_standing', 'ai_questions'],
  run: (action, input, ctx) => {
    const mine = countryOf(ctx.site?.country);
    if (!mine) return [];
    if (action === 'ai_questions') {
      // new questions: each one that asks about another market, Accept = leave it out of what is added
      const add = (Array.isArray(input.add) ? input.add : []).map((x) => (x && typeof x === 'object' ? str((x as { prompt?: unknown }).prompt) : str(x)));
      return add.flatMap((text, i) => {
        const mk = marketOfText(text, mine.iso);
        if (mk.ok) return [];
        const label = placesLabel(mk.outside);
        const rest = (input.add as unknown[]).filter((_x, j) => j !== i);
        return [
          warning({
            id: `ai.question_place:${cycleNorm(text).slice(0, 80)}:${mine.iso}`,
            code: 'ai.question_place',
            severity: 'market',
            title: `${q(text)} asks about ${label}; your market is ${mine.name}`,
            body: `AI answers about ${label} name the companies buyers there choose. Your visibility is measured for buyers in ${mine.name}.`,
            short: `Asks about ${label}`,
            confirm: 'Add it anyway',
            accept: { label: 'Leave this question out', change: { kind: 'fields', set: { add: rest } } },
          }),
        ];
      });
    }
    const off = (ctx.aiPrompts ?? [])
      .filter((p) => !p.status || p.status === 'active')
      .map((p) => ({ p, mk: marketOfText(p.prompt, mine.iso) }))
      .filter((x) => !x.mk.ok);
    if (!off.length) return [];
    const label = placesLabel(off.flatMap((x) => x.mk.outside));
    const ids = off.map((x) => x.p.promptId);
    const examples = off.slice(0, 2).map((x) => q(x.p.prompt)).join(' and ');
    return [
      warning({
        id: `ai.question_place:${mine.iso}:${fingerprint(ids)}`,
        code: 'ai.question_place',
        severity: 'market',
        title: `${plural(off.length, 'AI question')} ${off.length === 1 ? 'asks' : 'ask'} about ${label}, not about ${mine.name}`,
        body: `For example ${examples}. Your market is ${mine.name}, so these answers measure companies buyers elsewhere choose. Switch them off and the next weekly AI check writes new questions for ${mine.name}.`,
        short: `${plural(off.length, 'question')} about ${label}`,
        confirm: 'Keep these questions',
        ...(ctx.siteApi ? { accept: { label: `Switch ${off.length === 1 ? 'it' : 'them'} off and write new ones`, change: { kind: 'call' as const, method: 'POST' as const, path: `${ctx.siteApi}/admin`, body: { action: 'ai_prompts', remove: ids } } } } : {}),
      }),
    ];
  },
};

/** Every check, in the order the warnings are shown. A new case is one more entry here. */
export const CONSISTENCY_CHECKS: readonly ConsistencyCheck[] = [
  RUN_COUNTRY,
  KEYWORD_PLACE,
  KEYWORD_SCRIPT,
  BUSINESS_TEXT,
  COUNTRY_CHANGE,
  ENGINE_DRIFT,
  LADDER_COUNTRY,
  RESEARCH_COUNTRY,
  AI_QUESTION_PLACE,
  OTHER_SIGNALS,
  PIPELINE,
];

/** The warnings an action raises, warnings before information. */
export function consistencyWarnings(action: ConsistencyAction, input: Record<string, unknown>, ctx: ConsistencyCtx): Warning[] {
  const out: Warning[] = [];
  const seen = new Set<string>();
  for (const c of CONSISTENCY_CHECKS) {
    if (!c.on.includes(action)) continue;
    for (const w of c.run(action, input, ctx))
      if (!seen.has(w.id)) {
        seen.add(w.id);
        out.push(w);
      }
  }
  return out.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === 'warning' ? -1 : 1));
}

/** Warnings that hold the action until they are answered: a warning tone with a "... anyway" choice, not named in `acknowledged`. */
export const needsAcknowledge = <W extends PipelineNotice>(warnings: readonly W[], acknowledged: readonly string[] = []): W[] =>
  warnings.filter((w) => w.tone === 'warning' && !!w.confirm && !acknowledged.includes(w.id));

/** The codes of the warnings a caller continued past (for the run and the audit log). */
export function overriddenCodes(warnings: readonly Warning[], acknowledged: readonly string[]): { ids: string[]; codes: string[] } {
  const hit = warnings.filter((w) => w.tone === 'warning' && acknowledged.includes(w.id));
  return { ids: hit.map((w) => w.id), codes: [...new Set(hit.map((w) => w.code))] };
}

/** Severities an automatic start never continues past (it becomes a "Needs you" item instead). */
export const AUTO_STOP_SEVERITIES: readonly WarningSeverity[] = ['money', 'market', 'data'];

/** The 409 body every path answers with (the API's `confirm_needed`): `notices` (the old name) and `warnings` are the same list. */
export interface ConfirmNeeded {
  notices: Warning[];
  warnings: Warning[];
  needsAcknowledge: string[];
}
export const confirmNeededBody = (warnings: Warning[], open: readonly Warning[]): ConfirmNeeded => ({ notices: warnings, warnings, needsAcknowledge: open.map((w) => w.id) });
