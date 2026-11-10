// ---- LADDER PACKAGE (2026-11-09, docs/keyword-intel-2026-11-08/fixes/LADDER.md): the five ladder rules, ONE copy ----
// Production (2026-10-22 .. 11-08, R3_PROD_OUTPUTS.md F1 F6 F7 F9): three rungs of techand.ai's ERP ladder, the main page included, were written onto
// ONE blog address (/insights/is-microsoft-dynamics-365-an-erp-system); the CRM ladder's main page pointed at "/dynamics-365-crm-uae-2", a copy
// of the live CRM page; a rung the verdict called AVOID was written and published because ladder page runs carry force_content; a rung sat
// in "writing" for days after its run died; devaicon.com's "ai automation solutions gcc" was measured in Pakistan. The rules:
//   1. one search, one address: two rungs never share a target, a rung whose address already answers its search improves that page, and the
//      main page is never a blog / insights address or a "-2" / "-copy" variant of a live page (addresses compared without scheme / www);
//   2. the rungs step towards the main keyword (stage: problem, solution, compare, hire); a plan with no compare / hire rung before the main
//      page is re-planned from its own pool, and a pure definition ("what is a crm company") is a rung only when its results page is
//      informational (guides) and it links to the main page;
//   3. the market is the website's market, or the market the keyword names ("gcc", "uae", "dubai" -> AE); never another country;
//   4. an AVOID verdict, or a score clearly under the line (40), stops the rung: no page is written until the client says "Write it anyway";
//   5. a rung "writing" for longer than three times its expected time (at least 60 minutes) with nothing of its run still alive is closed as
//      failed with its reason, so the next rung can go.
// Inlined into Ladder Plan, Ladder Duplicate (Words), Parse Verdict's ladder stop (Ladder Row Written), Cadence Plan, Publish Candidates and
// Publish Check (through _publish_rows.js); the app runs the same source (app/shared/src/ladder-rules.generated.js, ladder_rules_app.py) for
// its warnings, its rung reasons and its stuck-rung watcher. Pure: no clock (pass `now`), no table, no network. Needs fitPlaces
// (_fit_gate.js) only for the market rule; everything else stands alone.
const LRU = (() => {
  const S = (v) => String(v == null ? '' : v).trim();
  const low = (v) => S(v).toLowerCase();
  const CFG = {
    stuck_min_minutes: 60, stuck_eta_factor: 3, page_eta_minutes: 20,   // page runs take 15-19 minutes on production (2026-11-08)
    clear_score: 40,                                                    // Parse Verdict's "clearly low" line (HOLD CFG.clear)
    blog_dirs: ['blog', 'blogs', 'insights', 'insight', 'articles', 'article', 'news', 'resources', 'resource', 'posts', 'post', 'learn', 'guides', 'guide', 'knowledge', 'academy', 'stories', 'magazine'],
    // the measurable markets (Normalize Input COUNTRIES): ISO-2 -> the country name the engine and the app use
    countries: { US: 'United States', GB: 'United Kingdom', CA: 'Canada', AU: 'Australia', NZ: 'New Zealand', IE: 'Ireland', PK: 'Pakistan', IN: 'India',
      AE: 'United Arab Emirates', SA: 'Saudi Arabia', SG: 'Singapore', ZA: 'South Africa', DE: 'Germany', FR: 'France', ES: 'Spain', IT: 'Italy',
      NL: 'Netherlands', BR: 'Brazil', MX: 'Mexico' },
  };
  const STAGES = ['problem', 'solution', 'compare', 'hire', 'info'];
  const COMMERCIAL = ['compare', 'hire'];

  // ---- addresses (rule 1) ----
  /** the comparable form of an address: no scheme, no www., no query / fragment, no trailing slash, lower case ('' for nothing) */
  const urlKey = (u) => low(u).replace(/^[a-z]+:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  const pathOf = (u) => { const k = urlKey(u); const i = k.indexOf('/'); return i < 0 ? '' : k.slice(i); };
  const segs = (u) => pathOf(u).split('/').filter(Boolean);
  /** a blog / insights / news ... address: its first folder is one of CFG.blog_dirs */
  const isBlog = (u) => { const s = segs(u); return s.length > 1 && CFG.blog_dirs.includes(s[0]); };
  const COPY_RE = /^(.+?)-(?:copy(?:-\d+)?|\d{1,2}|old|new|draft|backup|bak|v\d)$/;
  /** a "-2" / "-copy" / "-old" variant of another address of the site: -> the original's address, or ''. A numbered or dated suffix counts
   *  only when the address without it is a page the site has (so /step-2 is not a copy unless /step exists); "-copy" always counts. */
  const copyOf = (u, known) => {
    const s = segs(u); if (!s.length) return '';
    const m = s[s.length - 1].match(COPY_RE); if (!m) return '';
    const base = urlKey(u).replace(/[^/]+$/, m[1]);
    const ks = new Map((Array.isArray(known) ? known : []).map(x => [urlKey(x && typeof x === 'object' ? x.url : x), x && typeof x === 'object' ? S(x.url) : S(x)]).filter(([k]) => k));
    if (ks.has(base)) return ks.get(base) || base;
    return /-copy(?:-\d+)?$/.test(s[s.length - 1]) ? base : '';
  };
  // the same search in other words: every word kept, joining words dropped, a plural folded (the H2 target_guard rule of Ladder_Plan.js)
  const JOIN = new Set(['in', 'the', 'a', 'an', 'of', 'for', 'to', 'on', 'at', 'and', 'with', 'by', 'from']);
  const wordsKey = (kw) => [...new Set(low(kw).split(/[^a-z0-9؀-ۿ]+/).filter(t => t && !JOIN.has(t)).map(t => t.length > 3 ? t.replace(/ies$/, 'y').replace(/([^s])s$/, '$1') : t))].sort().join(' ');
  const sameSearch = (a, b) => { const x = low(a), y = low(b); if (!x || !y) return false; if (x === y) return true; const wa = wordsKey(x); return !!wa && wa === wordsKey(y); };
  /** who already holds an address: owners [{ url, keyword, supporting?: [..], ladder_id?, by? }] -> the owner of `url` whose search is NOT
   *  `keyword` (nor one of its supporting keywords), or null. The same search may always improve its own page. */
  const ownerOf = (url, keyword, owners, mine) => {
    const k = urlKey(url); if (!k) return null;
    const kws = [keyword, ...(Array.isArray(mine) ? mine : [])].map(low).filter(Boolean);
    for (const o of (Array.isArray(owners) ? owners : [])) {
      if (!o || urlKey(o.url) !== k || !S(o.keyword)) continue;
      const theirs = [o.keyword, ...(Array.isArray(o.supporting) ? o.supporting : String(o.supporting || '').split(','))].map(low).filter(Boolean);
      if (kws.some(a => theirs.some(b => sameSearch(a, b)))) continue;   // the same search: its own page (another owner may still hold it)
      return o;
    }
    return null;
  };
  /** the address a new page gets on the site: home + slug(keyword), with the site's trailing-slash form */
  const plannedUrl = (home, keyword, slash) => { const h = S(home).replace(/\/+$/, ''); const sl = low(keyword).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return h && sl ? h + '/' + sl + (slash ? '/' : '') : ''; };
  /** rule 1 for the MAIN page: a blog address, or a copy of a live page, is never its target. -> null (fine) or { reason, was, to, exists }:
   *  a copy points back to the original page (improve it); a blog address gets the commercial page the site has (`commercial`, a URL
   *  found by the caller among non-blog pages), else a new page at `planned`. */
  const headTarget = (url, o) => {
    const opt = o || {}; const u = S(url); if (!u) return null;
    const orig = copyOf(u, opt.known || []);
    if (orig) return { reason: 'copy', was: u, to: S(orig).startsWith('http') ? S(orig) : (S(opt.home).replace(/\/+$/, '') + pathOf(orig)), exists: true,
      text: u.replace(/^https?:\/\/[^\/]+/i, '') + ' is a copy of ' + pathOf(orig) + ', a page your website already has: the main page improves that page instead of a second copy' };
    if (isBlog(u)) { const c = S(opt.commercial);
      return c ? { reason: 'blog', was: u, to: c, exists: true, text: 'the main page is a page people choose a provider on, not a blog post: ' + c.replace(/^https?:\/\/[^\/]+/i, '') + ' improves instead of ' + u.replace(/^https?:\/\/[^\/]+/i, '') }
        : { reason: 'blog', was: u, to: S(opt.planned), exists: false, text: 'the main page is a page people choose a provider on, not a blog post (' + u.replace(/^https?:\/\/[^\/]+/i, '') + '): it gets its own page at ' + S(opt.planned).replace(/^https?:\/\/[^\/]+/i, '') }; }
    return null;
  };
  /** rule 1 inside one plan: pages [{ keyword, target_url, exists, rung, supporting }] in plan order (the main page first) -> { pages, moved }.
   *  Two pages on one address: the first keeps it; a later page of the SAME search joins it as a supporting keyword, any other gets its own
   *  new address (`planned(keyword)`). */
  const oneUrl = (pages, planned) => {
    const seen = new Map(); const out = []; const moved = [];
    for (const p of (Array.isArray(pages) ? pages : [])) {
      const k = urlKey(p && p.target_url); if (!p || !k) { out.push(p); continue; }
      const o = seen.get(k);
      if (!o) { seen.set(k, p); out.push(p); continue; }
      if (sameSearch(o.keyword, p.keyword)) { o.supporting = [...new Set([...(o.supporting || []), p.keyword, ...(p.supporting || [])])]; moved.push({ keyword: p.keyword, to: o.keyword, url: o.target_url, how: 'joined', text: '"' + p.keyword + '" is the same search as "' + o.keyword + '", so it is a supporting keyword of that page' }); continue; }
      const nu = typeof planned === 'function' ? S(planned(p.keyword)) : '';
      if (!nu || seen.has(urlKey(nu))) { moved.push({ keyword: p.keyword, to: o.keyword, url: o.target_url, how: 'dropped', text: '"' + p.keyword + '" had the same address as "' + o.keyword + '" and no address of its own could be made, so it waits' }); continue; }
      moved.push({ keyword: p.keyword, from: p.target_url, url: nu, how: 'own address', text: '"' + p.keyword + '" had the same address as "' + o.keyword + '" (' + pathOf(p.target_url) + '): one search, one page, so it gets its own page at ' + pathOf(nu) });
      Object.assign(p, { target_url: nu, exists: false, status: 'new', existing_source: null, existing_confidence: null, existing_evidence: '' });
      seen.set(urlKey(nu), p); out.push(p);
    }
    return { pages: out, moved };
  };

  // ---- the buyer's stage (rule 2) ----
  const Q_START = /^(?:what|who|why|when|where|which|is|are|does|do|can|should|will|how)\b/;
  const W_COMPARE = /\b(?:best|top|vs|versus|alternatives?|compare|comparison|comparing|pricing|prices?|costs?|fees?|quotes?|reviews?|rated|cheapest|affordable|rankings?|list of)\b/;
  const W_HIRE = /\b(?:compan(?:y|ies)|agenc(?:y|ies)|firms?|providers?|partners?|consultants?|consultanc(?:y|ies)|contractors?|developers?|vendors?|integrators?|resellers?|specialists?|experts?|freelancers?|hire|hiring|near me|services)\b|\b(?:consulting|implementation|development|support|migration|integration|outsourcing) services?\b/;
  const W_PROBLEM = /\b(?:deadlines?|penalt(?:y|ies)|fines?|mandate|mandatory|requirements?|compliance|compliant|regulations?|law|laws|problems?|issues?|errors?|not working|fix|risks?|challenges?|obligations?)\b/;
  const W_SOLUTION = /\b(?:software|system|systems|platform|platforms|tools?|solutions?|apps?|applications?|modules?|features?|implementation|migration|integration|upgrade|automation|development|hosting|cloud|erp|crm|hrms|lms|setup|service)\b/;
  const W_DEFINE = /^(?:what (?:is|are|does)|what's|whats|define|definition of|meaning of)\b/;
  const W_SELLER_NOUN = /\b(?:compan(?:y|ies)|agenc(?:y|ies)|firms?|providers?|partners?|consultants?|consultanc(?:y|ies)|vendors?|integrators?|specialists?)\b/;
  /** the stage of a search: a stored KI stage when there is one, else the words, else the intent the research gave -> one of STAGES */
  const stageOf = (keyword, intent, stored) => {
    const st = low(stored); if (STAGES.includes(st)) return st;
    const k = low(keyword).replace(/[^a-z0-9؀-ۿ&]+/g, ' ').trim();
    if (!k) return 'info';
    if (W_COMPARE.test(k)) return 'compare';
    if (Q_START.test(k)) return W_PROBLEM.test(k) ? 'problem' : 'info';
    if (W_HIRE.test(k)) return 'hire';
    if (W_PROBLEM.test(k)) return 'problem';
    if (W_SOLUTION.test(k)) return 'solution';
    const i = low(intent);
    return i === 'commercial' || i === 'transactional' ? 'solution' : 'info';
  };
  const isCommercial = (stage) => COMMERCIAL.includes(low(stage));
  /** a pure definition of a seller ("what is a crm company", "meaning of erp partner"): a page for people learning a word, not buyers */
  const isDefinitional = (keyword) => { const k = low(keyword); return W_DEFINE.test(k) && W_SELLER_NOUN.test(k); };
  /** rule 2: may a definitional rung stay? only when its results page was read and is informational (guides lead) and it links to the main page */
  const definitionalOk = (o) => { const x = o || {}; return !!x.serp_informational && !!x.links_up; };
  const STAGE_WORDS = { problem: 'people with a problem to solve', solution: 'people looking for a solution', compare: 'people comparing providers or options', hire: 'people ready to choose a provider', info: 'people learning about the topic' };
  const stageText = (stage) => STAGE_WORDS[low(stage)] || STAGE_WORDS.info;

  // ---- the market (rule 3) ----
  const placesOf = (s) => { try { return typeof fitPlaces === 'function' ? fitPlaces(s) : []; } catch (e) { return []; } };
  const countryName = (iso) => CFG.countries[S(iso).toUpperCase()] || '';
  /** -> { iso, country, source: 'keyword' | 'site' | 'request', named: [place words], keyword_iso, ok (the request market is the lock), changed,
   *  measurable, note }. o: { keyword, site_iso (the website's market), request_iso (what the run was sent with) }.
   *  A keyword that names places stands for those places: the website's market when it is among them ("gcc" for a UAE website), else the
   *  first measurable country it names (a region: its first country, "gcc" -> AE); a keyword that names no place is the website's market.
   *  Never a third country: the request's market is used only when there is neither a place in the keyword nor a website market. */
  const market = (o) => {
    const x = o || {}; const site = S(x.site_iso).toUpperCase(), req = S(x.request_iso).toUpperCase();
    const places = placesOf(x.keyword); const named = places.map(p => p.word);
    let iso = '', source = '', keyword_iso = '';
    if (places.length) {
      const isos = [...new Set(places.flatMap(p => p.iso || []))];
      keyword_iso = site && isos.includes(site) ? site : (isos.find(i => CFG.countries[i]) || isos[0] || '');
      iso = keyword_iso; source = site && iso === site ? 'site' : 'keyword';
    } else if (site) { iso = site; source = 'site'; }
    else { iso = req; source = 'request'; }
    const unmeasured = !CFG.countries[iso] && !!site;
    if (unmeasured) { iso = site; source = 'site'; }   // a named market we cannot measure (Qatar): the website's own, said so
    const ok = !req || req === iso;
    const nm = (i) => countryName(i) || i;
    const note = !iso ? '' : source === 'keyword'
      ? 'The keyword names ' + named.join(', ') + ', so this ladder is measured in ' + nm(iso) + (site ? ', not in your website\'s market (' + nm(site) + ')' : '') + '.'
      : places.length && keyword_iso && keyword_iso !== iso ? 'The keyword names ' + named.join(', ') + ', which we cannot measure, so this ladder is measured in your website\'s market (' + nm(iso) + ').'
      : places.length ? 'The keyword names ' + named.join(', ') + ', which includes your website\'s market (' + nm(iso) + '), so it is measured there.'
      : source === 'site' ? 'Measured in your website\'s market (' + nm(iso) + ').' : '';
    return { iso, country: nm(iso), source, named, keyword_iso, request_iso: req, ok, changed: !!req && req !== iso, measurable: !!CFG.countries[iso], note };
  };
  /** the sentence a refused run carries when its market contradicts the lock (Ladder Duplicate (Words), before anything is paid) */
  const marketRefusal = (m, keyword) => !m || m.ok ? '' : 'This ladder was sent to be measured in ' + (countryName(m.request_iso) || m.request_iso) + ', but "' + S(keyword) + '" '
    + (m.source === 'keyword' ? 'names ' + m.named.join(', ') + ' (' + m.country + ')' : 'names no place and your website\'s market is ' + m.country)
    + '. A ladder is measured in one market, so nothing was planned and nothing was charged: start it again in ' + m.country
    + (m.source === 'site' && !m.named.length ? ', or confirm that you want it measured in ' + (countryName(m.request_iso) || m.request_iso) + ' on purpose.' : '.');

  // ---- verdicts (rule 4) ----
  /** o: { verdict: 'GO' | 'GO_WITH_CHANGES' | 'AVOID' | ..., score: 0-100 | null, ack: the client said "Write it anyway" } -> { stop, reason, band } */
  const verdictStop = (o) => {
    const x = o || {}; const v = S(x.verdict).toUpperCase(); const sc = x.score === '' || x.score == null || !Number.isFinite(Number(x.score)) ? null : Math.round(Number(x.score));
    const band = v === 'AVOID' ? 'avoid' : sc != null && sc < CFG.clear_score ? 'clearly_low' : '';
    if (!band) return { stop: false, reason: '', band: '' };
    if (x.ack) return { stop: false, reason: 'you chose to write it anyway', band, overridden: true };
    return { stop: true, band, score: sc,
      reason: band === 'avoid' ? 'our check advised against this page (AVOID' + (sc != null ? ', score ' + sc : '') + ')' : 'our check scored it ' + sc + ' out of 100, clearly under the ' + CFG.clear_score + ' we write without asking' };
  };

  // ---- stuck rungs (rule 5) ----
  /** o: { status, since (ISO: when it went to writing / was started), eta_minutes, live: true | false | null (null = could not be asked), now (ISO or ms) }
   *  -> { stuck, minutes, limit, reason } */
  const stuck = (o) => {
    const x = o || {}; const st = low(x.status);
    const eta = Number.isFinite(Number(x.eta_minutes)) && Number(x.eta_minutes) > 0 ? Number(x.eta_minutes) : CFG.page_eta_minutes;
    const limit = Math.max(CFG.stuck_min_minutes, CFG.stuck_eta_factor * eta);
    const t = Date.parse(S(x.since)); const now = typeof x.now === 'number' ? x.now : Date.parse(S(x.now));
    if (!['writing', 'started'].includes(st) || !Number.isFinite(t) || !Number.isFinite(now)) return { stuck: false, minutes: null, limit, reason: '' };
    const minutes = Math.max(0, Math.round((now - t) / 60000));
    if (minutes < limit) return { stuck: false, minutes, limit, reason: '' };
    if (x.live !== false) return { stuck: false, minutes, limit, reason: x.live === true ? 'still running' : 'the engine could not be asked whether it is still running' };
    return { stuck: true, minutes, limit, reason: 'the page run stopped without a result: it was being written for ' + minutes + ' minutes (more than ' + limit + ') and nothing of it is still running' };
  };

  // ---- what a rung row tells the client (the app's ladder page) ----
  /** row: a seo_ladders row; o: { next: the keyword the ladder writes next, now } -> { state, label, why, url } */
  const rungState = (row, o) => {
    const r = row || {}; const st = low(r.status || 'planned'); const url = S(r.target_url); const note = S(r.status_note);
    const exists = r.page_exists === true || r.page_exists === 'true';
    const path = url.replace(/^https?:\/\/[^\/]+/i, '') || '/';
    const tw = S(r.target_why);
    if (st === 'stopped') return { state: 'stopped', label: 'Stopped', why: note.replace(/^stopped:\s*/i, '') || 'our check advised against this page', url };
    if (st === 'failed') return { state: 'failed', label: 'Stopped without a result', why: note.replace(/^failed:\s*/i, '') || 'the page run stopped without a result', url };
    if (st === 'merged') return { state: 'merged', label: 'Part of another page', why: note.replace(/^merged:\s*/i, '') || 'it is a section of another page of this ladder', url };
    if (st === 'set_aside') return { state: 'set_aside', label: 'Set aside', why: note || 'it is not a search for this website', url };
    if (st === 'published') return { state: 'published', label: 'Live', why: 'published at ' + path, url };
    if (st === 'written' || st === 'not_ready') return { state: st, label: st === 'written' ? 'Written, waiting to be published' : 'Written, needs a fix', why: note || (exists ? 'improves ' + path : 'a new page at ' + path), url };
    if (st === 'writing') return { state: 'writing', label: 'Being written', why: exists ? 'improves ' + path : 'a new page at ' + path, url };
    const nxt = (o || {}).next ? sameSearch((o || {}).next, r.keyword) : false;
    return { state: exists ? 'improve' : 'new', label: exists ? 'Improves an existing page' : 'New page', why: (tw || (exists ? 'your page ' + path + ' already answers this search, so it is improved, not written twice' : 'a page you do not have yet, at ' + path))
      + (nxt ? '' : note ? ' (' + note + ')' : ''), url, waiting: !nxt };
  };

  // ---- rule 6: keyword intelligence as the ladder's pool ----
  /** o: { mode (seo_monitors.ki_mode), killed (true | false | null = unread: counts as killed), rows (seo_ki_keywords of the site), runs
   *  (seo_ki_runs of the site), market ('AE-en'), min (default 3) } -> { used, reason, run_id, rows (one head per cluster, gate pass, not
   *  gated), avoid (keywords the client's checks advised against), note }. Read only when the site's mode is exactly 'on' and the kill
   *  switch reads off (fails closed, KI.readable's rule); only the rows of the latest finished keyword-research run of this market
   *  (CONTRACTS KI_ROW_CURRENT). Fewer than `min` usable heads: not used, and the ladder keeps its own research, said so. */
  const kiPool = (o) => {
    const x = o || {}; const mode = low(x.mode); const mk = S(x.market);
    const off = (reason, note) => ({ used: false, reason, run_id: '', rows: [], avoid: [], note: note || '' });
    if (mode !== 'on') return off(mode ? 'ki_' + mode : 'ki_off');
    if (x.killed !== false) return off('killed', 'Keyword intelligence is paused for every website, so this ladder used its own keyword research.');
    const runs = (Array.isArray(x.runs) ? x.runs : []).filter(r => r && low(r.kind) === 'keyword_research' && ['ok', 'partial'].includes(low(r.status)) && (!mk || S(r.market) === mk))
      .sort((a, b) => S(b.finished_at || b.started_at).localeCompare(S(a.finished_at || a.started_at)));
    const cur = runs[0] ? S(runs[0].run_id) : '';
    if (!cur) return off('no_run', 'Keyword intelligence is on, but no finished keyword research is on file for ' + (mk || 'this market') + ', so this ladder used its own keyword research.');
    const all = (Array.isArray(x.rows) ? x.rows : []).filter(r => r && S(r.keyword) && S(r.run_id) === cur && (!mk || S(r.market) === mk));
    const yes = (v) => v === true || v === 'true';
    const pass = all.filter(r => low(r.gate) === 'pass' && low(r.verdict) !== 'gated');
    const anyHead = pass.some(r => yes(r.is_head));
    const heads = pass.filter(r => !anyHead || yes(r.is_head));
    const avoid = all.filter(r => low(r.gate_reason) === 'avoid').map(r => S(r.keyword));
    const min = Number(x.min) > 0 ? Number(x.min) : 3;
    if (heads.length < min) return { ...off('too_few', 'Keyword intelligence holds only ' + heads.length + ' usable search' + (heads.length === 1 ? '' : 'es') + ' for ' + (mk || 'this market') + ' (at least ' + min + ' are needed), so this ladder used its own keyword research.'), run_id: cur, avoid };
    return { used: true, reason: '', run_id: cur, rows: heads, avoid,
      note: 'The supporting pages come from keyword intelligence: ' + heads.length + ' search groups of its last keyword research (' + cur + '), one search per group, with its verdict, page action and Search Console position.' };
  };

  return { CFG, STAGES, COMMERCIAL, kiPool, urlKey, pathOf, isBlog, copyOf, wordsKey, sameSearch, ownerOf, plannedUrl, headTarget, oneUrl,
    stageOf, isCommercial, isDefinitional, definitionalOk, stageText, countryName, market, marketRefusal, verdictStop, stuck, rungState };
})();
