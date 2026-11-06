// AI ranking in the client's words (FX-C RC-1, 2026-11-06). The engine's weekly memo of the AI ranking plan is written for the owner's review
// (question ids, stage codes, statistics, the model's own figures, provider dollars). A client never reads it: this file is the app's copy of
// the engine kit n8n/seo-agent/v5/code/_ai_rank_client.js (AIRC.view), rule for rule, so the AI visibility page (which reads the stored memo)
// says exactly what the AI growth report says. Its test runs the engine kit on the same memo and requires the same output.
// Money: the view carries the questions won and the raw spend apart; the server turns the spend into credits (`creditsPerWin`, `creditsUsed`)
// and the raw spend never reaches a customer (clientSafePayload strips `spend_usd`, and the readers below drop it).

export interface AiRankClientSection {
  key: 'changed' | 'why' | 'worked' | 'did' | 'you';
  title: string;
  lines: string[];
}

export interface AiRankClientView {
  v: number;
  sections: AiRankClientSection[];
  /** questions won after a confirmed step, net of the background (null: not computed this week) */
  wins: number | null;
  /** credits used by the plan per question won (null: nothing won yet, or unknown) */
  creditsPerWin: number | null;
  /** credits the plan's readings used (null: unknown) */
  creditsUsed: number | null;
}

/** the engine-side shape, before the server adds credits (spend_usd is provider money: never served to a customer) */
export interface AiRankClientRaw {
  v: number;
  sections: AiRankClientSection[];
  wins: number | null;
  spend_usd: number | null;
}

