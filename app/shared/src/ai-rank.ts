// AI ranking (AIR, 2026-11-06, n8n/seo-agent/docs/ai-ranking-2026-11-05/DESIGN.md §2.F, §2.H, §4.1, §6.7; CONTRACTS.md §2.1, §3.1):
// the app's side of the engine's AI-ranking plan. One website at a time is switched off / shadow (a private trial: the plan is computed and
// logged, nothing a client sees changes) / on (the plan acts through the existing rails). This file holds:
//  * the settings parse, rule for rule the engine's AIRF.settingsOf (v5/code/_ai_rank_flags.js): empty or junk = off, false, 0, false, false;
//  * the Site Admin `monitors` body for the five settings (only the fields given; '' clears one);
//  * the readers of what the engine stores (seo_ai_rank_runs, seo_ai_rank_actions) and of the additive `ai_rank` key of the ai_growth
//    callback, each tolerant of a missing or older shape (a reader never throws on an engine from before AIR);
//  * the client words (no internal names: the client reads "AI ranking", never the engine's ids).

import { aiRankClientCredits, aiRankClientOf, aiRankClientView, aiRankPlain, type AiRankClientView } from './ai-rank-client';

/** The three modes, in the engine's words. 'shadow' is shown to clients as "Trial". */
export const AI_RANK_MODES = ['off', 'shadow', 'on'] as const;
export type AiRankMode = (typeof AI_RANK_MODES)[number];

export interface AiRankSettings {
  mode: AiRankMode;
  /** the reserved AI answer page slot (on top of the keyword pages, inside the AI pages a month) */
  reserve: boolean;
  /** fan-out searches read a week (0-50, a paid read, platform admins only) */
  fanoutN: number;
  /** the monthly AI mention database read (paid, platform admins only) */
  mentions: boolean;
  /** the independent search index read (keyed, platform admins only) */
  brave: boolean;
}

const S = (v: unknown) => (v == null ? '' : String(v)).trim();
const flag = (v: unknown) => v === true || /^(true|1|yes|on)$/i.test(S(v));

/** seo_monitors row -> the settings (AIRF.settingsOf, field for field). */
export function aiRankSettingsOf(row: Record<string, unknown> | null | undefined): AiRankSettings {
  const r = row ?? {};
  const m = S(r.ai_rank_mode).toLowerCase();
  const n = Number(r.ai_rank_fanout_n);
  return {
    mode: (AI_RANK_MODES as readonly string[]).includes(m) ? (m as AiRankMode) : 'off',
    reserve: flag(r.ai_rank_reserve),
    fanoutN: S(r.ai_rank_fanout_n) === '' || !Number.isFinite(n) ? 0 : Math.min(50, Math.max(0, Math.round(n))),
    mentions: flag(r.ai_rank_mentions),
    brave: flag(r.ai_rank_brave),
  };
}

/** What a person may change (the admin action's `aiRank`): only the fields given are sent. */
export interface AiRankSettingsInput {
  mode?: AiRankMode;
  reserve?: boolean;
  fanoutN?: number;
  mentions?: boolean;
  brave?: boolean;
}

/** The fields only platform admins may change: each one buys an outside reading. */
export const AI_RANK_PAID_FIELDS = ['fanoutN', 'mentions', 'brave'] as const;
export const aiRankPaidChange = (a: AiRankSettingsInput | null | undefined): boolean => !!a && AI_RANK_PAID_FIELDS.some((k) => a[k] !== undefined);

/** The Site Admin `monitors` fields for the settings given (the engine's AIRF.validate takes exactly these names). */
export function aiRankBody(a: AiRankSettingsInput | null | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!a) return out;
  if (a.mode !== undefined) out.ai_rank_mode = a.mode;
  if (a.reserve !== undefined) out.ai_rank_reserve = a.reserve;
  if (a.fanoutN !== undefined) out.ai_rank_fanout_n = a.fanoutN;
  if (a.mentions !== undefined) out.ai_rank_mentions = a.mentions;
  if (a.brave !== undefined) out.ai_rank_brave = a.brave;
  return out;
}

