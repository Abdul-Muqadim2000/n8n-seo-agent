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
const metrics = $('AI Metrics').all().map(i => i.json);
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
  if (SE) { h += h3('How AI speaks of you, aspect by aspect');
    if (SE.withheld) h += p_(esc(SE.note) + (SE.unread_note ? ' ' + esc(SE.unread_note) : ''), true);
    else { h += p_(esc(SE.note) + (SE.unread_note ? ' ' + esc(SE.unread_note) : ''));
      h += table(['Aspect', 'Positive', 'Neutral', 'Negative', 'Net (answers)'], (SE.by_aspect || []).map(a => [esc(a.aspect), n(a.pos), n(a.neu), n(a.neg), (a.net == null ? 'too few' : w2pm(a.net)) + muted(n(a.n) + ' answers')]), 'no aspect judged');
      if ((SE.objections || []).length) h += p_('<b>What would make a buyer hesitate</b>: ' + SE.objections.map(o => esc(o.text) + ' (' + o.n + ')').join('; ') + '.');
      if ((SE.by_rival || []).filter(r => r.net != null).length) h += p_('How the same answers speak of your competitors: ' + SE.by_rival.filter(r => r.net != null).map(r => esc(r.id) + ' ' + w2pm(r.net) + ' (' + r.n + ' answers)').join(', ') + '.', true); }
    h += p_('Method: ' + esc(SE.method) + '. ' + esc((SE.kappa || {}).note || '') + (SE.model_vs_rules ? ' This run the model and the rule reader agreed on ' + SE.model_vs_rules.agreement + '% of ' + SE.model_vs_rules.n + ' answers.' : ''), true); }
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
  return { json: { ...m, brief: b, lineage, subject, html, file_name, status: 'progress', stage: 'ai_visibility' }, binary: { data: { data: b64(wrapDoc(subject, html)), mimeType: 'text/html', fileName: file_name, fileExtension: 'html' } } };
});