type P = Record<string, unknown>;
const S = (v: unknown) => (v == null ? '' : String(v)).trim();
const obj = (v: unknown): P => (v && typeof v === 'object' && !Array.isArray(v) ? (v as P) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** the engine's lever names (ARL.LEVERS labels), as the memo writes them */
export const AI_RANK_ENGINE_LEVER_LABELS: Record<string, string> = {
  L01: 'Unblock AI bots in robots.txt',
  L02: 'Content in raw HTML (server render)',
  L03: 'Add the site to Bing Webmaster and submit',
  L04: 'Get the page indexed in Google',
  L05: 'Own answer page for the searches the engines run',
  L06: 'Refresh the ranking page for the searches the engines run',
  L07: 'Cited but not named: fix the passage',
  L08: 'Placement on an editorial list the answers cite',
  L09: 'Directory profile on a directory the answers cite',
  L10: 'Registry or partner listing (eligible only)',
  L11: 'Earned mention (press, partner, customer case)',
  L12: 'LinkedIn article by a named person',
  L13: 'Disclosed community answer',
  L14: 'Video for the question',
  L15: 'Correction (own page or ask the source)',
  L16: 'Protect a cited page; refresh it when citations decay',
  L17: 'Wikidata / Wikipedia entity',
};
/** the client's words for each lever (equal to AI_RANK_LEVER_LABELS in ai-rank.ts and AIRC.LABELS in the engine; tested) */
export const AI_RANK_CLIENT_LEVER_LABELS: Record<string, string> = {
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
const LEVER_OF_LABEL: Record<string, string> = Object.fromEntries(Object.entries(AI_RANK_ENGINE_LEVER_LABELS).map(([k, v]) => [v, k]));
const label = (lever: string) => AI_RANK_CLIENT_LEVER_LABELS[S(lever)] ?? 'A step to get you named in AI answers';
const STAGE: Record<string, string> = {
  S0: 'the assistant could not read your website',
  S1: 'not in the answer',
  S2: 'your website comes up but is not linked',
  S3: 'linked but not named',
  S4: 'named, but weakly or wrongly',
  S5: 'clearly named',
  unmeasured: 'not measured',
};
const ENGINES: Record<string, string> = { 'ChatGPT (API)': 'ChatGPT' };
const engine = (e: string) => ENGINES[S(e)] ?? S(e);
const WHO: Record<string, string> = { auto: 'we do it', approve: 'you approve it, we do it', human: 'you do it, we check it' };
const STATUS: Record<string, string> = {
  proposed: 'proposed',
  queued: 'queued',
  in_progress: 'in progress',
  done: 'done',
  verified: 'confirmed',
  not_happened: 'did not happen',
  expired: 'expired',
  refused: 'not done',
  shadow: 'trial only',
};
const OPEN = ['proposed', 'queued', 'in_progress'];
const VERDICT: Record<string, string> = {
  'likely helped': 'likely helped',
  "can't tell": "can't tell yet",
  'no effect seen': 'no change seen yet',
  'did not happen': 'the step did not happen',
  'not due yet': 'too early to tell',
};

/** a free text (an action's why, a blocker) without ids, stage codes, money, the internal name or the model's figures (AIRC.plain) */
export function aiRankPlain(v: unknown): string {
  return S(v)
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/\s*\([^()]*(?:chance|model|prior|bootstrap|fisher|p ?=|own-page|notability)[^()]*\)/gi, '')
    .replace(/\bnotability gate\b/gi, 'the bar for an encyclopedia entry')
    .replace(/\b(?:aip|air|ait|lad|cad)_[A-Za-z0-9_.:-]+/g, '')
    .replace(/\bAIR'?s?\b/g, 'AI ranking')
    .replace(/\bS[0-5]\b/g, '')
    .replace(/(?:US)?\$\s?\d[\d,]*(?:\.\d+)?/g, '')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export interface AiRankClientContext {
  question?: (promptId: string) => string;
  leverOf?: (actionId: string) => string;
  actions?: { lever: string; executor: string; status: string; url: string }[];
}

interface MemoLine {
  text: string;
  figures: { name: string; value: unknown }[];
}
const lineOf = (l: unknown): MemoLine => {
  const o = obj(l);
  return { text: S(o.text ?? l), figures: arr(o.figures).map((f) => ({ name: S(obj(f).name), value: obj(f).value })) };
};
const fig = (l: MemoLine, name: string): unknown => l.figures.find((f) => f.name === name)?.value;
const num = (v: unknown): number | null => (v == null || S(v) === '' || !Number.isFinite(Number(v)) ? null : Number(v));

/** ARL.memo (as stored, or as aiRankMemoOf read it: figure values may be strings) -> the client view (AIRC.view, rule for rule) */
export function aiRankClientView(memo: unknown, ctx: AiRankClientContext = {}): AiRankClientRaw {
  const m = obj(memo);
  const part = (k: string) => arr(arr(m.parts).map(obj).find((p) => p.key === k)?.lines).map(lineOf);
  const qWords = (q: string) => {
    const t = S(ctx.question ? ctx.question(q) : '');
    return t ? `"${aiRankPlain(t)}"` : 'One of your tracked questions';
  };
  const changed: string[] = [];
  const why: string[] = [];
  const worked: string[] = [];
  const did: string[] = [];
  const you: string[] = [];
  for (const l of part('what_changed')) {
    const t = l.text;
    let x: RegExpMatchArray | null;
    if (t === 'No diagnosis this week.') changed.push('No new reading of your questions this week.');
    else if (/^This is the first reading/.test(t)) changed.push('This is the first week we read your questions, so there is nothing to compare with yet.');
    else if (t === 'No question changed stage this week.') changed.push('No question moved this week.');
    else if ((x = t.match(/^(.+?): found on (\d+) of (\d+) questions \(last week (\d+)\), won on (\d+) \(last week (\d+)\)\.$/)))
      changed.push(`${engine(x[1])}: your website comes up for ${x[2]} of ${x[3]} questions (${x[4]} last week), and you are clearly named for ${x[5]} (${x[6]} last week).`);
    else if ((x = t.match(/^Question (\S+) on (.+?): (up|down) from /))) {
      const from = STAGE[S(fig(l, 'from'))];
      const to = STAGE[S(fig(l, 'to'))];
      if (!from || !to) continue;
      changed.push(`${qWords(x[1])} on ${engine(x[2])}: moved ${x[3]}, from ${from} to ${to}.`);
    }
  }
  for (const l of part('why')) {
    const t = l.text;
    if (/^Nothing moved up/.test(t)) {
      why.push('Nothing moved up this week.');
      continue;
    }
    const x = t.match(/^Question (\S+) on (.+?): (.+)$/);
    if (!x) continue;
    const head = `${qWords(x[1])} on ${engine(x[2])}: `;
    const aid = S(fig(l, 'attributed_to'));
    const bg = /background/.test(x[3]);
    if (aid) {
      const lv = S(ctx.leverOf ? ctx.leverOf(aid) : '') || LEVER_OF_LABEL[(x[3].match(/after "([^"]+)"/) ?? [])[1] ?? ''] || '';
      why.push(head + (bg ? `can't tell yet. It moved after our step "${label(lv)}", but questions we did not work on moved the same way.` : `likely helped by our step "${label(lv)}".`));
    } else why.push(head + (bg ? 'it moved on its own: questions we did not work on moved the same way.' : 'it moved without a step of ours.'));
  }
  for (const l of part('projected_vs_real')) {
    const t = l.text;
    if (/^No action has reached the end of its window yet/.test(t)) {
      worked.push('It is too early to tell whether our steps worked: each one is judged after a few weeks of answers, against questions we did not work on.');
      continue;
    }
    const x = t.match(/^(.+?): we projected .*Verdict: (.+)\.$/);
    if (!x) continue;
    const v = VERDICT[S(x[2])];
    if (!v) continue;
    worked.push(`${label(LEVER_OF_LABEL[x[1]] ?? '')}: ${v}.`);
  }
  for (const a of (ctx.actions ?? []).filter((a) => a && S(a.lever))) {
    const st = S(a.status);
    const ex = S(a.executor) === 'auto' || S(a.executor) === 'approve' ? S(a.executor) : 'human';
    const what = label(a.lever) + (S(a.url) ? `: ${S(a.url)}` : '');
    const stw = (s: string) => STATUS[s] ?? aiRankPlain(s).replace(/_/g, ' ');
    if (ex === 'human') {
      if (!st || OPEN.includes(st)) you.push(`${what} (you do it, we check it).`);
      else did.push(`${what} (${stw(st)}).`);
    } else if (ex === 'approve' && (!st || st === 'proposed')) you.push(`${what} (you approve it, we do it).`);
    else did.push(`${what} (${WHO[ex]}${st ? `; ${stw(st)}` : ''}).`);
  }
  for (const b0 of arr(m.blockers)) {
    const b = obj(b0);
    const w = aiRankPlain(b.what);
    if (!w) continue;
    const W = w.charAt(0).toUpperCase() + w.slice(1);
    (S(b.owner) === 'us' ? did : you).push(`${S(b.owner) === 'us' ? 'On us: ' : ''}${W.replace(/[.\s]+$/, '')}.`);
  }
  if (!did.length) did.push('No new step this week.');
  if (!you.length) you.push('Nothing from you this week.');
  let wins: number | null = null;
  let spend: number | null = null;
  for (const l of part('cost_per_win')) {
    const w = num(fig(l, 'wins'));
    const sp = num(fig(l, 'spend_usd'));
    if (w != null) wins = w;
    if (sp != null) spend = sp;
  }
  const sections: AiRankClientSection[] = (
    [
      { key: 'changed', title: 'What changed', lines: changed },
      { key: 'why', title: 'Why it moved', lines: why },
      { key: 'worked', title: 'Did our steps work', lines: worked },
      { key: 'did', title: 'What we did', lines: did.slice(0, 10) },
      { key: 'you', title: 'What we need from you', lines: you.slice(0, 10) },
    ] as AiRankClientSection[]
  ).filter((s) => s.lines.length);
  return { v: 1, sections, wins, spend_usd: spend };
}

/** credits for the raw view: `rate` credits per US dollar of provider cost (billing.ts creditRate); the dollars are dropped */
export function aiRankClientCredits(raw: AiRankClientRaw | null, rate: number | null): AiRankClientView | null {
  if (!raw) return null;
  const used = raw.spend_usd != null && rate && rate > 0 ? Math.round(raw.spend_usd * rate * 10) / 10 : null;
  const perWin = used != null && raw.wins != null && raw.wins > 0 ? Math.round((used / raw.wins) * 10) / 10 : null;
  return { v: raw.v, sections: raw.sections, wins: raw.wins, creditsPerWin: perWin, creditsUsed: used };
}

const KEYS = new Set(['changed', 'why', 'worked', 'did', 'you']);
/** the `client` key of an ai_rank payload (engine v 2) as served: sections of plain lines, credits; never a dollar figure */
export function aiRankClientOf(v: unknown): AiRankClientView | null {
  const c = obj(v);
  const sections = arr(c.sections)
    .map(obj)
    .filter((s) => KEYS.has(S(s.key)))
    .map((s) => ({ key: S(s.key) as AiRankClientSection['key'], title: S(s.title), lines: arr(s.lines).map((l) => aiRankPlain(l)).filter(Boolean) }))
    .filter((s) => s.lines.length);
  if (!sections.length) return null;
  return { v: num(c.v) ?? 1, sections, wins: num(c.wins), creditsPerWin: num(c.credits_per_win ?? c.creditsPerWin), creditsUsed: num(c.credits_used ?? c.creditsUsed) };
}

/** the `ai_rank` key of a report payload as a customer may see it: the client view and the steps, never the owner's memo, the comparison, the
 *  cost or any dollar figure (an engine before FX-C carried them; an older stored report still does) */
export function aiRankCustomerSafe(v: unknown): unknown {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return v;
  const { memo: _m, compare: _c, cost: _k, ...rest } = v as P;
  const out: P = { ...rest };
  if (out.client && typeof out.client === 'object') {
    const { spend_usd: _s, ...c } = out.client as P;
    out.client = { ...c, sections: arr(c.sections).map((s) => ({ ...obj(s), lines: arr(obj(s).lines).map((l) => aiRankPlain(l)) })) };
  }
  const plainList = (xs: unknown) =>
    arr(xs).map((x) => {
      if (!x || typeof x !== 'object') return x;
      const { action_id: _a, target_stage: _t, ...y } = x as P;
      return { ...y, why: aiRankPlain(y.why), ...(y.what == null ? {} : { what: aiRankPlain(y.what) }) };
    });
  if (Array.isArray(out.actions)) out.actions = plainList(out.actions);
  if (Array.isArray(out.steps)) out.steps = plainList(out.steps);
  return out;
}

/** at callback time (server/src/services/runs.ts ingestCallback): the plan's raw spend becomes credits on the stored `ai_rank.client`
 *  (`credits_per_win`, `credits_used`); the raw `spend_usd` stays on the stored row for the platform admin and is stripped from every served copy */
export function withAiRankCredits(payload: Record<string, unknown>, rate: number | null): Record<string, unknown> {
  const r = payload.ai_rank;
  if (!r || typeof r !== 'object' || Array.isArray(r)) return payload;
  const c = (r as P).client;
  if (!c || typeof c !== 'object' || Array.isArray(c)) return payload;
  const raw: AiRankClientRaw = { v: num((c as P).v) ?? 1, sections: [], wins: num((c as P).wins), spend_usd: num((c as P).spend_usd) };
  const v = aiRankClientCredits(raw, rate)!;
  return { ...payload, ai_rank: { ...(r as P), client: { ...(c as P), credits_per_win: v.creditsPerWin, credits_used: v.creditsUsed } } };
}
