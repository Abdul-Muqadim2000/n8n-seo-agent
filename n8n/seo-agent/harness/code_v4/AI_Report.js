// Weekly AI-visibility report per site (e-mail HTML + the same document for the PDF; v4.9): headline, KPI tiles with the 95% range and last week's
// change (marked when it is beyond sampling noise), alerts, actions (with ready-to-send API bodies for content gaps), what AI visits are worth (GA4),
// how AI describes the business and what it gets wrong, whether AI crawlers can read the site, buyer stages and topics, the answer grid (question x
// engine, with the week's win rate and demand), engines, competitors, the market-wide index, what AI searched, questions worth tracking, the sources
// AI trusts, your cited pages, the monthly market view and the method. Uses the Claude brief when present, the computed facts otherwise.
// G29 (2026-10-13, FIX_PLAN): the method paragraph is kept, and every figure group also carries its source, period and sample as
// structured fields (LN) so "Where these numbers come from" can be read without reading the prose — and so the app can show the same.
// ---- shared report helpers (inlined by the build): the same look as the Site Tracker report ----
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const n = (v) => (Number(v) || 0).toLocaleString('en-GB');
const td = 'style="padding:4px 8px;border:1px solid #cbd5e1;font-size:13px;vertical-align:top"', th = 'style="padding:4px 8px;border:1px solid #cbd5e1;background:#f1f5f9;text-align:left;font-size:12px"';
const table = (headers, rows, empty) => rows.length ? '<table style="border-collapse:collapse;margin:6px 0;max-width:100%">' + '<tr>' + headers.map(h => '<th ' + th + '>' + esc(h) + '</th>').join('') + '</tr>' + rows.map(r => '<tr>' + r.map(c => '<td ' + td + '>' + c + '</td>').join('') + '</tr>').join('') + '</table>' : '<p style="color:#64748b;font-size:13px">' + esc(empty || 'nothing to show') + '</p>';
const tile = (label, value, delta, color) => '<td style="padding:8px 12px;border:1px solid #e2e8f0;min-width:110px;vertical-align:top"><div style="font-size:11px;color:#64748b;text-transform:uppercase">' + esc(label) + '</div><div style="font-size:20px;font-weight:700">' + value + '</div><div style="font-size:12px;color:' + (color || '#475569') + '">' + delta + '</div></td>';
const h3 = (t) => '<h3 style="margin:18px 0 4px;font-size:15px;color:#0f172a">' + esc(t) + '</h3>';
const p_ = (t, muted) => '<p style="margin:4px 0;font-size:13px' + (muted ? ';color:#64748b' : '') + '">' + t + '</p>';
const pathOf = (u) => { const p = String(u || '').replace(/^https?:\/\/[^\/]+/i, ''); return p || '/'; };
const link = (u, label) => u ? '<a href="' + esc(u) + '" style="color:#1d4ed8">' + esc(label || pathOf(u)) + '</a>' : '—';
const dpts = (v) => v == null ? '' : (v > 0 ? '<span style="color:#15803d">▲ ' + v + ' pts</span>' : v < 0 ? '<span style="color:#b91c1c">▼ ' + Math.abs(v) + ' pts</span>' : 'no change');
const briefBox = (b) => b ? '<div style="background:#f8fafc;border-left:4px solid #1d4ed8;padding:10px 12px;margin:8px 0"><div style="font-weight:700;font-size:15px">' + esc(b.headline) + '</div><p style="margin:6px 0 0;font-size:13px">' + esc(b.summary) + '</p></div>' : '';
const alertBox = (alerts) => (alerts || []).length ? '<div style="background:#fef2f2;border-left:4px solid #b91c1c;padding:8px 12px;margin:8px 0">' + alerts.map(a => '<div style="font-size:13px">⚠ ' + esc(a.text || a) + '</div>').join('') + '</div>' : '';
const wrapDoc = (title, body) => '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(title) + '</title></head><body style="margin:24px">' + body + '</body></html>';
const b64 = (s) => Buffer.from(String(s), 'utf8').toString('base64');

