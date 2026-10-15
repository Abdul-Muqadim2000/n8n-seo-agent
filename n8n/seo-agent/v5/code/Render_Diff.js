// G14 (2026-10-13, system review FIX_PLAN.md; CRITERIA_technical… 1.4): the response-versus-render diff.
// Two readings of every key page are in: the **raw first response** (*Fetch Raw Pages*, a plain GET — what a crawler that does not run
// JavaScript receives, which is every AI crawler today) and the **rendered page** (*Render Key Pages*, the Jina Reader render path of
// v5/code/Render_Requests.js, or the JavaScript crawl as the fallback). Six figures are read from both with the same parser — title, main
// heading, canonical link, robots meta, links on the page, text length — and every one of them says which reading it came from.
// Rules this node keeps:
//   * URLs are compared host-agnostically: the crawl reports www. hosts while a canonical may use the bare host, and that is NOT a mismatch.
//   * a reading that failed is "not checked" with the reason (a bot challenge, an HTTP error, a DNS failure, an empty body) — never
//     "no difference". A crawl run without JavaScript is not a rendered reading and never stands in for one.
//   * nothing here can fail the audit.
/*__LINK_KIT__*/
let prev = {};
try { prev = $('Analyze CrUX').first().json || {}; } catch (e) {}
if (!prev.probe) { try { const i = $input.first().json || {}; if (i.probe || i.skip) prev = i; } catch (e2) {} }

let reqs = [];
try { reqs = $('Render Diff Targets').all().map(i => i.json || {}); } catch (e) {}
let renders = [];
try { renders = $('Render Key Pages').all().map(i => i.json || {}); } catch (e) {}
let raws = [];
try { raws = $('Fetch Raw Pages').all().map(i => i.json || {}); } catch (e) {}
let crawled = [];
try { crawled = ($('Get Crawled Pages').first().json.tasks?.[0]?.result?.[0]?.items || []).filter(p => p && p.url); } catch (e) {}