/** The reserved slot: about two AI answer pages a month, inside the AI pages allowance (owner decision 2026-11-06, ~$1.60 a site a month). */
export const AI_RANK_RESERVE_PAGES_MONTH = 2;
export const AI_RANK_RESERVE_USD_MONTH = 1.6;

/** The client words for each mode (plain, no internal names). */
export const AI_RANK_MODE_TEXT: Record<AiRankMode, { label: string; text: string }> = {
  off: { label: 'Off', text: 'Nothing changes. Your AI visibility and AI growth work as they do today.' },
  shadow: {
    label: 'Trial',
    text: 'We work out a plan for getting you named in AI answers every week and keep it private. Nothing on your website, in your reports or in your plan changes. We use the trial to check the plan before it acts.',
  },
  on: {
    label: 'On',
    text: 'We act on the plan: an AI answer page in the reserved slot if you turn it on, placements on the lists and directories AI answers cite in Link building, steps on your website, and a weekly plan with what changed and why in your AI growth report.',
  },
};

/** The engine's lever names (v5/code/_ai_rank_learn.js LEVERS), as the client reads them. */
export const AI_RANK_LEVER_LABELS: Record<string, string> = {
  L01: 'Let AI assistants read your website',
  L02: 'Put the page text in the page itself, not only in scripts',
  L03: 'Add your website to Bing Webmaster Tools',
  L04: 'Get the page into Google',
  L05: 'A new page that answers the question',
  L06: 'Refresh the page that ranks for the question',
  L07: 'Name your business in the passage AI answers quote',
  L08: 'Get onto a list that AI answers cite',
  L09: 'A profile on a directory that AI answers cite',
  L10: 'A registry or partner listing you qualify for',
  L11: 'Be mentioned in the press, by a partner or a customer',
  L12: 'A LinkedIn article by a named person',
  L13: 'An answer in a community, saying who you are',
  L14: 'A short video that answers the question',
  L15: 'Correct a wrong claim about your business',
  L16: 'Keep a page AI answers cite, and refresh it when they stop',
  L17: 'A Wikidata entry for your business',
};
export const aiRankLeverLabel = (lever: string): string => AI_RANK_LEVER_LABELS[S(lever)] ?? 'A step to get you named in AI answers';

/** The setup guide each human step opens ("Show me how"). */
export const AI_RANK_GUIDE_OF_LEVER: Record<string, string> = {
  L01: 'ai-crawler-access',
  L02: 'ai-rank-raw-html',
  L03: 'bing-webmaster',
  L04: 'index-coverage',
  L07: 'ai-rank-passage',
  L09: 'ai-rank-directory-profile',
  L10: 'ai-rank-directory-profile',
  L11: 'ai-rank-earned-mention',
  L12: 'ai-rank-earned-mention',
  L13: 'ai-rank-earned-mention',
  L14: 'ai-rank-earned-mention',
  L17: 'ai-rank-wikidata',
};
export const aiRankGuideOf = (lever: string): string => AI_RANK_GUIDE_OF_LEVER[S(lever)] ?? 'ai-rank-earned-mention';

export type AiRankExecutor = 'auto' | 'approve' | 'human';
export type AiRankActionStatus = 'shadow' | 'proposed' | 'queued' | 'in_progress' | 'done' | 'verified' | 'not_happened' | 'expired' | 'refused';
export const AI_RANK_STATUS_TEXT: Record<AiRankActionStatus, string> = {
  shadow: 'Trial only',
  proposed: 'Proposed',
  queued: 'Queued',
  in_progress: 'In progress',
  done: 'Done',
  verified: 'Confirmed',
  not_happened: 'Did not happen',
  expired: 'Expired',
  refused: 'Not done',
};
export const aiRankStatusText = (s: string): string => AI_RANK_STATUS_TEXT[S(s) as AiRankActionStatus] ?? (S(s) || 'Unknown');
export const AI_RANK_EXECUTOR_TEXT: Record<AiRankExecutor, string> = { auto: 'We do it', approve: 'You approve, we do it', human: 'You do it' };