// ---- lineage (G29, 2026-10-13, system review FIX_PLAN.md; CRITERIA_technical_tracking_reporting_ai_links.md 3.11) ----
// Every number a customer reads has to say where it came from, over what period, and how big the sample was. Before this, the AI
// visibility report said it (sample sizes, Wilson ranges) and the others did not: the weekly report printed "1,240 impressions" and
// "#8" side by side without saying that one is a 28-day Search Console count and the other one live sample of one results page.
// LN.of() carries that as structured fields next to the value (`source`, `period`, `sample`, `basis`), LN.note() turns them into one
// short line for a tooltip or a footnote, and LN.block() prints the whole list under a report as "Where these numbers come from".
// Rules: the vocabulary is the one the rest of the system already uses (G6 "modelled, not measured clicks", G8 `calibrated` /
// `modelled` / `unknown`, G28 statistical ranges, G26 `impact_basis`) - this kit makes it universal, it does not invent a second
// scheme. A modelled or uncalibrated number must say so. Where lineage is genuinely unknown the note reads "source not recorded":
// never a guessed source.
const LN = (() => {
  const MISSING = 'source not recorded';
  // where numbers come from. `label` is what a customer reads, `how` the one sentence about what that source can and cannot see.
  const SOURCES = {
    gsc: { label: 'Google Search Console', how: 'Google\'s own count of the impressions and clicks it served; the last 3 days are not final, and figures are averages across devices and locations' },
    gsc_history: { label: 'your stored Search Console history', how: 'the weekly Search Console readings we have kept for this site' },
    inspection: { label: 'Search Console URL Inspection', how: 'Google\'s own answer about one URL at the moment it was asked' },
    gsc_links: { label: 'your Search Console link export', how: 'the sample of links Google shows you; it is a sample, not the whole list' },
    ga4: { label: 'Google Analytics 4', how: 'visits measured on your site by your own GA4 property' },
    serp: { label: 'a live Google results page', how: 'one results page read through DataForSEO at that moment, from one country and one device' },
    kwdata: { label: 'Google Ads keyword data (through DataForSEO)', how: 'the provider\'s monthly search volume and cost per click; a provider estimate for a single keyword, not a measurement of your site' },
    backlink_index: { label: 'the DataForSEO backlink index', how: 'one crawler\'s index of the web: it finds much of the web, never all of it' },
    bing: { label: 'Bing Webmaster Tools', how: 'Bing\'s own figures for the site it has verified' },
    link_graph: { label: 'the Common Crawl web graph', how: 'a public crawl of the web, released every few months' },
    ahrefs: { label: 'the Ahrefs Domain Rating API', how: 'Ahrefs\' own 0-100 rating of a domain' },
    trends: { label: 'Google Trends', how: 'a relative index of search interest (100 = the peak of the period), not a count of searches' },
    ai_engines: { label: 'the AI assistants themselves', how: 'the answers ChatGPT, Gemini, Google AI Mode and the others gave to the questions in your panel' },
    ai_db: { label: 'the DataForSEO AI-answer database', how: 'a database of AI answers and the brands they name' },
    own_check: { label: 'our own fetch of the page', how: 'we requested the page ourselves and read what came back' },
    draft: { label: 'the finished draft itself', how: 'counted in the text this run wrote, before anybody published it' },
    crawl: { label: 'our crawl of your website', how: 'the pages we could reach and read on your site' },
    crux: { label: 'the Chrome User Experience Report', how: 'speed as real Chrome visitors experienced it over 28 days' },
    pagespeed: { label: 'Google PageSpeed Insights (Lighthouse)', how: 'one simulated mobile load in a lab, not what your visitors felt' },
    rdap: { label: 'the domain registry (RDAP, else WHOIS)', how: 'the registry\'s own record of when a domain was registered' },
    gbp: { label: 'Google Business Profile', how: 'the public listing Google holds for the business' },
    wikidata: { label: 'Wikidata', how: 'the public knowledge base search engines read' },
    web: { label: 'public web pages we read', how: 'pages we fetched and quoted; nothing behind a login' },
    you: { label: 'what you told us', how: 'the business profile, the monthly check-in or the forms you filled in' },
    model: { label: 'a model on top of measured data', how: 'computed from measured numbers with a published formula, not measured itself' },
    none: { label: MISSING, how: 'this figure reached the report without its source: treat it as unverified' },
  };
  // how the figure was arrived at. The words are the ones G6 / G8 / G28 already use.
  const BASIS = {
    measured: 'measured',
    calibrated: 'calibrated against your own measured data',
    modelled: 'modelled, not measured',
    one_sample: 'one sample, not an average',
    estimated: 'estimated',
    reported: 'reported by the source',
    unknown: MISSING,
  };
  const S = (v) => String(v == null ? '' : v);
  const fmt = (v) => (Number(v) || 0).toLocaleString('en-GB');
  const esc1 = (s) => S(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const src = (k) => SOURCES[k] || SOURCES.none;
  // "2026-09-15 to 2026-10-12 (28 days)" - the period a figure covers, never an empty string
  const range = (r, label) => { const o = r || {}; const a = S(o.start), b = S(o.end);
    if (!a && !b) return label ? S(label) : 'period not recorded';
    if (a && b) { const d = Math.round((new Date(b + 'T00:00:00Z').getTime() - new Date(a + 'T00:00:00Z').getTime()) / 864e5) + 1;
      return a + ' to ' + b + (Number.isFinite(d) && d > 0 ? ' (' + d + ' day' + (d === 1 ? '' : 's') + ')' : ''); }
    return 'to ' + (b || a); };
  const asOf = (at) => { const d = S(at).slice(0, 10); return d ? 'as of ' + d : 'date not recorded'; };
  const days = (n, end) => (Number(n) || 0) + ' days' + (S(end).slice(0, 10) ? ' to ' + S(end).slice(0, 10) : '');
  const sample = (n, unit) => (n == null || n === '' || !Number.isFinite(Number(n))) ? 'sample not recorded' : fmt(n) + (unit ? ' ' + S(unit) : '');
  // one figure's lineage, as structured fields beside the value
  const of = (figure, source, o) => { const x = o || {}; const key = SOURCES[source] ? source : 'none';
    const basis = BASIS[x.basis] ? x.basis : (key === 'none' ? 'unknown' : 'measured');
    return { figure: S(figure), source: key, source_label: src(key).label, source_how: src(key).how,
      period: S(x.period) || 'period not recorded', sample: x.sample == null ? 'sample not recorded' : S(x.sample),
      basis, basis_label: BASIS[basis], note: S(x.note) };
  };
  // a figure whose source nobody recorded: say exactly that instead of inventing one
  const unknown = (figure, why) => ({ figure: S(figure), source: 'none', source_label: MISSING, source_how: src('none').how,
    period: '', sample: '', basis: 'unknown', basis_label: MISSING, note: S(why) });
  // "Google Search Console · 2026-09-15 to 2026-10-12 (28 days) · 1,240 impressions · measured"
  const note = (l) => { const x = l || {}; const lbl = x.source_label || MISSING;
    return [lbl, x.period, x.sample, x.basis_label === lbl ? '' : x.basis_label, x.note].filter(Boolean).join(' · '); };
  const isHonest = (l) => !!l && (l.basis !== 'unknown' || note(l).indexOf(MISSING) >= 0);
  // ---- the evidence half of the same rule (R10, promoted to the class by lineage_lint.py, 2026-10-15) ----
  // A finding is a figure like any other: it may not be shown without the thing that shows it. R10 was exactly this - Google
  // retired the Mobile Usability report, the API answered VERDICT_UNSPECIFIED for every page, and the audit raised a HIGH finding
  // on 45 of 47 pages whose evidence string was "/:  | /whatwedo/ai-automation: " - punctuation and nothing else. So the test is
  // not `evidence !== ''`: a string that is only separators, brackets or a bare "0" carries no evidence either.
  const hasEvidence = (f) => {
    const ev = S((f || {}).evidence).replace(/<[^>]*>/g, ' ');     // markup is not evidence
    return /[A-Za-z]|[1-9]/.test(ev.replace(/[\s;|,.:·\-–—()\[\]\/]+/g, ' '));
  };
  // the findings that may be shown, and the titles of the ones held back. `allow` names a title that is evidence in itself
  // (a count in the title, a note about data that could not be collected); everything else has to carry its own.
  const unevidenced = (list, o) => { const x = o || {}; const allow = (x.allow || []).map(S);
    return (list || []).filter(f => f && !hasEvidence(f) && allow.indexOf(S(f.title)) < 0).map(f => S(f.title || f.id || 'untitled')); };
  const evidenced = (list, o) => { const x = o || {}; const allow = (x.allow || []).map(S);
    const keep = (list || []).filter(f => f && (hasEvidence(f) || allow.indexOf(S(f.title)) >= 0));
    if (typeof x.onDrop === 'function') { const d = unevidenced(list, o); if (d.length) x.onDrop(d); }
    return keep; };
  const evidenceNote = (dropped) => (dropped || []).length
    ? (dropped.length + ' finding(s) were left out because nothing was measured to show them: ' + dropped.slice(0, 5).join(', ')) : '';
  const html = (l) => '<span style="color:#64748b;font-size:11px">' + esc1(note(l)) + '</span>';
  const line = (l) => '<div style="color:#64748b;font-size:11px;margin-top:2px">' + esc1(note(l)) + '</div>';
  // the block under a report: one row per figure, so no number is left without a source, a period and a sample
  const block = (list, o) => { const rows = (list || []).filter(Boolean); const x = o || {};
    const td = 'style="padding:3px 8px;border:1px solid #cbd5e1;font-size:11px;vertical-align:top;color:#334155"';
    const th = 'style="padding:3px 8px;border:1px solid #cbd5e1;background:#f1f5f9;text-align:left;font-size:11px"';
    if (!rows.length) return '';
    return '<h3 style="margin:18px 0 4px;font-size:13px;color:#0f172a">' + esc1(x.title || 'Where these numbers come from') + '</h3>'
      + '<table style="border-collapse:collapse;margin:4px 0;max-width:100%">'
      + '<tr><th ' + th + '>Figure</th><th ' + th + '>Source</th><th ' + th + '>Period</th><th ' + th + '>Sample</th><th ' + th + '>How it was arrived at</th></tr>'
      + rows.map(l => '<tr><td ' + td + '>' + esc1(l.figure) + '</td><td ' + td + '>' + esc1(l.source_label) + '</td><td ' + td + '>' + esc1(l.period || '-')
        + '</td><td ' + td + '>' + esc1(l.sample || '-') + '</td><td ' + td + '>' + esc1([l.basis_label, l.note].filter(Boolean).join(': ')) + '</td></tr>').join('')
      + '</table><p style="color:#64748b;font-size:11px;margin:4px 0">' + esc1(x.footer || 'A figure marked "' + BASIS.modelled + '" is computed, not counted; "' + MISSING + '" means the figure reached this report without its source and should be treated as unverified.') + '</p>';
  };
  return { of, unknown, note, html, line, block, range, asOf, days, sample, isHonest, hasEvidence, evidenced, unevidenced,
    evidenceNote, SOURCES, BASIS, MISSING };
})();
// ---- W2-E1 (2026-10-23, docs/ai-visibility-2026-10-23/WAVE2_CONTRACTS.md §1 §2, fixes/W2-E1.md): the answer-level data every engine call
// already returns and the tracker used to throw away. Inlined (AAD) into Parse AI Answers (weekly and pulse), Analyst Jobs, Apply Analysis,
// AI Metrics, AI Report and Prompt Jobs by build_monitors.py (placeholder AI_ANSWER_DATA).
//   per answer (seo_ai_answers): the full answer text (capped at 12,000 characters, the analyst re-reads it in a run's last part when the part
//     that paid for it died before its analysis), every source cited in order (cited_json), the pages the engine READ but did not cite
//     (retrieved_json: the ChatGPT interface's search_results minus its sources), the searches it ran (fanout_json), product cards
//     (products_json: ChatGPT chat_gpt_products, AI Mode / AI Overview ai_overview_shopping), ads (ads_json: ChatGPT chat_gpt_ad, AI Mode
//     ai_overview_paid), local-business cards (local_json: ChatGPT chat_gpt_local_businesses) and the model the response reports.
//     An empty list '[]' is "the engine can show these and showed none"; '' is "this engine does not report them" (or an older row).
//   per run (seo_ai_visibility): urls_json (your pages read / cited, the page cited instead), sources_json (rule-based source types, first /
//     last seen, half-life from stored history), shopping_json (trigger rate with n; "no shopping results", never 0%), ads_local_json.
// No URL constructor in the n8n sandbox: hosts are read with a regex.
const AAD = (() => {
  const TEXT_CAP = 12000, LIST_CAP = 40, FANOUT_CAP = 20;
  const S = (v) => v == null ? '' : String(v);
  const tb = (v) => v === true || S(v) === 'true';
  const hostOf = (u) => { const m = S(u).match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); return m ? m[1].toLowerCase().replace(/^www\d?\./, '') : ''; };
  const normH = (h) => S(h).toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\d?\./, '').replace(/[\/?#:].*$/, '');
  const TRACK = /^(utm_[a-z_]*|srsltid|gclid|gbraid|wbraid|dclid|fbclid|msclkid|yclid|twclid|igshid|mc_cid|mc_eid|ref|ref_src|referrer|_hsenc|_hsmi|hsa_[a-z]+|spm|at_[a-z_]+)$/i;
  const clean = (u) => { const s = S(u).trim(); const m = s.match(/^(https?):\/\/([^/?#]+)([^?#]*)(\?[^#]*)?/i); if (!m) return s.replace(/#.*$/, '');
    const q = (m[4] || '').replace(/^\?/, '').split('&').filter(kv => kv && !TRACK.test(kv.split('=')[0])).join('&');
    return m[1].toLowerCase() + '://' + m[2].toLowerCase().replace(/^www\./, '').replace(/:(?:80|443)$/, '') + (m[3] || '/') + (q ? '?' + q : ''); };
  const SL2 = /^(co|com|org|net|gov|ac|edu|ltd|plc|sch|nic|mil|go|or|ne|gob|gouv)\.[a-z]{2}$/;
  const regD = (h) => { const x = normH(h); const p = x.split('.').filter(Boolean); if (p.length <= 2) return p.join('.'); return SL2.test(p.slice(-2).join('.')) ? p.slice(-3).join('.') : p.slice(-2).join('.'); };
  const J = (v, d) => { if (v && typeof v === 'object') return v; if (v == null || v === '') return d; try { const x = JSON.parse(String(v)); return x == null ? d : x; } catch (e) { return d; } };
  const pctOf = (a, b) => b ? Math.round(1000 * a / b) / 10 : null;
  const wilson = (k, n) => { if (!n) return null; const z = 1.96, p = k / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
    return [Math.max(0, Math.round(1000 * (c - h)) / 10), Math.min(100, Math.round(1000 * (c + h)) / 10)]; };
  const num = (v) => { const x = Number(v); return v == null || v === '' || !Number.isFinite(x) ? null : x; };
  // the answer's full text: whitespace normalised (runs of spaces / tabs to one, 3+ line breaks to 2: the list structure the analyst and
  // the app read stays), capped at TEXT_CAP characters
  const textOf = (t) => { const s = S(t).replace(/\r\n?/g, '\n').replace(/[ \t\f\v ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    return { text: s.slice(0, TEXT_CAP), cut: s.length > TEXT_CAP, len: s.length }; };

  // ---- which engines report what (an engine that cannot show a thing stores '', never '[]') ----
  const SHOWS = { products: new Set(['chatgpt', 'ai_mode', 'ai_overview']), ads: new Set(['chatgpt', 'ai_mode', 'ai_overview']), local: new Set(['chatgpt']), retrieved: new Set(['chatgpt']) };
  const isScraper = (engine, res) => engine === 'chatgpt' || (engine === 'gemini' && !!res && (res.markdown != null || (res.items || []).some(x => /^gemini_/.test(S(x && x.type)))));

  /** One answer's data (WAVE2_CONTRACTS §1). ctx: { engine, res (the task result), answered, text, cites [{url, host, title}], fanout [..],
   *  isOurs(host), ownNames [lower-case brand names], entities (AIE.read(...).entities), sameEntity, kindOfDomain } */
  const answerFields = (ctx) => {
    const c = ctx || {}; const e = S(c.engine); const res = c.res || null;
    const empty = { answer_text: '', cited_json: '', retrieved_json: '', fanout_json: '', products_json: '', ads_json: '', local_json: '', model: '', detail_json: '' };
    if (!c.answered || !res) return { ...empty, model: res ? S(res.model || res.model_name).slice(0, 80) : '' };
    const isOurs = typeof c.isOurs === 'function' ? c.isOurs : () => false;
    const own = (c.ownNames || []).map(x => S(x).toLowerCase()).filter(x => x.length >= 3);
    const ents = Array.isArray(c.entities) ? c.entities : [];
    const same = typeof c.sameEntity === 'function' ? c.sameEntity : (a, b) => regD(a) === regD(b);
    const entityOf = (host) => { const h = normH(host); if (!h) return { id: '', role: '' }; if (isOurs(h)) return { id: regD(h), role: 'self' };
      const r = regD(h); const x = ents.find(en => en && en.id && /\./.test(S(en.id)) && same(en.id, r)); return x ? { id: S(x.id), role: S(x.role) || 'source' } : { id: r, role: 'source' }; };
    const ownName = (s) => { const t = S(s).toLowerCase(); return !!t && own.some(n => t === n || (n.length >= 5 && t.indexOf(n) >= 0)); };
    const T = textOf(c.text);
    // every source cited, in order (1-based), one entry per page
    const seen = new Set(); const cited = [];
    for (const x of (c.cites || [])) { const url = x && x.url ? clean(x.url).slice(0, 300) : ''; const host = normH((x && x.host) || hostOf(url)); if (!host && !url) continue;
      const k = url || ('host:' + host); if (seen.has(k)) continue; seen.add(k); const en = entityOf(host);
      cited.push({ url, host, entity_id: en.id, role: en.role, position: cited.length + 1 }); if (cited.length >= LIST_CAP) break; }
    const citedUrls = new Set(cited.map(x => x.url).filter(Boolean));
    // pages the engine read but did not cite: the ChatGPT interface returns everything it retrieved (search_results) beside what it cited
    let retrieved = null;
    if (SHOWS.retrieved.has(e) && isScraper(e, res)) { retrieved = []; const rs = new Set();
      for (const x of (Array.isArray(res.search_results) ? res.search_results : [])) { const url = x && x.url ? clean(x.url).slice(0, 300) : ''; if (!url || citedUrls.has(url) || rs.has(url)) continue; rs.add(url);
        const host = normH(hostOf(url) || (x && x.domain)); retrieved.push({ url, host, entity_id: entityOf(host).id }); if (retrieved.length >= LIST_CAP) break; } }
    const fanout = Array.isArray(c.fanout) ? [...new Set(c.fanout.map(q => S(q).replace(/\s+/g, ' ').trim().slice(0, 200)).filter(Boolean))].slice(0, FANOUT_CAP) : [];
    const items = Array.isArray(res.items) ? res.items : [];
    const ao = items.find(x => x && x.type === 'ai_overview') || null;
    const sub = ao && Array.isArray(ao.items) ? ao.items : [];
    // product cards: ChatGPT's carousel (chat_gpt_products) and Google's shopping block inside the AI answer (ai_overview_shopping)
    let products = null;
    if (SHOWS.products.has(e) && (e === 'chatgpt' ? isScraper(e, res) : !!ao)) { products = [];
      const groups = e === 'chatgpt' ? [...items.filter(x => x && x.type === 'chat_gpt_products'), ...(Array.isArray(res.chat_gpt_products) ? [{ items: res.chat_gpt_products }] : [])] : sub.filter(x => x && x.type === 'ai_overview_shopping');
      for (const g of groups) for (const p of (Array.isArray(g.items) ? g.items : [])) { if (!p) continue;
        const url = p.url ? clean(p.url).slice(0, 300) : ''; const host = normH(p.domain || hostOf(url));
        const merchant = S(e === 'chatgpt' ? (p.merchants || p.merchant || p.seller || host) : (p.seller || p.marketplace || host)).replace(/\s+/g, ' ').trim().slice(0, 80);
        const pr = p.price && typeof p.price === 'object' ? p.price : null;
        const price = pr ? num(pr.current != null ? pr.current : pr.max_value) : num(p.price);
        const currency = S(pr ? pr.currency : p.currency).slice(0, 8);
        const en = entityOf(host);
        products.push({ title: S(p.title).replace(/\s+/g, ' ').trim().slice(0, 160), merchant, price, currency, url, position: products.length + 1, entity_id: en.id, own: (!!host && isOurs(host)) || ownName(merchant) });
        if (products.length >= LIST_CAP) break; } }
    // ads: ChatGPT's ad unit (is_rendered: false = in the response but not shown) and the paid block inside Google's AI answer
    let ads = null;
    if (SHOWS.ads.has(e) && (e === 'chatgpt' ? isScraper(e, res) : !!ao)) { ads = [];
      if (e === 'chatgpt') for (const a of items.filter(x => x && x.type === 'chat_gpt_ad')) { const adv = a.advertiser || {}; const url = clean(a.url || adv.url || '').slice(0, 300); const host = normH(a.domain || hostOf(url) || hostOf(adv.url));
        ads.push({ advertiser: S(adv.name || a.title || host).slice(0, 80), url, host, rendered: a.is_rendered !== false }); }
      else for (const g of sub.filter(x => x && x.type === 'ai_overview_paid')) for (const a of (Array.isArray(g.items) ? g.items : [])) { if (!a) continue; const url = clean(a.url || '').slice(0, 300); const host = normH(a.domain || hostOf(url));
        ads.push({ advertiser: S(a.website_name || a.title || host).slice(0, 80), url, host, rendered: true }); }
      ads = ads.slice(0, 12); }
    // local-business cards (ChatGPT)
    let local = null;
    if (SHOWS.local.has(e) && isScraper(e, res)) { local = [];
      for (const g of items.filter(x => x && x.type === 'chat_gpt_local_businesses')) for (const b of (Array.isArray(g.items) ? g.items : [])) { if (!b) continue; const url = clean(b.url || '').slice(0, 300); const host = normH(b.domain || hostOf(url));
        local.push({ name: S(b.title || b.name).replace(/\s+/g, ' ').trim().slice(0, 100), url, host, position: local.length + 1, own: (!!host && isOurs(host)) || ownName(b.title || b.name) }); }
      local = local.slice(0, 20); }
    const detail = { v: 1, answer_len: T.len }; if (T.cut) detail.answer_cut = true;
    return { answer_text: T.text, cited_json: JSON.stringify(cited), retrieved_json: retrieved ? JSON.stringify(retrieved) : '',
      fanout_json: (res.fan_out_queries !== undefined || fanout.length) ? JSON.stringify(fanout) : '',
      products_json: products ? JSON.stringify(products) : '', ads_json: ads ? JSON.stringify(ads) : '', local_json: local ? JSON.stringify(local) : '',
      model: S(res.model || res.model_name).slice(0, 80), detail_json: JSON.stringify(detail) };
  };

  // ---- the analyst's mark (detail_json.analysed) and a stored row read back (Load AI Run Answers: strings for booleans and numbers) ----
  const analysed = (r) => !!J(r && r.detail_json, {}).analysed;
  const markAnalysed = (detailJson) => { const d = J(detailJson, {}); d.v = d.v || 1; d.analysed = true; return JSON.stringify(d); };
  const fromStored = (r) => ({ ...r, answered: tb(r.answered), mentioned: tb(r.mentioned), cited: tb(r.cited), named: r.named === '' || r.named == null ? r.named : tb(r.named),
    rank: Number(r.rank) || 0, position: num(r.position), cost: Number(r.cost) || 0, _text: S(r.answer_text), _stored: true });

  // ---- source types (rule-based; MARKET_RND §3.1 gap 11). Typed on the FULL host (community.x.com is a forum), keyed by registrable domain ----
  const T_GOV = /\.gov(\.[a-z]{2,3})?$|(^|\.)gov\.[a-z]{2}$|(^|\.)(gouv|gob|go|gv|govt|gc)\.[a-z]{2}$|\.mil(\.[a-z]{2})?$|(^|\.)u\.ae$|\.int$|(^|\.)europa\.eu$|(^|\.)(canada\.ca|admin\.ch|bund\.de|service-public\.fr|nhs\.uk|usa\.gov)$|(^|\.)(difc|adgm|dmcc|dafz|dafza|jafza|rakez|dso|ifza|shams|kezad|dwtc|dubaided|saifzone|dubaichamber|abudhabichamber)\.(com|ae|org)$|(^|\.)[a-z]{3,}fz\.(ae|com)$|freezone/i;
  const T_REF = /(^|\.)(wikipedia|wikimedia|wikidata|wiktionary|britannica|investopedia|merriam-webster|dictionary|thefreedictionary|collinsdictionary|arxiv|researchgate|jstor|sciencedirect|springer|semanticscholar|ssrn|w3|iso|ieee|ietf|openstax|khanacademy|plato\.stanford)\.[a-z.]+$|(^|\.)scholar\.google\.[a-z.]+$|(^|\.)developer\.mozilla\.org$|\.edu(\.[a-z]{2})?$|(^|\.)ac\.[a-z]{2}$/i;
  const T_UGC = /(^|\.)(reddit|redd|youtube|youtu|quora|stackoverflow|stackexchange|superuser|serverfault|askubuntu|medium|substack|linkedin|facebook|fb|twitter|x|instagram|tiktok|pinterest|github|gitlab|discord|telegram|tumblr|blogspot|wordpress|hashnode|dev|vimeo|twitch|threads|bsky|mastodon|steamcommunity|xda-developers|spiceworks|tripadvisor-forum)\.(com|be|co|me|io|net|to|org|app|social|it)$|(^|\.)(community|communities|forum|forums|discuss|discussion|discussions|answers|boards|groups|talk)\.[a-z0-9-]+\.[a-z.]+$|(^|[.-])forums?([.-]|$)/i;
  const T_DIR = /(^|\.)(g2|capterra|clutch|trustpilot|goodfirms|getapp|softwareadvice|crunchbase|yelp|sortlist|designrush|themanifest|softwaresuggest|sourceforge|saashub|alternativeto|producthunt|glassdoor|zoominfo|owler|tripadvisor|bbb|angi|angieslist|houzz|thumbtack|hidubai|dnb|kompass|europages|justdial|sulekha|trustradius|gartnerpeerinsights|peerspot|appsumo|bayt|indeed|yellowpages|yell|hotfrog|cylex|foursquare|manta|chamberofcommerce|expertise|upcity|bark|fiverr|upwork)\.[a-z.]+$|yellow-?pages|directory|listings?\b|(^|\.)aspl?ist|uaeasp|einvoicinglist/i;
  const T_EDIT = /(^|\.)(gulfnews|khaleejtimes|thenationalnews|thenational|zawya|arabianbusiness|gulfbusiness|tradearabia|wam|emirates247|khaleej|alkhaleej|albayan|argaam|arabnews|saudigazette|reuters|bloomberg|forbes|cnbc|bbc|cnn|nytimes|washingtonpost|wsj|ft|economist|techcrunch|theverge|wired|engadget|venturebeat|zdnet|cnet|techradar|pcmag|computerworld|computerweekly|itpro|cio|infoworld|theregister|entrepreneur|inc|fortune|fastcompany|businessinsider|marketwatch|axios|apnews|aljazeera|theguardian|guardian|telegraph|independent|timesofindia|hindustantimes|economictimes|livemint|dawn|nerdwallet|hbr|mckinsey|gartner|forrester|statista|idc|frost|marketsandmarkets|mordorintelligence|grandviewresearch|searchenginejournal|searchengineland|thedrum|adweek|campaignme|pcworld|tomsguide|tomshardware|lifewire|makeuseof|howtogeek|digitaltrends|mashable|gizmodo|vox|politico|npr|abc|cbsnews|nbcnews|foxnews|usatoday|time|newsweek)\.[a-z.]+$/i;
  const T_EDIT_WORD = /(^|[.-])(news|times|post|herald|tribune|gazette|journal|magazine|mag|daily|weekly|chronicle|telegraph|observer|express|courier|insider|today|wire|press|media|reporter)([.-]|$)|news\.|magazine/i;
  const SOURCE_TYPES = ['own', 'rival', 'ugc', 'reference', 'editorial', 'government', 'directory', 'other'];
  /** ctx: { own: domain, isOurs(host)?, isRival(host)? } -> one of SOURCE_TYPES */
  const sourceType = (host, ctx) => { const h = normH(host); const c = ctx || {}; if (!h) return 'other';
    const own = normH(c.own); if ((typeof c.isOurs === 'function' && c.isOurs(h)) || (own && (h === own || h.endsWith('.' + own)))) return 'own';
    if (typeof c.isRival === 'function' && c.isRival(h)) return 'rival';
    if (T_GOV.test(h)) return 'government';
    if (T_REF.test(h)) return 'reference';
    if (T_UGC.test(h)) return 'ugc';
    if (T_DIR.test(h)) return 'directory';
    if (T_EDIT.test(h) || T_EDIT_WORD.test(h)) return 'editorial';
    return 'other'; };
  const TYPE_WORDS = { own: 'your site', rival: 'businesses AI names instead of you', ugc: 'forums, video and social posts', reference: 'reference sites (encyclopedias, academic)', editorial: 'news, magazines and analysts',
    government: 'government and official bodies', directory: 'directories and review sites', other: 'other company and product sites' };

  // ---- one run's answers -> the visibility row's four JSON columns (WAVE2_CONTRACTS §2) ----
  /** a: { rows (the run's answered rows, stored or in memory), domain, isOurs(host), isRival(host), rivalIds (Set of entity ids), history (earlier
   *  seo_ai_visibility rows of the site, any order), checked_at, ENG (engine names) } */
  const aggregate = (a) => {
    const A = a || {}; const rows = (A.rows || []).filter(r => r && tb(r.answered) && !r.error);
    const isOurs = typeof A.isOurs === 'function' ? A.isOurs : (h) => { const o = normH(A.domain); const x = normH(h); return !!x && (x === o || x.endsWith('.' + o)); };
    const rivalIds = A.rivalIds instanceof Set ? A.rivalIds : new Set(A.rivalIds || []);
    const isRivalH = (h, idHint, role) => role === 'competitor' || (typeof A.isRival === 'function' && A.isRival(h)) || rivalIds.has(regD(h)) || (!!idHint && rivalIds.has(S(idHint)));
    const citedOf = (r) => { const v = J(r.cited_json, null); if (Array.isArray(v)) return v.filter(x => x && (x.url || x.host));
      // an older row (before W2-E1): its own pages (our_urls) and the third-party pages it cited (cited_urls), order unknown
      const o = S(r.our_urls).split(/\s+/).filter(Boolean).map(u => ({ url: clean(u), host: hostOf(u), role: 'self' }));
      const t = J(r.cited_urls, []); return [...o, ...(Array.isArray(t) ? t : []).filter(x => x && x.u).map(x => ({ url: clean(x.u), host: hostOf(x.u) }))]; };
    const retrOf = (r) => { const v = J(r.retrieved_json, null); return Array.isArray(v) ? v.filter(x => x && x.url) : null; };
    // -- urls_json: your pages AI read and cited; the page AI cited instead
    const ownU = new Map(); const rivU = new Map(); const reportsRetrieval = rows.filter(r => retrOf(r) !== null).length;
    const bump = (m, k, o) => { const x = m.get(k) || { ...o, n: 0 }; x.n++; m.set(k, x); return x; };
    for (const r of rows) {
      const cited = citedOf(r); const retr = retrOf(r) || [];
      const citedOwn = new Set(cited.filter(x => x.url && isOurs(x.host || hostOf(x.url))).map(x => clean(x.url)));
      const readOwn = new Set(retr.filter(x => isOurs(x.host || hostOf(x.url))).map(x => clean(x.url)));
      const rivalsCited = cited.filter(x => x.url && !isOurs(x.host || hostOf(x.url)) && isRivalH(x.host || hostOf(x.url), x.entity_id, x.role));
      const othersCited = cited.filter(x => x.url && !isOurs(x.host || hostOf(x.url)));
      for (const x of rivalsCited) { const y = rivU.get(clean(x.url)) || { url: clean(x.url), host: normH(x.host || hostOf(x.url)), entity_id: S(x.entity_id) || regD(x.host || hostOf(x.url)), cited_n: 0 }; y.cited_n++; rivU.set(y.url, y); }
      for (const u of new Set([...citedOwn, ...readOwn])) {
        const o = ownU.get(u) || { url: u, cited_n: 0, retrieved_n: 0, engines: new Set(), questions: new Set(), instead: new Map(), competing: new Map(), read_not_cited_n: 0 };
        o.retrieved_n++; o.engines.add(S(r.engine)); if (r.prompt_id) o.questions.add(S(r.prompt_id));
        if (citedOwn.has(u)) o.cited_n++;
        else { o.read_not_cited_n++; for (const x of rivalsCited) bump(o.instead, clean(x.url), { url: clean(x.url), host: normH(x.host || hostOf(x.url)) });
          for (const x of othersCited) bump(o.competing, clean(x.url), { url: clean(x.url), host: normH(x.host || hostOf(x.url)) }); }
        ownU.set(u, o); } }
    const topN = (m, k) => [...m.values()].sort((x, y) => y.n - x.n || S(x.url).localeCompare(S(y.url))).slice(0, k).map(x => ({ url: x.url, host: x.host, n: x.n }));
    const ownRows = [...ownU.values()].sort((x, y) => y.cited_n - x.cited_n || y.retrieved_n - x.retrieved_n || x.url.localeCompare(y.url));
    const urls = { answers_n: rows.length, retrieval_answers_n: reportsRetrieval,
      own: ownRows.slice(0, 25).map(o => ({ url: o.url, cited_n: o.cited_n, retrieved_n: o.retrieved_n, cited_rate: pctOf(o.cited_n, o.retrieved_n), rate_n: o.retrieved_n, answers_n: rows.length,
        engines: [...o.engines].sort(), questions: [...o.questions].slice(0, 20), rival_cited_instead: topN(o.instead, 3) })),
      rivals: [...rivU.values()].sort((x, y) => y.cited_n - x.cited_n || x.url.localeCompare(y.url)).slice(0, 20),
      retrieved_not_cited: ownRows.filter(o => o.read_not_cited_n > 0).sort((x, y) => y.read_not_cited_n - x.read_not_cited_n || x.url.localeCompare(y.url)).slice(0, 15)
        .map(o => ({ url: o.url, retrieved_n: o.retrieved_n, cited_n: o.cited_n, read_not_cited_n: o.read_not_cited_n, top_competing: topN(o.competing, 3) })),
      note: reportsRetrieval ? '' : 'no engine of this run reports the pages it read (only the ChatGPT interface does), so "read but not cited" is not measured' };
    // -- sources_json: where AI gets its answers, by type; first / last seen and half-life from the stored history
    const dom = new Map(); let pairs = 0; let citingAnswers = 0;
    for (const r of rows) { const hs = new Map(); for (const x of citedOf(r)) { const h = normH(x.host || hostOf(x.url)); if (!h) continue; const k = regD(h); if (!hs.has(k)) hs.set(k, { h, x }); }
      if (hs.size) citingAnswers++;
      for (const [k, { h, x }] of hs) { const d = dom.get(k) || { host: k, type: '', cited_n: 0, engines: new Set() }; d.cited_n++; d.engines.add(S(r.engine)); if (!d.type) d.type = isOurs(h) ? 'own' : isRivalH(h, x.entity_id, x.role) ? 'rival' : sourceType(h, { own: A.domain, isOurs }); dom.set(k, d); pairs++; } }
    const today = S(A.checked_at || new Date().toISOString()).slice(0, 10);
    const hist = (A.history || []).map(v => ({ at: S(v && v.checked_at).slice(0, 10), s: J(v && v.sources_json, null) })).filter(v => v.at && v.at < today && v.s && !Array.isArray(v.s) && Array.isArray(v.s.domains))
      .sort((x, y) => x.at.localeCompare(y.at));
    const last = hist.length ? hist[hist.length - 1].s : null;
    const prevD = new Map(((last && last.domains) || []).map(d => [S(d.host), d]));
    const shareAt = (s, host) => { const d = (s.domains || []).find(x => S(x.host) === host); const n = Number(s.n) || 0; return d && n ? 100 * (Number(d.cited_n) || 0) / n : 0; };
    const daysBetween = (a0, b0) => Math.round((Date.parse(b0 + 'T00:00:00Z') - Date.parse(a0 + 'T00:00:00Z')) / 864e5);
    const decayOf = (host, firstSeen, nowShare) => {
      const pts = [...hist.filter(v => v.at >= firstSeen).map(v => ({ at: v.at, y: shareAt(v.s, host) })), { at: today, y: nowShare }];
      if (pts.length < 3 || daysBetween(pts[0].at, today) < 14) return { half_life_days: null, decay: 'too little history', weeks: pts.length };
      let pk = 0; pts.forEach((p, i) => { if (p.y > pts[pk].y) pk = i; });
      if (!(pts[pk].y > 0)) return { half_life_days: null, decay: 'not cited', weeks: pts.length };
      for (let i = pk + 1; i < pts.length; i++) if (pts[i].y <= pts[pk].y / 2) { const a = pts[i - 1], b = pts[i]; const f = (a.y - pts[pk].y / 2) / Math.max(1e-9, a.y - b.y);
        return { half_life_days: Math.max(1, Math.round(daysBetween(pts[pk].at, a.at) + f * daysBetween(a.at, b.at))), decay: 'halved', weeks: pts.length }; }
      return { half_life_days: null, decay: pk === pts.length - 1 ? 'at its peak now' : 'holding', weeks: pts.length }; };
    const out = [];
    for (const d of dom.values()) { const p0 = prevD.get(d.host); const first = p0 && p0.first_seen ? S(p0.first_seen).slice(0, 10) : today; const share = pctOf(d.cited_n, pairs);
      out.push({ host: d.host, type: d.type, cited_n: d.cited_n, share, engines: [...d.engines].sort(), first_seen: first < today ? first : today, last_seen: today, ...decayOf(d.host, first < today ? first : today, share || 0) }); }
    // a domain cited before and not this run keeps its dates for 120 days, so its first-seen date and its decay stay readable
    for (const [h, p0] of prevD) { if (dom.has(h) || !p0.last_seen || daysBetween(S(p0.last_seen).slice(0, 10), today) > 120) continue; const first = S(p0.first_seen || p0.last_seen).slice(0, 10);
      out.push({ host: h, type: S(p0.type) || sourceType(h, { own: A.domain, isOurs }), cited_n: 0, share: 0, engines: [], first_seen: first, last_seen: S(p0.last_seen).slice(0, 10), ...decayOf(h, first, 0) }); }
    out.sort((x, y) => y.cited_n - x.cited_n || S(y.last_seen).localeCompare(S(x.last_seen)) || x.host.localeCompare(y.host));
    const types = {}; for (const t of SOURCE_TYPES) { const k = out.filter(d => d.type === t).reduce((s, d) => s + d.cited_n, 0); types[t] = { n: k, share: pairs ? pctOf(k, pairs) : null }; }
    const sources = { v: 2, n: pairs, answers_n: rows.length, citing_answers_n: citingAnswers, types, domains: out.slice(0, 80), history_runs: hist.length, method: 'rule-based type by host (own, rival, ugc, reference, editorial, government, directory, other); share = a domain\'s citations out of every (answer, domain) citation; half-life = days from the domain\'s peak share to half of it, from 3 or more stored runs over 14 days or more' };
    // -- shopping_json: how often an answer shows product cards, whose, and where you are
    const shopRows = rows.filter(r => Array.isArray(J(r.products_json, null)));
    const byE = {}; let trig = 0, prodN = 0, ownAns = 0; const ownPos = []; const merch = new Map(); const prods = new Map();
    for (const r of shopRows) { const ps = J(r.products_json, []); const e = S(r.engine); const b = byE[e] || (byE[e] = { name: (A.ENG || {})[e] || e, answers_n: 0, trigger_n: 0, products_n: 0 }); b.answers_n++;
      if (!ps.length) continue; trig++; b.trigger_n++; b.products_n += ps.length; prodN += ps.length;
      const mine = ps.filter(p => p && p.own); if (mine.length) { ownAns++; ownPos.push(Math.min(...mine.map(p => Number(p.position) || 99))); }
      for (const p of ps) { const m0 = S(p.merchant || p.entity_id || 'unknown').trim() || 'unknown'; const k = m0.toLowerCase(); const x = merch.get(k) || { merchant: m0, n: 0 }; x.n++; merch.set(k, x);
        const tk = S(p.title).toLowerCase(); if (tk) { const y = prods.get(tk) || { title: S(p.title), merchant: m0, n: 0, pos: 0, own: !!p.own }; y.n++; y.pos += Number(p.position) || 0; prods.set(tk, y); } } }
    for (const b of Object.values(byE)) b.trigger_rate = b.trigger_n ? pctOf(b.trigger_n, b.answers_n) : null;
    const shopping = trig ? { status: 'measured', answers_n: shopRows.length, trigger_n: trig, trigger_rate: pctOf(trig, shopRows.length), trigger_ci: wilson(trig, shopRows.length), products_n: prodN,
        own_presence_rate: pctOf(ownAns, trig), own_presence_n: trig, own_answers_n: ownAns, own_avg_position: ownPos.length ? Math.round(10 * ownPos.reduce((s, x) => s + x, 0) / ownPos.length) / 10 : null,
        merchants: [...merch.values()].sort((x, y) => y.n - x.n).slice(0, 10).map(x => ({ merchant: x.merchant, n: x.n, share: pctOf(x.n, prodN) })),
        products: [...prods.values()].sort((x, y) => y.n - x.n).slice(0, 10).map(x => ({ title: x.title, merchant: x.merchant, n: x.n, avg_position: Math.round(10 * x.pos / x.n) / 10, own: x.own })), by_engine: byE }
      : { status: 'no shopping results', answers_n: shopRows.length, trigger_n: 0, trigger_rate: null, products_n: 0, own_presence_rate: null, own_avg_position: null, merchants: [], by_engine: byE,
        note: shopRows.length ? 'no answer showed product cards (' + shopRows.length + ' answers on engines that can show them)' : 'no engine of this run can show product cards' };
    // -- ads_local_json: who advertises inside the answers to your questions; local-business cards and whether you are in them
    const adRows = rows.filter(r => Array.isArray(J(r.ads_json, null))); const adv = new Map(); let adSeen = 0, adShown = 0;
    for (const r of adRows) { const as = J(r.ads_json, []); if (!as.length) continue; adSeen++; if (as.some(x => x && x.rendered !== false)) adShown++;
      for (const x of as) { if (!x) continue; const k = S(x.host || x.advertiser).toLowerCase(); const y = adv.get(k) || { name: S(x.advertiser || x.host), host: S(x.host), n: 0, own: isOurs(x.host) }; y.n++; adv.set(k, y); } }
    const locRows = rows.filter(r => Array.isArray(J(r.local_json, null))); const loc = new Map(); let locSeen = 0, locOwn = 0;
    for (const r of locRows) { const ls = J(r.local_json, []); if (!ls.length) continue; locSeen++; if (ls.some(x => x && x.own)) locOwn++;
      for (const x of ls) { if (!x || x.own) continue; const k = S(x.name || x.host).toLowerCase(); const y = loc.get(k) || { name: S(x.name || x.host), host: S(x.host), n: 0 }; y.n++; loc.set(k, y); } }
    const ads_local = { ads: { seen_n: adSeen, rendered_n: adShown, answers_n: adRows.length, rate: adSeen ? pctOf(adSeen, adRows.length) : null, advertisers: [...adv.values()].sort((x, y) => y.n - x.n).slice(0, 10) },
      local: { seen_n: locSeen, own_n: locOwn, answers_n: locRows.length, rate: locSeen ? pctOf(locSeen, locRows.length) : null, own_rate: locSeen ? pctOf(locOwn, locSeen) : null, rivals: [...loc.values()].sort((x, y) => y.n - x.n).slice(0, 10) } };
    return { urls, sources, shopping, ads_local };
  };

  // ---- the panel: a "shopping" stage only for a site whose services or pages show it sells products ----
  const SHOP_TYPE = /\b(e-?commerce|online (shop|store)|retail(er)?|shop|store|marketplace|brand|d2c|dtc|direct[- ]to[- ]consumer|manufacturer|wholesale|boutique)\b/i;
  const SHOP_WORD = /\b(buy|shop|store|products?|collections?|catalogue|catalog|add to cart|free shipping|delivery)\b/i;
  const SHOP_PATH = /\/(products?|shop|store|collections?|catalog(ue)?|item|items|p|dp|buy|cart)\/[^\/?#]+/i;
  const sellsProducts = (p, pages) => { const P = p || {}; const svc = [...(P.services || []), ...(P.topics || [])].map(S);
    const urls = (pages || []).map(x => S(x && (x.url || x))).filter(Boolean); const productPages = urls.filter(u => SHOP_PATH.test(u)).length;
    const byType = SHOP_TYPE.test(S(P.business_type)); const bySvc = svc.filter(s => SHOP_WORD.test(s)).length;
    const sells = productPages >= 3 || (byType && (productPages >= 1 || bySvc >= 1)) || bySvc >= 2;
    return { sells, why: sells ? [productPages ? productPages + ' product page(s) on the site' : '', byType ? 'business type "' + S(P.business_type) + '"' : '', bySvc ? bySvc + ' service(s) about products' : ''].filter(Boolean).join(', ') : '' }; };

  // ---- the report: four short sections, each only when it has something to say; n beside every rate ----
  const reportHtml = (D, k) => {
    if (!D) return ''; const h3 = k.h3, p_ = k.p_, table = k.table, esc = k.esc, n = k.n, link = k.link || ((u) => esc(u)); let html = '';
    const U = D.urls || {}; const SRC = D.sources || {}; const SH = D.shopping || {}; const AL = D.ads_local || {};
    if ((U.retrieved_not_cited || []).length) html += h3('Pages AI reads but does not cite') + p_('ChatGPT shows the pages it read before answering. These pages of yours were read in '
      + n(U.retrieval_answers_n) + ' answer(s) that could show it, but another page was cited. The page cited instead is the one to beat: match what it answers, how directly it answers it, and its date.')
      + table(['Your page', 'Read in', 'Cited in', 'Cited instead'], U.retrieved_not_cited.slice(0, 10).map(x => [link(x.url), n(x.retrieved_n) + ' answer' + (x.retrieved_n === 1 ? '' : 's'), n(x.cited_n),
        (x.top_competing || []).map(c => link(c.url, S(c.url).replace(/^https?:\/\//, '').slice(0, 90)) + ' (' + n(c.n) + ')').join('<br>') || '—']));
    if ((SRC.n || 0) > 0) { const T = SRC.types || {}; const rowsT = SOURCE_TYPES.filter(t => T[t] && T[t].n > 0).sort((a, b) => T[b].n - T[a].n);
      html += h3('Where AI gets its answers') + p_('Every site the answers cited, grouped by kind: ' + n(SRC.n) + ' citations in ' + n(SRC.citing_answers_n) + ' of ' + n(SRC.answers_n) + ' answers.')
        + table(['Kind of source', 'Citations', 'Share'], rowsT.map(t => [esc(TYPE_WORDS[t] || t), n(T[t].n), T[t].share + '% of ' + n(SRC.n)]))
        + table(['Site', 'Kind', 'Cited in', 'First seen', 'How long it stays cited'], (SRC.domains || []).filter(d => d.cited_n > 0).slice(0, 12).map(d => [esc(d.host), esc(d.type), n(d.cited_n) + ' answer' + (d.cited_n === 1 ? '' : 's'), esc(d.first_seen || '—'),
          d.half_life_days != null ? 'its share halved in ' + n(d.half_life_days) + ' days' : esc(d.decay === 'too little history' ? 'too little history (' + d.weeks + ' run' + (d.weeks === 1 ? '' : 's') + ')' : d.decay || '—')])); }
    if (SH.status === 'measured' && SH.trigger_n > 0) html += h3('AI shopping results') + p_('Product cards appeared in ' + n(SH.trigger_n) + ' of ' + n(SH.answers_n) + ' answers that can show them (' + SH.trigger_rate + '%'
      + (SH.trigger_ci ? ', 95% range ' + SH.trigger_ci[0] + '–' + SH.trigger_ci[1] + '%' : '') + '), ' + n(SH.products_n) + ' cards in all. Your products were in ' + n(SH.own_answers_n) + ' of those ' + n(SH.trigger_n) + ' answers'
      + (SH.own_avg_position != null ? ', at card ' + SH.own_avg_position + ' on average' : '') + '.')
      + table(['Seller', 'Cards', 'Share of cards'], (SH.merchants || []).map(x => [esc(x.merchant), n(x.n), x.share + '% of ' + n(SH.products_n)]));
    const AD = AL.ads || {}, LO = AL.local || {};
    if (AD.seen_n > 0) html += h3('Ads inside AI answers') + p_('An ad was part of ' + n(AD.seen_n) + ' of ' + n(AD.answers_n) + ' answers that can carry one (' + n(AD.rendered_n) + ' shown to the reader).')
      + table(['Advertiser', 'Answers'], (AD.advertisers || []).map(x => [esc(x.name) + (x.own ? ' (you)' : ''), n(x.n)]));
    if (LO.seen_n > 0) html += h3('Local business cards in AI answers') + p_('ChatGPT showed local business cards in ' + n(LO.seen_n) + ' of ' + n(LO.answers_n) + ' answers; you were among them in ' + n(LO.own_n) + ' of those ' + n(LO.seen_n) + '.')
      + ((LO.rivals || []).length ? table(['Business shown', 'Answers'], LO.rivals.map(x => [esc(x.name), n(x.n)])) : '');
    return html; };

  return { TEXT_CAP, SOURCE_TYPES, TYPE_WORDS, hostOf, normH, regD, clean, textOf, answerFields, analysed, markAnalysed, fromStored, sourceType, aggregate, sellsProducts, reportHtml, tb };
})();
// ---- G6 (2026-10-18, AI_VISIBILITY_SPEC.md §10): the AI question panel at enterprise scale — shared by AI Plan, AI Requests, Prompt Jobs,
// Prompt Rows, Pulse Plan, AI Metrics and the Site Admin (inlined by the build). Pure functions, no node access: the harness runs them.
// The money is here too (AIP.cost, section 8: ONE formula for the engine; app/shared/src/cost.ts mirrors it against one table of golden
// cases). And the rest: the limits, the markets and personas a question carries, the strata the daily sample rotates through,
// the requests of a run in one deterministic order (so a resumed run never pays for the same answer twice), the state of a run that is
// split across executions, and the "same question in other words" rule that keeps a 500-question panel from asking one thing ten times.
const AIP = (() => {
  const LIMITS = {
    min: 3, max: 500,                 // questions a site may track (the brand question included)
    default_new: 50,                  // a site with NO seo_monitors row starts here
    default_stored: 20,               // a row whose ai_prompts_max is empty keeps the v4.9 default (an existing site is never raised by a release)
    chunk_requests: 600,              // engine requests one execution of the weekly run asks for one site (about 25 KB an answer: ~30 MB of execution data)
    exec_requests: 1200,              // and for all its sites together (a scheduled run covers up to 15 sites)
    pulse_max_requests: 900,          // requests one pulse morning may ask (the v4.9 cap); the daily sample is sized to fit under it
    full_pulse_max_panel: 50,         // up to this panel the pulse asks every question every day, as before (auto mode)
    target_headline: 3,               // ± points (95%) the weekly headline rate should reach — the pulse's N is chosen for it
    target_cluster: 8,                // ± points (95%) the median topic cluster should reach
    cluster_size_guess: 12,           // questions per cluster when the panel has none yet (the Prompt Writer aims at 8-15)
    min_segment: 12,                  // answers under which a segment rate is "too few answers" (= MIN_RATE_SAMPLES)
    stall_minutes: 65,                // a split run silent this long is resumed by the next start of the tracker or the pulse: the tracker's
                                      // execution limit is 60 minutes, so a part not heard of for 65 is dead, never merely slow (a resume of a
                                      // live part would ask its questions twice; the run guard refuses that twin too)
    resume_days: 6,                   // an unfinished run older than this is closed, not resumed (a new week starts a new run)
    done_fresh_hours: 20,             // R-E1: a run that FINISHED this recently answers an on-demand / catch-up start with its stored week
                                      // (a retry of the same cycle job is answered so whatever the hour); nothing is asked or paid again
    max_run_usd: 150,                 // one weekly / full run above this is refused by the plan, with the reason
    writer_batch: 40,                 // questions one Prompt Writer job writes (the agent's answer must fit its token budget)
    writer_jobs_per_run: 14,          // Prompt Writer jobs one run may start (14 x 40 = 560: a new 500-question panel in one run)
    similar: 0.6,                     // Jaccard over content-word stems at or above which two questions ask the same thing
  };
  const S = (v) => String(v == null ? '' : v).trim();
  const n0 = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const hash = (t) => { let h = 5381; for (const c of String(t)) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0; return h; };

  // ---- 1. the panel size a site is held to ----------------------------------------------------------------------------------
  /** `row` = the site's seo_monitors row, or null when it has none. A stored number is never changed; an empty field keeps 20. */
  const panelSize = (row) => {
    if (!row || !S(row.site_id)) return LIMITS.default_new;
    const v = Number(row.ai_prompts_max);
    if (row.ai_prompts_max === '' || row.ai_prompts_max == null || !Number.isFinite(v) || v <= 0) return LIMITS.default_stored;
    return clamp(Math.round(v), LIMITS.min, LIMITS.max);
  };

  // ---- 2. markets and personas -----------------------------------------------------------------------------------------------
  /** "ae-EN", "AE en", "ae" -> "AE-en" (country ISO + language); '' when it is not a market */
  const normMarket = (m, dfltLang) => {
    const x = S(m).replace(/[_\s]+/g, '-'); const mm = x.match(/^([A-Za-z]{2})(?:-([A-Za-z]{2,3}))?$/);
    if (!mm) return '';
    return mm[1].toUpperCase() + '-' + (mm[2] || dfltLang || 'en').toLowerCase();
  };
  const listOf = (v) => (Array.isArray(v) ? v : S(v).split(/[\n,;|]+/)).map(S).filter(Boolean);
  /** the markets a site's panel covers: its own first, then the extra ones in its settings and the stored questions' own markets, at most
   *  MARKETS_MAX (E22, 2026-10-23: the comment said 6 while the code kept 8; the app caps the settings at 5, the stored questions can add
   *  more). A question whose market falls past the cap is asked in the site's own market and the request says so (`market_fallback`). */
  const MARKETS_MAX = 8;
  const marketsOf = (site) => {
    const own = normMarket(S(site.country_iso) + '-' + S(site.language_code || 'en')) || 'US-en';
    const extra = listOf(site.ai_markets).map(m => normMarket(m, 'en')).filter(Boolean);
    return [...new Set([own, ...extra])].slice(0, MARKETS_MAX);
  };
  // DataForSEO's location code for a country is 2000 + its ISO 3166 numeric code. The main workflow's COUNTRIES table holds 22 countries;
  // a market outside it (Qatar, Kuwait, Germany …) must still be asked IN that country, never quietly relabelled as the site's own market.
  const ISO_NUM = { AE: 784, SA: 682, QA: 634, KW: 414, BH: 48, OM: 512, EG: 818, JO: 400, LB: 422, MA: 504, TN: 788, DZ: 12, IQ: 368, TR: 792, IL: 376, PK: 586, IN: 356, BD: 50, LK: 144, NP: 524,
    US: 840, CA: 124, MX: 484, BR: 76, AR: 32, CL: 152, CO: 170, PE: 604, GB: 826, IE: 372, FR: 250, DE: 276, NL: 528, BE: 56, LU: 442, CH: 756, AT: 40, IT: 380, ES: 724, PT: 620,
    SE: 752, NO: 578, DK: 208, FI: 246, PL: 616, CZ: 203, SK: 703, HU: 348, RO: 642, BG: 100, GR: 300, HR: 191, SI: 705, RS: 688, UA: 804, EE: 233, LV: 428, LT: 440, CY: 196, MT: 470,
    ZA: 710, NG: 566, KE: 404, GH: 288, ET: 231, TZ: 834, UG: 800, AU: 36, NZ: 554, SG: 702, MY: 458, ID: 360, TH: 764, VN: 704, PH: 608, HK: 344, TW: 158, JP: 392, KR: 410, CN: 156 };
  const locationOf = (cc) => { const n = ISO_NUM[S(cc).toUpperCase()]; return n ? 2000 + n : 0; };
  const PERSONA_MAX = 6;
  const personasOf = (site) => [...new Set(listOf(site.ai_personas).map(p => p.replace(/\s+/g, ' ').slice(0, 40)))].slice(0, PERSONA_MAX);
  const stageOf = (s) => { const x = S(s).toLowerCase(); return ['awareness', 'consideration', 'decision', 'brand', 'shopping'].includes(x) ? x : ''; };

  // ---- 3. one question, said another way ----------------------------------------------------------------------------------------
  const STOP = new Set(('a an and are as at be best by can do does for from get has have how i in is it its me my of on or our should the their them '
    + 'there these this to top us we what when where which who why will with you your vs versus near me good great right').split(' '));
  const stem = (w) => w.replace(/(ies)$/, 'y').replace(/(ing|ers|er|es|ed|ly|s)$/, '').slice(0, 7);
  const stems = (t) => [...new Set(S(t).toLowerCase().replace(/[^a-z0-9؀-ۿ\s]+/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w)).map(stem).filter(w => w.length >= 2))];
  const jaccard = (a, b) => { const A = new Set(a), B = new Set(b); if (!A.size || !B.size) return 0; let i = 0; for (const x of A) if (B.has(x)) i++; return i / (A.size + B.size - i); };
  /** do two questions ask the same thing? (same market and persona, and their content words overlap enough) */
  const sameAsk = (a, b) => {
    if (S(a.market || '') !== S(b.market || '') && a.market && b.market) return false;
    if (a.persona && b.persona && S(a.persona).toLowerCase() !== S(b.persona).toLowerCase()) return false;
    return jaccard(stems(a.prompt), stems(b.prompt)) >= LIMITS.similar;
  };
  /** keep the first of every group of questions that ask the same thing; `existing` are kept already. Returns { keep, dup: [{q, like}] } */
  const dedupe = (cands, existing) => {
    const kept = (existing || []).map(q => ({ ...q, _s: stems(q.prompt) }));
    const keep = [], dup = [];
    for (const q of (cands || [])) {
      const s = stems(q.prompt);
      const like = kept.find(k => (S(k.market || '') === S(q.market || '') || !k.market || !q.market)
        && (!k.persona || !q.persona || S(k.persona).toLowerCase() === S(q.persona).toLowerCase()) && jaccard(k._s, s) >= LIMITS.similar);
      if (like) { dup.push({ q, like: like.prompt }); continue; }
      kept.push({ ...q, _s: s }); keep.push(q);
    }
    return { keep, dup };
  };

  // ---- 3b. a question's identity and its search phrase (F2, 2026-10-23: ENGINE_AUDIT.md E2 / E15 / E9) ---------------------------------
  // E2: the old normaliser kept only [a-z0-9], so every Arabic (any non-Latin) question became the empty string — one prompt id for all of
  // them, the first stored and every later one overwriting its wording. E15: that id was a 32-bit djb2 hash in one key space shared by every
  // site, upserted on `prompt_id` alone, so a collision moved one site's question to another (~25% odds at 50k questions).
  // Now: ONE normal form for every script (NFKC, lower case, Arabic harakat / tatweel dropped, anything that is not a letter, digit or mark
  // is a space), and a 64-bit id (two independent 32-bit mixes, cyrb53's mixing without the 53-bit cut) over `site_id | normal form`,
  // prefixed `q_` so a new id can never be read as an old `p_` one. Save Prompts and the Site Admin upsert on (site_id, prompt_id).
  // A stored question keeps the id it was stored with (its trend and its answer history hang on it): writers and the Site Admin match an
  // existing row by its id OR its normal form first, and only a question new to the site gets a new id.
  const AR_MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;
  const normQ = (t) => S(t).normalize('NFKC').toLowerCase().replace(AR_MARKS, '').replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ').replace(/\s+/g, ' ').trim();
  const hash64 = (t) => {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57; const s = String(t);
    for (let i = 0; i < s.length; i++) { const ch = s.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507); h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507); h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(36).padStart(7, '0') + (h1 >>> 0).toString(36).padStart(7, '0');
  };
  /** the stable id of a question on one site: 'q_' + 64 bits over the site and the question's normal form */
  const promptId = (site_id, prompt) => 'q_' + hash64(S(site_id) + '|' + normQ(prompt));
  /** a stored row that IS this question (same id, or same normal form) — so a reworded-identical question keeps its stored id */
  const findStored = (rows, site_id, prompt) => { const n = normQ(prompt); if (!n) return null;
    return (rows || []).find(r => r && S(r.site_id) === S(site_id) && (S(r.prompt_id) === promptId(site_id, prompt) || normQ(r.prompt) === n)) || null; };
  // E9: an owner's question got the first five words as its search phrase ("what should i check before"), and the AI Overview presence,
  // the AI search volume and the fit gate were all measured on that fragment. The phrase is now the question's content words in their own
  // order (question words, stop words and filler dropped, hyphenated words kept whole, at most 6) — or the owner's own keyword when given.
  // `keyword_source` says which: 'owner' (typed by the owner), 'writer' (the Prompt Writer's search phrase), 'template', 'derived' (built
  // here). A derived phrase is not a search anyone typed, so AI Requests does not ask Google's AI Overview for it.
  const KW_DROP = new Set(('a an and are as at be been before being best both by can could did do does doing each few for from get gets give has have '
    + 'help how i if in into is it its just know like list looking me more most much my need needs of on or our please really recommend '
    + 'recommended should so some tell than that the their them then there these they this those to top us very vs versus want was way ways '
    + 'we what whats what\'s when where which while who whom whose why will with without would you your yours check good great right near '
    + 'any also about after etc options option thing things kind kinds sort type types able actually currently today now there\'s '
    + 'ما ماذا هي هو هل في من على عن إلى الى كيف لماذا أي اي التي الذي مع أو او و هذا هذه ذلك تلك كم لدي لدى أفضل افضل يمكن يجب').split(/\s+/));
  const keywordOf = (prompt) => {
    const words = (S(prompt).normalize('NFKC').replace(AR_MARKS, '').match(/[\p{L}\p{N}\p{M}]+(?:['’-][\p{L}\p{N}\p{M}]+)*/gu) || [])
      .map(t => ({ t, w: t.toLowerCase().replace(/’/g, '\'') }))
      .filter(({ t, w }) => (t === 'IT' || (!KW_DROP.has(w) && !KW_DROP.has(w.replace(/'s$/, '')))) && (w.length >= 2 || /^\d+$/.test(w) || /[^\x00-\x7f]/.test(w)))   // "IT" (information technology) is a word, "it" is not
      .map(({ w }) => w);
    const kw = [...new Set(words)].slice(0, 6).join(' ').slice(0, 120).trim();
    return kw || normQ(prompt).split(' ').slice(0, 6).join(' ').slice(0, 120);
  };
  const KEYWORD_SOURCES = ['owner', 'writer', 'template', 'derived'];

  // ---- 4. strata and the daily rotating sample ----------------------------------------------------------------------------------
  const stratumOf = (q) => (S(q.cluster || q.topic).toLowerCase() || 'other') + ' | ' + (S(q.persona).toLowerCase() || 'any buyer');
  /** the pulse-day counter: the six days after the website's cycle day (its weekly run) are six consecutive numbers, and the cycle day
   *  itself shares the next day's. `cycleWeekday` is 0 (Sunday) … 6 (Saturday); with none it is Monday (1), the v4.9 rule exactly - every
   *  website then had its weekly run on Monday and its pulse Tuesday..Sunday. 2026-10-19 (SCHEDULING_KEYWORDS_PLAN.md §4.8): a website's week
   *  starts on the day it set up, so its six pulse mornings are counted from ITS cycle day; a question is still asked on exactly `per_week`
   *  of every six consecutive pulse mornings (pulseSample), whatever the weekday. `iso` is the website's LOCAL date (YYYY-MM-DD…). */
  const pulseDay = (iso, cycleWeekday) => {
    const cw = Number.isInteger(Number(cycleWeekday)) && cycleWeekday !== null && cycleWeekday !== '' && Number(cycleWeekday) >= 0 && Number(cycleWeekday) <= 6 ? Number(cycleWeekday) : 1;
    const t = Date.parse(S(iso).slice(0, 10) + 'T00:00:00Z'); const d = Math.floor((t - Date.UTC(1970, 0, 4 + cw)) / 864e5);   // 1970-01-04 was a Sunday: the anchor is the first cycle day of 1970
    const w = Math.floor(d / 7), r = ((d % 7) + 7) % 7;
    return w * 6 + (r === 0 ? 0 : r - 1);
  };
  /** the weekly answer counts a panel collects */
  const halfWidth = (n, p) => { const N = n0(n); if (N <= 0) return null; const z = 1.96, q = p == null ? 0.5 : p; const d = 1 + z * z / N, m = z * Math.sqrt(q * (1 - q) / N + z * z / (4 * N * N)); return Math.round(1000 * m / d) / 10; };
  /** N: how many pulse mornings a week each question is asked. 'full' = every morning; auto = the smallest N that brings the weekly
   *  headline to ±target_headline and the median cluster to ±target_cluster (both at 95%, at worst p = 0.5) — capped by what one
   *  morning may ask. Returns { per_week, why, headline, cluster } with the half-widths it buys. */
  const pulsePerWeek = (o) => {
    const asked = Math.max(1, n0(o.asked)); const wE = Math.max(0, n0(o.weekly_engines)); const pE = Math.max(0, n0(o.pulse_engines));
    const cl = Math.max(1, n0(o.cluster_size) || LIMITS.cluster_size_guess);
    const capQ = pE ? Math.floor(LIMITS.pulse_max_requests / pE) : asked;   // questions one morning may ask
    const capN = Math.max(1, Math.min(6, Math.floor(6 * capQ / asked)));
    const at = (N) => ({ headline: halfWidth(asked * (wE + N * pE)), cluster: halfWidth(Math.min(asked, cl) * (wE + N * pE)) });
    const mode = S(o.mode).toLowerCase();
    if (!pE) return { per_week: 0, why: 'no pulse engine is on', ...at(0), capped: false };
    if (mode === 'full' || (mode !== 'sample' && asked <= LIMITS.full_pulse_max_panel - 1)) {
      const N = Math.min(6, capN);
      return { per_week: N, ...at(N), capped: N < 6, why: N < 6 ? 'every question every morning would be ' + (asked * pE) + ' requests; one morning asks at most ' + LIMITS.pulse_max_requests + ', so each question is asked ' + N + ' mornings a week' : 'every question, every pulse morning' };
    }
    const fixed = n0(o.per_week);
    if (fixed >= 1) { const N = Math.min(6, Math.round(fixed), capN); return { per_week: N, ...at(N), capped: N < Math.round(fixed), why: 'set by the owner: each question ' + N + ' morning(s) a week' + (N < Math.round(fixed) ? ' (more would pass the ' + LIMITS.pulse_max_requests + '-request morning limit)' : '') }; }
    for (let N = 1; N <= capN; N++) { const h = at(N); if (h.headline <= LIMITS.target_headline && h.cluster <= LIMITS.target_cluster) return { per_week: N, ...h, capped: false, why: 'the fewest mornings that bring the weekly rate to ±' + h.headline + ' points and a ' + cl + '-question cluster to ±' + h.cluster + ' (95%)' }; }
    return { per_week: capN, ...at(capN), capped: true, why: 'the most one morning allows (' + LIMITS.pulse_max_requests + ' requests): a ' + cl + '-question cluster reaches ±' + at(capN).cluster + ' points, not ±' + LIMITS.target_cluster };
  };
  /** today's sample: every question asked on `per_week` of the six pulse mornings, slots spread round-robin inside each stratum (with a
   *  per-stratum offset so the mornings carry the same load), and every stratum present every morning (a stratum too small to be
   *  covered by its slots gets one extra question that day, chosen in turn). Returns { asked, strata, covered, per_week, extra } */
  const pulseSample = (prompts, o) => {
    const N = clamp(Math.round(n0(o.per_week)) || 6, 1, 6); const pd = n0(o.day);
    const groups = new Map();
    for (const q of (prompts || [])) { const k = stratumOf(q); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(q); }
    const asked = []; let extra = 0;
    for (const [k, qs] of groups) {
      const sorted = qs.slice().sort((a, b) => (hash(a.prompt_id) - hash(b.prompt_id)) || S(a.prompt_id).localeCompare(S(b.prompt_id)));
      const off = hash(k) % 6; let got = 0;
      sorted.forEach((q, i) => { const slot = (off + i) % 6; if (((pd - slot) % 6 + 6) % 6 < N) { asked.push({ ...q, slot, stratum: k }); got++; } });
      if (!got && sorted.length) { const q = sorted[((pd % sorted.length) + sorted.length) % sorted.length]; asked.push({ ...q, slot: -1, stratum: k, top_up: true }); extra++; }
    }
    return { asked, strata: groups.size, covered: new Set(asked.map(q => q.stratum)).size, per_week: N, extra };
  };

  // ---- 5. the requests of one run, in one order -------------------------------------------------------------------------------
  const reqKey = (prompt_id, engine) => S(prompt_id) + '|' + S(engine);
  /** the requests a run still owes: `all` in the run's deterministic order, minus the keys answered by an earlier execution of the same
   *  run, cut at `limit`. Returns { now, left, done, total, final } — `final` when nothing is left after this execution. */
  const slice = (all, doneKeys, limit) => {
    const done = doneKeys instanceof Set ? doneKeys : new Set(doneKeys || []);
    const owed = (all || []).filter(r => !done.has(reqKey(r.prompt_id, r.engine)));
    const lim = Math.max(1, n0(limit) || LIMITS.chunk_requests);
    const now = owed.slice(0, lim);
    return { now, left: owed.length - now.length, done: (all || []).length - owed.length, total: (all || []).length, final: owed.length <= lim };
  };

  // ---- 6. a run split across executions: its state row in seo_cache (`ai_run:<site_id>`, kind ai) --------------------------------
  const stateKey = (site_id) => 'ai_run:' + S(site_id);
  const parse = (t, d) => { try { const v = typeof t === 'string' ? JSON.parse(t || '') : t; return v == null ? d : v; } catch (e) { return d; } };
  const stateOf = (cacheRows, site_id) => { const r = (cacheRows || []).find(c => c && c.key === stateKey(site_id)); return r ? parse(r.value, null) : null; };
  /** what to do with a stored state at `now`: 'continue' (this is its next chunk), 'resume' (silent too long: pick it up), 'busy' (a chunk
   *  is running right now), 'blocked' (F2: the run was STOPPED — its answers were not stored or it reached its money ceiling — and nothing
   *  of this site's weekly run is asked again until a human clears the row or the run is older than resume_days; a `failed_store` stop is
   *  checked again by every later start, see healStore), 'closed' (finished, or
   *  too old to resume) */
  const STOPPED = ['failed_store', 'stopped_ceiling', 'stopped'];
  const stateVerdict = (st, nowIso, continuing) => {
    if (!st || !st.run_id) return 'closed';
    const now = Date.parse(nowIso) || Date.now();
    const started = Date.parse(st.started_at) || 0, upd = Date.parse(st.updated_at) || started;
    if (started && now - started > LIMITS.resume_days * 864e5) return 'closed';
    if (STOPPED.includes(S(st.status))) return 'blocked';
    if (S(st.status) !== 'running') return 'closed';
    if (continuing && S(continuing) === S(st.run_id)) return 'continue';
    if (now - upd >= LIMITS.stall_minutes * 60000) return 'resume';
    return 'busy';
  };
  const stateRow = (site_id, st, nowIso) => ({ key: stateKey(site_id), kind: 'ai', site_id: S(site_id), value: JSON.stringify(st), updated_at: nowIso });   // exact seo_cache columns
  /** R-E1 (2026-10-23, REVIEW_ENGINE.md): is a stored `done` run THIS start's week? -> { why, cycle_key, finished_at } or null. A start of the same
   *  cycle job (the dispatcher's retry after the run's last part died past the moment its week was stored) is always answered with the stored
   *  week; any other start that is not a cycle job (on demand, a catch-up, a bare manual start) is answered so when the run finished less than
   *  done_fresh_hours ago. A cycle job of ANOTHER cycle (the next week) runs. `rerun` (the trigger's rerun_today) asks again on purpose. */
  const doneRun = (st, o) => { const x = o || {};
    if (!st || !st.run_id || S(st.status) !== 'done' || x.rerun) return null;
    const fin = Date.parse(st.finished_at || st.updated_at) || 0; const now = Date.parse(x.now) || Date.now();
    const ck = S(x.cycle && x.cycle.key), sk = S(st.cycle && st.cycle.key);
    if (ck) return ck === sk ? { why: 'same_cycle', cycle_key: ck, finished_at: S(st.finished_at || st.updated_at) } : null;
    if (fin && now - fin >= 0 && now - fin < LIMITS.done_fresh_hours * 3600e3) return { why: 'recent', cycle_key: sk, finished_at: S(st.finished_at || st.updated_at) };
    return null; };

  // ---- 6b. never pay twice (F2, 2026-10-23: ENGINE_AUDIT.md E1 / E11) ----------------------------------------------------------------
  // E1: a part whose answers were not stored left no trace of what it had PAID for, so every later part asked the same first chunk again,
  // until the run expired or the account ran dry (4 parts x 600 keys = 2,400 paid requests for 600 questions). Now the state row records
  // every key the run has sent (`asked_keys`, packed) and the chunk in flight (`pending`) BEFORE the requests leave (*AI Asking State* ->
  // *Save Asking State*, and nothing is paid unless that save is read back), and AI Requests never asks a recorded key again. A part whose
  // keys are recorded but whose answers are not stored is found by the next part: the first time (a crash: the 60-minute limit, a restart,
  // a pre-empted VM) the lost keys are counted as could-not-be-read and the next chunk is halved; the second time, or when the part itself
  // saw its save fail, the run STOPS (`failed_store`), with an ops alert and the reason, and nothing is asked again.
  // The run also carries a hard money ceiling (`ceiling_dfs_usd`, fixed at its start: 1.5 x its own estimate, at least $2, never above
  // max_run_usd): every part checks the run's spent + committed DataForSEO money against it, AI Requests stops adding requests at it, and a
  // run that reaches it with questions left STOPS (`stopped_ceiling`) with an ops alert.
  const ENG_CODE = { chatgpt: 'c', gemini: 'g', perplexity: 'p', claude: 'l', ai_overview: 'o', ai_mode: 'm', copilot: 'b', chatgpt_api: 'C', gemini_api: 'G' };
  const CODE_ENG = Object.fromEntries(Object.entries(ENG_CODE).map(([e, c]) => [c, e]));
  /** ['p1|chatgpt', 'p1|gemini', 'p2|claude'] -> { p1: 'cg', p2: 'l' } (an engine without a code is kept in parentheses) */
  const packKeys = (keys) => { const m = {};
    for (const k of (keys instanceof Set ? [...keys] : (keys || []))) { const s = S(k); const i = s.lastIndexOf('|'); if (i <= 0) continue;
      const pid = s.slice(0, i), e = s.slice(i + 1); const c = ENG_CODE[e] || ('(' + e + ')'); if (!(m[pid] || '').includes(c)) m[pid] = (m[pid] || '') + c; }
    return m; };
  const unpackKeys = (m) => { const out = new Set(); const o = parse(m, {}) || {};
    for (const pid of Object.keys(o)) for (const t of (S(o[pid]).match(/\(([^)]+)\)|./g) || [])) { const e = t[0] === '(' ? t.slice(1, -1) : CODE_ENG[t]; if (e) out.add(reqKey(pid, e)); }
    return out; };
  const CEILING = { factor: 1.5, min_usd: 2 };
  /** the run's hard DataForSEO ceiling, fixed when it starts */
  const runCeiling = (runCostDfs) => Math.round(100 * Math.min(LIMITS.max_run_usd, Math.max(CEILING.min_usd, CEILING.factor * n0(runCostDfs)))) / 100;
  /** what is left under the ceiling: the larger of what the run measured (settled per task) and what it committed before paying */
  const ceilingLeft = (st) => { if (!st || !(n0(st.ceiling_dfs_usd) > 0)) return null; return Math.max(0, n0(st.ceiling_dfs_usd) - Math.max(n0(st.spent_dfs_usd), n0(st.committed_dfs_usd))); };
  /** the request estimate of a set of keys at the engine prices */
  const keysUsd = (keys) => { let t = 0; for (const k of keys) { const e = S(k).slice(S(k).lastIndexOf('|') + 1); t += PRICE[e] || 0.01; } return Math.round(t * 10000) / 10000; };
  /** the identity of a run's state (what every writer of the state row carries), from a plan item */
  const baseState = (p) => { const c = p.cycle && p.cycle.key ? { key: p.cycle.key, date: p.cycle.date || '', job: p.cycle.job || 'ai_visibility', monthly: !!p.cycle.monthly, scheduled_for: p.cycle.scheduled_for || '', request_id: p.cycle.request_id || p.request_id || '', label: p.cycle.label || '' } : null;
    return { run_id: p.run_id, run_kind: p.run_kind, on_demand: !!p.on_demand, full_due: !!p.full_due, request_id: p.request_id || '', email: p.email || '', callback_url: p.callback_url || '', cycle: c,
      site_id: p.site_id, domain: p.domain, started_at: p.checked_at, ceiling_dfs_usd: n0(p.ceiling_dfs_usd) || null }; };

  // ---- 6b'. a store that only LOOKED failed heals itself (2026-10-27, production 2026-10-25: devaicon.com, run ai_20261025_devaicon-com) -----
  // The hand-off counted an answer as "not stored" when the row *Save AI Answers* returned carried a non-empty `error` - but `error` is a
  // COLUMN of seo_ai_answers: an answer the in-200 gate could not read is stored WITH its DataForSEO message ("Internal SE Server Error.").
  // Three such rows (stored, ids and all) were read as three failed saves and the run stopped `failed_store`, blocking the site for 6 days.
  // n8n 2.41's Data Table insert writes every row of a call in ONE transaction and returns each row with its `id`, or fails them all; so a
  // row is stored exactly when the table handed it back with an id (storedRow), never judged by its `error` column. Before a part declares
  // `failed_store` it reads the run's rows back and inserts the truly missing ones once more (storeCheck); a run already stopped
  // `failed_store` is checked again by every later start of the tracker and by the pulse's resume (healStore / storeHealDue): if every lost
  // answer is in the table the run simply continues; if some are truly missing it continues ONCE with them counted as could-not-be-read
  // (never asked again, never paid again); a second storage failure in the same run keeps it stopped for a person.
  const storedRow = (j) => !!(j && typeof j === 'object' && S(j.id) !== '' && S(j.prompt_id) && S(j.engine));
  /** what one part sent and what the table holds of it: { sent, stored, missing: [keys], recovered: n (found on the re-read or the retry) } */
  const storeCheck = (o) => { const x = o || {}; const mine = (r) => r && S(r.site_id) === S(x.site_id) && (!x.run_id || !S(r.run_id) || S(r.run_id) === S(x.run_id));
    const sent = new Set((x.sent || []).filter(mine).map(r => reqKey(r.prompt_id, r.engine)));
    const first = new Set((x.saved || []).filter(r => mine(r) && storedRow(r)).map(r => reqKey(r.prompt_id, r.engine)));
    const later = new Set([...(x.reread || []), ...(x.retried || [])].filter(r => mine(r) && storedRow(r)).map(r => reqKey(r.prompt_id, r.engine)));
    const missing = [...sent].filter(k => !first.has(k) && !later.has(k));
    return { sent: sent.size, stored: sent.size - missing.length, missing, recovered: [...sent].filter(k => !first.has(k) && later.has(k)).length }; };
  /** a `failed_store` state checked against the run's stored rows: null (not such a state), { ok: true, state, found, missing, note } (the
   *  run continues), or { ok: false, found, missing, why } (it stays stopped) */
  const healStore = (st, rows, nowIso) => {
    if (!st || !st.run_id || S(st.status) !== 'failed_store') return null;
    const stored = new Set((rows || []).filter(r => r && S(r.run_id) === S(st.run_id) && r.prompt_id && r.engine).map(r => reqKey(r.prompt_id, r.engine)));
    const explicit = Object.keys(parse(st.lost_keys, {}) || {}).length > 0;
    if (!explicit && !st.asked_keys) return { ok: false, found: 0, missing: n0(st.lost), why: 'the stopped run recorded neither the answers it lost nor the requests it sent, so the table cannot be checked for them' };
    const lostK = explicit ? unpackKeys(st.lost_keys) : new Set([...unpackKeys(st.asked_keys)].filter(k => !stored.has(k)));
    const missing = [...lostK].filter(k => !stored.has(k));
    const found = explicit ? lostK.size - missing.length : Math.max(0, n0(st.lost) - missing.length);
    const heals = n0(st.store_heals);
    if (missing.length && heals >= 1) return { ok: false, found, missing: missing.length, why: 'this run already continued once after answers it paid for were not stored, and ' + missing.length + ' answer(s) are missing again: a second storage failure in one run keeps it stopped' };
    const when = S(st.updated_at).slice(0, 16).replace('T', ' ');
    const note = missing.length
      ? 'Run ' + st.run_id + ' was stopped' + (when ? ' at ' + when + ' UTC' : '') + ' because answers it had paid for were not stored. Read again, ' + found + ' of them are stored and ' + missing.length + ' are still missing: those ' + missing.length + ' were paid for once, are never asked again and count as could not be read; the run continued with the answers it has.'
      : 'Run ' + st.run_id + ' was stopped' + (when ? ' at ' + when + ' UTC' : '') + ' because ' + (found || n0(st.lost)) + ' answer(s) looked unstored. Read again, every one of them is in the table (the save had reported them as failed), so the run continued from its stored answers. Nothing was asked or paid for again.';
    const state = { ...st, status: 'running', stop_reason: '', lost: explicit ? Math.max(0, n0(st.lost) - found) : missing.length, lost_keys: null, pending: null,
      store_heals: heals + (missing.length ? 1 : 0), store_heal: { at: S(nowIso), found, missing: missing.length, stopped_at: S(st.updated_at), reason: S(st.stop_reason).slice(0, 300) }, store_heal_note: note };
    return { ok: true, state, found, missing: missing.length, note }; };
  /** the pulse's resume: a `failed_store` run (inside resume_days) whose answers can be checked is started again so the tracker checks them */
  const storeHealDue = (st, nowIso) => { if (!st || !st.run_id || S(st.status) !== 'failed_store') return false;
    const now = Date.parse(nowIso) || Date.now(), started = Date.parse(st.started_at) || 0;
    if (started && now - started > LIMITS.resume_days * 864e5) return false;
    return !!(Object.keys(parse(st.lost_keys, {}) || {}).length || st.asked_keys); };

  // ---- 6c. a part sized by TIME, not only by count (F2, 2026-10-23: ENGINE_AUDIT.md E11) ----------------------------------------------
  // A 600-request part at ~40-60 s per batch of 10 (Run AI Requests: batch 10, 200 ms apart) is 40-60 minutes BEFORE the retries and the
  // Answer Analyst, against an execution limit of 60: a part that runs out of time loses everything it paid for. A part now gets a time
  // budget (40 of the 60 minutes, less a fixed allowance for loads and writes, the retry pause and the analyst's jobs), and the requests
  // that fit it at the slow-case seconds of each engine (a batch of 10 waits for its slowest answer) — or at the seconds per request the
  // run's earlier parts MEASURED (wall time of the part, analyst taken out), with 20% headroom. Never more than chunk_requests.
  const TIME = { exec_limit_s: 3600, budget_s: 2400, fixed_s: 300, batch: 10, interval_s: 0.2, retry_wait_s: 20, retry_share: 0.15, headroom: 1.2, min_requests: 40,
    analyst_job_s: 30,
    // R-E5 (2026-10-23, REVIEW_ENGINE.md): one Sentiment Reader call (20 passages, ~6k tokens in, up to 4k out) at its slow case, and the tail a run's
    // last part still runs after the reader (the metrics, the saves, the brief, the report, the PDF; the options keep their own extra_s)
    sentiment_call_s: 30, sentiment_tail_s: 420,
    req_s: { chatgpt: 60, gemini: 60, perplexity: 30, claude: 45, ai_mode: 45, ai_overview: 25, copilot: 20, chatgpt_api: 45, gemini_api: 45 } };
  /** seconds one request costs a part, on these engines: the modelled figure, or the measured one when a part of the run measured it */
  const secPerRequest = (engines, measured) => {
    const es = (engines || []).filter(e => TIME.req_s[e]); const avg = es.length ? es.reduce((t, e) => t + TIME.req_s[e], 0) / es.length : 45;
    const model = (avg / TIME.batch + TIME.interval_s) * (1 + TIME.retry_share);
    return n0(measured) > 0 ? Math.max(0.5, n0(measured) * TIME.headroom) : model; };
  /** how many requests one part may ask: { size, sec_per_request, budget_s, basis } */
  const chunkPlan = (o) => {
    const x = o || {}; const spr = secPerRequest(x.engines, x.measured_s); const aj = Math.max(0, n0(x.analyst_jobs));
    // W2-E3 (2026-10-23): `extra_s` = the seconds the run's last part keeps for the fan-out check, the persona test and the demand lookups
    // (AIX.extraSeconds); 0 when none of them is on, so every part keeps its size
    const budget = Math.max(0, n0(x.budget_s) || (TIME.budget_s - TIME.fixed_s - TIME.retry_wait_s - aj * TIME.analyst_job_s - Math.max(0, n0(x.extra_s))));
    let size = Math.min(LIMITS.chunk_requests, Math.max(TIME.min_requests, Math.floor(budget / spr)));
    if (x.halve) size = Math.max(TIME.min_requests, Math.floor(size / 2));
    return { size, sec_per_request: Math.round(spr * 100) / 100, budget_s: Math.round(budget), analyst_jobs: aj, halved: !!x.halve,
      basis: (n0(x.measured_s) > 0 ? 'measured ' + (Math.round(n0(x.measured_s) * 100) / 100) + ' s a request in this run\'s earlier parts (+20%)' : 'modelled ' + (Math.round(spr * 100) / 100) + ' s a request (slow-case engine time / batch of ' + TIME.batch + ', +15% retries)')
        + ', ' + Math.round(budget) + ' s for requests in a part (40 of the 60 minutes, less loads, the retry pause and ' + aj + ' analyst job(s)' + (n0(x.extra_s) > 0 ? ', and ' + Math.round(n0(x.extra_s)) + ' s kept for the fan-out check / persona test / demand lookups' : '') + ')' + (x.halve ? '; halved after a part that did not finish' : '') }; };

  // ---- 6d. one fit-gate context for the weekly run and the pulse (F2, 2026-10-23: ENGINE_AUDIT.md E18) ------------------------------------
  // The weekly plan protected the ladder heads + the site's services, the pulse the questions' own topics with no services, so one question
  // could be refused on one path and asked on the other. Both now build the gate's input here, from the same rows.
  const servicesOfRow = (row) => { const r = row || {}; if (!(S(r.canonical_host) || S(r.model_updated_at))) return [];
    const arr = (v) => { const x = parse(v, null); return Array.isArray(x) ? x : listOf(v); };
    return [...new Set([...arr(r.declared_services), ...arr(r.services_json)].map(s => S(s).slice(0, 80)).filter(Boolean))].slice(0, 30); };
  const fitInput = (o) => { const x = o || {};
    return { own_domain: S(x.domain), competitors: [...new Set((x.competitors || []).map(S).filter(Boolean))].slice(0, 8), brands: x.aliases || {},
      heads: [...new Set((x.ladders || []).map(l => S(l.head_keyword)).filter(Boolean))], services: (x.services || []).slice(0, 30), keywords: x.keywords || [] }; };

  // ---- 7. the panel's identity: a delta is only a delta between the same questions ---------------------------------------------
  const panelIds = (ids) => [...new Set((ids || []).map(S).filter(Boolean))].sort();
  const panelHash = (ids, engines) => { const s = panelIds(ids).join(',') + '#' + [...new Set(engines || [])].sort().join('+'); return (hash(s) >>> 0).toString(36) + '-' + panelIds(ids).length; };
  /** share of the earlier panel's questions still asked now (0-1), and whether that is the same panel (>= 80%) */
  const overlap = (now, before) => { const A = new Set(panelIds(now)), B = panelIds(before); if (!B.length || !A.size) return { share: null, same: null, common: 0 };
    const c = B.filter(x => A.has(x)).length; const share = c / Math.max(A.size, B.length); return { share: Math.round(1000 * share) / 1000, same: share >= 0.8, common: c }; };

  // ---- 8. the money: ONE formula (the app's app/shared/src/cost.ts estimateAiPanelCost mirrors it; both are held to the golden cases in
  // v5/data/ai_panel_cost_cases.json — harness S211 and app/shared cost.aipanel.test.ts) --------------------------------------------
  // DataForSEO price per question on each engine (LLM scraper / LLM Responses / SERP, measured 2026-10-02, priced 2026-10-08; the two API
  // engines of 2026-10-18 are ESTIMATES until their first live call — the settle takes each task's own `cost` either way).
  const PRICE = { chatgpt: 0.004, gemini: 0.004, perplexity: 0.006, claude: 0.025, ai_overview: 0.002, ai_mode: 0.004, copilot: 0.002, chatgpt_api: 0.012, gemini_api: 0.02 };
  const PRICE_BASIS = { chatgpt_api: 'estimate: DataForSEO $0.0002 a task + OpenAI tokens + web search (~$0.01); confirm on the first live run', gemini_api: 'estimate: DataForSEO $0.0002 a task + Gemini tokens + Google Search grounding; confirm on the first live run' };
  const ENGINES = Object.keys(PRICE);
  const DEFAULT_ENGINES = ['chatgpt', 'perplexity', 'gemini', 'claude', 'ai_overview', 'ai_mode'];   // copilot and the two API engines are opt-in
  const MONTHLY_ENGINES = ['claude'];
  const PULSE_ENGINES = ['chatgpt', 'gemini', 'ai_mode', 'copilot'];
  const FIXED = { weekly_ai_min: 0.13, brief_ai: 0.03, analyst_job_ai: 0.02, analyst_per_job: 12, analyst_share: 0.35, analyst_cap_base: 24, analyst_cap_max: 60,
    full_dfs: 0.45, full_ai: 0.3, weeks_per_month: 4.33, pulse_days: 6,
    // W2-E2's Sentiment Reader (Claude Haiku, merged 2026-10-23): every answer of the run that names the business, 20 a call, at most 40 calls a
    // run, about $0.02 a call (R-E9, 2026-10-23: was $0.012; a call reads ~20 x (question + passage) + the prompt = ~6k tokens at Haiku 4.5's $1/M
    // = $0.006, and answers 2-3k tokens (capped at 4,000) at $5/M = $0.010-0.020, so $0.016-0.026; _cost_cal.js holds the same Haiku prices).
    // The worst case a run can spend is calls_max x tries (the agent node's retryOnFail: 2) x sentiment_call_worst (6k in + 4k out = $0.026). Named answers = the weekly run's answers x sentiment_named_rate. ASSUMPTION: 50% named, conservative on purpose (a
    // new site is named in far fewer), so the quote is an upper bound; the full run's few extra answers (the monthly engine, the brand question) are
    // inside that margin and are not priced on their own (a quote never moves by a call or two with the engine set).
    sentiment_named_rate: 0.5, sentiment_per_call: 20, sentiment_calls_max: 40, sentiment_call_ai: 0.02, sentiment_call_worst: 0.026, sentiment_tries: 2 };
  /** the Sentiment Reader's calls and Claude money for a run of `answers` answers */
  const sentimentOf = (answers) => { const named = Math.ceil(Math.max(0, n0(answers)) * FIXED.sentiment_named_rate);
    const calls = Math.min(FIXED.sentiment_calls_max, Math.ceil(named / FIXED.sentiment_per_call)); return { named, calls, ai: Math.round(calls * FIXED.sentiment_call_ai * 10000) / 10000 }; };
  // ---- W2-E3 (2026-10-23, docs/ai-visibility-2026-10-23/WAVE2_CONTRACTS.md §4): the owner's engine and coverage options -------------------------
  // Every one is OFF by default, so a site that sets none of them costs exactly what it cost before (the golden cases of `cases` hold that).
  //  * ai_claude_weekly   Claude every weekly run instead of the month's full run only
  //  * ai_pulse_engines   which engines the daily pulse asks ('' = the default four, each when the site has it on); Perplexity and the Google AI
  //                       Overview may be added (the AI Overview is asked only for a real search phrase, so its figure here is an upper bound)
  //  * ai_persona_context each buyer role sent to the ChatGPT API as the asker's context on a sub-panel of PERSONA.questions questions (the same
  //                       questions for every role), plus the same questions once with no role (one control shared by every role), every weekly
  //                       run: the persona effect, labelled "API answers"
  //  * ai_fanout_check    the N most frequent searches the engines ran before answering, each checked on Google's top 10 every weekly run
  //                       (a results page read earlier the same day is reused for nothing, so the figure is an upper bound)
  //  * ai_demand_market   (W2-E3 addition to the contract) the monthly market trend from the AI-answer database: your mentions month by month,
  //                       the mentions won and lost, and the brands AI names most for your main topic (3 LLM Mentions tasks on the full run)
  // The extra prices live apart from PRICE (PRICE is the per-engine table the app's AI_ENGINE_COST is held to).
  const XPRICE = { fanout_serp: 0.002, persona: 0.012, demand_task: 0.11 };   // serp/google/organic depth 10 (live); the ChatGPT API answer (= PRICE.chatgpt_api, an estimate until its first live call); one LLM Mentions task ($0.10 + ~10 rows x $0.001)
  const PERSONA = { questions: 12, max_roles: 6 };   // 12 questions a role = MIN_RATE_SAMPLES, so a role's rate is never "too few answers" by construction
  const FANOUT_MAX = 200;
  const DEMAND_TASKS = 3;
  const PULSE_ALLOWED = ['chatgpt', 'gemini', 'ai_mode', 'copilot', 'perplexity', 'ai_overview'];
  /** the engines the daily pulse asks: the owner's choice (only engines the site has on, in a fixed order) or, with none, the default four */
  const pulseEnginesOf = (engines, chosen) => {
    const en = (engines && engines.length ? engines : DEFAULT_ENGINES).map(e => S(e).toLowerCase());
    const pick = listOf(chosen).map(e => e.toLowerCase().replace(/[\s-]+/g, '_')).filter(e => PULSE_ALLOWED.includes(e) && en.includes(e));
    return pick.length ? PULSE_ALLOWED.filter(e => pick.includes(e)) : PULSE_ENGINES.filter(e => en.includes(e));
  };
  /** the engines asked only on the month's full run */
  const monthlyOf = (claudeWeekly) => (claudeWeekly ? [] : MONTHLY_ENGINES.slice());
  const r4 = (x) => Math.round(x * 10000) / 10000; const r2 = (x) => Math.round(x * 100) / 100;
  const sumPrice = (list) => list.reduce((t, e) => t + (PRICE[e] || 0), 0);
  /** what the options add to one run: the persona test and the fan-out check every weekly run, the demand trend on the full run */
  const optionsOf = (x, asked) => {
    const nRoles = Array.isArray(x.personas) || typeof x.personas === 'string' ? listOf(x.personas).length : Math.round(n0(x.personas));   // a count, or the roles themselves
    const roles = x.persona_context ? Math.min(PERSONA.max_roles, Math.max(0, nRoles)) : 0;
    const pq = roles ? Math.min(PERSONA.questions, asked) : 0;
    const pReq = roles ? (roles + 1) * pq : 0;   // every role, plus one control arm shared by all of them
    const fq = clamp(Math.round(n0(x.fanout_check)), 0, FANOUT_MAX);
    const dm = !!x.demand_market;
    return { claude_weekly: !!x.claude_weekly, pulse_engines: null,
      persona: { on: !!x.persona_context, roles, questions: pq, requests_run: pReq, dfs_run: r4(pReq * XPRICE.persona) },
      fanout: { queries: fq, requests_run: fq, dfs_run: r4(fq * XPRICE.fanout_serp) },
      demand_market: { on: dm, tasks: dm ? DEMAND_TASKS : 0, dfs_full: dm ? r4(DEMAND_TASKS * XPRICE.demand_task) : 0 } };
  };
  /** the seconds the run's last part keeps for the options (batches of 10, the slowest request of each kind; none = 0) */
  const extraSeconds = (o) => { const x = o || {}; const p = n0(x.persona_requests), f = n0(x.fanout_requests), d = n0(x.demand_requests);
    return Math.ceil(p / 10) * (TIME.req_s.chatgpt_api || 45) + Math.ceil(f / 10) * 10 + Math.ceil(d / 10) * 30 + (p + f + d ? TIME.retry_wait_s : 0); };
  /** the Answer Analyst jobs one weekly run may start (it reads the answers that matter, 12 a job; more for a bigger panel, never past 60) */
  const analystCap = (panel) => Math.min(FIXED.analyst_cap_max, FIXED.analyst_cap_base + Math.floor(n0(panel) / 25));
  /** o: { panel, engines, pulse (bool), pulse_mode ('auto'|'sample'|'full'), pulse_per_week, cluster_size, and the W2-E3 options claude_weekly,
   *  pulse_engines, persona_context + personas (the number of buyer roles), fanout_check, demand_market; AI-FOCUS: pulse_questions, the questions the
   *  pulse asks when its scope is the focus }. Every figure is in US dollars;
   *  `run` is what one execution chain of the weekly tracker spends (weekly / the month's full run), `pulse_day` one pulse morning,
   *  `month` the site's month (4.33 weekly runs + the full run's extra + 26 pulse mornings); `options` what each option adds. */
  const cost = (o) => {
    const x = o || {};
    const panel = clamp(Math.round(n0(x.panel)) || LIMITS.default_new, LIMITS.min, LIMITS.max);
    const engines = [...new Set((x.engines && x.engines.length ? x.engines : DEFAULT_ENGINES).filter(e => PRICE[e] != null))];
    const asked = Math.max(1, panel - 1);                  // the brand question is asked on the month's full run only
    const MONTHLY = monthlyOf(x.claude_weekly);            // W2-E3: Claude weekly when the owner asks for it
    const wE = engines.filter(e => !MONTHLY.includes(e));
    const pE = pulseEnginesOf(engines, x.pulse_engines);   // W2-E3: the owner's pulse engines ('' = the default four)
    const answers = asked * wE.length;
    const jobs = Math.min(analystCap(panel), Math.ceil(answers * FIXED.analyst_share / FIXED.analyst_per_job));
    const opt = optionsOf(x, asked); opt.pulse_engines = pE.slice();
    const sw = sentimentOf(answers);   // W2-E2's Sentiment Reader, priced on the weekly run's answers (every run asks them)
    const weekly = { dfs: r4(asked * sumPrice(wE) + opt.persona.dfs_run + opt.fanout.dfs_run), ai: r4(Math.max(FIXED.weekly_ai_min, FIXED.brief_ai + jobs * FIXED.analyst_job_ai) + sw.ai) };
    weekly.usd = r4(weekly.dfs + weekly.ai);
    const extra = { dfs: r4(MONTHLY.filter(e => engines.includes(e)).reduce((t, e) => t + panel * PRICE[e], 0) + sumPrice(wE) + FIXED.full_dfs + opt.demand_market.dfs_full), ai: FIXED.full_ai };
    extra.usd = r4(extra.dfs + extra.ai);
    const full = { dfs: r4(weekly.dfs + extra.dfs), ai: r4(weekly.ai + extra.ai) }; full.usd = r4(full.dfs + full.ai);
    const on = x.pulse !== false && pE.length > 0;
    const pw = on ? pulsePerWeek({ asked, weekly_engines: wE.length, pulse_engines: pE.length, cluster_size: x.cluster_size, mode: x.pulse_mode, per_week: x.pulse_per_week }) : { per_week: 0, headline: halfWidth(answers), cluster: halfWidth(Math.min(asked, n0(x.cluster_size) || LIMITS.cluster_size_guess) * wE.length), capped: false, why: on ? '' : 'the daily pulse is off' };
    // AI-FOCUS (2026-10-27): with the pulse scope 'focus' the pulse asks only `pulse_questions` of the panel (the questions of the topics the client
    // works on); null / absent = the whole panel, exactly as before (every golden case without it is unchanged)
    const pq = x.pulse_questions == null || x.pulse_questions === '' || !Number.isFinite(Number(x.pulse_questions)) ? asked : clamp(Math.round(n0(x.pulse_questions)), 0, asked);
    const qDay = on ? Math.min(pq, Math.ceil(pq * pw.per_week / FIXED.pulse_days)) : 0;
    const pulse_day = { dfs: r4(qDay * sumPrice(pE)), ai: 0 }; pulse_day.usd = pulse_day.dfs;
    const W = FIXED.weeks_per_month;
    const month = { weekly: r2(W * weekly.usd), full_extra: r2(extra.usd), pulse: r2(W * FIXED.pulse_days * pulse_day.usd) };
    month.total = r2(month.weekly + month.full_extra + month.pulse);
    return { panel, asked, engines, weekly_engines: wE, pulse_engines: on ? pE : [], per_week: pw.per_week, pulse_questions_day: qDay, pulse_why: pw.why, pulse_capped: !!pw.capped,
      requests: { weekly: answers, full: answers + MONTHLY.filter(e => engines.includes(e)).length * panel + wE.length, pulse_day: qDay * (on ? pE.length : 0) },
      executions: Math.max(1, Math.ceil(answers / LIMITS.chunk_requests)), analyst_jobs: jobs,
      half_width: { headline: pw.headline, cluster: pw.cluster }, run: { weekly, full }, full_extra: extra, pulse_day, month,
      prices: engines.map(e => ({ engine: e, usd: PRICE[e], basis: PRICE_BASIS[e] || 'measured / priced' })),
      // W2-E3: what each option adds (all zero / off by default), and the requests the run's last part makes for them
      sentiment: { named_rate: FIXED.sentiment_named_rate, ...sw },
      options: { ...opt, requests_extra: { weekly: opt.persona.requests_run + opt.fanout.requests_run, full: opt.persona.requests_run + opt.fanout.requests_run + opt.demand_market.tasks } } };
  };

  return { LIMITS, panelSize, normMarket, locationOf, listOf, marketsOf, personasOf, stageOf, stems, jaccard, sameAsk, dedupe, stratumOf, pulseDay, halfWidth,
    pulsePerWeek, pulseSample, reqKey, slice, stateKey, stateOf, stateVerdict, stateRow, doneRun, panelIds, panelHash, overlap, hash,
    MARKETS_MAX, normQ, hash64, promptId, findStored, keywordOf, KEYWORD_SOURCES, STOPPED, ENG_CODE, packKeys, unpackKeys, CEILING, runCeiling, ceilingLeft, keysUsd, baseState,
    storedRow, storeCheck, healStore, storeHealDue,
    TIME, secPerRequest, chunkPlan, servicesOfRow, fitInput,
    PRICE, PRICE_BASIS, ENGINES, DEFAULT_ENGINES, MONTHLY_ENGINES, PULSE_ENGINES, FIXED, analystCap, cost, sentimentOf,
    XPRICE, PERSONA, FANOUT_MAX, DEMAND_TASKS, PULSE_ALLOWED, pulseEnginesOf, monthlyOf, optionsOf, extraSeconds };
})();
// ---- W2-E3 (2026-10-23, docs/ai-visibility-2026-10-23/WAVE2_CONTRACTS.md §2-§5, MARKET_RND.md §3.1 gaps 4 / 5 / 7 / 9 / 10) -----------------
// Coverage and demand at the leaders' level, for the AI Visibility Tracker (inlined by build_monitors.py after AIP, SC and AIE; pure functions,
// the harness runs them):
//  1. FAN-OUT RANKING GAP (`ai_fanout_check` N, default 0 = off): the searches the engines ran before answering, deduplicated, the N most
//     frequent checked on Google's top 10 (one results-page reading per search and day, shared with every other path through SC), joined to
//     the site's Search Console queries; per search: how often, which engines, our rank and page, the page that should rank (page inventory),
//     the domains that do, and whether an answer that ran it cited us. "We rank #1-3 but are not cited" is flagged on its own.
//  2. PERSONA EFFECT (`ai_persona_context`, API answers only): the same questions asked of the ChatGPT API with each buyer role as the
//     asker's context and once without (one shared control), named rate per role against the control, two-proportion tested, pooled over the
//     last 28 days of stored runs. Kept out of every headline: it is labelled "API answers".
//  3. DEMAND AS A RANGE: per question, every proxy we hold with its source and date (AI keyword volume, the AI-answer database's question
//     volume, Search Console impressions of matching question queries, the owner's uploaded AI reports), and the low / high they span; the
//     monthly market trend (LLM Mentions historical / timeseries_new_lost / top_mentioned_brands) when `ai_demand_market` is on. The ChatGPT
//     part of the database is US-English only, and every figure from it says so for any other market.
//  4. THE OWNER'S AI REPORTS (seo_ai_imports, written by the app): Bing Webmaster "AI Performance" and Search Console's AI Mode / AI
//     Overview exports, summarised for the period; a Bing file is the Copilot figure's ground truth.
//  5. The run's bookkeeping: its execution ids, its notes (lost / unanalysed answers, questions asked outside their market) and each
//     question's asked state (last run, last time, times asked in 28 days, the run whose gate refused it).
// Nothing here is called unless its option is on or its data is present; with every option off the run asks and costs exactly what it did.
const AIX = (() => {
  const S = (v) => String(v == null ? '' : v).trim();
  const n0 = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const nn = (v) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v));
  const tb = (v) => v === true || S(v).toLowerCase() === 'true';
  const parse = (t, d) => { if (t && typeof t === 'object') return t; try { const v = JSON.parse(S(t) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const r4 = (x) => Math.round(x * 10000) / 10000; const r1 = (x) => Math.round(x * 10) / 10;
  const pct = (a, b) => (b ? r1(100 * a / b) : null);
  const normD = (x) => S(x).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#:].*$/, '');
  const hostOf = (u) => { const m = S(u).match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); return m ? m[1].toLowerCase().replace(/^www\./, '') : ''; };   // no URL constructor in the n8n sandbox
  const pathOf = (u) => { const m = S(u).match(/^https?:\/\/[^\/?#]+(\/[^?#]*)?/i); return m ? (m[1] || '/') : ''; };
  const isOurs = (host, domain) => { const h = normD(host), d = normD(domain); return !!h && !!d && (h === d || h.endsWith('.' + d)); };
  const cleanUrl = (u) => S(u).replace(/#.*$/, '').replace(/[?&](utm_[a-z]+|gclid|fbclid|srsltid)=[^&]*/gi, '').replace(/\?$/, '');
  const API = 'https://api.dataforseo.com/v3/';
  const day = (iso) => S(iso).slice(0, 10);
  const daysBetween = (a, b) => (Date.parse(day(b) + 'T00:00:00Z') - Date.parse(day(a) + 'T00:00:00Z')) / 864e5;
  const usEn = (plan) => Number(plan.location_code) === 2840 && S(plan.language_code || 'en').toLowerCase() === 'en';
  const US_NOTE = 'the AI-answer database holds ChatGPT answers for US-English only';

  // ---- 0. the options a site set (from monitorSites' settings) ---------------------------------------------------------------------------
  const optionsOf = (settings) => { const s = settings || {};
    return { claude_weekly: !!s.claude_weekly, pulse_engines: S(s.pulse_engines_raw), persona_context: !!s.persona_context, personas: (s.personas || []).length,
      fanout_check: Math.max(0, Math.min(AIP.FANOUT_MAX, Math.round(n0(s.fanout_check)))), demand_market: !!s.demand_market }; };

  // ---- 1. the fan-out ranking gap ------------------------------------------------------------------------------------------------------
  /** the searches one answer row ran: W2-E1's fanout_json (every query) when present, else the stored `fanout` (' | ' joined, first six) */
  const fanoutOf = (r) => { const j = parse(r && r.fanout_json, null); if (Array.isArray(j)) return j.map(x => S(typeof x === 'object' && x ? x.query : x)).filter(Boolean);
    return S(r && r.fanout).split(' | ').map(S).filter(Boolean); };
  const normQuery = (q) => { let s = S(q); try { s = s.normalize('NFKC'); } catch (e) {} return s.toLowerCase().replace(/["“”«»]/g, '').replace(/\s+/g, ' ').trim(); };
  /** did this answer cite the site (a boolean, or a URL since W2-E1, or our_urls) */
  const citedRow = (r) => { const c = r && r.cited; return c === true || S(c).toLowerCase() === 'true' || /^https?:\/\//i.test(S(c)) || !!S(r && r.our_urls); };
  /** the run's fan-out searches, deduplicated, most frequent first: [{ query, key, freq, engines, prompts, answers, cited_n }] */
  const fanoutTop = (rows, n) => { const m = new Map();
    for (const r of (rows || [])) { if (!r || !tb(r.answered)) continue; const seen = new Set();
      for (const f of fanoutOf(r)) { const k = normQuery(f); if (!k || k.length < 3 || seen.has(k)) continue; seen.add(k);
        const x = m.get(k) || { query: S(f).replace(/\s+/g, ' ').slice(0, 300), key: k, freq: 0, engines: new Set(), prompts: new Set(), cited_n: 0 };
        x.freq++; x.engines.add(S(r.engine)); x.prompts.add(S(r.prompt_id)); if (citedRow(r)) x.cited_n++; m.set(k, x); } }
    const all = [...m.values()].sort((a, b) => b.freq - a.freq || b.engines.size - a.engines.size || a.key.localeCompare(b.key));
    return { distinct: all.length, top: all.slice(0, Math.max(0, n)).map(x => ({ query: x.query, key: x.key, freq: x.freq, engines: [...x.engines].sort(), prompts: [...x.prompts].slice(0, 5), cited_n: x.cited_n })) }; };
  const serpBody = (plan, q) => ({ keyword: S(q).slice(0, 700), location_code: Number(plan.location_code) || 2840, language_code: S(plan.language_code || 'en') || 'en', depth: 10 });
  /** the requests a fan-out check still needs (a reading of today, deep enough, is used for nothing) and the readings it reuses */
  const fanoutRequests = (plan, top, serpRows, nowIso) => { const requests = [], hits = {};
    for (const q of (top || [])) { const body = serpBody(plan, q.query); const lk = SC.lookup(serpRows || [], body, { now: nowIso });
      if (lk.hit) { hits[q.key] = lk.response; continue; }
      requests.push({ site_id: plan.site_id, domain: plan.domain, kind: 'fanout', key: q.key, query: q.query, endpoint: API + 'serp/google/organic/live/advanced', body: [body], est_cost: AIP.XPRICE.fanout_serp }); }
    return { requests, hits }; };
  const stemsOf = (t) => AIP.stems(t);
  /** the page of the site that should rank for a search: the inventory page whose address and title share most content words with it */
  const targetPage = (query, pages, domain) => { const qs = stemsOf(query); if (!qs.length) return null; let best = null, bs = 0;
    for (const p of (pages || [])) { if (!p || !p.url || !isOurs(hostOf(p.url), domain)) continue; if (Number(p.http_status) >= 400) continue;
      const ps = stemsOf(pathOf(p.url).replace(/[\/_-]+/g, ' ') + ' ' + S(p.title) + ' ' + S(p.h1)); const A = new Set(ps); let hit = 0; for (const w of qs) if (A.has(w)) hit++;
      const sc = hit / qs.length; if (sc > bs) { bs = sc; best = p.url; } }
    return bs >= 0.34 ? cleanUrl(best) : null; };
  /** the site's Search Console row for a search: the exact query, else the closest one sharing 75% of its content words */
  const gscOf = (query, qrows) => { const k = normQuery(query); let exact = null, best = null, bs = 0; const qs = stemsOf(query);
    for (const r of (qrows || [])) { const rk = normQuery(r.query); if (!rk) continue; if (rk === k) { exact = r; break; } const j = AIP.jaccard(qs, stemsOf(r.query)); if (j > bs) { bs = j; best = r; } }
    const r = exact || (bs >= 0.75 ? best : null); return r ? { query: S(r.query), impressions: n0(r.impressions), clicks: n0(r.clicks), position: nn(r.position), match: exact ? 'exact' : 'close', as_of: day(r.period_end || r.checked_at) } : null; };
  const task0 = (r) => (((r || {}).tasks || [])[0]) || {};
  /** -> fanout_gap_json. `answers` = { key: response } for every search read (fresh or from the shared reading) */
  const fanoutGap = (o) => { const x = o || {}, plan = x.plan || {}, top = x.top || { top: [], distinct: 0 };
    const latestQ = new Map(); for (const r of (x.queries || [])) { if (!r || S(r.site_id) !== S(plan.site_id) || !r.query) continue; const k = normQuery(r.query); const old = latestQ.get(k); if (!old || S(r.checked_at) > S(old.checked_at)) latestQ.set(k, r); }
    const qrows = [...latestQ.values()];
    const queries = top.top.map(q => { const res = (x.answers || {})[q.key] || null; const t = task0(res); const st = SC.status(res);
      const base = { query: q.query, freq: q.freq, engines: q.engines, our_rank: null, our_url: null, target_url: targetPage(q.query, x.pages, plan.domain), top_domains: [], cited: q.cited_n > 0, cited_n: q.cited_n,
        gsc: gscOf(q.query, qrows), read: !res ? 'not asked' : st === 'failed' ? 'not read' : (res.serp_cache && res.serp_cache.hit ? 'reading of today (' + S(res.serp_cache.text) + ')' : 'read now') };
      if (!res || st === 'failed') return { ...base, flag: 'not_read', note: !res ? 'not checked (the run\'s money ceiling or no request)' : 'Google\'s results page could not be read: ' + S(t.status_message || (res.error && (res.error.message || res.error)) || 'no answer').slice(0, 120) };
      const items = (((t.result || [])[0] || {}).items || []).filter(i => i && i.type === 'organic').sort((a, b) => n0(a.rank_group) - n0(b.rank_group));
      const ours = items.find(i => isOurs(hostOf(i.url) || i.domain, plan.domain));
      const our_rank = ours ? n0(ours.rank_group) || null : null;
      const flag = our_rank && our_rank <= 3 && !base.cited ? 'ranks_not_cited' : base.cited ? 'cited' : our_rank ? 'ranks' : 'not_in_top10';
      return { ...base, our_rank, our_url: ours ? cleanUrl(ours.url) : null, top_domains: [...new Set(items.map(i => normD(i.domain || hostOf(i.url))).filter(Boolean))].slice(0, 5), flag }; });
    const read = queries.filter(q => q.flag !== 'not_read');
    return { queries, checked_n: read.length, distinct_n: top.distinct, top_n: top.top.length, setting: n0(x.setting), cost_usd: r4(n0(x.cost_usd)),
      from_reading_today_n: queries.filter(q => /^reading of today/.test(q.read)).length, not_read_n: queries.length - read.length,
      ranks_not_cited: queries.filter(q => q.flag === 'ranks_not_cited').map(q => q.query), not_in_top10_n: read.filter(q => q.our_rank == null).length,
      location_code: Number(plan.location_code) || 2840, language_code: S(plan.language_code || 'en'), as_of: day(x.now || new Date().toISOString()),
      method: 'the ' + top.top.length + ' most frequent of the ' + top.distinct + ' distinct searches the engines ran before answering this run\'s questions, each checked on Google\'s top 10 (desktop, the site\'s market); "cited" = an answer that ran the search cited one of your pages; a results page read earlier today is reused, never paid twice' }; };

  // ---- 2. the persona effect (API answers) --------------------------------------------------------------------------------------------
  const PERSONA_MODEL = 'gpt-5.4-mini';
  const personaMessage = (role, plan) => 'The person asking you is a ' + S(role) + (S(plan.country) ? ' at a business in ' + S(plan.country) : '') + '. Answer their question as you would answer that person.';
  /** the sub-panel: the same questions for every role (so one control arm serves them all), spread over the panel's topics, in a stable order */
  const personaQuestions = (plan) => { const qs = (plan.prompts || []).filter(q => q && q.kind !== 'brand' && q.prompt);
    const by = new Map(); for (const q of qs) { const k = S(q.cluster || q.topic).toLowerCase() || 'other'; if (!by.has(k)) by.set(k, []); by.get(k).push(q); }
    for (const v of by.values()) v.sort((a, b) => (AIP.hash(a.prompt_id) - AIP.hash(b.prompt_id)) || S(a.prompt_id).localeCompare(S(b.prompt_id)));
    const keys = [...by.keys()].sort(); const out = []; let i = 0;
    while (out.length < Math.min(AIP.PERSONA.questions, qs.length)) { const k = keys[i % keys.length]; const v = by.get(k); if (v.length) out.push(v.shift()); i++; if (i > qs.length * 4 + keys.length) break; }
    return out; };
  const personaRequests = (plan, settings) => { const roles = (settings.personas || []).slice(0, AIP.PERSONA.max_roles); if (!settings.persona_context || !roles.length) return [];
    const geo = /^[A-Z]{2}$/.test(S(plan.country_iso).toUpperCase()) ? { web_search_country_iso_code: S(plan.country_iso).toUpperCase() } : {};
    const out = []; const qs = personaQuestions(plan);
    for (const q of qs) for (const role of ['', ...roles]) {
      const body = { user_prompt: q.prompt, model_name: PERSONA_MODEL, web_search: true, max_output_tokens: 1200, ...geo, ...(role ? { system_message: personaMessage(role, plan) } : {}) };
      out.push({ site_id: plan.site_id, domain: plan.domain, kind: 'persona', role: role || '', arm: role ? 'with' : 'without', prompt_id: q.prompt_id, prompt: q.prompt, endpoint: API + 'ai_optimization/chat_gpt/llm_responses/live', body: [body], est_cost: AIP.XPRICE.persona }); }
    return out; };
  /** an LLM Responses answer -> { answered, text, cites } (the parser's own reading of that shape) */
  const llmText = (res) => { const t = task0(res); const r0 = ((t.result || [])[0]) || null; if (!res || res.error || t.status_code !== 20000 || !r0) return { answered: false, text: '', cites: [], error: S(t.status_message || (res && res.error && (res.error.message || res.error)) || 'no answer').slice(0, 160) };
    const secs = (r0.items || []).flatMap(it => it.sections || []); const text = secs.map(s => s.text || '').join('');
    const cites = secs.flatMap(s => s.annotations || []).map(a => ({ url: a.url || '', title: a.title || '', host: hostOf(a.url) }));
    return { answered: !!text, text, cites, error: '' }; };
  /** two proportions: z of (k1/n1 - k2/n2) on the pooled rate; null when either side has no answers */
  const twoProp = (k1, n1, k2, n2) => { if (!n1 || !n2) return null; const p = (k1 + k2) / (n1 + n2); const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2)); if (!se) return 0; return Math.round(100 * ((k1 / n1 - k2 / n2) / se)) / 100; };
  const MIN = 12;
  /** 95% Wilson interval of k / n (0-1) */
  const wilson = (k, n) => { if (!n) return [0, 1]; const z = 1.96, p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)); return [Math.max(0, (c - m) / d), Math.min(1, (c + m) / d)]; };
  /** 95% interval of the difference k1/n1 - k2/n2 in points (Newcombe's hybrid score method: the two Wilson intervals combined) */
  const diffCi = (k1, n1, k2, n2) => { if (!n1 || !n2) return [null, null]; const p1 = k1 / n1, p2 = k2 / n2, [l1, u1] = wilson(k1, n1), [l2, u2] = wilson(k2, n2), d = p1 - p2;
    return [r1(100 * (d - Math.sqrt((p1 - l1) ** 2 + (u2 - p2) ** 2))), r1(100 * (d + Math.sqrt((u1 - p1) ** 2 + (p2 - l2) ** 2)))]; };
  // a role's effect is real when the 95% interval of the difference excludes 0 (the z of the two-proportion test is reported beside it)
  const verdictOf = (w, c) => { const [lo, hi] = diffCi(w.k, w.n, c.k, c.n); if (w.n < MIN || c.n < MIN) return { verdict: 'too few answers', z: null, delta: w.n && c.n ? r1(100 * (w.k / w.n - c.k / c.n)) : null, lo, hi, significant: false };
    const z = twoProp(w.k, w.n, c.k, c.n); const delta = r1(100 * (w.k / w.n - c.k / c.n)); const significant = lo > 0 || hi < 0;
    return { z, delta, lo, hi, significant, verdict: significant ? (delta > 0 ? 'named more often with this role' : 'named less often with this role') : 'no measurable difference' }; };
  // R-E3 (2026-10-23, docs/ai-visibility-2026-10-23/REVIEW_ENGINE.md): the two arms are the SAME questions, with and without the role, and the
  // 28-day pool is the same questions again each week: answers are paired by question and clustered by question, never independent samples.
  // The old test (Newcombe over two independent proportions, weeks pooled as more answers) called 3 questions out of 12 "real" after four
  // weeks of the same 3 questions (z 2.46) where a paired test on those questions gives p 0.25. Now: per question, d = named with the role -
  // named without it (this run: 1, 0 or -1; pooled: the mean over the runs that asked that question on both arms); the verdict is an exact
  // sign test on the questions whose d is not 0 (McNemar's exact test for one run), the 95% range a bootstrap of the mean d over QUESTIONS.
  const MINQ = 6;   // paired questions under which a role's effect is "too few questions" (5 discordant questions all one way is p 0.06)
  /** exact two-sided sign test: b questions up, c down -> p */
  const signP = (b, c) => { const n = b + c; if (!n) return 1; const k = Math.min(b, c); let comb = 1, s = 0; for (let i = 0; i <= k; i++) { if (i > 0) comb = comb * (n - i + 1) / i; s += comb; } return Math.min(1, 2 * s / Math.pow(2, n)); };
  const rngOf = (seed) => { let a = AIP.hash(S(seed)) >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  /** 95% percentile bootstrap of the mean of per-question differences (points), resampling QUESTIONS; seeded, so a run is reproducible */
  const bootMean = (ds, seed, B) => { const n = ds.length; if (n < 2) return [null, null]; const R = rngOf(seed); const NB = B || 2000; const vals = new Array(NB);
    for (let b = 0; b < NB; b++) { let s = 0; for (let i = 0; i < n; i++) s += ds[Math.floor(R() * n)]; vals[b] = s / n; }
    vals.sort((a, b) => a - b); return [r1(100 * vals[Math.floor(0.025 * NB)]), r1(100 * vals[Math.min(NB - 1, Math.ceil(0.975 * NB) - 1)])]; };
  /** the paired verdict over per-question differences (each in [-1, 1]) */
  const pairedOf = (ds, seed) => { const n = ds.length; const up = ds.filter(d => d > 0).length, down = ds.filter(d => d < 0).length; const delta = n ? r1(100 * ds.reduce((t, d) => t + d, 0) / n) : null;
    if (n < MINQ) return { questions: n, up, down, p: null, delta, lo: null, hi: null, significant: false, z: null, verdict: 'too few questions' };
    const p = signP(up, down); const [lo, hi] = bootMean(ds, seed); const significant = p < 0.05 && lo != null && (lo > 0 || hi < 0);
    return { questions: n, up, down, p: Math.round(10000 * p) / 10000, delta, lo, hi, significant, z: null, verdict: significant ? (delta > 0 ? 'named more often with this role' : 'named less often with this role') : 'no measurable difference' }; };
  /** -> the persona block. `pairs` = [{ q: request item, r: response }]; `read` = (text, cites) -> { named, cited } (AIE over the site's names) */
  const personaEffect = (o) => { const x = o || {}; const pairs = x.pairs || []; if (!pairs.length) return null;
    const cnt = () => ({ n: 0, k: 0, c: 0, failed: 0 }); const control = cnt(); const by = new Map();
    const byQ = {};   // { prompt_id: { c: 0 | 1 (control named), r: { role: 0 | 1 } } } - kept in notes_json.persona so later weeks pair by question
    for (const { q, r } of pairs) { const a = llmText(r); const box = q.arm === 'without' ? control : (by.get(q.role) || by.set(q.role, cnt()).get(q.role));
      if (!a.answered) { box.failed++; continue; } const v = x.read(a.text, a.cites); box.n++; if (v.named) box.k++; if (v.cited) box.c++;
      const e = byQ[S(q.prompt_id)] || (byQ[S(q.prompt_id)] = { c: null, r: {} }); if (q.arm === 'without') e.c = v.named ? 1 : 0; else e.r[S(q.role)] = v.named ? 1 : 0; }
    // the stored runs of the last 28 days that kept their per-question answers (notes_json.persona.by_q); a run stored without them cannot be paired
    const prevAll = (x.previous || []).filter(p => p && p.persona && daysBetween(p.checked_at, x.now) <= 28 && daysBetween(p.checked_at, x.now) > 0);
    const prev = prevAll.filter(p => p.persona.by_q && typeof p.persona.by_q === 'object'); const unpaired = prevAll.length - prev.length;
    const seed0 = S(x.seed || x.now);
    const roles = [...by.entries()].map(([role, w]) => {
      const dNow = Object.values(byQ).filter(e => e.c != null && e.r[role] != null).map(e => e.r[role] - e.c);
      const v = pairedOf(dNow, seed0 + '|' + role);
      // pooled: per question, the mean difference over every run (this one included) that asked it on both arms
      const acc = new Map(); const add = (bq) => { for (const [pid, e] of Object.entries(bq || {})) { if (!e || e.c == null || e.r == null || e.r[role] == null) continue; const a = acc.get(pid) || { s: 0, m: 0 }; a.s += n0(e.r[role]) - n0(e.c); a.m++; acc.set(pid, a); } };
      add(byQ); const pairsIn = () => [...acc.values()].reduce((t, a) => t + a.m, 0); let runs = 1; for (const p of prev) { const before = pairsIn(); add(p.persona.by_q); if (pairsIn() > before) runs++; }
      const dPool = [...acc.values()].map(a => a.s / a.m); const pv = pairedOf(dPool, seed0 + '|' + role + '|pooled');
      const pool = prev.reduce((t, p) => { const pr = (p.persona.roles || []).find(rr => S(rr.role) === S(role)); const pc = p.persona.control || {};
        if (!pr) return t; return { n: t.n + n0(pr.n), k: t.k + n0(pr.k), cn: t.cn + n0(pc.n), ck: t.ck + n0(pc.k) }; }, { n: w.n, k: w.k, cn: control.n, ck: control.k });
      return { role, n: w.n, k: w.k, c: w.c, failed: w.failed, rate: pct(w.k, w.n), control_rate: pct(control.k, control.n), delta: v.delta, lo: v.lo, hi: v.hi, significant: v.significant, z: null, p: v.p, questions: v.questions, up: v.up, down: v.down, verdict: v.verdict,
        pooled: { runs, n: pool.n, k: pool.k, control_n: pool.cn, control_k: pool.ck, rate: pct(pool.k, pool.n), control_rate: pct(pool.ck, pool.cn), questions: pv.questions, up: pv.up, down: pv.down, p: pv.p, delta: pv.delta, lo: pv.lo, hi: pv.hi, significant: pv.significant, z: null, verdict: pv.verdict } }; });
    return { label: 'API answers', engine: 'chatgpt_api', model: PERSONA_MODEL, questions: [...new Set(pairs.map(p => p.q.prompt_id))].length, control: { n: control.n, k: control.k, c: control.c, failed: control.failed, rate: pct(control.k, control.n) }, roles, by_q: byQ,
      unpaired_runs: unpaired,
      method: 'the same questions asked of the ChatGPT API (web search on) with the buyer role sent as the asker\'s context, and once without it. Each question is compared with itself: the answers are paired by question, and the weeks of the last 28 days are pooled per question (the same questions again are not more evidence). The change in the "named" rate is the mean per-question difference with a 95% range from resampling the questions; it is real when an exact sign test on the questions that moved gives p under 0.05 and the range excludes 0. Under ' + MINQ + ' paired questions: "too few questions"'
        + (unpaired ? '; ' + unpaired + ' earlier run(s) stored without per-question answers are not pooled' : '') + '. API answers are not what the chatgpt.com interface shows and are kept out of every headline figure',
      as_of: day(x.now) }; };

  // ---- 3. demand as a range, and the monthly market trend --------------------------------------------------------------------------------
  const platformOf = (plan) => (usEn(plan) ? 'chat_gpt' : 'google');
  const monthStart = (iso, back) => { const d = new Date(day(iso) + 'T00:00:00Z'); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - back); return d.toISOString().slice(0, 10); };
  const demandRequests = (plan, settings, nowIso) => { if (!settings.demand_market || !plan.full_due) return [];
    const loc = { location_code: Number(plan.location_code) || 2840, language_code: S(plan.language_code || 'en') || 'en' }; const platform = platformOf(plan);
    const topic = S(plan.market_keyword || (plan.topics || [])[0]);
    const out = [
      { kind: 'demand', what: 'historical', endpoint: API + 'ai_optimization/llm_mentions/historical/live', body: [{ target: [{ domain: plan.domain }], ...loc, platform }] },
      { kind: 'demand', what: 'new_lost', endpoint: API + 'ai_optimization/llm_mentions/timeseries_new_lost/live', body: [{ target: [{ domain: plan.domain }], ...loc, platform, date_from: monthStart(nowIso, 6), date_to: day(nowIso), group_range: 'month' }] } ];
    if (topic) out.push({ kind: 'demand', what: 'top_brands', topic, endpoint: API + 'ai_optimization/llm_mentions/top_mentioned_brands/live', body: [{ target: [{ keyword: topic.slice(0, 250), search_scope: ['answer'] }], ...loc, platform, limit: 10 }] });
    return out.map(r => ({ site_id: plan.site_id, domain: plan.domain, platform, est_cost: AIP.XPRICE.demand_task, ...r })); };
  const marketOf = (plan, pairs, nowIso) => { if (!(pairs || []).length) return null; const platform = platformOf(plan); const out = { platform, location_code: Number(plan.location_code) || 2840, language_code: S(plan.language_code || 'en'), as_of: day(nowIso), historical: [], new_lost: [], top_brands: [], errors: [] };
    for (const { q, r } of pairs) { const t = task0(r); const r0 = ((t.result || [])[0]) || {};
      if (!r || r.error || t.status_code !== 20000) { out.errors.push(q.what + ': ' + S(t.status_message || (r && r.error && (r.error.message || r.error)) || 'no answer').slice(0, 120)); continue; }
      const items = r0.items || [];
      if (q.what === 'historical') out.historical = items.map(i => ({ month: S(i.year) + '-' + S(i.month).padStart(2, '0'), mentions: n0((i.metrics || {}).mentions), ai_search_volume: n0((i.metrics || {}).ai_search_volume) })).sort((a, b) => a.month.localeCompare(b.month));
      if (q.what === 'new_lost') out.new_lost = items.map(i => ({ date: S(i.date), new_mentions: n0(i.new_mentions), lost_mentions: n0(i.lost_mentions), new_ai_search_volume: n0(i.new_ai_search_volume), lost_ai_search_volume: n0(i.lost_ai_search_volume) })).sort((a, b) => a.date.localeCompare(b.date));
      if (q.what === 'top_brands') { out.topic = q.topic; out.top_brands = items.slice(0, 10).map(i => ({ brand: S(i.brand), mentions: n0((i.total || {}).mentions), ai_search_volume: n0((i.total || {}).ai_search_volume) })); } }
    out.note = platform === 'chat_gpt' ? 'ChatGPT answers in the AI-answer database (US-English)' : 'Google AI Overview answers in this market; ' + US_NOTE + ', so no ChatGPT figure is shown for it';
    return out; };
  /** the question-shaped LLM Mentions items this run read (discovery / "questions citing you"): [{ question, volume, platform, as_of }] */
  const mentionItems = (pairs, nowIso) => { const out = [];
    for (const { q, r } of (pairs || [])) { const t = task0(r); if (t.status_code !== 20000) continue;
      for (const it of ((((t.result || [])[0]) || {}).items || [])) if (it && it.question) out.push({ question: S(it.question).slice(0, 300), volume: nn(it.ai_search_volume), platform: S(it.platform || q.platform || ''), as_of: day(nowIso) }); }
    return out; };
  const importRows = (rows, plan, fromIso, toIso) => (rows || []).filter(r => r && S(r.site_id) === S(plan.site_id) && day(r.day) >= day(fromIso) && day(r.day) <= day(toIso));
  /** -> demand_json. Every proxy names its source and date; lo / hi span the proxies a question has (none = no range, never 0). */
  const demand = (o) => { const x = o || {}, plan = x.plan || {}; const now = x.now || new Date().toISOString();
    const qs = (plan.prompts || []).filter(q => q && q.kind !== 'brand' && q.prompt);
    const fresh = new Map((x.fresh || []).filter(r => r && r.prompt_id).map(r => [S(r.prompt_id), r]));
    const stored = new Map((x.stored || []).filter(r => r && r.prompt_id).map(r => [S(r.prompt_id), r]));
    const latestQ = new Map(); for (const r of (x.queries || [])) { if (!r || S(r.site_id) !== S(plan.site_id) || !r.query) continue; const k = normQuery(r.query); const old = latestQ.get(k); if (!old || S(r.checked_at) > S(old.checked_at)) latestQ.set(k, r); }
    const gq = [...latestQ.values()].map(r => ({ r, s: stemsOf(r.query) }));
    const imp = importRows(x.imports, plan, new Date(Date.parse(now) - 28 * 864e5).toISOString(), now).filter(r => S(r.query));
    const impQ = imp.map(r => ({ r, s: stemsOf(r.query) }));
    const mi = (x.mentions || []).map(m => ({ m, s: stemsOf(m.question) }));
    const notUS = !usEn(plan);
    const out = [];
    for (const q of qs) { const s = stemsOf(q.prompt), kws = stemsOf(q.keyword || ''); const proxies = [];
      const row = fresh.get(S(q.prompt_id)) || stored.get(S(q.prompt_id)) || {};
      const vol = q.volume != null ? q.volume : nn(row.volume);
      if (vol != null) proxies.push({ source: 'ai_keyword_volume', value: Math.round(vol), as_of: day(row.updated_at || row.created_at || now) || day(now), note: 'AI searches a month for "' + S(q.keyword || row.keyword).slice(0, 60) + '" (DataForSEO, from People also ask)' });
      let bm = null, bj = 0; for (const it of mi) { const j = AIP.jaccard(s, it.s); if (j > bj) { bj = j; bm = it.m; } }
      if (bm && bj >= 0.6 && bm.volume != null) proxies.push({ source: 'llm_mentions_question', value: Math.round(bm.volume), as_of: bm.as_of, note: (bm.platform === 'chat_gpt' ? 'ChatGPT (US-English)' : 'Google AI Overview') + ' question "' + bm.question.slice(0, 60) + '"' + (bm.platform !== 'chat_gpt' && notUS ? '; ' + US_NOTE : '') });
      const match = (cand) => cand.filter(c => AIP.jaccard(s, c.s) >= 0.6 || (kws.length >= 2 && kws.every(w => c.s.includes(w))));
      const gm = match(gq); if (gm.length) { const imps = gm.reduce((t, c) => t + n0(c.r.impressions), 0); const asOf = gm.map(c => day(c.r.period_end || c.r.checked_at)).sort().pop();
        proxies.push({ source: 'search_console_impressions', value: Math.round(imps * 30 / 28), as_of: asOf, note: gm.length + ' matching question quer' + (gm.length === 1 ? 'y' : 'ies') + ', Google Search, 28 days scaled to a month (only searches where you appeared)' }); }
      for (const src of ['gsc_ai', 'bing_ai']) { const im = match(impQ.filter(c => S(c.r.source) === src)); if (!im.length) continue; const v = im.reduce((t, c) => t + n0(c.r.impressions), 0); if (!(v > 0)) continue;
        proxies.push({ source: src === 'gsc_ai' ? 'search_console_ai_upload' : 'bing_ai_upload', value: Math.round(v * 30 / 28), as_of: im.map(c => day(c.r.day)).sort().pop(), note: (src === 'gsc_ai' ? 'Search Console AI Mode / AI Overview impressions' : 'Bing AI Performance impressions') + ' of ' + im.length + ' matching row(s), your upload, 28 days scaled to a month' }); }
      const vals = proxies.map(p => p.value).filter(v => Number.isFinite(v));
      if (proxies.length) out.push({ prompt_id: q.prompt_id, proxies, lo: vals.length ? Math.min(...vals) : null, hi: vals.length ? Math.max(...vals) : null }); }
    out.sort((a, b) => n0(b.hi) - n0(a.hi));
    const CAP = 200;
    return { questions: out.slice(0, CAP), questions_with_proxy: out.length, questions_total: qs.length, cut: out.length > CAP ? 'the ' + CAP + ' questions with the highest figure are kept' : '',
      market: x.market || null, market_carried: !!x.market_carried,
      note: 'Demand is shown as the range of the proxies each question has, each named with its source and date; no single "prompt volume" exists for AI answers. ' + (notUS ? 'For this market ' + US_NOTE + '. ' : '') + 'Search Console impressions are a floor: they count only the searches where the site appeared.',
      as_of: day(now) }; };

  // ---- 4. the owner's uploaded AI reports (seo_ai_imports, written by the app) -----------------------------------------------------------
  const imports = (rows, plan, nowIso) => { const now = nowIso || new Date().toISOString(); const from = new Date(Date.parse(now) - 28 * 864e5).toISOString();
    const mine = importRows(rows, plan, from, now); if (!mine.length) return null; const out = { period: { from: day(from), to: day(now) }, sources: {}, copilot: null };
    for (const src of ['bing_ai', 'gsc_ai']) { const rs = mine.filter(r => S(r.source) === src); if (!rs.length) continue;
      const pageRows = rs.filter(r => cleanUrl(r.url)), tot = pageRows.length ? pageRows : rs; const sum = (k) => tot.reduce((t, r) => t + n0(r[k]), 0);   /* R-APP note: a pages file and a queries file for the same days are two views of one total - sum one kind (pages when there are any), never both */ const byUrl = new Map(), byQ = new Map();
      for (const r of rs) { const u = cleanUrl(r.url); if (u) { const a = byUrl.get(u) || { url: u, impressions: 0, citations: 0, clicks: 0 }; a.impressions += n0(r.impressions); a.citations += n0(r.citations); a.clicks += n0(r.clicks); byUrl.set(u, a); }
        const q = S(r.query); if (q) { const a = byQ.get(q) || { query: q.slice(0, 200), impressions: 0, citations: 0, clicks: 0 }; a.impressions += n0(r.impressions); a.citations += n0(r.citations); a.clicks += n0(r.clicks); byQ.set(q, a); } }
      const days = rs.map(r => day(r.day)).sort(); const files = [...new Set(rs.map(r => S(r.file_name)).filter(Boolean))].slice(0, 5); const at = rs.map(r => S(r.imported_at)).sort().pop() || '';
      const rank = (m) => [...m.values()].sort((a, b) => (b.citations - a.citations) || (b.impressions - a.impressions)).slice(0, 10);
      out.sources[src] = { rows: rs.length, days: { from: days[0], to: days[days.length - 1] }, impressions: sum('impressions'), citations: sum('citations'), clicks: sum('clicks'), urls_n: byUrl.size, queries_n: byQ.size,
        top_urls: rank(byUrl), top_queries: rank(byQ), files, imported_at: at }; }
    const b = out.sources.bing_ai;
    if (b) out.copilot = { source: 'bing_ai', citations: b.citations, impressions: b.impressions, urls_n: b.urls_n, as_of: b.days.to, label: 'from Bing Webmaster (your export of ' + (day(b.imported_at) || b.days.to) + ')',
      note: 'Bing\'s AI Performance report counts your citations across Copilot and Bing\'s AI answers; it replaces the Copilot figure read from Bing\'s results page, which shows its summary for few searches' };
    out.note = 'Your uploaded reports, ' + day(from) + ' to ' + day(now) + ': ' + Object.entries(out.sources).map(([k, v]) => (k === 'bing_ai' ? 'Bing AI Performance' : 'Search Console AI Mode / AI Overviews') + ' (' + v.rows + ' rows, ' + v.days.from + ' to ' + v.days.to + ')').join('; ');
    return out; };

  // ---- 5. the run's bookkeeping -----------------------------------------------------------------------------------------------------------
  /** R-E1 (2026-10-23, REVIEW_ENGINE.md): one key per paid option request of a run, recorded in the run's state row BEFORE it is paid
   *  (`extras: { run_id, keys }`), so an attempt of the same run that starts the options again never buys one twice (F2's asked_keys rule) */
  const extraKey = (r) => { const x = r || {}; return x.kind === 'fanout' ? 'f|' + S(x.key) : x.kind === 'persona' ? 'p|' + (S(x.role) || '-') + '|' + S(x.prompt_id) : x.kind === 'demand' ? 'd|' + S(x.what) : 'x|' + S(x.kind) + '|' + S(x.key); };
  /** the option keys this run already recorded: the state row's `extras` when it belongs to the run */
  const extrasRecorded = (st, run_id) => new Set(st && st.extras && S(st.extras.run_id) === S(run_id) && Array.isArray(st.extras.keys) ? st.extras.keys.map(S) : []);
  const execIds = (plan, execId) => [...new Set([...(((plan.chunk || {}).executions) || []), S(execId)].map(S).filter(Boolean))].join(',');
  const notes = (plan, extra) => { const c = plan.chunk || {}; const e = extra || {};
    return { lost_note: S(c.lost_note), unanalysed_note: S(c.unanalysed_note), market_fallback_n: (plan.prompts || []).filter(q => q && q.market_fallback).length,
      ...(e.persona ? { persona: e.persona } : {}), ...(e.fanout_note ? { fanout_note: e.fanout_note } : {}), ...(e.ceiling_note ? { ceiling_note: e.ceiling_note } : {}) }; };
  /** each question's asked state (seo_ai_prompts: last_asked_run, last_asked_at, asked_n_28d, refused_at_run); only rows that change */
  const promptState = (o) => { const x = o || {}, plan = x.plan || {}; const now = x.now || new Date().toISOString(); const runAt = S(plan.checked_at || now);
    const asked = new Set((x.run_rows || []).filter(r => r && S(r.site_id) === S(plan.site_id) && S(r.run_id) === S(plan.run_id) && r.prompt_id).map(r => S(r.prompt_id)));
    // R-E12 (2026-10-23, REVIEW_ENGINE.md): the questions the Prompt Writer stored in THIS run (`written`, the Prompt Rows of this execution) get their
    // state too - an asked one its run, a refused one the run whose gate refused it - instead of waiting a week for Load AI Prompts to carry them
    const written = (x.written || []).filter(r => r && S(r.site_id) === S(plan.site_id) && r.prompt_id);
    const refused = new Set([...(plan.set_aside || []).filter(s => s && s.dropped && s.prompt_id).map(s => S(s.prompt_id)), ...written.filter(r => S(r.status) === 'refused').map(r => S(r.prompt_id))]);
    const storedAll = (x.stored || []).slice(); for (const w of written) if (!storedAll.some(r => r && S(r.site_id) === S(w.site_id) && S(r.prompt_id) === S(w.prompt_id))) storedAll.push({ site_id: w.site_id, prompt_id: w.prompt_id });
    const weekly = (x.vis_rows || []).filter(v => v && S(v.site_id) === S(plan.site_id) && S(v.run_id) !== S(plan.run_id) && daysBetween(v.checked_at, now) <= 28).map(v => new Set(((parse(v.panel_json, {}) || {}).ids || []).map(S)));
    const pulse = (x.daily_rows || []).filter(d => d && S(d.site_id) === S(plan.site_id) && daysBetween(d.checked_at || d.date, now) <= 28).map(d => new Set(Object.keys(parse(d.prompts_json, {}) || {})));
    const out = [];
    for (const r of storedAll) { if (!r || S(r.site_id) !== S(plan.site_id) || !r.prompt_id) continue; const id = S(r.prompt_id);
      const was = { last_asked_run: S(r.last_asked_run), last_asked_at: S(r.last_asked_at), asked_n_28d: nn(r.asked_n_28d), refused_at_run: S(r.refused_at_run) };
      const now_ = { ...was };
      if (asked.has(id)) { now_.last_asked_run = S(plan.run_id); now_.last_asked_at = runAt; }
      if (refused.has(id)) now_.refused_at_run = S(plan.run_id);
      now_.asked_n_28d = (asked.has(id) ? 1 : 0) + weekly.filter(s => s.has(id)).length + pulse.filter(s => s.has(id)).length;
      if (now_.last_asked_run !== was.last_asked_run || now_.last_asked_at !== was.last_asked_at || now_.asked_n_28d !== was.asked_n_28d || now_.refused_at_run !== was.refused_at_run)
        out.push({ site_id: S(plan.site_id), prompt_id: id, ...now_ }); }
    return out; };

  // ---- 6. the report's sections and the callback's fields -------------------------------------------------------------------------------
  const FLAG = { ranks_not_cited: '<b style="color:#b45309">ranks top 3, not cited</b>', cited: 'cited', ranks: 'ranks, not cited', not_in_top10: 'not in the top 10', not_read: 'not read' };
  const reportHtml = (x, k) => { if (!x) return ''; const { h3, p_, table, esc, n } = k; let h = '';
    const F = x.fanout_gap; if (F && F.queries && F.queries.length) {
      h += h3('Do you rank for what AI searched?') + p_('The ' + F.top_n + ' most frequent of the ' + F.distinct_n + ' searches the assistants ran before answering, each checked on Google\'s top 10. A page that ranks for these is the page they read; "ranks top 3, not cited" means Google shows your page and the answer still cites someone else.' + (F.not_read_n ? ' ' + F.not_read_n + ' could not be read.' : ''), true)
        + table(['Search', 'Times', 'Engines', 'Your rank', 'Page that should rank', 'Who ranks', 'In answers'], F.queries.slice(0, 25).map(q => [esc(q.query), n(q.freq), esc(q.engines.join(', ')), q.our_rank ? '#' + q.our_rank + (q.our_url ? '<br><span style="font-size:11px">' + esc(pathOf(q.our_url)) + '</span>' : '') : (q.flag === 'not_read' ? 'not read' : 'not in top 10'),
          q.target_url ? esc(pathOf(q.target_url)) : '<span style="color:#94a3b8">no page yet</span>', esc((q.top_domains || []).slice(0, 3).join(', ')), FLAG[q.flag] || esc(q.flag)]));
      if ((F.ranks_not_cited || []).length) h += p_('Ranks in Google\'s top 3 but the answers that searched it did not cite you: ' + F.ranks_not_cited.slice(0, 6).map(esc).join('; ') + '. The page is found; make it the one worth citing (a direct answer near the top, dated facts, sources).', true); }
    const P = x.persona; if (P && (P.roles || []).length) {
      h += h3('Does the asker\'s role change the answer? (API answers)') + p_(esc(P.method) + '. Without a role: named in ' + (P.control.rate == null ? '-' : P.control.rate + '%') + ' of ' + n(P.control.n) + ' answers.', true)
        + table(['Buyer role', 'Named with the role', 'Change (95% range)', 'This run', 'Last 28 days'], P.roles.map(r => [esc(r.role), (r.rate == null ? '-' : r.rate + '%') + ' of ' + n(r.n), r.delta == null ? '-' : (r.delta > 0 ? '+' : '') + r.delta + ' pts' + (r.lo != null ? ' (' + r.lo + ' to ' + r.hi + ')' : ''), esc(r.verdict),
          esc(r.pooled.verdict) + ' (' + n(r.pooled.questions == null ? 0 : r.pooled.questions) + ' questions paired over ' + r.pooled.runs + ' run' + (r.pooled.runs === 1 ? '' : 's') + (r.pooled.p != null ? ', sign test p ' + r.pooled.p : '') + ')'])); }
    const D = x.demand; if (D && ((D.questions || []).length || D.market)) {
      h += h3('Demand behind your questions') + p_(esc(D.note), true);
      if ((D.questions || []).length) { const pq = new Map((x.prompts || []).map(q => [S(q.prompt_id), q.prompt]));
        h += table(['Question', 'Range a month', 'From'], D.questions.slice(0, 12).map(q => [esc(pq.get(S(q.prompt_id)) || q.prompt_id), q.lo == null ? '-' : (q.lo === q.hi ? n(q.lo) : n(q.lo) + ' to ' + n(q.hi)), esc(q.proxies.map(p => p.source.replace(/_/g, ' ') + ' ' + n(p.value) + ' (' + p.as_of + ')').join('; '))])); }
      const M = D.market; if (M) { h += p_('Market trend' + (D.market_carried ? ' (read ' + esc(M.as_of) + ', monthly)' : '') + ': ' + esc(M.note) + '.', true);
        if ((M.historical || []).length) h += table(['Month', 'Answers mentioning you', 'Their AI search volume'], M.historical.slice(-6).map(r => [esc(r.month), n(r.mentions), n(r.ai_search_volume)]));
        if ((M.new_lost || []).length) h += table(['Month', 'New mentions', 'Lost mentions'], M.new_lost.slice(-6).map(r => [esc(S(r.date).slice(0, 7)), n(r.new_mentions), n(r.lost_mentions)]));
        if ((M.top_brands || []).length) h += table(['Brands AI names most for "' + S(M.topic) + '"', 'Mentions', 'AI search volume'], M.top_brands.map(b => [esc(b.brand), n(b.mentions), n(b.ai_search_volume)]));
        if ((M.errors || []).length) h += p_('Not available: ' + esc(M.errors.join('; ')), true); } }
    const I = x.imports; if (I) { h += h3('Your uploaded AI reports') + p_(esc(I.note), true);
      if (I.copilot) h += p_('Copilot: ' + n(I.copilot.citations) + ' citations of ' + n(I.copilot.urls_n) + ' of your pages, ' + esc(I.copilot.label) + '. ' + esc(I.copilot.note) + '.', true);
      const g = I.sources.gsc_ai; if (g) h += p_('Google AI Mode / AI Overviews: ' + n(g.impressions) + ' impressions, ' + n(g.clicks) + ' clicks on ' + n(g.urls_n) + ' pages (your Search Console export).', true); }
    const N = x.notes || {}; const nl = [N.lost_note, N.unanalysed_note, N.market_fallback_n ? N.market_fallback_n + ' question(s) were asked in your own market because their market is past the limit of ' + AIP.MARKETS_MAX + ' markets a panel covers' : '', N.ceiling_note, N.fanout_note, N.resend_note, N.extras_note].filter(Boolean);
    if (nl.length) h += p_(nl.map(esc).join(' '), true);
    return h; };
  /** -> persona_effect_json (WAVE2 contract addition from W2-A): one entry per role, the 28-day pooled figures (this run included; a first run
   *  is this run alone): [{ role, with: { rate, n }, without: { rate, n }, delta, lo, hi, significant }], rates and the interval in points 0-100 */
  const personaEffectRows = (P) => (P && (P.roles || []).length ? P.roles.map(r => ({ role: r.role, with: { rate: r.pooled.rate, n: r.pooled.n }, without: { rate: r.pooled.control_rate, n: r.pooled.control_n },
    delta: r.pooled.delta, lo: r.pooled.lo, hi: r.pooled.hi, significant: !!r.pooled.significant })) : null);
  const callbackFields = (x) => (x ? { fanout_gap: x.fanout_gap || null, persona_effect: x.persona || null, demand: x.demand || null, imports: x.imports || null, exec_ids: x.exec_ids || '', run_notes: x.notes || null } : {});

  return { optionsOf, fanoutOf, normQuery, citedRow, fanoutTop, serpBody, fanoutRequests, targetPage, gscOf, fanoutGap, personaMessage, personaQuestions, personaRequests, llmText, twoProp, verdictOf, signP, pairedOf, bootMean, MINQ, personaEffect,
    platformOf, demandRequests, marketOf, mentionItems, demand, imports, extraKey, extrasRecorded, execIds, notes, promptState, reportHtml, callbackFields, personaEffectRows, diffCi, wilson, PERSONA_MODEL, US_NOTE, MIN };
})();
const metrics = $('AI Metrics').all().map(i => i.json);
// W2-E3 (2026-10-23): the owner's coverage options (AI Extras) and the free columns written with the row (AI Vis Rows), per site
const __w2x = (() => { const g = (n) => { try { return $(n).all().map(i => i.json).filter(r => r && r.site_id); } catch (e) { return []; } }; const X = g('AI Extras'), V = g('AI Vis Rows'); const pj = (t) => { try { return JSON.parse(t || 'null'); } catch (e) { return null; } };
  return (m) => { const x = X.find(r => r.site_id === m.site_id) || {}; const v = V.find(r => r.site_id === m.site_id) || {}; if (!x.site_id && !v.site_id) return null;
    return { fanout_gap: x.fanout_gap || null, persona: x.persona || null, demand: x.demand || pj(v.demand_json), imports: pj(v.imports_json), notes: x.notes || pj(v.notes_json), exec_ids: v.exec_ids || '', prompts: m.questions || [] }; }; })();
let briefs = []; try { briefs = $('AI Brief').all().map(i => (i.json && i.json.output && typeof i.json.output === 'object') ? i.json.output : null); } catch (e) { briefs = []; }
const SYM = { cited: '<b style="color:#15803d">✓ cited</b>', mentioned: '<span style="color:#15803d">✓ named</span>', absent: '<span style="color:#b91c1c">✗</span>', none: '<span style="color:#94a3b8">no AI answer</span>', error: '<span style="color:#94a3b8">error</span>', monthly: '<span style="color:#94a3b8">monthly</span>' };
const money = (v) => (Number(v) || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 });
const muted = (t) => '<br><span style="color:#64748b;font-size:11px">' + t + '</span>';
// ---- W2-E2 (2026-10-23, docs/ai-visibility-2026-10-23/fixes/W2-E2.md): the plain-language lines for the new measurement - every figure with its n ----
const w2pm = (v) => v == null ? '—' : (v > 0 ? '+' : '') + v;
const w2Sections = (m) => { let h = ''; const S = m.sov, SE = m.sentiment, IM = m.impact || [], AR = (m.alert_rules || []).filter(r => r.rule_id);
  if (S && S.by_entity) { h += h3('Share of voice among the businesses you follow');
    h += p_(esc(S.note) + ' Counted over ' + n(S.denominators.answers_naming_any_brand) + ' answers that named a business (of ' + n(S.denominators.all_answers) + ' answers; ' + n(S.mentions) + ' mentions).', true);
    h += table(['Business', 'Share of mentions (95% range)', 'Mentions'], [...S.by_entity.map(e => [esc(e.self ? e.name + ' (you)' : e.name), e.share == null ? '—' : e.share + '%' + (e.lo != null ? muted(e.lo + '–' + e.hi + '%') : ''), n(e.n)]),
      ['others' + (S.others_top && S.others_top.length ? muted(esc(S.others_top.map(o => o.id).join(', '))) : ''), S.others_share == null ? '—' : S.others_share + '%' + (S.others_lo != null ? muted(S.others_lo + '–' + S.others_hi + '%') : ''), n(S.others_n)]]);
    const nb = S.named_of_branded || {}, na = S.named_rate_all || {}, mp = S.mean_norm_position || {};
    h += p_('Named in ' + (na.rate == null ? '—' : na.rate + '%') + ' of all ' + n(na.n) + ' answers' + (na.lo != null ? ' (' + na.lo + '–' + na.hi + '%)' : '') + ', and in ' + (nb.rate == null ? '—' : nb.rate + '%') + ' of the ' + n(nb.n) + ' answers that named any business' + (nb.lo != null ? ' (' + nb.lo + '–' + nb.hi + '%)' : '') + '.'
      + (mp.value != null ? ' Place in the list when named: ' + mp.value + ' on a 0-1 scale (1 = named first, 0 = named last; ' + n(mp.n) + ' answers' + (mp.lo != null ? ', 95% range ' + mp.lo + '–' + mp.hi : '') + ').' : '')); }
  if (SE) { h += h3('How AI speaks of you, aspect by aspect' + (SE.validated ? '' : ' (early reading, not validated)'));   // R-E4
    if (SE.withheld) h += p_(esc(SE.note) + (SE.unread_note ? ' ' + esc(SE.unread_note) : ''), true);
    else { h += p_(esc(SE.note) + (SE.unread_note ? ' ' + esc(SE.unread_note) : ''));
      h += table(['Aspect', 'Positive', 'Neutral', 'Negative', 'Net (answers)'], (SE.by_aspect || []).map(a => [esc(a.aspect), n(a.pos), n(a.neu), n(a.neg), (a.net == null ? 'too few' : w2pm(a.net)) + muted(n(a.n) + ' answers')]), 'no aspect judged');
      // R-E4: phrases the reader picked out, quoted from answers we do not control - never a bold finding, and no action is drawn from them
      if ((SE.objections || []).length) h += p_('Phrases the reader picked out where an answer might make a buyer hesitate (' + esc(SE.objections_note || 'not a finding') + '): ' + SE.objections.map(o => '"' + esc(o.text) + '" (' + o.n + ')').join('; ') + '.', true);
      if ((SE.by_rival || []).filter(r => r.net != null).length) h += p_('How the same answers speak of your competitors: ' + SE.by_rival.filter(r => r.net != null).map(r => esc(r.id) + ' ' + w2pm(r.net) + ' (' + r.n + ' answers)').join(', ') + '.', true); }
    // R-E9: the reader's money is bounded by its call cap: the modelled price a call, and the worst case (every call at its full answer, retried once)
    const FX = AIP.FIXED; const capUsd = (FX.sentiment_calls_max * FX.sentiment_call_ai).toFixed(2), worstUsd = (FX.sentiment_calls_max * FX.sentiment_tries * FX.sentiment_call_worst).toFixed(2);
    h += p_('Method: ' + esc(SE.method) + '. ' + esc((SE.kappa || {}).note || '') + (SE.model_vs_rules ? ' This run the model and the rule reader agreed on ' + SE.model_vs_rules.agreement + '% of ' + SE.model_vs_rules.n + ' answers.' : '')
      + ' Cost: at most ' + FX.sentiment_calls_max + ' calls a run, about $' + FX.sentiment_call_ai.toFixed(2) + ' a call (about $' + capUsd + ' at the cap; never more than $' + worstUsd + ', every call at its longest answer and retried once).', true); }
  if (IM.length) { h += h3('Did your actions work?');
    h += p_('Each action is compared with similar questions it did not target, 28 days before and after (difference in differences). "Likely helped" means its questions rose more than the others beyond the 95% range; it is a correlation, never proof of cause.', true);
    h += table(['Action', 'Its questions: before → after', 'Others: before → after', 'Difference (95% range)', 'Verdict'], IM.map(a => [esc(a.label || a.action_id) + muted(esc(a.kind) + ' · ' + String(a.at).slice(0, 10) + ' · ' + a.days_after + ' days after'),
      (a.before.rate == null ? '—' : a.before.rate + '%') + ' → ' + (a.after.rate == null ? '—' : a.after.rate + '%') + muted(a.target_questions.length + ' question(s), ' + n(a.before.n) + ' / ' + n(a.after.n) + ' answers'),
      (a.control_before.rate == null ? '—' : a.control_before.rate + '%') + ' → ' + (a.control_after.rate == null ? '—' : a.control_after.rate + '%') + muted(a.control_questions.length + ' question(s), ' + n(a.control_before.n) + ' / ' + n(a.control_after.n) + ' answers'),
      a.did.effect == null ? '—' : w2pm(a.did.effect) + ' pts' + (a.did.lo != null ? muted(a.did.lo + ' to ' + a.did.hi) : ''), '<b>' + esc(a.verdict) + '</b>' + muted(esc(a.why))])); }
  if (AR.length) { h += h3('Your alert rules');
    h += table(['Rule', 'Metric', 'Change', 'Result'], AR.map(r => [esc(r.rule_id), esc(r.metric.replace(/_/g, ' ')) + (Object.keys(r.scope || {}).length ? muted(esc(Object.entries(r.scope).map(([a, b]) => a + ': ' + b).join(', '))) : ''), r.delta == null ? '—' : w2pm(r.delta) + ' pts', (r.fired ? '<b>fired</b> · ' : '') + esc(r.reason)])); }
  return h; };
return metrics.map((m, i) => {
  const b = briefs[i] || null; const M = m.metrics; const d = M.delta || {}; const T = m.traffic; const A = m.access; const X = m.index; const P = m.perception;
  const engs = Object.keys(m.engines);
  let html = '<div style="font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a;max-width:900px">';
  html += '<h2 style="margin:0 0 2px;font-size:20px">AI search visibility: ' + esc(m.domain) + '</h2>' + p_(esc(m.checked_at.slice(0, 10)) + ' · ' + (M.headline ? esc(M.headline.text) : m.questions.length + ' buyer questions × ' + engs.length + ' AI engines · ' + n(M.samples) + ' answers counted' + (M.pulse_samples ? ' (' + n(M.pulse_samples) + ' from the daily pulse)' : '')) + (m.on_demand ? ' · on-demand run' : '') + (m.previous ? (M.delta_not_compared ? ' · ' + esc(String(M.delta_not_compared).replace(/\.$/, '')) : ' · compared with ' + esc(String(m.previous.checked_at).slice(0, 10))) : ' · first run (baseline)'), true);
  // D19: every figure counts answered requests only, so the failures are named here instead of being invisible
  if (M.errors) html += p_(M.errors + ' of ' + n(M.requests || M.asked_all) + ' requests failed this run (' + M.error_rate + '%)'
    + (M.retried ? ', ' + M.retry_answered + ' of ' + M.retried + ' answered when they were sent again' : '') + ': '
    + esc((M.errors_list || []).map(e => e.engine + ' — ' + e.message + (e.count > 1 ? ' (x' + e.count + ')' : '')).join('; '))
    + '. ' + (M.headline ? n(M.headline.came_back) + ' of ' + n(M.headline.requests) + ' came back; the rates below count ' + esc(M.headline.text) + '.' : 'The rates below count the ' + n(M.answered) + ' answers that came back.'), true);
  // R85: a lookup that failed is said where the volumes are read, never left as "—" with no reason
  if (M.volume_lookup && M.volume_lookup.note) html += p_(esc(M.volume_lookup.note), true);
  html += briefBox(b) + alertBox(m.alerts);
  // B8-9: the alerts that rest on a test were judged together - say across how many, and at what threshold
  if (M.multiple_tests && M.multiple_tests.tests) html += p_(esc(M.multiple_tests.note), true);
  const sig = d.significant === true ? ' <b>real change</b>' : d.significant === false ? ' (within noise)' : '';
  // B8-1 (2026-10-15, benchmark area 8, INVARIANTS rule 1): three of the four headline tiles printed a bare arrow beside a tested
  // one, in the same type and the same row. Every arrow now carries the verdict of its own test, and every rate its own 95% range.
  const T_ = M.tests || {};
  const verdict = (t) => !t ? ' (not tested)' : t.significant === true ? ' <b>real change</b>' : t.significant === false ? ' (within noise)' : ' (not tested)';
  const band = M.score_band || {};
  // B-L4 (2026-10-15, INVARIANTS rule 1): the panel or the run kind moved, so there is no change to print — say that in the
  // place the arrow would have been. An empty box reads as "no change", which is the opposite of what happened.
  const nc = '<span style="color:#b45309">not compared</span>';
  const chg = (key, first) => !m.previous ? first : M.delta_not_compared ? nc
    : (T_[key] && T_[key].delta != null) ? dpts(T_[key].delta) + verdict(T_[key])
    : (d[key] != null ? dpts(d[key]) + ' (not tested)' : nc);
  // AI-FOCUS (2026-10-27): what changed in the questions this run and why, and what the owner is asked to decide about them
  { const F = m.focus || {}; if (F.summary) html += p_('<b>Your questions.</b> ' + esc(F.summary), true);
    if ((F.not_measured || []).length) html += p_('Not measured yet: ' + esc(F.not_measured.map(x => '"' + x.label + '"').join(', ')) + '. Your panel holds ' + n(m.prompts_max) + ' questions; ' + n(F.raise_to) + ' would cover ' + (F.not_measured.length === 1 ? 'it' : 'them') + ' too (you choose this in the AI visibility settings).');
    if ((F.owner_off_focus || []).length) html += p_(n(F.owner_off_focus.length) + ' of your own question' + (F.owner_off_focus.length === 1 ? ' is' : 's are') + ' about something none of your keywords, pages or services cover. They are kept as you set them; switch them off in the app if you no longer need them.'); }
  if (M.delta_not_compared) html += p_('<b>These figures are not compared with the last check.</b> ' + esc(String(M.delta_not_compared).replace(/^Not compared with [0-9-]+: /, '')) + ' The figures below are this run\'s own measurement.', true);
  const cci = M.citation_ci || [0, 0], sci = M.sov_ci || [0, 0];
  // F1b (2026-10-23, E7): "Named in" counts the answers that NAME you in their text; an answer that only links a page is in "Your pages cited"
  html += '<table style="border-collapse:collapse;margin:8px 0"><tr>' + tile('Named in', M.mention_rate + '%', '95% range ' + M.mention_ci[0] + '–' + M.mention_ci[1] + '% of ' + n(M.samples) + ' answers (named in the text)' + (m.previous ? '<br>' + (M.delta_not_compared ? nc : dpts(d.mention_rate) + sig) : '')) +
    tile('Visibility score', M.visibility_score + '/100', (band.half != null ? '95% band ±' + band.half + ' pts' : 'position and demand weighted') + (m.previous ? '<br>' + chg('visibility_score', '') : '')) +
    tile('Your pages cited', M.citation_rate + '%', '95% range ' + cci[0] + '–' + cci[1] + '%' + (m.previous ? '<br>' + chg('citation_rate', '') : '<br>' + M.cited + ' answers')) +
    tile('Share of voice', M.share_of_voice + '%', '95% range ' + sci[0] + '–' + sci[1] + '% · ' + n(M.sov_denominator) + ' mentions in ' + n(M.sov_answers != null ? M.sov_answers : M.samples) + ' answers' + (m.previous ? '<br>' + chg('share_of_voice', '') : '<br>vs every competitor named')) +
    (T && T.connected ? tile('AI visits (28 days)', n(T.sessions), (T.change_pct != null ? (T.change_pct >= 0 ? '▲ ' : '▼ ') + Math.abs(T.change_pct) + '% · ' : '') + n(T.key_events) + ' key events' + (T.revenue ? ' · ' + money(T.revenue) + ' revenue' : '')) : '') +
    (M.sentiment_score != null ? tile('Sentiment', (M.sentiment_score > 0 ? '+' : '') + M.sentiment_score, P.positive + ' positive · ' + P.negative + ' negative', M.sentiment_score < 0 ? '#b91c1c' : '#15803d') : '') + '</tr><tr>' +
    // F1b: the place in the answers - the mean place when named, how often you are named first, and the position-weighted visibility - each
    // with the answers it rests on; under 12 placed answers the mean place is "too few answers", never a figure
    tile('Avg. position', M.avg_position != null ? '#' + M.avg_position : M.position_answers ? 'too few' : '—', 'when named · ' + n(M.position_answers || 0) + ' placed answer' + (M.position_answers === 1 ? '' : 's') + (m.previous && M.tests && M.tests.avg_position && M.tests.avg_position.delta != null && !M.delta_not_compared ? '<br>' + (M.tests.avg_position.delta > 0 ? '+' : '') + M.tests.avg_position.delta + verdict(M.tests.avg_position) : '')) +
    tile('Named first', M.first_rate != null ? M.first_rate + '%' : 'too few', 'of ' + n(M.samples) + ' answers name you first') +
    tile('Position-weighted', M.pos_visibility != null ? M.pos_visibility + '/100' : 'too few', '1st = 100, 2nd = 80, 3rd = 65, not named = 0') + tile('AI Overview', M.aio_presence + '%', 'of searches show one' + (M.aio_basis ? ' (' + M.aio_basis.shown + ' of the ' + M.aio_basis.read + ' read' + (M.aio_basis.failed ? '; ' + M.aio_basis.failed + ' failed, left out' : '') + ')' : '') + '; you cited in ' + M.aio_citation_rate + '%') +
    // B8-10: a count with its denominator and its 95% range, in the neutral colour - no green / red verdict from one answer per assistant
    (M.brand && M.brand.answered ? tile('Brand recognised', M.brand.known + ' of ' + M.brand.answered, 'assistants asked directly named you' + (M.brand.ci ? '<br>95% range ' + M.brand.ci[0] + '–' + M.brand.ci[1] + '%' : '') + (M.brand.carried ? '<br>checked ' + String(M.brand.checked_at).slice(0, 10) + ' (monthly)' : '')) : '') +
    // E21 (F1b): the database share is yours among you and the tracked rivals (at most 8), not a share of the whole market
    (X && X.sov != null ? tile('Share among tracked rivals', X.sov + '%', 'AI-answer database, you and ' + Math.max(0, (X.brands || []).filter(b => b.domain && !b.you).length) + ' tracked rival' + ((X.brands || []).filter(b => b.domain && !b.you).length === 1 ? '' : 's') + ' · ' + n(X.answers_citing_you) + ' answers cite you' + (X.carried ? ' (monthly)' : '')) : '') +
    (A ? tile('AI crawlers', A.answer_bots_ok + ' of ' + A.answer_bots, A.ok ? 'answer bots can read the site' : 'blocked: see below', A.ok ? '#15803d' : '#b91c1c') : '') + '</tr></table>';
  // B8-1 / B8-3 / B8-5: what the figures above were measured on, in the place they are read. A sample too small for a rate, the
  // pulse mornings pooled into the week (and the ones that did not reach every engine), and the requests the run never sent.
  const basisLines = [];
  if (!M.enough_samples && M.sample_note) basisLines.push('<b>Too few answers to draw a rate from.</b> ' + esc(M.sample_note) + ' The figures above are what came back, with their ranges; nothing above is called a change.');
  if (M.score_band && M.score_band.basis === 'modelled') basisLines.push('The visibility score is <b>modelled</b>, not counted: ' + esc(M.score_band.why) + ', so it carries a 95% band of ±' + M.score_band.half + ' points and a move inside that band is not reported as a change.');
  if (M.pulse_basis && M.pulse_basis.note) basisLines.push(esc(M.pulse_basis.note));
  if (M.capped && M.capped.note) basisLines.push('<b>Not everything was asked.</b> ' + esc(M.capped.note));
  // W2-E2: how the ranges are drawn (the question is the sampling unit), with the plain range it replaces
  if (m.ci && m.ci.headline && m.ci.headline.named_rate && m.ci.headline.named_rate.lo != null) { const c0 = m.ci.headline.named_rate; basisLines.push('Ranges count the question, not the answer, as the unit: ' + n(c0.n_answers) + ' answers to ' + n(c0.n_questions) + ' questions are worth about ' + n(Math.round(c0.n_eff)) + ' independent answers (design effect ' + c0.deff + '), so "Named in" is ' + c0.lo + '–' + c0.hi + '%' + (c0.wilson_naive ? ' (counting every answer as independent would have said ' + c0.wilson_naive[0] + '–' + c0.wilson_naive[1] + '%)' : '') + '.'); }
  if (basisLines.length) html += '<p style="margin:6px 0 10px;font-size:12px;color:#475569;background:#f8fafc;border-left:3px solid #cbd5e1;padding:6px 10px">' + basisLines.join('<br>') + '</p>';
  // R83: the brief is Claude's wording of the computed actions, and it is read through the same rule — an action that pitches a
  // business AI recommends instead of you is dropped, whoever wrote it (exec 623's brief: "Pitch a guest article … to wafeq.com").
  const rivalDoms = [...(m.rival_sources || []).map(r => r.domain), ...(m.competitors || []).map(c => c.domain)].filter(d => /\./.test(String(d || ''))).map(d => String(d).toLowerCase());
  const pitchesRival = (a) => { const t = (String(a.action || '') + ' ' + String(a.why || '')).toLowerCase(); return /\b(pitch|featured|guest (article|post)|outreach|comparison mention|get listed|a quote there)\b/.test(t) && rivalDoms.some(d => t.includes(d)); };
  const briefActs = (b && Array.isArray(b.actions)) ? b.actions.map(a => ({ action: a.action, why: a.why })).filter(a => !pitchesRival(a)) : [];
  const acts = briefActs.length ? briefActs : m.actions.filter(a => !pitchesRival(a));
  html += h3('Do this next') + (acts.length ? '<ol style="margin:4px 0 4px 18px;padding:0;font-size:13px">' + acts.map(a => '<li style="margin:3px 0"><b>' + esc(a.action) + '</b> — ' + esc(a.why) + '</li>').join('') + '</ol>' : p_('Nothing urgent.', true));
  const gapActs = m.actions.filter(a => a.api_body);
  if (gapActs.length) html += p_('Write the missing pages with one call each (or use the form: <a href="' + esc(m.form_url) + '">' + esc(m.form_url) + '</a>):', true) + gapActs.map(a => '<pre style="background:#f1f5f9;padding:6px;font-size:11px;white-space:pre-wrap">POST ' + esc(m.api_url) + '\n' + esc(JSON.stringify(a.api_body)) + '</pre>').join('');
  // what AI visits are worth
  html += h3('What AI visits are worth (GA4, last 28 days)');
  if (T && T.connected) { html += p_(n(T.sessions) + ' visits from AI assistants (' + T.share_of_sessions + '% of all visits' + (T.change_pct != null ? '; ' + (T.change_pct >= 0 ? '+' : '') + T.change_pct + '% vs the 28 days before' : '') + '), ' + n(T.key_events) + ' key events' + (T.revenue ? ', ' + money(T.revenue) + ' revenue' : '') + '. AI visitors convert at ' + T.conv_rate + '% vs ' + T.organic_conv_rate + '% for organic search. Google AI Overviews / AI Mode visits are counted as organic search in GA4.') +
      table(['Assistant', 'Visits', 'Before', 'Engaged', 'Key events', 'Revenue'], (T.assistants || []).map(a => [esc(a.name), n(a.sessions), n(a.prev_sessions), n(a.engaged), n(a.key_events), money(a.revenue)]), 'no AI visits recorded') +
      table(['Landing page from AI', 'Visits', 'Key events', 'Revenue'], (T.landing || []).slice(0, 10).map(l => [esc(l.page) + (l.cited_by_ai ? muted('cited in AI answers') : ''), n(l.sessions), n(l.key_events), money(l.revenue)]), 'none'); }
  else html += p_(esc((T && T.error) || 'GA4 is not connected.') + ' Connect GA4 to see the visits, key events and revenue AI assistants bring.', true);
  html += w2Sections(m);   // W2-E2
  // perception
  html += h3('How AI describes you');
  if (P.analysed) html += p_(P.positive + ' positive, ' + P.neutral + ' neutral and ' + P.negative + ' negative answers naming you' + (P.descriptors.length ? '. Words AI uses: ' + esc(P.descriptors.join(', ')) : '') + '.') + (P.negatives.length ? table(['Negative answer', 'Engine'], P.negatives.map(x => [esc(x.prompt) + muted(esc(x.excerpt)), esc(x.engine)])) : '');
  else html += p_('No answer named you this week, so there is nothing to read yet.', true);
  if (P.issues.length) html += '<p style="margin:6px 0 2px;font-size:13px;color:#b91c1c"><b>What AI gets wrong</b></p>' + table(['Claim → the fact on file', 'Engines', 'Asked'], P.issues.map(x => [esc(x.text) + (x.new ? ' <b style="color:#b91c1c">new</b>' : ''), esc(x.engines.join(', ')), esc(x.questions.join(' · '))]));
  else if (P.fact_check && P.fact_check !== 'checked') html += '<p style="margin:6px 0 2px;font-size:13px"><b>What AI gets wrong</b>: not checked</p>' + p_(esc(P.fact_check_note), true);   // G10: "not checked" is not "nothing wrong"
  else if (P.fact_check === 'checked') html += '<p style="margin:6px 0 2px;font-size:13px"><b>What AI gets wrong</b>: nothing that contradicts your business facts.</p>';
  // crawler access
  if (A) { html += h3('Can AI read your site?') + p_('robots.txt ' + (A.robots.found ? 'found' : 'missing (' + A.robots.status + ')') + ' · llms.txt ' + (A.llms_txt.found ? 'found' : 'missing') + (A.training_blocked.length ? ' · training crawlers blocked: ' + esc(A.training_blocked.join(', ')) + ' (your choice; it does not remove you from AI answers)' : '') + '.', true) +
      table(['Crawler', 'Used for', 'robots.txt', 'Homepage test'], A.bots.filter(x => x.group === 'answer').map(x => { const t = (A.fetch.tests || []).find(t2 => t2.bot === x.bot); return [esc(x.bot), esc(x.owner), x.allowed_root ? (x.blocked_paths.length ? '<span style="color:#b45309">partly blocked</span>' : '<span style="color:#15803d">allowed</span>') : '<b style="color:#b91c1c">blocked</b> ' + esc(x.rule), t ? (t.blocked ? '<b style="color:#b91c1c">' + (t.challenge ? 'challenge' : t.status || 'no answer') + '</b>' : String(t.status)) : '—']; }) ) +
      (A.issues.length ? '<ul style="margin:4px 0 4px 18px;padding:0;font-size:13px">' + A.issues.map(x => '<li><b>' + esc(x.text) + '</b> ' + esc(x.fix) + '</li>').join('') + '</ul>' : ''); }
  // stages and topics
  const st = m.clusters.stages || [], cl = m.clusters.clusters || [];
  if (st.length) html += h3('By buyer stage') + table(['Stage', 'Questions', 'Named in', 'AI searches / month', 'Named most instead'], st.map(s => [esc(s.key), n(s.questions), s.mention_rate + '%', s.volume ? n(s.volume) : '—', esc(s.leader || '—')]));
  if (cl.length > 1 && !((m.segments || {}).rows || []).length) html += h3('By topic') + table(['Topic', 'Questions', 'Named in', 'AI searches / month', 'Named most instead'], cl.map(s => [esc(s.key), n(s.questions), s.mention_rate + '%', s.volume ? n(s.volume) : '—', esc(s.leader || '—')]));
  // ---- G6 (2026-10-18): the panel at scale — rates per topic, buyer role and market with ranges, what moved (Benjamini-Hochberg), and how
  // precise this panel is. A segment under the answer floor says "too few answers" instead of a percentage.
  const SG = m.segments || null; const PN = m.panel || null;
  // W2-E2: a segment's level is its last 28 days (its window said once below the tables); its change is this run against the last one
  const segRow = (s) => [esc(s.key), n(s.questions), s.w28 && s.w28.n ? (s.w28.enough ? s.w28.rate + '%' + muted(s.w28.lo + '–' + s.w28.hi + '% · ' + n(s.w28.n) + ' answers, ' + n(s.w28.questions) + ' questions, 28 days') : '<span style="color:#b45309">too few answers</span>' + muted(n(s.w28.n) + ' in 28 days, ' + (SG ? SG.min_answers : 12) + ' needed')) : s.enough ? s.rate + '%' + muted(s.ci[0] + '–' + s.ci[1] + '% · ' + n(s.n) + ' answers') : '<span style="color:#b45309">too few answers</span>' + muted(n(s.n) + ' of ' + (SG ? SG.min_answers : 12) + ' needed'),
    s.sov == null ? '—' : s.sov + '%', esc(s.leader || '—'), s.change ? (s.change.significant ? '<b>' + (s.change.delta > 0 ? '+' : '') + s.change.delta + ' pts</b>' + muted('real move') : s.change.delta == null ? muted(esc(s.change.why)) : (s.change.delta > 0 ? '+' : '') + s.change.delta + ' pts' + muted('within noise')) : '—'];
  const segHead = ['', 'Questions', 'Named in (95% range)', 'Share of voice', 'Named most instead', 'Change'];
  if (SG && SG.rows.length) {
    const dims = [['cluster', 'By topic cluster'], ['persona', 'By buyer role'], ['market', 'By market'], ['engine', 'By engine and topic']];
    for (const [dim, title] of dims) { const rows = SG.rows.filter(s => s.dim === (dim === 'engine' ? 'engine x cluster' : dim)); if (rows.length > 1 || (dim !== 'engine' && rows.length === 1 && dim === 'cluster'))
      html += h3(title) + table([title.replace(/^By /, '').replace(/^./, c => c.toUpperCase()), ...segHead.slice(1)], rows.slice(0, dim === 'engine' ? 24 : 20).map(segRow)); }
    if (m.window_28d && m.window_28d.note) html += p_(esc(m.window_28d.note), true);   // W2-E2
    const mv = SG.moves || [];
    html += h3('What moved, by segment') + (mv.length ? table(['Segment', 'Named in now', 'Change', 'Answers'], mv.map(x => [esc(x.dim + ': ' + x.key), x.rate + '%', (x.delta > 0 ? '+' : '') + x.delta + ' pts', n(x.n)])) : p_('No segment moved beyond noise this week.')) + p_(esc(SG.family.note));
    if (SG.too_few) html += p_(SG.too_few + ' segment(s) have too few answers for a rate this week (fewer than ' + SG.min_answers + '); they are shown as "too few answers", never as 0%.');
  }
  if (PN && PN.half_width) { const hw = PN.half_width; html += h3('How precise this is') + p_((hw.measured.headline != null ? 'This week\'s "named in" rate is measured to ±' + hw.measured.headline + ' points (95%, ' + n(hw.measured.headline_answers) + ' answers)' : 'No headline rate this week')
    + (hw.measured.median_cluster != null ? '; a typical topic cluster to ±' + hw.measured.median_cluster + ' points (' + n(hw.measured.median_cluster_answers) + ' answers).' : '.')
    + ' With ' + n(PN.setting || PN.size) + ' questions' + (PN.pulse_per_week ? ' and each one asked on ' + PN.pulse_per_week + ' pulse morning' + (PN.pulse_per_week === 1 ? '' : 's') + ' a week' : '') + ' the panel can reach ±' + hw.achievable.headline + ' points on the headline and ±' + hw.achievable.cluster + ' on a 12-question cluster (' + esc(hw.achievable.note) + ').'
    + (PN.overlap_with_previous && PN.overlap_with_previous.share != null ? ' ' + Math.round(100 * PN.overlap_with_previous.share) + '% of the questions were also asked last time' + (PN.overlap_with_previous.same ? '.' : ' — too few for a week-on-week change, so none is shown.') : '')); }
  if (m.run_split && m.run_split.note) html += p_(esc(m.run_split.note));
  // G6: at 500 questions the answer grid would be 500 rows long: the report shows the 60 that matter most (the gaps first, then by demand); the app shows them all
  const QMAX = 60; const qShown = m.questions.length > QMAX ? m.questions.slice().sort((a, b) => ((b.decided && !b.won ? 1 : 0) - (a.decided && !a.won ? 1 : 0)) || ((Number(b.volume) || 0) - (Number(a.volume) || 0))).slice(0, QMAX) : m.questions;
  html += h3('Answer by answer') + (m.questions.length > QMAX ? p_('The ' + QMAX + ' questions that matter most of the ' + n(m.questions.length) + ' asked (the questions you lose first, then the most searched); every question is in the app.') : '') + table(['Question', 'Week', ...engs.map(e => m.engines[e].name)], qShown.map(q => [esc(q.prompt) + muted(esc(q.kind) + (q.stage ? ' · ' + esc(q.stage) : '') + (q.volume ? ' · ' + n(q.volume) + ' AI searches/mo' : '') + (q.competitors.length && !q.won ? ' · named instead: ' + esc(q.competitors.slice(0, 3).join(', ')) : '')), (q.win && q.win.enough ? q.win.rate + '%' + muted(q.win.ci[0] + '–' + q.win.ci[1] + '% · ' + q.samples + ' answers') : q.samples ? '<span style="color:#b45309">too few</span>' + muted(esc((q.win && q.win.why) || (q.samples + ' answers'))) : '—'), ...engs.map(e => SYM[q.engines[e]] || '—')]), 'no answers this week');
  // B8-4: the questions nobody has enough answers about. They are NOT in the gap list above, do not pick an action and do not carry
  // an API body — a question asked once and lost once is not a question the business loses.
  if ((m.undecided || []).length) html += '<p style="margin:6px 0 2px;font-size:13px"><b>Not enough answers to tell yet</b> (left out of the gaps and the actions)</p>'
    + table(['Question', 'Answers so far', 'AI searches / month', 'Named instead'], m.undecided.map(u => [esc(u.prompt), n(u.samples) + muted(esc(u.why)), u.volume ? n(u.volume) : '—', esc((u.competitors || []).slice(0, 3).join(', ') || '—')]));
  html += h3('By engine') + table(['Engine', 'Answers', 'Named you', '95% range', 'Cited your pages', 'Failed'], engs.map(e => { const x = m.engines[e]; const outH = M.headline && (M.headline.monthly_left_out || []).some(o => o.engine === x.name); return [esc(x.name) + (x.carried ? muted('monthly · last asked ' + esc(String(x.checked_at || '').slice(0, 10))) : x.pulse_samples ? muted(x.pulse_samples + ' from the daily pulse') : '') + (outH ? muted('asked monthly: not in the headline') : ''), n(x.samples != null ? x.samples : x.answered), x.mentioned + ' (' + x.mention_rate + '%)', x.ci ? x.ci[0] + '–' + x.ci[1] + '%' : '—', x.cited + ' (' + x.citation_rate + '%)', n(x.errors)]; }));
  // B8-8: an engine that cites the site less than last time is judged on its own answers - or says it has too few to tell
  const ecFell = Object.values(M.engine_changes || {}).filter(c => c && c.fell);
  if (ecFell.length) html += p_('<b>Citations by engine against the last check:</b> ' + ecFell.map(c => esc(c.name) + ' cited your pages in ' + c.k + ' of ' + c.samples + ' answers, ' + c.k_before + ' of ' + c.samples_before + ' last time — ' + esc(c.why)).join('; ') + '.', true);
  // F1b: the competitor table - each business's named rate, mean place, share of voice and cited rate over the same answers as yours, and the
  // change since the last comparable run (none when the runs are not comparable; the share's change carries its test)
  const pctOr = (v) => v == null ? '—' : v + '%';
  const cChg = (c) => !c.delta ? (m.previous ? (M.delta_not_compared ? nc : '—') : '—') : [c.delta.named_rate != null ? 'named ' + dpts(c.delta.named_rate) : '', c.delta.sov != null ? 'share ' + dpts(c.delta.sov) + (c.delta.sov_significant === true ? ' <b>real change</b>' : c.delta.sov_significant === false ? ' (within noise)' : ' (not tested)') : ''].filter(Boolean).join('<br>');
  html += h3('Who AI recommends instead') + table(['Business', 'Answers naming it', 'Named in', 'Avg. position', 'Share of voice', 'Cited', 'Change', ''], [['<b>' + esc(m.domain) + ' (you)</b>', n(M.mentioned), M.mention_rate + '%', M.avg_position != null ? '#' + M.avg_position : '—', M.share_of_voice + '%', M.citation_rate + '%', m.previous ? (M.delta_not_compared ? nc : dpts(d.mention_rate) + sig) : '—', ''],
    ...m.competitors.map(c => [esc(c.domain), n(c.mentions), pctOr(c.named_rate), c.avg_position != null ? '#' + c.avg_position : '—', c.share + '%', pctOr(c.cited_rate), cChg(c), c.auto ? (c.named_only ? 'named (no website shown)' : 'detected') : 'your competitor'])], 'no other businesses named')
    + p_('Share of voice = mentions of a business out of the mentions of you and every competitor named, in the same ' + n(M.sov_answers != null ? M.sov_answers : M.samples) + ' answers; its range is taken over answers, so an answer naming four businesses counts once.', true);
  // B-G1 (2026-10-15, INVARIANTS rule 1 + 2): a stored keyword the read-path fit gate set aside was NOT asked of any engine and is in no
  // rate above — so the panel says why it is shorter, instead of a number nobody can account for.
  if ((m.set_aside || []).length) html += '<p style="margin:4px 0 8px;font-size:12px;color:#b45309"><b>Not asked</b> (set aside by the keyword rule): '
    + m.set_aside.map(x => esc(x.note || (x.keyword + ' — ' + x.detail))).join(' | ') + '</p>';
  if (X) { html += h3('AI-answer database: you and your tracked rivals' + (X.carried ? ' (from ' + esc(X.checked_at) + ')' : '')) + p_('Beyond your tracked questions: how often answers across the AI-answer database (387M+ real questions; Google AI Overviews' + ((X.platforms || []).includes('chat_gpt') ? ' and ChatGPT' : '') + ') cite each business\'s website, weighted by AI search volume.' + (X.answers_citing_you ? ' ' + n(X.answers_citing_you) + ' answers cite you.' : ''), true) +
      table(['Business', 'Answers citing it', 'Share', 'AI search volume'], (X.brands || []).map(bb => [(bb.you ? '<b>' : '') + esc(bb.domain || ('"' + bb.name + '" by name'))
        + (bb.you ? ' (you)</b>' : bb.name_only ? muted('matched by name only — not matched to your website, so it carries no share') : ''), n(bb.mentions), bb.share != null ? bb.share + '%' : '—', n(bb.ai_search_volume)]), 'no data') +
      // R14 (2026-10-13): the table used to open with "Tech&" by name (you) — 19,579 answers — under the headline "0 AI answers cite you"
      ((X.name_rows_dropped || []).length ? p_('Left out of this table: ' + X.name_rows_dropped.map(x => '"' + esc(x.name) + '" (' + n(x.mentions) + ' answers) — ' + esc(x.why)).join('; ') + '.', true) : '') +
      ((X.questions || []).length ? table(['Real questions where AI cites you', 'AI searches / month', 'Where'], X.questions.slice(0, 10).map(q => [esc(q.question), n(q.volume), esc(q.platform)])) : '') + ((X.errors || []).length ? p_('Not available: ' + esc(X.errors.join('; ')), true) : ''); }
  if ((m.fanout || []).length) html += h3('What AI searched before answering') + p_('The searches the assistants ran to write their answers. A page that ranks for these is the page they read and cite.', true) + table(['Search', 'Times', 'Engines', 'For the question'], m.fanout.slice(0, 10).map(f => [esc(f.query), n(f.count), esc(f.engines.join(', ')), esc(f.questions[0] || '')]));
  if ((m.suggestions || []).length) html += h3('Questions worth tracking') + p_('Real questions people ask AI about your topics (AI-answer database) that your panel does not track yet; add them in the app or with Site Admin <code>ai_prompts</code>.', true) + table(['Question', 'AI searches / month', 'You cited'], m.suggestions.slice(0, 8).map(s => [esc(s.question), n(s.volume), s.you_cited ? 'yes' : 'no']));
  html += h3('Sources AI relies on (where to get featured)') + table(['Source', 'Citations', 'Engines', 'Topics', 'Kind'], m.sources.map(s => [esc(s.domain), n(s.citations), esc(s.engines.join(', ')), esc(s.topics.join(', ')), esc({ official: 'official', platform: 'platform', media: 'news / media', directory: 'directory / reviews', authority: 'consultancy / research', engine: 'search engine (not a place to get featured)', site: 'site (PR target)' }[s.kind] || s.kind)]), 'no sources cited') + p_('These also appear in your link-prospect list (type ai_source); the Backlink Monitor drafts outreach for them.', true)
    // R83: cited by AI, but businesses AI recommends instead of you — named, never pitched
    + ((m.rival_sources || []).length ? p_('Also cited, but these are businesses AI recommends instead of you' + (m.rival_sources.some(r => r.kind === 'vendor') ? ' or that sell what you sell (marked *)' : '') + ', so they are not places to get featured and are not in your prospect list: ' + m.rival_sources.map(r => esc(r.domain) + (r.kind === 'vendor' ? '*' : '') + ' (' + n(r.citations) + ')').join(', ') + '.', true) + (m.rival_sources.some(r => r.kind === 'vendor') ? p_('* ' + m.rival_sources.filter(r => r.kind === 'vendor').map(r => esc(r.domain) + ': ' + esc(r.why || '')).join('; '), true) : '') : '');
  // RV-1 (2026-10-21): a cited address that no longer answers is marked as such, with the redirect it needs, never listed as a page to build on
  const goneTo = new Map((m.gone_cited || []).map(r => [String(r.from_url), r]));
  html += h3('Your pages AI cites') + table(['Page', 'Citations', 'Engines'], m.our_pages.map(x => [link(x.url) + (x.gone ? muted('no longer answers (HTTP ' + (x.http_status || 404) + '): redirect it to ' + esc(((goneTo.get(String(x.url)) || {}).to) || 'the closest live page')) : ''), n(x.citations), esc((x.engines || []).map(e => (m.engines[e] || {}).name || e).join(', '))]), 'none yet');
  html += AAD.reportHtml(m.answer_data, { h3, p_, table, esc, n, link });   // W2-E1 (2026-10-23): pages AI reads but does not cite, where AI gets its answers, shopping / ads / local cards (each only when there is something)
  if (m.market) html += h3('Market view: who AI cites for "' + m.market.keyword + '"' + (m.market.carried ? ' (from ' + m.market.checked_at + ')' : '')) + (m.market.error ? p_('Not available: ' + esc(m.market.error), true) : p_((m.market.total_mentions ? n(m.market.total_mentions) + ' AI answers in the DataForSEO index (Google AI Overview) mention this topic. ' : '') + (m.market.you ? 'You are #' + m.market.you + ' of the cited domains.' : 'Your domain is not among the cited domains yet.')) + table(['Domain', 'Mentions', 'AI search volume'], (m.market.top || []).slice(0, 10).map(x => [esc(x.domain), n(x.mentions), n(x.ai_search_volume)])));
  if (m.chunk && m.chunk.unavailable_note) html += p_(esc(m.chunk.unavailable_note));
  const __x = __w2x(m); html += AIX.reportHtml(__x, { h3, p_, table, esc, n });   // W2-E3: the fan-out ranking gap, the persona effect (API answers), demand, your uploaded AI reports, the run's notes
  html += h3('How this is measured') + p_((PN && PN.pulse_per_week && PN.pulse_per_week < 6 ? 'This panel is large, so the daily AI Pulse asks a rotating sample: each question on ' + PN.pulse_per_week + ' of the six pulse mornings of a week, with every topic and buyer role in every morning\'s sample. ' : '') + 'Every day (Tuesday to Sunday) the AI Pulse asks every tracked question on ChatGPT and Gemini (the real chatgpt.com and gemini.google.com answers) and Google AI Mode; every Monday the full set adds Perplexity and the Google AI Overview of the matching search, and on the month\'s first run Claude (with web search), the question about the brand itself, new questions from real AI searches and the market-wide database view. Answers vary between asks, so each rate counts all of the past week\'s answers and comes with its 95% range; a change is called real only when it is beyond sampling noise (two-proportion test). Rates and share of voice use the buyer questions only; the brand question measures recognition. "Named" = the answer names ' + esc(m.brand_names.join(' / ')) + ' in its text (an answer that only links one of your pages is "cited", not "named"); "cited" = it links one of your pages; "position" = your place among the businesses the answer names; the visibility score weighs that place, whether you are also cited, and each question\'s monthly AI search volume; share of voice = your mentions out of yours plus every competitor\'s, in the same answers (brands named without a website count too, read by Claude); sentiment and wrong claims are read by Claude against your business profile. AI search volume is DataForSEO\'s estimate; "estimated answers naming you" multiplies it by your win rate and is an estimate. Cost this run: $' + m.cost_usd.toFixed(2) + ' (DataForSEO).', true);
  // G29: the same figures with their source, period and sample as structured fields
  const lineage = [
    LN.of('Named in, your pages cited, share of voice and the visibility score', 'ai_engines', { basis: 'measured',
      period: M.rate_period ? esc(M.rate_period) : 'the run of ' + esc(m.checked_at.slice(0, 10)), sample: M.headline ? LN.sample(M.samples, 'answers (' + M.headline.buyer_questions + ' buyer questions on ' + M.headline.engine_count + ' weekly engines: ' + M.headline.run_answers + ' this run + ' + M.headline.pulse_answers + ' from the daily pulse)') : LN.sample(M.samples, 'answers (' + m.questions.length + ' questions × ' + engs.length + ' engines)'),
      note: '95% range ' + M.mention_ci[0] + '–' + M.mention_ci[1] + '% for "named in", ' + cci[0] + '–' + cci[1] + '% for the pages cited, ' + sci[0] + '–' + sci[1] + '% for the share of voice'
        + (M.score_band && M.score_band.half != null ? '; the visibility score is MODELLED from the position in each answer and the question\'s AI search volume, ±' + M.score_band.half + ' points at 95% (' + M.score_band.why + ')' : '; the visibility score is modelled from the position in each answer and the question\'s AI search volume')
        + (M.pulse_basis ? '; ' + M.pulse_basis.note.replace(/\.$/, '') : '') + '. The named and cited rates are two-proportion z-tested; share of voice, the score and the place are tested on their standard errors over answers; each change is labelled real, within noise, or not tested' + (M.compare && M.compare.rule_version ? ' (measurement rule ' + M.compare.rule_version + ')' : '') }),
    // R85: "not read" and "0 stored" are two different things, and the row says which
    (M.volume_lookup && M.volume_lookup.read === false)
      ? LN.unknown('AI searches per month per question', 'not read this run — ' + M.volume_lookup.note + ' ' + M.volume_lookup.stored_measured + ' of the ' + M.volume_lookup.questions + ' questions carry a stored figure (' + M.volume_lookup.stored_positive + ' above 0).')
      : LN.of('AI searches per month per question', 'ai_db', { basis: 'estimated', period: 'the provider\'s latest month', sample: LN.sample(m.questions.filter(q => q.kind !== 'brand' && q.volume != null).length, 'questions with a volume read (' + m.questions.filter(q => Number(q.volume) > 0).length + ' above 0)'),
        note: 'DataForSEO\'s estimate of how often the question is asked; "estimated answers naming you" multiplies it by your win rate' + (M.volume_lookup && M.volume_lookup.asked ? '' : '; not looked up this run — the figures are the stored ones') }),
    T && T.connected
      ? LN.of('AI visits, key events and revenue', 'ga4', { basis: 'measured', period: 'the last 28 days', sample: LN.sample(T.sessions, 'visits from AI assistants'), note: 'Google AI Overviews and AI Mode arrive as organic search in GA4 and are not in this figure' })
      : LN.unknown('AI visits, key events and revenue', (T && T.error) || 'Google Analytics is not connected for this site'),
    P.analysed ? LN.of('How AI describes you, and what it gets wrong', 'ai_engines', { basis: 'reported', period: 'this run\'s answers', sample: LN.sample(P.positive + P.neutral + P.negative, 'answers naming you'),
      note: P.fact_check === 'checked' ? 'claims read by Claude against your business profile' : 'claims not checked: ' + String(P.fact_check_note || 'no business facts on file') })
      : LN.unknown('How AI describes you', 'no answer named you this run, so there is nothing to read'),
  ];
  // B8-5: a request the cost or request cap stopped is evidence that was never gathered, and it says so in the lineage block too
  if (M.capped) lineage.push(LN.unknown('The engines and questions this run did not reach', M.capped.note));
  if (A) lineage.push(LN.of('Whether AI crawlers can read your site', 'own_check', { basis: 'one_sample', period: LN.asOf(m.checked_at), sample: LN.sample(A.answer_bots, 'answer crawlers, robots.txt plus one homepage fetch each') }));
  if (X) lineage.push(LN.of('Share among tracked rivals (AI-answer database) and the answers citing you', 'ai_db', { basis: 'reported', period: X.carried ? LN.asOf(X.checked_at) + ' (read monthly)' : LN.asOf(m.checked_at), sample: LN.sample(X.answers_citing_you, 'answers in the database citing you'), note: 'the whole AI-answer database, not only your tracked questions' }));
  html += LN.block(lineage) + '</div>';
  // B8-1: the subject line is the one line everybody reads, and it used to print the points with no word about the test — so an
  // untested "+5 pts" arrived in the inbox looking exactly like a measured gain. It now says which it is, or says nothing.
  const subjChange = (m.previous && d.mention_rate) ? ' (' + (d.mention_rate > 0 ? '+' : '') + d.mention_rate + ' pts'
    + (d.significant === true ? ', real change' : d.significant === false ? ', within noise' : ', not tested') + ')' : '';
  const subject = '[AI visibility] ' + m.domain + ' — named in ' + M.mention_rate + '% of AI answers' + subjChange + (T && T.connected ? ' · ' + n(T.sessions) + ' AI visits' : '') + (m.alerts.length ? ' · ' + m.alerts.length + ' alert(s)' : '');
  const file_name = 'ai-visibility-' + m.domain.replace(/[^a-z0-9]+/gi, '-') + '-' + m.checked_at.slice(0, 10) + '.html';
  return { json: { ...m, brief: b, lineage, subject, html, file_name, status: 'progress', stage: 'ai_visibility', ...AIX.callbackFields(__x) }, binary: { data: { data: b64(wrapDoc(subject, html)), mimeType: 'text/html', fileName: file_name, fileExtension: 'html' } } };
});