const targets = reqs.filter(r => r && r.url && !r.skip);
const plan = (reqs[0] || {}).render_plan || { pages: 0, cap: 0, crawl_js: false, figures: [] };
const S = (v) => String(v == null ? '' : v).trim();
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const pathOf = (u) => S(u).replace(/^https?:\/\/[^\/]+/, '').replace(/[?#].*$/, '') || '/';

// ---- host-agnostic URL comparison (www. vs the bare host, a trailing slash, the scheme and tracking parameters are all the same URL) ----
const normU = (u) => {
  const raw = S(u);
  if (!raw) return '';
  const m = raw.match(/^https?:\/\/([^\/?#]+)([^?#]*)/i);
  const host = m ? m[1].toLowerCase().replace(/^www\./, '').replace(/:\d+$/, '') : '';
  const p = (m ? m[2] : raw.replace(/[?#].*$/, '')) || '/';
  return host + ((p.replace(/\/+$/, '') || '/').toLowerCase());
};
const sameUrl = (a, b) => !!normU(a) && normU(a) === normU(b);

// ---- one reading of a page, from HTML: the same parser for the raw response and for the rendered page ----
const robotsOf = (html, headers) => {
  const metas = [...S(html).matchAll(/<meta\b[^>]*>/gi)].map(x => x[0])
    .filter(t => /name\s*=\s*["']?(robots|googlebot)\b/i.test(t))
    .map(t => S(LK.attr(t, 'content')).toLowerCase()).filter(Boolean);
  const H = {};
  for (const [k, v] of Object.entries(headers || {})) H[String(k).toLowerCase()] = S(v);
  const xr = S(H['x-robots-tag']).toLowerCase();
  return [...new Set([...metas, ...(xr ? ['x-robots-tag: ' + xr] : [])])].join(', ');
};
const linkCount = (html, url) => {
  const own = LK.regDomain(LK.hostOf(url));
  let internal = 0, external = 0;
  for (const m of S(html).matchAll(/<a\b([^>]*)>/gi)) {
    const href = S(LK.attr(m[1], 'href'));
    if (!href || /^(#|javascript:|mailto:|tel:|sms:|data:)/i.test(href)) continue;
    const h = LK.hostOf(href);
    if (!h || LK.sameSite(h, own)) internal++; else external++;
  }
  return { internal, external, total: internal + external };
};
// ---- B5-1 (2026-10-15, benchmark area 5; Screaming Frog v24's "Find Uncrawlable Links"): link-shaped things no crawler can follow ----
// A card, a tile, a table row or a button that navigates with a script is not a link: it carries no href, so nothing queues the page behind
// it and no internal-link signal reaches it. It is the usual cause of the orphan pages the crawl reports ("no crawlable internal links"),
// and until today the audit named that symptom and *guessed* the cause in its own words. This reads the HTML we have already fetched for the
// response-versus-render diff — nothing extra is requested and nothing is paid for. Regex only: the n8n Code sandbox has no DOM.
const UNC_KINDS = {
  javascript_href: 'an <a href="javascript:…"> link',
  anchor_without_href: 'an <a> with no href that navigates on click',
  anchor_to_nowhere: 'an <a href="#"> that navigates on click',
  element_as_link: 'an element used as a link (no <a href>)'
};
const looksLikeUrl = (t) => /^(?:https?:\/\/|\/)[^\s"'<>]*$/i.test(S(t));
const uncrawlable = (html) => {
  const out = [];
  const navAttr = (attrs) => S(LK.attr(attrs, 'data-href') || LK.attr(attrs, 'data-url') || LK.attr(attrs, 'data-link') || '').slice(0, 120);
  const navScript = (attrs) => S((S(attrs).match(/(?:location(?:\.href)?\s*=\s*|window\.open\s*\(\s*|navigate\s*\(\s*|router\.push\s*\(\s*)["']([^"']{1,120})["']/i) || [])[1]);
  const target = (attrs) => navAttr(attrs) || navScript(attrs);
  for (const m of S(html).matchAll(/<a\b([^>]*)>/gi)) {
    const attrs = m[1]; const href = S(LK.attr(attrs, 'href'));
    const click = /\bonclick\s*=/i.test(attrs) || /\bdata-(?:href|url|link)\s*=/i.test(attrs);
    if (/^javascript:/i.test(href)) out.push({ kind: 'javascript_href', tag: 'a', detail: href.slice(0, 120) });
    else if (!href && click) out.push({ kind: 'anchor_without_href', tag: 'a', detail: target(attrs) });
    else if (/^#?$/.test(href) && href === '#' && click) out.push({ kind: 'anchor_to_nowhere', tag: 'a', detail: target(attrs) });
  }
  for (const m of S(html).matchAll(/<(div|span|li|button|td|tr|section|article|h[1-6])\b([^>]*(?:\bonclick\s*=|\bdata-(?:href|url|link)\s*=|\bhref\s*=)[^>]*)>/gi)) {
    const tag = m[1].toLowerCase(); const attrs = m[2];
    const t = target(attrs) || S(LK.attr(attrs, 'href'));
    if (!looksLikeUrl(t)) continue;                 // a script that is not navigation, or a target we cannot read, is not counted
    out.push({ kind: 'element_as_link', tag, detail: t.slice(0, 120) });
  }
  return { count: out.length, kinds: [...new Set(out.map(x => x.kind))], samples: out.slice(0, 5) };
};
const readHtml = (html, headers, url) => {
  const facts = LK.pageFacts(html, headers, url);
  const h1s = [...S(html).matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map(m => LK.text(m[1])).filter(Boolean);
  const links = linkCount(html, url);
  return { ok: true, title: S(facts.title), h1: S(h1s[0]), h1_count: h1s.length, canonical: S(facts.canonical),
    robots: robotsOf(html, headers), links: links.total, internal_links: links.internal, words: num(facts.words) || 0, js_shell: !!facts.js_shell,
    uncrawlable: uncrawlable(html) };
};
// why a reading could not be used ("not checked", never "no difference")
const failureOf = (res, label) => {
  const r = res || {};
  const html = S(r.html ?? r.body ?? r.data);
  const status = num(r.statusCode ?? r.status) || 0;
  const err = r.error ? S(r.error.message || r.error.description || r.error).slice(0, 160) : '';
  if (err && !html) return 'the ' + label + ' failed: ' + err;
  if (LK.challenge(status, html)) return 'the ' + label + ' hit a bot challenge' + (status ? ' (HTTP ' + status + ')' : '');
  if (status >= 400) return 'the ' + label + ' answered HTTP ' + status;
  if (!html) return 'the ' + label + ' returned no HTML';
  if (!/<html|<body|<head/i.test(html)) return 'the ' + label + ' returned no HTML document';
  return '';
};
// the JavaScript crawl as the rendered reading of last resort (only when the crawl really rendered JavaScript)
const fromCrawl = (url) => {
  if (!plan.crawl_js) return null;
  const hit = crawled.find(p => sameUrl(p.url, url));
  if (!hit) return null;
  const meta = hit.meta || {};
  const nonIdx = (((prev.crawl_extras || {}).non_indexable) || []).find(x => sameUrl(x.url, url));
  const robots = [nonIdx && /noindex/i.test(S(nonIdx.reason)) ? 'noindex' : '', meta.follow === false ? 'nofollow' : ''].filter(Boolean).join(', ');
  return { ok: true, title: S(meta.title), h1: S((meta.htags || {}).h1 && (meta.htags || {}).h1[0]), h1_count: (((meta.htags || {}).h1) || []).length,
    canonical: S(meta.canonical), robots, links: (num(meta.internal_links_count) || 0) + (num(meta.external_links_count) || 0),
    internal_links: num(meta.internal_links_count) || 0, words: num((meta.content || {}).plain_text_word_count) || 0, js_shell: false };
};

// ---- the figures, and what each one is attributed to ----
const FIGURES = [
  { key: 'title', label: 'Title', kind: 'text' },
  { key: 'h1', label: 'Main heading (H1)', kind: 'text' },
  { key: 'canonical', label: 'Canonical link', kind: 'url' },
  { key: 'robots', label: 'Robots meta', kind: 'text' },
  { key: 'links', label: 'Links on the page', kind: 'count' },
  { key: 'words', label: 'Text length (words)', kind: 'count' }
];
const SOURCE_RAW = 'the first response (raw HTML)';
const SOURCE_REN = 'after JavaScript (rendered page)';
const same = (f, a, b) => f.kind === 'url' ? (sameUrl(a, b) || (!S(a) && !S(b)))
  : f.kind === 'count' ? (Number(a) === Number(b) || (Math.max(Number(a) || 0, Number(b) || 0) > 0 && Math.min(Number(a) || 0, Number(b) || 0) / Math.max(Number(a) || 0, Number(b) || 0) >= 0.8))
    : S(a).toLowerCase().replace(/\s+/g, ' ') === S(b).toLowerCase().replace(/\s+/g, ' ');
const grew = (f, rawV, renV) => {   // a count that is materially bigger after JavaScript
  if (f.kind !== 'count') return false;
  const a = Number(rawV) || 0, b = Number(renV) || 0;
  return b >= (f.key === 'links' ? 10 : 150) && (a === 0 || a / b < 0.4);
};

const pages = [];
const notChecked = [];
for (let i = 0; i < targets.length; i++) {
  const t = targets[i];
  const renRes = renders[i] || null;
  const rawRes = raws.find(r => r && sameUrl(r.url, t.url)) || raws[i] || null;
  const rawFail = failureOf(rawRes, 'raw request');
  const renFail = failureOf(renRes, 'render');
  const raw = rawFail ? null : readHtml(S((rawRes || {}).html ?? (rawRes || {}).body ?? (rawRes || {}).data), (rawRes || {}).headers, t.url);
  let rendered = renFail ? null : readHtml(S((renRes || {}).html ?? (renRes || {}).body ?? (renRes || {}).data), (renRes || {}).headers, t.url);
  let rendered_source = rendered ? 'render_service' : '';
  if (!rendered) { const c = fromCrawl(t.url); if (c) { rendered = c; rendered_source = 'crawl_js'; } }

  if (!raw || !rendered) {
    const why = [rawFail, rendered ? '' : (renFail + (plan.crawl_js ? ', and the JavaScript crawl has no reading of this page' : ', and the crawl did not render JavaScript, so it cannot stand in'))].filter(Boolean).join('; ');
    const row = { url: t.url, path: pathOf(t.url), kind: t.kind || 'page', checked: false, not_checked: why || 'neither reading could be used', figures: [], js_only: [], rendered_source };
    pages.push(row); notChecked.push(row);
    continue;
  }
  const figures = FIGURES.map(f => {
    const a = raw[f.key], b = rendered[f.key];
    const hasA = f.kind === 'count' ? (Number(a) || 0) > 0 : !!S(a);
    const hasB = f.kind === 'count' ? (Number(b) || 0) > 0 : !!S(b);
    let state = 'same', from = SOURCE_RAW;
    if (!hasA && !hasB) { state = 'absent'; from = 'neither reading has it'; }
    else if (!hasA && hasB) { state = 'js_only'; from = SOURCE_REN; }
    else if (hasA && !hasB) { state = 'raw_only'; from = SOURCE_RAW; }
    else if (!same(f, a, b)) { state = grew(f, a, b) ? 'js_only' : 'differs'; from = state === 'js_only' ? SOURCE_REN : 'the two readings differ'; }
    return { figure: f.label, key: f.key, raw: a, rendered: b, state, from };
  });
  // B5-1: what a crawler cannot follow is read from the rendered page where we have one (that is the DOM Google ends up with), and from
  // the first response otherwise. `fromCrawl` has no HTML of its own, so it carries no count and the page simply reports none.
  const uncRen = (rendered_source === 'render_service' && rendered.uncrawlable && rendered.uncrawlable.count) ? rendered.uncrawlable : null;
  const uncRaw = (raw.uncrawlable && raw.uncrawlable.count) ? raw.uncrawlable : null;
  const unc = uncRen || uncRaw || { count: 0, kinds: [], samples: [] };
  pages.push({ url: t.url, path: pathOf(t.url), kind: t.kind || 'page', checked: true, not_checked: '', rendered_source,
    figures, js_only: figures.filter(f => f.state === 'js_only').map(f => f.key),
    differs: figures.filter(f => f.state === 'differs').map(f => f.key), js_shell: !!raw.js_shell,
    uncrawlable: unc.count, uncrawlable_kinds: unc.kinds, uncrawlable_samples: unc.samples,
    uncrawlable_read_from: unc.count ? (uncRen ? 'the rendered page' : 'the first response') : '' });
}

const checked = pages.filter(p => p.checked);
const withJs = checked.filter(p => p.js_only.length);
// B5-1: the orphan pages the crawl found, which is what link-shaped elements without an href usually cause
const orphanPages = crawled.filter(p => (p.checks || {}).is_orphan_page === true);
const uncPages = checked.filter(p => (p.uncrawlable || 0) > 0);
const uncTotal = uncPages.reduce((n, p) => n + (p.uncrawlable || 0), 0);
const uncrawlable_links = { pages_with: uncPages.length, pages_checked: checked.length, total: uncTotal,
  kinds: [...new Set(uncPages.flatMap(p => p.uncrawlable_kinds || []))], orphan_pages: orphanPages.length,
  method: 'Read from the HTML of the key pages already fetched for this check: <a> tags with no href or a javascript: href that navigate on click, and elements (div, span, li, button, table rows) that carry a page address in an onclick or a data-href. A crawler follows none of them, so the pages behind them are reached only if something else links to them.' };
const render_diff = {
  available: checked.length > 0,
  crawl_js: !!plan.crawl_js,
  uncrawlable_links,
  not_available: checked.length ? '' : (targets.length ? 'no key page could be read twice: ' + (notChecked[0] ? notChecked[0].not_checked : 'both readings failed') : (plan.reason || 'no page to compare')),
  pages, pages_checked: checked.length, pages_not_checked: notChecked.length, pages_with_js_only: withJs.length,
  cap: plan.cap || 0, rendered_source: checked.length ? checked[0].rendered_source : '',
  method: 'Each page was read twice: a plain GET of the page (the first response, what a crawler that does not run JavaScript receives) and the same page after its scripts ran. Title, main heading, canonical link, robots meta, links and text length are read from both with the same parser, and URLs are compared without the www. prefix.',
  figures: FIGURES.map(f => f.label),
  checked_at: new Date().toISOString()
};

// ---- findings ----
const findings = [];
const works = [];
// `figure` names the reading this finding came from (h1, words, title, canonical, robots, links, uncrawlable, all). Build Site Issues uses
// it to join a crawl-wide symptom to its cause instead of scoring both (build section 65, B5-2).
const F = (category, severity, title, evidence, why, fix, urls, scoring, figure) => findings.push({ category, severity, title, evidence, why, fix,
  sample_urls: (urls || []).slice(0, 5), affected_count: (urls || []).length || null, affected_pct: checked.length ? Math.round(((urls || []).length / checked.length) * 100) : null,
  scope: 'page', scoring: scoring !== false, source: 'render_diff', figure: figure || '' });
const quote = (p, key) => { const f = p.figures.find(x => x.key === key) || {}; return p.path + ': ' + (key === 'links' || key === 'words' ? (Number(f.raw) || 0) + ' in the first response, ' + (Number(f.rendered) || 0) + ' after JavaScript' : '"' + S(f.rendered).slice(0, 70) + '" (the first response has ' + (S(f.raw) ? '"' + S(f.raw).slice(0, 70) + '"' : 'none') + ')'); };
const only = (key) => checked.filter(p => p.js_only.includes(key));
const differ = (key) => checked.filter(p => (p.differs || []).includes(key));

const h1Only = only('h1');
if (h1Only.length) F('Crawlability & Indexing', 'High', 'The main heading of ' + h1Only.length + ' page(s) only appears after JavaScript',
  h1Only.map(p => quote(p, 'h1')).join(' · '),
  'The heading is the strongest on-page signal of what a page is about. A crawler that does not run JavaScript — every AI crawler today, and Google on its first pass — sees the page without it.',
  'Render the <h1> on the server (server-side rendering, static generation or a prerender layer) so it is in the HTML of the first response.',
  h1Only.map(p => p.url), true, 'h1');

const textOnly = only('words');
if (textOnly.length) F('Crawlability & Indexing', 'High', 'The page text of ' + textOnly.length + ' page(s) only appears after JavaScript',
  textOnly.map(p => quote(p, 'words')).join(' · '),
  'A page whose text arrives only after its scripts run is an empty shell to any crawler that does not render, so it cannot be quoted, summarised or cited.',
  'Serve the main content in the first HTML response. Where that is a bigger change, add a prerender layer for crawlers first.',
  textOnly.map(p => p.url), true, 'words');

const titleBad = [...only('title'), ...differ('title')];
if (titleBad.length) F('On-Page', 'Medium', 'The title of ' + titleBad.length + ' page(s) is written by JavaScript',
  titleBad.map(p => quote(p, 'title')).join(' · '),
  'The title is what search engines and AI answers show. When the first response carries a different title (or none), that is the one a non-rendering crawler indexes.',
  'Put the final <title> in the server response instead of setting it from a script after load.',
  titleBad.map(p => p.url), true, 'title');

const canonBad = [...only('canonical'), ...differ('canonical')];
if (canonBad.length) F('Crawlability & Indexing', 'Medium', 'The canonical link of ' + canonBad.length + ' page(s) is not in the first response',
  canonBad.map(p => quote(p, 'canonical')).join(' · '),
  'A canonical that a script inserts is ignored by crawlers that do not render, so duplicates of the page can be indexed instead of the one you chose. (A www. host against a bare host is the same URL and is not counted here.)',
  'Output <link rel="canonical"> in the server-rendered <head>.',
  canonBad.map(p => p.url), true, 'canonical');

const robotsBad = [...only('robots'), ...differ('robots')];
if (robotsBad.length) {
  const blocksAfter = robotsBad.filter(p => { const f = p.figures.find(x => x.key === 'robots') || {}; return /noindex|none/i.test(S(f.rendered)) && !/noindex|none/i.test(S(f.raw)); });
  F('Crawlability & Indexing', blocksAfter.length ? 'High' : 'Medium', 'The robots meta of ' + robotsBad.length + ' page(s) changes after JavaScript',
    robotsBad.map(p => quote(p, 'robots')).join(' · '),
    blocksAfter.length ? 'A script adds noindex after load: the page looks indexable in the first response and asks to be dropped once rendered, and which reading wins is out of your hands.'
      : 'The indexing rules a crawler reads depend on whether it rendered the page, so two crawlers can treat the same page differently.',
    'Decide the robots directive on the server and send the same one in the first response (or as an X-Robots-Tag header).',
    robotsBad.map(p => p.url), true, 'robots');
}

const linksOnly = only('links');
if (linksOnly.length) F('Crawlability & Indexing', 'Medium', 'Most links of ' + linksOnly.length + ' page(s) appear only after JavaScript',
  linksOnly.map(p => quote(p, 'links')).join(' · '),
  'Links that a script writes are not followed by crawlers that do not render, so the pages behind them can stay undiscovered.',
  'Output real <a href> links in the server response for navigation and in-content links (a script may still enhance them).',
  linksOnly.map(p => p.url), true, 'links');

// ---- B5-1 (2026-10-15, benchmark area 5): the links a crawler cannot follow, and the orphan pages they explain ----
// Three or more on one page, or any on two pages, is a pattern and not a stray widget. The severity follows the harm that is visible in
// this same audit: Medium where the crawl already reports orphan pages or where most links appear only after JavaScript (the pages behind
// them are genuinely unreachable), Low otherwise - it is still worth fixing, never worth ranking first.
if (uncTotal >= 3 || uncPages.length >= 2) {
  const sev = (orphanPages.length || linksOnly.length) ? 'Medium' : 'Low';
  const kinds = uncrawlable_links.kinds.map(k => UNC_KINDS[k] || k);
  F('Crawlability & Indexing', sev, uncTotal + ' link(s) on ' + uncPages.length + ' key page(s) are built without a real <a href>',
    uncPages.map(p => p.path + ': ' + p.uncrawlable + ' (' + (p.uncrawlable_samples || []).map(x => '<' + x.tag + '>' + (x.detail ? ' \u2192 ' + x.detail : '')).slice(0, 3).join(', ') + ')').join(' \u00b7 ')
      + (orphanPages.length ? ' \u2014 the crawl also found ' + orphanPages.length + ' orphan page(s) with no crawlable internal link, which is what these usually cause' : ''),
    'A card, a tile or a button that navigates with a script is not a link: ' + kinds.join(', ') + '. No crawler queues the page behind it and no internal-link signal reaches it, so those pages are crawled rarely, rank on their own merits only, and are invisible to the AI crawlers, which do not run JavaScript at all.',
    'Make each one a real <a href="\u2026"> to the same address (the script can stay on top of it for the behaviour you want). The crawler, the AI crawlers and keyboard users all follow it then.',
    uncPages.map(p => p.url), true, 'uncrawlable');
}

const differsAny = checked.filter(p => p.js_only.length || (p.differs || []).length);
if (differsAny.length) F('AI Search Readiness', 'Medium', 'AI crawlers see a different version of ' + differsAny.length + ' key page(s)',
  differsAny.map(p => p.path + ' (' + [...p.js_only, ...(p.differs || [])].map(k => (FIGURES.find(f => f.key === k) || {}).label).join(', ') + ')').join(' · '),
  'ChatGPT, Perplexity, Claude and the other AI crawlers fetch the HTML and do not run JavaScript, so anything a script adds is invisible to the answers they write.',
  'Server-render at least the title, the main heading, the opening answer and the in-content links of every page you want quoted.',
  differsAny.map(p => p.url), true, 'all');

if (notChecked.length) F('Technical', 'Info', 'The response-versus-render check could not be completed for ' + notChecked.length + ' page(s)',
  notChecked.map(p => p.path + ': ' + p.not_checked).join(' · '),
  'A reading that failed says nothing about the page: it is reported as not checked rather than as "no difference".',
  notChecked.some(p => /bot challenge/.test(p.not_checked)) ? 'Allow our crawler through the bot protection (or share a staging URL) so the two readings can be compared.' : 'Nothing to do if the page answered for visitors; the next audit tries again.',
  notChecked.map(p => p.url), false, '');

if (checked.length && !withJs.length && !checked.some(p => (p.differs || []).length)) {
  works.push('Every key page checked (' + checked.length + ') serves its title, heading, canonical, robots rule, links and text in the first response, so crawlers that do not run JavaScript see the same page as Google does');
}

return [{ json: { ...prev, skip: undefined, render_diff,
  extra_findings: [...(prev.extra_findings || []), ...findings],
  extra_works: [...(prev.extra_works || []), ...works] } }];
