// The draft gate (L2, system review of 2026-10-11): the checks every outreach e-mail passes before it may be sent. The n8n Link Builder runs
// the same rules when it drafts (n8n/seo-agent/v5/code/_draft_qa.js, node "LB Draft QA"): a draft that fails is kept as `needs_edit` with its
// reasons. This copy is the send-time gate — a person may edit a held draft in the app, and nothing goes out until every check passes. The two
// files must change together (as Cadence_Plan.js and server/src/services/cadence.ts do).
// What it refuses: a claim about the business the facts do not carry (only when the facts are given; the engine already wraps those in
// [Owner: confirm — …]), anything left in brackets for the owner, an address that is not on the prospect's own domain, a first e-mail that
// quotes nothing from their page, no link / more than one link / a link that is not our chosen page on our canonical host, a competitor, a
// government site or a bare homepage as the recipient, an e-mail that is too long, and SEO / AI jargon or hype.

export interface DraftStep {
  subject: string;
  body: string;
}
export interface DraftInput {
  type: string;
  steps: DraftStep[];
  to: string;
  prospectDomain: string;
  pageUrl?: string;
  pageTitle?: string;
  evidence?: string;
  deadAnchor?: string;
  deadUrl?: string;
}
export interface DraftContext {
  /** our website's bare domain */
  domain: string;
  /** the host the site is really served on (www or not) */
  canonicalHost?: string;
  /** the page the pitch offers */
  targetUrl?: string;
  /** the business name as the site model has it (so a draft cannot sign with the domain label) */
  brand?: string;
  brandKnown?: boolean;
  competitors?: string[];
  /** the business facts on file; when given, claims outside them are refused */
  facts?: string;
  /** the signature line (never read as a claim) */
  signer?: string;
  /** true when the facts say the business holds an accreditation */
  accredited?: boolean;
}
export interface DraftVerdict {
  ok: boolean;
  held: string[];
  notes: string[];
}

export const DRAFT_LIMITS = { first: 120, pressFirst: 200, followup: 60, subject: 70 } as const;