export interface AiRankFigure { name: string; value: string; basis: string }
export interface AiRankMemoLine { text: string; figures: AiRankFigure[] }
export interface AiRankMemoPart { key: string; title: string; lines: AiRankMemoLine[] }
export interface AiRankBlocker { what: string; owner: string; since: string; blocks: string }
export interface AiRankMemo { v: number; ruleVersion: string; mode: AiRankMode; parts: AiRankMemoPart[]; blockers: AiRankBlocker[] }

export interface AiRankActionView {
  actionId: string;
  lever: string;
  label: string;
  executor: AiRankExecutor;
  status: string;
  sink: string;
  scope: string;
  questions: string[];
  engines: string[];
  targetStage: string;
  why: string;
  url: string;
}

export interface AiRankStep {
  /** `ai_rank:<lever>:<refKey>` */
  key: string;
  lever: string;
  label: string;
  what: string;
  why: string;
  check: string;
  url: string;
  actionId: string;
  status: string;
}

export interface AiRankCompare { overlap: number | null; gainAir: number | null; gainOld: number | null; note: string }

/** The additive `ai_rank` key of an ai_growth callback (on sites only), read for the report and the site tasks. */
export interface AiRankReport {
  v: number;
  mode: AiRankMode;
  runId: string;
  checkedAt: string;
  ruleVersion: string;
  /** FX-C RC-1: the plan in the client's words (engine v 2); null from an engine before it */
  client: AiRankClientView | null;
  /** the owner's raw memo: null for every customer (clientSafePayload removes it; an engine from v 2 never sends it) */
  memo: AiRankMemo | null;
  actions: AiRankActionView[];
  steps: AiRankStep[];
  /** provider cost: never served to a customer (null) */
  cost: { usd: number; basis: string } | null;
  compare: AiRankCompare | null;
  counts: { core: number; chosen: number; deferred: number; refused: number; open: number };
  reserve: boolean;
}

