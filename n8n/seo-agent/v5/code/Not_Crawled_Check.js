// B5-5 (2026-10-15, benchmark area 5 — BENCH_AREA5_technical_audit.md §5(a) a5): what the known URLs the crawl never reached
// actually answer. One free plain GET each (*Fetch Not Crawled*, redirects NOT followed, so a redirect is itself the answer), read
// with the same parser the rest of the audit uses: status, the address it redirects to, `noindex` (meta or X-Robots-Tag), the
// canonical it names, and its title.
// The rule this node exists to keep: **a page we could not fetch is reported as not fetched, with the reason — never as a finding.**
// This audit once shipped seven findings with an empty evidence string; a new check that cannot say what it saw is worse than no
// check. So a timeout, a DNS failure and a bot wall are all `not_fetched`, counted apart and named, and every count below says how
// many of how many it was measured on (`checked` / `checked_of`).
// Nothing here can fail the audit, and nothing here costs anything.
let prev = {};
try { prev = $('Render Diff').first().json || {}; } catch (e) {}
if (!prev.probe) { try { const i = $input.first().json || {}; if (i.probe || i.skip) prev = i; } catch (e2) {} }

let reqs = [];
try { reqs = $('Not Crawled Targets').all().map(i => i.json || {}); } catch (e) {}
let res = [];
try { res = $('Fetch Not Crawled').all().map(i => i.json || {}); } catch (e) {}