const BANNED: [RegExp, string][] = [
  [/\bback\s?links?\b/i, 'the word "backlink"'],
  [/\b(do|no)-?follow\b/i, 'link jargon'],
  [/\blink (building|exchange|swap|juice)\b/i, 'link jargon'],
  [/\b(seo|serps?)\b/i, 'SEO jargon'],
  [/\b(domain authority|domain rating|\bda\s?\d{1,3}\b|\bdr\s?\d{1,3}\b)/i, 'authority metrics'],
  [/\b(ai (answers?|assistants?|search|overview|overviews|mode|visibility)|chatgpt|perplexity|copilot|gemini)\b/i, 'how we found them (AI answers)'],
  [/\b(ranks?|ranking|rankings|rank higher|search rankings)\b/i, 'talk of rankings'],
  [/\b(world.?class|best.in.class|revolutionary|cutting.edge|game.chang\w+|one.stop.shop|leading provider)\b/i, 'hype'],
  [/i hope (this|you) (e-?mail |message )?(finds you well|are doing well)|i('ve| have) been (reading|following) (your|the) (blog|site|work|newsletter) for (years|a while|some time)/i, 'filler or fake familiarity'],
  [/\b(guest post|sponsored post|paid (link|placement)|in exchange for a link)\b/i, 'an offer we never make'],
];
// the same claim words as the engine's claims kit (v5/code/_claims.js, D14)
const CLAIM_RE = /\b(?:accredit\w*|certif\w*|iso[ -]?\d{4,5}|partner\w*|authori[sz]ed|licen[cs]ed|registered|approved|award\w*|member(?:s|ship)? of|founded|since \d{4}|headquarter\w*|based in|offices? in|\d[\d,.]*\+? ?(?:years?|yrs|clients?|customers?|projects?|companies|countries|employees|staff|users|installations?|implementations?)|\d[\d,.]*\s?%|(?:aed|usd|eur|gbp|sar|inr|\$|€|£)\s?\d[\d,.]*|\d[\d,.]*\s?(?:aed|usd|eur|gbp|sar|dirhams?|dollars?)|pric(?:e|es|ed|ing)|fees?|free of charge|no charge|discount\w*)\b/gi;
const MAILHOST = /^(gmail\.com|googlemail\.com|outlook\.[a-z.]{2,6}|hotmail\.[a-z.]{2,6}|live\.[a-z.]{2,6}|msn\.com|yahoo\.[a-z.]{2,6}|ymail\.com|aol\.com|icloud\.com|me\.com|gmx\.[a-z.]{2,5}|web\.de|mail\.(com|ru)|email\.com|protonmail\.com|proton\.me|tutanota\.com|yandex\.[a-z.]{2,5}|fastmail\.com|rediffmail\.com|qq\.com|naver\.com|163\.com|office\.com|office365\.com|microsoftonline\.com|sharepoint\.com|mimecast\.com)$/i;
const DATABROKER = /^(zoominfo\.[a-z.]+|apollo\.io|lusha\.com|rocketreach\.co|signalhire\.com|leadiq\.com|cognism\.com|seamless\.ai|hunter\.io|snov\.io|clearbit\.com|uplead\.com|datanyze\.com|contactout\.com|anymailfinder\.com|skrapp\.io|getprospect\.com|kaspr\.io|lead411\.com|slintel\.com|6sense\.com|owler\.com|dnb\.com|bizapedia\.com|opencorporates\.com|zaubacorp\.com|tofler\.in|signal\.ai)$/i;
const INFRA = /(^|\.)(amazonaws\.com|cloudfront\.net|akamai(hd|edge|ized)?\.net|azureedge\.net|googleusercontent\.com|googleapis\.com|gstatic\.com|appspot\.com|bit\.ly|t\.co|goo\.gl|ow\.ly|lnkd\.in|tinyurl\.com|blogspot\.com|wordpress\.com|wixsite\.com|weebly\.com|squarespace\.com|github\.io|herokuapp\.com|netlify\.app|vercel\.app|pages\.dev|web\.app|firebaseapp\.com|doubleclick\.net|jsdelivr\.net|cloudflare\.com|wp\.com|gravatar\.com|archive\.org)$/i;
const SCRAPER = /(^|[.-])(whois|who\.is|worth|siteprice|sitestats?|site-?info|hypestat|similarsites?|sitelike|websiteoutlook|statshow|domaintools|builtwith|urlscan|dnslytics|ipaddress|host\.io|webstatsdomain|rank2traffic|websiteinformer|valuation|seo-?analy[sz]er|sitechecker|domainstats)/i;
const GOV = /(^|\.)(gov|gouv|gob|govt|mil)(\.[a-z]{2})?$/i;
const ACCRED_RE = /\b(accredited|accreditation|pre-?approved|approved|certified|licen[cs]ed|authori[sz]ed|registered)\b[^.\n]{0,40}\b(service providers?|providers?|asps?|partners?|vendors?|suppliers?|list|lists|directory|register|registry)\b|\b(service providers?|providers?|asps?|partners?|vendors?)\b[^.\n]{0,25}\b(accredited|pre-?approved|approved|certified|licen[cs]ed)\b/i;
const HOME_OK = new Set(['mention', 'list', 'listing', 'ai_list', 'press', 'lost', 'reclaim']);
// a claim is ours only when the sentence speaks about us (the same rule as the engine's claims kit, CL.check { ours: true })
const OURS_RE = /\b(we|we.?re|we.?ve|our|ours|us|i|i.?m|i.?ve|my)\b/i;
const STOPW = new Set(
  'the and for with from your our you are was has have that this they their them will can into out about more most than then when what which who why how not but any one two all its also been being here there over under per via'.split(' '),
);

const s = (v: unknown) => (v == null ? '' : String(v));
const bare = (h: string) => s(h).toLowerCase().replace(/^www\./, '');
const sameSite = (a: string, b: string) => { const x = bare(a), y = bare(b); return !!x && !!y && (x === y || x.endsWith('.' + y) || y.endsWith('.' + x)); };
const hostOf = (u: string) => bare(s((s(u).match(/^https?:\/\/([^/?#]+)/i) ?? [])[1]));
const pathKey = (u: string) => s(u).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
const wordCount = (t: string) => s(t).replace(/\[[^\]]*\]/g, ' ').trim().split(/\s+/).filter(Boolean).length;
const linksIn = (t: string) => [...s(t).matchAll(/https?:\/\/[^\s<>()"'\]]+/gi)].map((m) => m[0].replace(/[.,;:!?)\]]+$/, ''));
const bracketsIn = (t: string) => [...s(t).matchAll(/\[[^\]\n]{1,160}\]/g)].map((m) => m[0]);
const grams = (t: string, n: number) => {
  const w = s(t).toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').split(/\s+/).filter((x) => x.length > 2 && !STOPW.has(x));
  const out: string[] = [];
  for (let i = 0; i + n <= w.length; i++) out.push(w.slice(i, i + n).join(' '));
  return out;
};
const maskEmail = (e: string) => { const [u = '', d = ''] = s(e).toLowerCase().split('@'); return u.slice(0, 1) + '***@' + d; };

/** a reason a host can never be pitched, '' when it can */
export function badHost(domain: string): string {
  const d = bare(domain).trim();
  if (!d || !d.includes('.')) return '';
  if (MAILHOST.test(d)) return `a mailbox provider (${d}), not a website whose editor could add a link`;
  if (DATABROKER.test(d)) return `a contact / company database (${d}): its pages are generated, nobody there edits them`;
  if (INFRA.test(d)) return `infrastructure (${d}: a CDN, a hosting platform or a link shortener), not a site to write to`;
  if (SCRAPER.test(d)) return `an automatically generated statistics page (${d}), not a site to write to`;
  return '';
}
/** three distinctive words in a row from their page, said back to them */
export function quotesThem(body: string, candidates: string[]): string {
  const B = new Set(grams(body, 3));
  for (const c of candidates) for (const g of grams(c, 3)) if (B.has(g)) return g;
  return '';
}

/** Every check an outreach e-mail passes before it is sent. `held` is empty when it may go out. */
export function draftGate(d: DraftInput, ctx: DraftContext): DraftVerdict {
  const held: string[] = [];
  const notes: string[] = [];
  const add = (why: string) => { if (why && !held.includes(why)) held.push(why); };
  const type = s(d.type);
  const press = type === 'press';
  const steps = (d.steps ?? []).map((x) => ({ subject: s(x.subject), body: s(x.body) }));
  if (!steps.length || !steps[0]!.body.trim()) return { ok: false, held: ['no e-mail was written'], notes };
  if (!steps[0]!.subject.trim()) add('the first e-mail has no subject');
  // 1. nothing left for the owner to fill in
  for (const st of steps) for (const b of bracketsIn(st.body + ' ' + st.subject)) add(`needs you: ${b.slice(0, 80)}`);
  // 2. claims the facts do not carry (only when the facts are at hand; the engine wraps them in [Owner: confirm — …] while drafting)
  if (s(ctx.facts).trim()) {
    const F = s(ctx.facts).toLowerCase().replace(/[^a-z0-9%$€£]+/g, ' ');
    const keyOf = (m: string) => {
      const x = m.toLowerCase().replace(/[^a-z0-9%$€£]+/g, ' ').trim();
      const num = x.match(/\d[\d,.]*/);
      if (num) return num[0].replace(/[,.]+$/, '');
      const w = x.split(' ')[0]!;
      const st = w.replace(/(ations?|ation|ings?|ed|es|s|ship|ships)$/, '');
      return (st.length >= 5 ? st : w).slice(0, 7);
    };
    const brandLower = s(ctx.brand).toLowerCase();
    for (const st of steps) {
      const body = ctx.signer ? st.body.split(ctx.signer).join(' ') : st.body;
      // only a sentence that speaks about us carries a claim about us ("the date it was approved" on their own list does not)
      for (const sentence of body.split(/(?<=[.!?])\s+|\n+/)) {
        if (!OURS_RE.test(sentence) && !(brandLower && sentence.toLowerCase().includes(brandLower))) continue;
        // a word in a URL is not a claim, and words inside quotation marks are their words (a pitch quotes their page title)
        const plain = sentence.replace(/\[[^\]]*\]/g, ' ').replace(/https?:\/\/\S+/g, ' ').replace(/["\u201c\u201d][^"\u201c\u201d]{3,200}["\u201c\u201d]/g, ' ');
        for (const m of plain.matchAll(CLAIM_RE)) {
          const k = keyOf(m[0]);
          if (k && !F.includes(k)) add(`needs your confirmation: "${m[0].slice(0, 60)}"`);
        }
      }
    }
  }
  // 3. the recipient is on the prospect's own domain
  const toDomain = s(d.to).toLowerCase().split('@')[1] ?? '';
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(s(d.to))) add('no valid e-mail address');
  // a journalist request is answered at the address in the request (the "prospect" is a post, not a website), so it is exempt
  else if (d.prospectDomain && !press && !d.prospectDomain.includes('/') && !sameSite(toDomain, d.prospectDomain)) add(`the address ${maskEmail(d.to)} is not on ${d.prospectDomain}`);
  // 4. one link per e-mail, ours, on the canonical host, and the page we chose
  const host = bare(s(ctx.canonicalHost || ctx.domain));
  steps.forEach((st, i) => {
    const ls = linksIn(st.body);
    const which = i ? `follow-up ${i}` : 'the first e-mail';
    if (ls.length > 1) add(`${which} carries ${ls.length} links (one, to your page)`);
    for (const u of ls) {
      const h = hostOf(u);
      if (!sameSite(h, ctx.domain)) add(`${which} links to ${h || 'nowhere'}, not to your site`);
      else if (host && h !== host) add(`the link uses ${h}; your site is served on ${host}`);
    }
  });
  const all = steps.flatMap((st) => linksIn(st.body));
  if (!all.length) add('no link to your page');
  else if (ctx.targetUrl && !all.some((u) => pathKey(u) === pathKey(ctx.targetUrl!))) add(`none of the e-mails links to the page we chose (${s(ctx.targetUrl).slice(0, 80)})`);
  // 5. who is being written to
  add(badHost(d.prospectDomain));
  if (GOV.test(bare(d.prospectDomain))) add('a government site: it lists providers through accreditation or an application, never through a pitch');
  if (/^https?:\/\/[^/?#]+\/?([?#]|$)/i.test(s(d.pageUrl)) && !HOME_OK.has(type)) add('only their homepage was found: a front page has no section a link could be added to');
  for (const c of ctx.competitors ?? []) if (c && sameSite(d.prospectDomain, c)) add(`a competing site of yours (${bare(c)}): a competitor does not link to you`);
  if (!ctx.accredited && ACCRED_RE.test(`${s(d.pageTitle)} ${s(d.pageUrl)}`)) add('a list of accredited / approved providers: the facts on file do not say you hold that accreditation');
  // 6. a real quote from their page
  if (s(d.evidence).trim() || s(d.pageTitle).trim()) {
    const cands = [d.pageTitle, d.evidence, d.deadAnchor, s(d.deadUrl).replace(/[/_.-]+/g, ' ')].map(s).filter(Boolean);
    if (!quotesThem(`${steps[0]!.body} ${steps[0]!.subject}`, cands)) add('the first e-mail quotes nothing that is on their page');
  }
  // 7. length, subject, one clear ask
  const w0 = wordCount(steps[0]!.body);
  const lim = press ? DRAFT_LIMITS.pressFirst : DRAFT_LIMITS.first;
  if (w0 > lim) add(`the first e-mail is ${w0} words (at most ${lim})`);
  if (steps[0]!.subject.length > DRAFT_LIMITS.subject) add(`the subject is ${steps[0]!.subject.length} characters (at most ${DRAFT_LIMITS.subject})`);
  steps.slice(1).forEach((st, i) => { const w = wordCount(st.body); if (w > DRAFT_LIMITS.followup) add(`follow-up ${i + 1} is ${w} words (at most ${DRAFT_LIMITS.followup})`); });
  const asks = (steps[0]!.body.match(/\?/g) ?? []).length;
  if (asks > 2) add(`the first e-mail asks ${asks} questions: make one clear ask`);
  if (!press && !asks && !/\b(would you|could you|can you|are you|let me know|happy to (send|share)|glad to send|glad to share|shall i|if (it|that|this) (helps|fits|is useful|would help))\b/i.test(steps[0]!.body))
    add('the first e-mail makes no clear ask');
  // 8. words we never use
  for (const st of steps) for (const [re, why] of BANNED) if (re.test(st.body) || re.test(st.subject)) add(`uses ${why}`);
  // 9. the business name as the site model has it
  const brandKey = s(ctx.brand).toLowerCase().replace(/[^a-z0-9]+/g, '');
  const label = bare(ctx.domain).split('.')[0]!.toLowerCase();
  if (ctx.brandKnown && label.length >= 4 && !brandKey.includes(label)) {
    const re = new RegExp(`(^|[^a-z0-9.@/])${label}($|[^a-z0-9.@-])`, 'i');
    if (steps.some((st) => re.test(st.body) || re.test(st.subject))) add(`writes the business name as "${label}"; it is "${ctx.brand}"`);
  }
  if (ctx.brandKnown && brandKey && !steps[0]!.body.toLowerCase().replace(/[^a-z0-9]+/g, '').includes(brandKey)) notes.push('the first e-mail never names the business');
  return { ok: !held.length, held, notes };
}

/** one line for the app: why a draft is held */
export const draftHeldReason = (v: DraftVerdict) => (v.ok ? '' : v.held.join('; '));
