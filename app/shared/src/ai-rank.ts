// AI ranking (AIR, 2026-11-06, n8n/seo-agent/docs/ai-ranking-2026-11-05/DESIGN.md §2.F, §2.H, §4.1, §6.7; CONTRACTS.md §2.1, §3.1):
// the app's side of the engine's AI-ranking plan. One website at a time is switched off / shadow (a private trial: the plan is computed and
// logged, nothing a client sees changes) / on (the plan acts through the existing rails). This file holds:
//  * the settings parse, rule for rule the engine's AIRF.settingsOf (v5/code/_ai_rank_flags.js): empty or junk = off, false, 0, false, false;
//  * the Site Admin `monitors` body for the five settings (only the fields given; '' clears one);
//  * the readers of what the engine stores (seo_ai_rank_runs, seo_ai_rank_actions) and of the additive `ai_rank` key of the ai_growth
//    callback, each tolerant of a missing or older shape (a reader never throws on an engine from before AIR);
//  * the client words (no internal names: the client reads "AI ranking", never the engine's ids).

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
  memo: AiRankMemo | null;
  actions: AiRankActionView[];
  steps: AiRankStep[];
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
    label: S(a.label) || aiRankLeverLabel(lever),
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
    memo: aiRankMemoOf(r.memo),
    actions: objs(r.actions).slice(0, 20).map(aiRankActionOf),
    steps: objs(r.steps)
      .slice(0, 8)
      .map((x) => ({
        key: S(x.key),
        lever: S(x.lever),
        label: S(x.label) || aiRankLeverLabel(S(x.lever)),
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
  memo: AiRankMemo | null;
  actions: AiRankActionView[];
  cost: { usd: number; basis: string } | null;
  settings: AiRankSettings;
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
export function aiRankPlanOf(runs: AiRankRunRow[], actions: AiRankActionRow[], settings: AiRankSettings): AiRankPlanData | null {
  const run = [...runs].filter((r) => modeOf(r.mode) === 'on' && S(r.checked_at)).sort((a, b) => S(b.checked_at).localeCompare(S(a.checked_at)))[0];
  if (!run) return null;
  const chosen = objs(jsonOf<unknown>(run.chosen_json, [])).map(aiRankActionOf);
  const byId = new Map(actions.map((a) => [S(a.action_id), a]));
  const shown = chosen.map((a) => ({ ...a, status: S(byId.get(a.actionId)?.status) || a.status }));
  const extra = actions.filter((a) => modeOf(a.mode) === 'on' && OPEN.has(S(a.status)) && !chosen.some((c) => c.actionId === S(a.action_id))).map((a) => aiRankActionOf(a as P));
  const cost = obj(jsonOf<unknown>(run.cost_json, {}));
  return {
    checkedAt: S(run.checked_at),
    runId: S(run.run_id),
    memo: aiRankMemoOf(run.memo_json),
    actions: [...shown, ...extra].slice(0, 20),
    cost: S(cost.usd) !== '' ? { usd: num(cost.usd), basis: S(cost.basis) } : null,
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