const S = (v) => String(v == null ? '' : v).trim();
const n0 = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const pathOf = (u) => S(u).replace(/^https?:\/\/[^\/]+/, '').replace(/[?#].*$/, '') || '/';
const bodyOf = (r) => { const b = r && (r.body != null ? r.body : r.data); return typeof b === 'string' ? b : (b ? String(b) : ''); };
const headerOf = (r, name) => { const h = (r && r.headers) || {}; const k = Object.keys(h).find(x => String(x).toLowerCase() === name); const v = k ? h[k] : ''; return S(Array.isArray(v) ? v.join(', ') : v); };
// host-agnostic: a crawl reports www. while a canonical may use the bare host, and that is not a mismatch (D15 / G14)
const ukey = (u) => S(u).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/$/, '');
const sameUrl = (a, b) => !!ukey(a) && ukey(a) === ukey(b);
const attr = (tag, name) => { const m = S(tag).match(new RegExp(name + '\\s*=\\s*("([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i')); return m ? S(m[2] || m[3] || m[4]) : ''; };

const targets = reqs.filter(r => r && r.url && !r.skip);
const planned = (reqs.find(r => r && r.not_crawled_plan) || {}).not_crawled_plan || null;
const skipped = reqs.find(r => r && r.skip) || null;

const findings = [];
const works = [];
const F = (severity, title, evidence, why, fix, urls, pct, scoring) => findings.push({ category: 'Crawlability & Indexing', severity, title, evidence, why, fix,
  sample_urls: (urls || []).slice(0, 5), affected_count: (urls || []).length || null, affected_pct: pct == null ? null : Math.max(1, Math.min(100, Math.round(pct))),
  scope: 'page', scoring: scoring !== false, source: 'not_crawled', figure: '' });

// ---- read every answer (paired by position: the fetch node keeps one answer per request) ----
const pages = targets.map((t, i) => {
  const r = res[i] || {};
  const out = { url: S(t.url), path: pathOf(t.url), source: S(t.source), impressions: n0(t.impressions), clicks: n0(t.clicks),
    changed_at: S(t.changed_at), changed_label: S(t.changed_label),
    checked: false, not_checked: '', status: 0, state: '', redirect_to: '', noindex: false, canonical: '', title: '' };
  const status = n0(r.statusCode != null ? r.statusCode : r.status);
  const errText = r && r.error ? S((r.error.message || r.error.description || r.error)).slice(0, 160) : '';
  if (!status) { out.not_checked = errText ? 'the request failed: ' + errText : 'the page gave no answer (timeout or no connection)'; return out; }
  out.status = status;
  if (status === 401 || status === 403 || status === 429) {
    out.not_checked = 'the server refused our request (HTTP ' + status + '): a bot wall or a rate limit, which says nothing about the page itself';
    return out;
  }
  out.checked = true;
  if (status >= 300 && status < 400) { out.redirect_to = headerOf(r, 'location'); out.state = 'redirect'; return out; }
  if (status === 404 || status === 410) { out.state = 'gone'; return out; }
  if (status >= 400) { out.state = 'error'; return out; }
  const html = bodyOf(r);
  const xrobots = headerOf(r, 'x-robots-tag');
  const metaRobots = (html.match(/<meta[^>]+>/gi) || []).filter(t2 => /name\s*=\s*["']?(robots|googlebot)["']?/i.test(t2)).map(t2 => attr(t2, 'content')).join(', ');
  out.noindex = /\bnoindex\b/i.test(xrobots) || /\bnoindex\b/i.test(metaRobots);
  out.robots_rule = S([metaRobots, xrobots].filter(Boolean).join(' / ')).slice(0, 120);
  const canonTag = (html.match(/<link[^>]+>/gi) || []).find(t2 => /rel\s*=\s*["']?canonical["']?/i.test(t2)) || '';
  out.canonical = canonTag ? attr(canonTag, 'href') : '';
  const titleM = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  out.title = titleM ? S(titleM[1].replace(/\s+/g, ' ')).slice(0, 160) : '';
  out.state = out.noindex ? 'noindex'
    : (out.canonical && !sameUrl(out.canonical, out.url)) ? 'canonical_elsewhere'
      : 'live';
  return out;
});

const checked = pages.filter(p => p.checked);
const notChecked = pages.filter(p => !p.checked);
const by = (st) => checked.filter(p => p.state === st);
const states = {};
for (const p of checked) states[p.state] = (states[p.state] || 0) + 1;
const share = (n) => checked.length ? (n / checked.length) * 100 : null;
const seen = (list) => list.filter(p => p.impressions > 0);
const totalNotCrawled = planned ? n0(planned.not_crawled_total) : targets.length;
const sampleNote = checked.length
  ? checked.length + ' of the ' + (totalNotCrawled || checked.length) + ' known URL(s) the crawl never reached were read'
    + (notChecked.length ? ', ' + notChecked.length + ' more could not be read' : '')
  : 'none of the known URLs the crawl never reached could be read';

const available = checked.length > 0;
const not_available = available ? '' : (!planned && skipped) ? S(skipped.reason)
  : notChecked.length ? 'none of the ' + notChecked.length + ' URL(s) tried could be read: ' + [...new Set(notChecked.map(p => p.not_checked))].slice(0, 2).join('; ')
    : 'no known URL outside the crawl was read in this run';

if (available) {
  const dead = [...by('gone'), ...by('error')];
  if (dead.length) {
    const hurt = seen(dead);
    F(hurt.length ? 'High' : 'Medium', 'Known URLs outside the crawl no longer answer',
      dead.slice(0, 5).map(p => p.path + ': HTTP ' + p.status).join(' · ') + ' — ' + sampleNote
        + (hurt.length ? '; ' + hurt.length + ' of them still earn impressions in Search Console' : ''),
      'These addresses are in your sitemap or Google still shows them, but they return an error. Visitors and crawlers that follow them hit a dead end, and the link value pointing at them is lost.',
      'Restore each page or 301-redirect it to the closest live page, then remove the dead address from the sitemap.',
      dead.map(p => p.url), share(dead.length));
  }
  const live = by('live');
  if (live.length) {
    F('Medium', 'Live, indexable pages the crawl never reached',
      live.length + ' of the ' + checked.length + ' URL(s) read answer 200 and are indexable, and this audit judged nothing about them: '
        + live.slice(0, 4).map(p => p.path).join(', ') + (live.length > 4 ? ' …' : '') + '. ' + sampleNote + '.',
      'Every share and count in this report is a share of the pages that were crawled. These pages exist and can rank, but no finding here covers them — the crawl stopped before it reached them, or nothing on the site links to them.',
      'Raise the crawl limit for this site so the next audit covers them, and link to them from the pages that already rank (the crawler follows links, and so do visitors).',
      live.map(p => p.url), share(live.length));
  }
  const noidx = by('noindex');
  if (noidx.length) {
    const hurt = seen(noidx);
    F(hurt.length ? 'Medium' : 'Low', 'Known URLs outside the crawl are set to noindex',
      noidx.slice(0, 5).map(p => p.path + (p.robots_rule ? ' (' + p.robots_rule + ')' : '')).join(' · ') + ' — ' + sampleNote
        + (hurt.length ? '; ' + hurt.length + ' of them still earn impressions' : ''),
      'A page marked noindex cannot rank. When it is in the sitemap as well, the sitemap is telling Google to index exactly what the page tells it not to.',
      'Decide which it is: remove the noindex if the page should rank, or take it out of the sitemap if it should not.',
      noidx.map(p => p.url), share(noidx.length));
  }
  const redir = by('redirect');
  if (redir.length) {
    F('Low', 'Known URLs outside the crawl redirect somewhere else',
      redir.slice(0, 5).map(p => p.path + ' → ' + (pathOf(p.redirect_to) || p.redirect_to || 'an unnamed address') + ' (' + p.status + ')').join(' · ') + ' — ' + sampleNote,
      'A redirected address in the sitemap wastes crawl budget and makes the sitemap less trustworthy; Google is told to fetch a URL that is not the real one.',
      'List only the final 200-status addresses in the sitemap.',
      redir.map(p => p.url), share(redir.length));
  }
  const canon = by('canonical_elsewhere');
  if (canon.length) {
    F('Low', 'Known URLs outside the crawl point their canonical at another page',
      canon.slice(0, 5).map(p => p.path + ' → ' + (pathOf(p.canonical) || p.canonical)).join(' · ') + ' — ' + sampleNote,
      'These pages answer 200 but tell Google that another page is the real one, so they will not rank on their own.',
      'Leave them out of the sitemap, or make each one distinct and set its canonical to itself.',
      canon.map(p => p.url), share(canon.length));
  }
  if (!dead.length && !noidx.length && !redir.length && !canon.length) {
    works.push('Every one of the ' + checked.length + ' known URL(s) read outside the crawl answers 200 and is indexable — the gap in the crawl is a crawl limit, not a broken part of the site');
  }
}
// a page we could not fetch is NEVER a finding about the page: it is counted, named and left alone
if (notChecked.length) {
  F('Info', notChecked.length + ' known URL(s) outside the crawl could not be read',
    notChecked.slice(0, 4).map(p => p.path + ': ' + p.not_checked).join(' · '),
    'A request that failed says nothing about the page. It is reported as not read rather than as a problem, and nothing in this report counts it.',
    notChecked.some(p => /refused|bot wall|rate limit/i.test(p.not_checked))
      ? 'Allow our checker through the bot protection if you want these addresses judged; otherwise nothing to do.'
      : 'Nothing to do if the address answers for visitors; the next audit tries again.',
    notChecked.map(p => p.url), null, false);
}

const not_crawled_check = {
  available, not_available,
  checked: checked.length, checked_of: targets.length, not_checked: notChecked.length,
  not_crawled_total: totalNotCrawled || null,
  known_urls: planned ? planned.known_urls : null, coverage_pct: planned ? planned.coverage_pct : null, cap: planned ? planned.cap : null,
  states, order_note: planned ? S(planned.order_note) : '', changed_first: planned ? n0(planned.changed_first) : 0,
  changed: planned ? planned.changed : null,
  method: planned ? S(planned.method) : 'Up to 25 of the known URLs the crawl never reached are read with one free plain GET each (status, redirect, robots rule, canonical, title).',
  basis: available
    ? 'measured: ' + sampleNote + '. Each one was read with a single plain GET, '
      + (planned && planned.changed && planned.changed.read && n0(planned.changed_first) ? 'the pages we submitted or wrote this week first, then ' : '') + 'the pages Google shows most often'
    : 'not available: ' + not_available,
  pages: pages.slice(0, 25).map(p => ({ url: p.url, path: p.path, source: p.source, status: p.status, state: p.state, checked: p.checked,
    not_checked: p.not_checked, redirect_to: p.redirect_to, canonical: p.canonical, title: p.title, noindex: p.noindex,
    impressions: p.impressions, changed_at: p.changed_at, changed_label: p.changed_label })),
};

return [{ json: { ...prev, skip: undefined, not_crawled_check,
  extra_findings: [...(prev.extra_findings || []), ...findings],
  extra_works: [...(prev.extra_works || []), ...works] } }];