type P = Record<string, unknown>;
const obj = (v: unknown): P => (v && typeof v === 'object' && !Array.isArray(v) ? (v as P) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const objs = (v: unknown): P[] => arr(v).filter((x): x is P => !!x && typeof x === 'object' && !Array.isArray(x));
const strs = (v: unknown): string[] => arr(v).map((x) => S(x)).filter(Boolean);
const numOrNull = (v: unknown): number | null => (v === null || v === undefined || S(v) === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const num = (v: unknown): number => Number(v) || 0;
/** A JSON column: an object or array as stored, or a string the engine wrote. Anything unreadable is `d`. */
export function jsonOf<T>(v: unknown, d: T): T {
  if (v && typeof v === 'object') return v as T;
  const s = S(v);
  if (!s) return d;
  try {
    const x = JSON.parse(s);
    return x == null ? d : (x as T);
  } catch {
    return d;
  }
}
const modeOf = (v: unknown): AiRankMode => {
  const m = S(v).toLowerCase();
  return (AI_RANK_MODES as readonly string[]).includes(m) ? (m as AiRankMode) : 'off';
};
const execOf = (v: unknown): AiRankExecutor => (S(v) === 'auto' || S(v) === 'approve' ? (S(v) as AiRankExecutor) : 'human');

/** ARL.memo (stored as memo_json or carried in the callback) -> the memo; null when there is none. */
export function aiRankMemoOf(v: unknown): AiRankMemo | null {
  const m = obj(jsonOf<unknown>(v, null));
  const parts = objs(m.parts)
    .map((p) => ({
      key: S(p.key),
      title: S(p.title),
      lines: objs(p.lines)
        .map((l) => ({ text: S(l.text), figures: objs(l.figures).map((f) => ({ name: S(f.name), value: S(f.value), basis: S(f.basis) })).filter((f) => f.name || f.value) }))
        .filter((l) => l.text),
    }))
    .filter((p) => p.key || p.title);
  if (!parts.length) return null;
  return {
    v: num(m.v) || 1,
    ruleVersion: S(m.rule_version),
    mode: modeOf(m.mode),
    parts,
    blockers: objs(m.blockers).map((b) => ({ what: S(b.what), owner: S(b.owner) || 'client', since: S(b.since).slice(0, 10), blocks: S(b.blocks) })).filter((b) => b.what),
  };
}

const refUrl = (ref: unknown): string => S(obj(jsonOf<unknown>(ref, {})).url);

/** One chosen / stored action (the callback's `actions`, chosen_json, or a seo_ai_rank_actions row) -> the view. */
export function aiRankActionOf(a: P): AiRankActionView {
  const lever = S(a.lever);
  const qs = jsonOf<unknown>(a.questions, []);
  return {
    actionId: S(a.action_id ?? a.actionId),
    lever,
    // RC-14 (review C, 2026-11-06): the client's words for a known lever win over the engine's own label
    label: AI_RANK_LEVER_LABELS[lever] ?? (S(a.label) || aiRankLeverLabel(lever)),
    executor: execOf(a.executor),
    status: S(a.status),
    sink: S(a.sink),
    scope: S(a.scope),
    questions: strs(qs),
    engines: strs(jsonOf<unknown>(a.engines, [])),
    targetStage: S(a.target_stage ?? a.targetStage),
    why: S(a.why),
    url: S(a.url) || refUrl(a.ref),
  };
}

/** The `ai_rank` key of an ai_growth callback payload. Null when absent (an off or shadow site, an engine from before AIR). */
export function aiRankReportOf(payload: unknown): AiRankReport | null {
  const p = obj(payload);
  if (!p.ai_rank || typeof p.ai_rank !== 'object') return null;
  const r = obj(p.ai_rank);
  const c = obj(r.counts);
  const cost = r.cost && typeof r.cost === 'object' ? obj(r.cost) : null;
  const cmp = r.compare && typeof r.compare === 'object' ? obj(r.compare) : null;
  return {
    v: num(r.v) || 1,
    mode: modeOf(r.mode),
    runId: S(r.run_id),
    checkedAt: S(r.checked_at),
    ruleVersion: S(r.rule_version),
    client: aiRankClientOf(r.client),
    memo: aiRankMemoOf(r.memo),
    actions: objs(r.actions).slice(0, 20).map(aiRankActionOf),
    steps: objs(r.steps)
      .slice(0, 8)
      .map((x) => ({
        key: S(x.key),
        lever: S(x.lever),
        label: AI_RANK_LEVER_LABELS[S(x.lever)] ?? (S(x.label) || aiRankLeverLabel(S(x.lever))),   // RC-14: the client words for the lever first
        what: S(x.what),
        why: S(x.why),
        check: S(x.check),
        url: S(x.url),
        actionId: S(x.action_id ?? x.actionId),
        status: S(x.status),
      }))
      .filter((x) => /^ai_rank:/.test(x.key)),
    cost: cost ? { usd: num(cost.usd), basis: S(cost.basis) } : null,
    compare: cmp ? { overlap: numOrNull(cmp.overlap), gainAir: numOrNull(cmp.gain_air), gainOld: numOrNull(cmp.gain_old), note: S(cmp.note) } : null,
    counts: { core: num(c.core), chosen: num(c.chosen), deferred: num(c.deferred), refused: num(c.refused), open: num(c.open) },
    reserve: r.reserve === true,
  };
}

/** The AI visibility page's AI ranking plan (an `on` site's newest run). */
export interface AiRankPlanData {
  checkedAt: string;
  runId: string;
  /** FX-C RC-1: the weekly note in the client's words, credits instead of money */
  client: AiRankClientView | null;
  /** the owner's raw memo: platform admins only (null for everyone else) */
  memo: AiRankMemo | null;
  actions: AiRankActionView[];
  /** provider cost of the plan's readings: platform admins only (null for everyone else) */
  cost: { usd: number; basis: string } | null;
  settings: AiRankSettings;
}

/** How the plan is read for one viewer: question texts by id, the credit rate, and whether the viewer is a platform admin. */
export interface AiRankPlanOptions {
  question?: (promptId: string) => string;
  /** credits per US dollar of provider cost (billing.ts creditRate); null: no credits shown */
  creditRate?: number | null;
  /** a platform admin also gets the raw memo and the provider cost */
  admin?: boolean;
}

/** A seo_ai_rank_runs row in the shape the app reads (every column optional: an older engine has none). */
export interface AiRankRunRow {
  site_id?: string; domain?: string; run_id?: string; checked_at?: string; mode?: string; rule_version?: string;
  chosen_json?: unknown; old_json?: unknown; compare_json?: unknown; memo_json?: unknown; cost_json?: unknown; error?: string;
}
/** A seo_ai_rank_actions row in the shape the app reads. */
export interface AiRankActionRow {
  action_id?: string; site_id?: string; domain?: string; lever?: string; executor?: string; scope?: string; ref?: unknown; questions?: unknown;
  engines?: unknown; target_stage?: string; status?: string; sink?: string; sink_ref?: string; happened_at?: string; mode?: string; run_id?: string;
  created_at?: string; updated_at?: string;
}

const OPEN = new Set(['proposed', 'queued', 'in_progress']);

/** The plan of the newest `on` run of a website, with its open actions (null: no `on` run on record). */
export function aiRankPlanOf(runs: AiRankRunRow[], actions: AiRankActionRow[], settings: AiRankSettings, opts: AiRankPlanOptions = {}): AiRankPlanData | null {
  const run = [...runs].filter((r) => modeOf(r.mode) === 'on' && S(r.checked_at)).sort((a, b) => S(b.checked_at).localeCompare(S(a.checked_at)))[0];
  if (!run) return null;
  const chosen = objs(jsonOf<unknown>(run.chosen_json, [])).map(aiRankActionOf);
  const byId = new Map(actions.map((a) => [S(a.action_id), a]));
  const shown = chosen.map((a) => ({ ...a, status: S(byId.get(a.actionId)?.status) || a.status }));
  const extra = actions.filter((a) => modeOf(a.mode) === 'on' && OPEN.has(S(a.status)) && !chosen.some((c) => c.actionId === S(a.action_id))).map((a) => aiRankActionOf(a as P));
  const cost = obj(jsonOf<unknown>(run.cost_json, {}));
  const q = opts.question ?? (() => '');
  const listed = [...shown, ...extra].slice(0, 20).map((a) => ({
    ...a,
    // FX-C RC-1: the stored rows name questions by id; a customer reads the question text or nothing, and a why without ids or figures
    questions: a.questions.map((x) => (/\s/.test(x) ? x : q(x))).filter(Boolean),
    why: opts.admin ? a.why : aiRankPlain(a.why),
  }));
  const shownToViewer = opts.admin ? listed : listed.map((a) => ({ ...a, actionId: '', targetStage: '' }));   // no internal id or stage code for a customer
  const leverOf = new Map([...chosen, ...actions.map((a) => aiRankActionOf(a as P))].map((a) => [a.actionId, a.lever]));
  const raw = jsonOf<unknown>(run.memo_json, null);
  const client = raw ? aiRankClientCredits(aiRankClientView(raw, { question: q, leverOf: (id) => leverOf.get(id) ?? '', actions: listed }), opts.creditRate ?? null) : null;
  return {
    checkedAt: S(run.checked_at),
    runId: S(run.run_id),
    client: client && client.sections.length ? client : null,
    memo: opts.admin ? aiRankMemoOf(run.memo_json) : null,
    actions: shownToViewer,
    cost: opts.admin && S(cost.usd) !== '' ? { usd: num(cost.usd), basis: S(cost.basis) } : null,
    settings,
  };
}

/** One week of the platform admin's shadow comparison. */
export interface AiRankShadowWeek {
  checkedAt: string;
  runId: string;
  mode: AiRankMode;
  error: string;
  air: AiRankActionView[];
  old: { targets: { question: string; kind: string; pageUrl: string }[]; earned: string[]; actions: string[] };
  compare: AiRankCompare | null;
  memo: AiRankMemo | null;
}

/** seo_ai_rank_runs rows -> the shadow comparison, newest first (max 8 weeks). */
export function aiRankShadowOf(runs: AiRankRunRow[]): AiRankShadowWeek[] {
  return [...runs]
    .filter((r) => S(r.checked_at))
    .sort((a, b) => S(b.checked_at).localeCompare(S(a.checked_at)))
    .slice(0, 8)
    .map((r) => {
      const old = obj(jsonOf<unknown>(r.old_json, {}));
      const cmp = jsonOf<unknown>(r.compare_json, null);
      const c = cmp && typeof cmp === 'object' ? obj(cmp) : null;
      return {
        checkedAt: S(r.checked_at),
        runId: S(r.run_id),
        mode: modeOf(r.mode),
        error: S(r.error),
        air: objs(jsonOf<unknown>(r.chosen_json, [])).slice(0, 20).map(aiRankActionOf),
        old: {
          targets: objs(old.targets).slice(0, 10).map((t) => ({ question: S(t.question), kind: S(t.kind), pageUrl: S(t.page_url) })),
          earned: objs(old.earned).slice(0, 10).map((e) => S(e.url ?? e.host ?? e.title)).filter(Boolean),
          actions: objs(old.actions).slice(0, 10).map((a) => S(a.action)).filter(Boolean),
        },
        compare: c ? { overlap: numOrNull(c.overlap), gainAir: numOrNull(c.gain_air), gainOld: numOrNull(c.gain_old), note: S(c.note) } : null,
        memo: aiRankMemoOf(r.memo_json),
      };
    });
}

/** The monthly export ask: the key of this month's step. */
export const aiExportTaskKey = (month: string): string => `ai_export:${month}`;

// ---------------------------------------------------------------------------------------------------------------------------
// RC-4 (review C, 2026-11-06): who may switch AI ranking on
// ---------------------------------------------------------------------------------------------------------------------------

/**
 * The owner's switch for the trial period (DESIGN.md §4.4, §6.7): while it is false, only platform admins set a website to Trial or On and
 * change the reserved slot; company owners and admins see the state read-only. The owner flips it once the shadow gate is passed and On is
 * offered to clients (one constant, read by the server's Site Admin route and by the settings card).
 */
export const AI_RANK_OPEN_TO_CLIENTS = false;

/** The fields that switch AI ranking itself (the mode and the reserved slot); the paid readings are AI_RANK_PAID_FIELDS. */
export const AI_RANK_MODE_FIELDS = ['mode', 'reserve'] as const;
export const aiRankModeChange = (a: AiRankSettingsInput | null | undefined): boolean => !!a && AI_RANK_MODE_FIELDS.some((k) => a[k] !== undefined);

/** May this person change these AI ranking settings? (paid readings: platform admins only; mode and reserve: platform admins only until the owner opens it) */
export function aiRankMayChange(a: AiRankSettingsInput | null | undefined, platformAdmin: boolean): boolean {
  if (platformAdmin) return true;
  if (aiRankPaidChange(a)) return false;
  return AI_RANK_OPEN_TO_CLIENTS || !aiRankModeChange(a);
}

/** The state a company person who is not a platform admin is shown: the trial changes nothing they see, so it reads as Off. */
export const aiRankClientMode = (m: AiRankMode): 'on' | 'off' => (m === 'on' ? 'on' : 'off');
export const AI_RANK_ROLLOUT_NOTE = 'AI ranking is rolling out to selected websites. Ask us if you would like it for this one.';

// ---------------------------------------------------------------------------------------------------------------------------
// RC-3 (review C, 2026-11-06): the steps whose check needs an address the client gives us
// ---------------------------------------------------------------------------------------------------------------------------

/** Levers checked only on an address the client pastes on the step (the article, the post, the video, the corrected page, the Wikidata item). */
export const AI_RANK_ADDRESS_REQUIRED: readonly string[] = ['L11', 'L12', 'L13', 'L14', 'L15', 'L17'];
/** Levers the weekly check can confirm on its own (the listing is found), or sooner on the profile address the client gives. */
export const AI_RANK_ADDRESS_OPTIONAL: readonly string[] = ['L09', 'L10'];
export function aiRankAddressNeed(lever: string): 'required' | 'optional' | null {
  const l = S(lever);
  return AI_RANK_ADDRESS_REQUIRED.includes(l) ? 'required' : AI_RANK_ADDRESS_OPTIONAL.includes(l) ? 'optional' : null;
}
/** The label of the address field, per lever. */
export const AI_RANK_ADDRESS_LABEL: Record<string, string> = {
  L09: 'Your profile address on the directory',
  L10: 'Your listing address',
  L11: 'The address of the page that mentions you',
  L12: 'The address of your LinkedIn article',
  L13: 'The address of your answer',
  L14: 'The address of your video',
  L15: 'The address of the corrected page',
  L17: 'The address of your Wikidata item',
};
export const aiRankAddressLabel = (lever: string): string => AI_RANK_ADDRESS_LABEL[S(lever)] ?? 'The address of the page';

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
const WIKIDATA = /^(www\.)?wikidata\.org$/i;

/**
 * An address a client pasted on a step, checked by the safe fetcher's rules before anything is fetched: http or https (http is read as
 * https, the only scheme our fetcher opens), no user name or password, no IP literal, a public-looking host name. L17 must be a Wikidata
 * item. Returns the address we will open, or the sentence that says what is wrong.
 */
export function aiRankAddressCheck(raw: string, lever = ''): { url: string } | { error: string } {
  const t = S(raw);
  if (!t) return { error: 'Paste the address of the page first.' };
  if (t.length > 600) return { error: 'That address is too long.' };
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`;
  let u: URL;
  try {
    u = new URL(withScheme.replace(/^http:\/\//i, 'https://'));
  } catch {
    return { error: 'That is not a web address. Copy it from the address bar of the page, starting with https://.' };
  }
  if (u.protocol !== 'https:') return { error: 'Only web addresses (https://) can be checked.' };
  if (u.username || u.password) return { error: 'Remove the user name or password from the address.' };
  const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!host || host.includes(':') || IPV4.test(host)) return { error: 'Use the page\'s web address, not a number address.' };
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(host) || /(^|\.)(localhost|local|internal|lan)$/i.test(host)) return { error: 'That address is not a public website.' };
  if (S(lever) === 'L17' && !(WIKIDATA.test(host) && /^\/wiki\/Q\d+/i.test(u.pathname))) return { error: 'Paste the address of your Wikidata item, for example https://www.wikidata.org/wiki/Q42.' };
  u.hash = '';
  return { url: u.toString() };
}

/** Does this page text name the business? The website's own address counts, and any business name on file of at least three characters (whole words). */
export function aiRankPageNames(text: string, domain: string, names: string[]): boolean {
  const plain = S(text).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').toLowerCase();
  const d = S(domain).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
  if (d && plain.includes(d)) return true;
  // the address inside a link counts too (a profile often links the website without printing it)
  if (d && new RegExp(`https?://(www\\.)?${d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(S(text))) return true;
  return names.map((n) => S(n).toLowerCase()).filter((n) => n.length >= 3).some((n) => new RegExp(`(^|[^\\p{L}\\p{N}])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}\\p{N}])`, 'u').test(plain));
}

/**
 * RC-9 (review C, 2026-11-06): did the engine keep what was sent? An engine from before AI ranking answers a Site Admin save with "ok" and
 * drops the fields it has no column for, so the app re-reads the settings and compares: undefined (no AI ranking column) or a different
 * stored value means the setting was not saved.
 */
export function aiRankSaveKept(sent: AiRankSettingsInput, stored: AiRankSettings | null | undefined): boolean {
  if (!stored) return false;
  return (Object.keys(sent) as (keyof AiRankSettingsInput)[]).every((k) => sent[k] === undefined || stored[k] === sent[k]);
}
export const AI_RANK_NOT_KEPT = 'The engine has not been updated yet, so this setting was not saved.';
