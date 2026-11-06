// AIR fixtures (2026-11-06, docs/ai-ranking-2026-11-05/DESIGN.md §6.8, CONTRACTS.md §7): a SEEDED generator of two synthetic archetype
// websites for the AI-ranking packages. PUBLIC REPO: synthetic only. Every host is a reserved `.example` host, except clutch.co and g2.com,
// which appear only as directory / review hosts for page classification. No real client answer, URL, contact or competitor appears here.
//
//   nova-ai.example   cold-start custom-software firm: market AE (site row + the client's own ladders) while the profile says PK, answers built
//                     from lists and directories, not in Bing's account, one page in Google, robots.txt blocked the AI bots until week 2
//                     (`robots_history`), named 0 times.
//   acme-erp.example  retrievable ERP partner in SA: ranks 20-50 for the commercial searches the engines run, two informational guides cited
//                     by the Google engines, a winning question the focus rules would retire (focus_state 'watch', last in focus 60 days ago)
//                     and a ladder rung aimed at its most-cited page.
//
// make({ seed, now, weeks, modes }) -> { now, nowMs, seed, sites: [site], tables: { <table name>: [rows] }, pages: { url: { status, html } },
//   robots: { host: text }, robots_history: { host: [{ from, text }] }, bing: { sites: [url], crawled: { url: iso } }, archetypes: { nova, acme } }
// Same seed and options -> byte-identical output (harness AIRW0-5). The default `now` is a fixed Monday; pass a number or ISO string to move it.
// The rows of seo_monitors, seo_ai_prompts, seo_ai_answers, seo_ai_targets, seo_ai_pages, seo_cache, seo_listings, seo_link_outreach and
// seo_link_prospects carry exactly their table's columns (harness/table_cols.json; AIRW0-5); the other tables carry the columns AIR reads.
const DAY = 864e5;
const fnv = (s) => { let h = 2166136261 >>> 0; const t = String(s); for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
const rngOf = (seed) => { let a = fnv(seed) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const AIV_RULE = 'aivis-2026-10-23';   // _ai_stats.js RULE_VERSION when these fixtures were written (the harness checks it is still current)
const ENGINES = ['chatgpt', 'gemini', 'ai_mode', 'ai_overview', 'perplexity', 'claude', 'copilot'];
const host = (u) => String(u).replace(/^https?:\/\//, '').replace(/[\/?#].*$/, '').toLowerCase();

function archetypes() {
  const nova = { site_id: 'site_nova-ai-example', domain: 'nova-ai.example', name: 'Nova AI', country: 'United Arab Emirates', cc: 'AE', location_code: 2784, profile_cc: 'PK',
    pages: ['/', '/services/custom-software', '/services/ai-development', '/services/mobile-apps', '/blog/custom-software-cost'],
    indexed: ['/'], bing_in_account: false,
    rivals: [['rival-one.example', 'Rival One'], ['rival-two.example', 'Rival Two'], ['bigsoft.example', 'BigSoft']],
    sources: {
      listicle: 'https://top-software-firms.example/best-custom-software-companies-uae',
      listicle2: 'https://techreview.example/top-10-ai-companies-uae',
      directory: 'https://clutch.co/ae/developers/dubai',
      review: 'https://www.g2.com/categories/custom-software-development',
      registry: 'https://registry.gov.example/accredited-software-providers',
      rival_list: 'https://rival-one.example/blog/top-software-companies-dubai',
      community: 'https://forum.devs.example/t/which-software-house-in-dubai/4411',
      forbidden: 'https://paywalled-news.example/business/uae-software-market-2026' },
    questions: [
      ['nq1', 'Which companies build custom software in Dubai?', 'recommend', 'custom software development dubai', 'decision', 'custom software', 260, 'AE-en'],
      ['nq2', 'Best AI development companies in the UAE', 'recommend', 'ai development company uae', 'decision', 'ai', 140, 'AE-en'],
      ['nq3', 'Top mobile app developers in Abu Dhabi', 'recommend', 'mobile app developers abu dhabi', 'consideration', 'apps', 90, 'AE-en'],
      ['nq4', 'How much does custom software cost in the UAE?', 'learn', 'custom software cost uae', 'awareness', 'custom software', 0, 'AE-en'],
      ['nq5', 'Which software house in Dubai builds ERP integrations?', 'recommend', 'erp integration dubai', 'consideration', 'erp', 40, 'AE-en'],
      ['nq6', 'What is the difference between custom and off-the-shelf software?', 'learn', 'custom vs off the shelf software', 'awareness', 'custom software', 30, 'AE-en'],
      ['nq7', 'What is Nova AI (nova-ai.example)?', 'brand', 'nova ai', 'awareness', 'brand', 0, 'AE-en'],
      ['nq8', 'Best software development agencies in Lahore', 'recommend', 'software house lahore', 'decision', 'custom software', 70, 'PK-en'] ],
    ladders: [['custom software development dubai', 'client'], ['ai development company uae', 'client'], ['software house lahore', 'system']] };
  const acme = { site_id: 'site_acme-erp-example', domain: 'acme-erp.example', name: 'Acme ERP', country: 'Saudi Arabia', cc: 'SA', location_code: 2682, profile_cc: 'SA',
    pages: ['/', '/guides/erp-implementation-cost', '/guides/what-is-erp', '/services/odoo-partner-riyadh', '/services/erp-manufacturing', '/case-studies'],
    indexed: ['/', '/guides/erp-implementation-cost', '/guides/what-is-erp', '/services/odoo-partner-riyadh', '/services/erp-manufacturing'], bing_in_account: true,
    rivals: [['erpone.example', 'ERP One'], ['gulf-erp.example', 'Gulf ERP'], ['cloudledger.example', 'CloudLedger']],
    sources: {
      listicle: 'https://erp-insights.example/top-erp-partners-saudi-arabia',
      directory: 'https://clutch.co/sa/it-services/erp',
      review: 'https://www.g2.com/categories/erp-systems',
      news: 'https://business-daily.example/news/saudi-erp-market-grows',
      rival_list: 'https://erpone.example/blog/best-erp-partners-ksa' },
    questions: [
      ['aq1', 'Who are the best ERP implementation partners in Saudi Arabia?', 'recommend', 'erp implementation partner saudi arabia', 'decision', 'erp partner', 320, 'SA-en'],
      ['aq2', 'How much does an ERP implementation cost?', 'learn', 'erp implementation cost', 'awareness', 'erp cost', 880, 'SA-en'],
      ['aq3', 'What is an ERP system?', 'learn', 'what is erp', 'awareness', 'erp basics', 2400, 'SA-en'],
      ['aq4', 'Best Odoo partners in Riyadh', 'recommend', 'odoo partner riyadh', 'decision', 'odoo', 110, 'SA-en'],
      ['aq5', 'Which ERP is best for manufacturing companies in Saudi Arabia?', 'recommend', 'erp for manufacturing saudi arabia', 'consideration', 'erp partner', 90, 'SA-en'],
      ['aq6', 'ERP vendors that support ZATCA e-invoicing', 'recommend', 'zatca erp vendors', 'consideration', 'e-invoicing', 170, 'SA-en'],
      ['aq7', 'What is Acme ERP (acme-erp.example)?', 'brand', 'acme erp', 'awareness', 'brand', 0, 'SA-en'],
      ['aq8', 'How long does an ERP implementation take?', 'learn', 'erp implementation timeline', 'awareness', 'erp cost', 320, 'SA-en'] ],
    ladders: [['erp implementation partner saudi arabia', 'client'], ['odoo partner riyadh', 'client']],
    winning: 'aq1', cited_page: '/guides/erp-implementation-cost' };
  return { nova, acme };
}

// what an engine's answer to a question looks like, per archetype (deterministic given the rng)
function behave(A, q, engine, week, R) {
  const [pid, , kind, keyword] = q; const S = A.sources; const W = 'https://' + A.domain;
  const ours = (p) => ({ url: W + p, host: A.domain });
  const fan = [keyword, keyword + ' ' + (A.cc === 'AE' ? '2026' : 'list'), 'best ' + keyword.replace(/^best /, '')];
  const rivalsNamed = A.rivals.filter(() => R() < 0.7).map(([h, n], i) => ({ id: h, name: n, role: 'competitor', position: i + 1, cited: R() < 0.3 }));
  let named = false, cited = [], retrieved = [], position = null;
  if (kind === 'brand') { named = true; position = 1; cited = [ours('/')]; }
  else if (A.domain === 'nova-ai.example') {
    const pool = [S.listicle, S.listicle2, S.directory, S.review, S.rival_list, S.community, S.registry, S.forbidden];
    cited = pool.filter(() => R() < 0.45).slice(0, 5).map(u => ({ url: u, host: host(u) }));
    if (!cited.length) cited = [{ url: S.listicle, host: host(S.listicle) }];
    if (engine === 'chatgpt') retrieved = [S.directory, 'https://rival-two.example/services'].map(u => ({ url: u, host: host(u) }));
  } else {
    const isWin = pid === A.winning; const isInfo = kind === 'learn';
    const pool = [S.listicle, S.directory, S.review, S.news, S.rival_list];
    cited = pool.filter(() => R() < 0.4).slice(0, 4).map(u => ({ url: u, host: host(u) }));
    if (isWin && (engine === 'chatgpt' || engine === 'ai_mode') && R() < 0.55) { named = true; position = 2 + Math.floor(R() * 2); }
    if (isInfo && ['ai_overview', 'ai_mode', 'gemini'].includes(engine) && (pid === 'aq2' || pid === 'aq3') && R() < 0.6) cited.unshift(ours(pid === 'aq2' ? A.cited_page : '/guides/what-is-erp'));
    if (pid === 'aq5' && engine === 'perplexity' && R() < 0.5) cited.unshift(ours('/services/erp-manufacturing'));
    if (engine === 'chatgpt' && (pid === 'aq4' || pid === 'aq1')) retrieved = [ours('/services/odoo-partner-riyadh'), { url: S.listicle, host: host(S.listicle) }];
  }
  const fanout = (engine === 'chatgpt' || engine === 'ai_mode') ? fan : [];
  return { named, position, cited, retrieved, fanout, rivalsNamed, citedUs: cited.some(c => c.host === A.domain) };
}

function make(opts) {
  const o = opts || {}; const seed = String(o.seed == null ? 'air-w0' : o.seed);
  const nowMs = typeof o.now === 'number' ? o.now : Date.parse(o.now || '2026-11-02T10:00:00.000Z'); const now = new Date(nowMs).toISOString();
  const weeks = Math.max(2, Math.min(20, Number(o.weeks) || 10)); const modes = o.modes || { nova: '', acme: 'off' };
  const R = rngOf(seed); const iso = (ms) => new Date(ms).toISOString(); const ago = (d) => iso(nowMs - d * DAY);
  const { nova, acme } = archetypes(); const ALL = [nova, acme];
  const T = { seo_sites: [], seo_monitors: [], seo_profiles: [], seo_ladders: [], seo_ai_prompts: [], seo_ai_answers: [], seo_ai_visibility: [], seo_ai_daily: [], seo_cache: [],
    seo_index_pages: [], seo_listings: [], seo_link_outreach: [], seo_link_prospects: [], seo_content_log: [], seo_ai_targets: [], seo_ai_pages: [], seo_query_history: [], seo_ai_growth: [], seo_cycles: [] };
  const pages = {}; const robots = {}; const robots_history = {}; const bing = { sites: [], crawled: {} };
  for (const A of ALL) {
    const W = 'https://' + A.domain; const sid = A.site_id; const mode = A === nova ? modes.nova : modes.acme;
    T.seo_sites.push({ site_id: sid, domain: A.domain, gsc_property: 'sc-domain:' + A.domain, ga4_property_id: '', country: A.country, location_code: A.location_code, language_code: 'en', email: '', callback_url: 'https://hooks.example/air/' + sid,
      keywords: A.ladders.map(l => l[0]).join(', '), status: 'active', source: 'track', created_at: ago(120), last_run_at: ago(7), last_status: 'ok', request_id: '', canonical_host: A.domain, business_name: A.name, logo_url: '', nap_json: '',
      services_json: JSON.stringify(A === nova ? ['Custom software development', 'AI development', 'Mobile apps'] : ['ERP implementation', 'Odoo partner', 'ERP for manufacturing']), nav_pages_json: '', business_facts: A.name + ' is a synthetic test business.',
      cta: '', brand_names: A.name, competitors: A.rivals.map(r => r[0]).join(', '), accreditation: '', model_updated_at: ago(30), content_groups_json: '', declared_services: '', fact_answers_json: '' });
    T.seo_monitors.push({ site_id: sid, domain: A.domain, ai_visibility: true, ai_engines: '', ai_prompts_max: 20, backlinks: true, audit_monthly: true, audit_pages: 200, audit_js: false, competitors: A.rivals.map(r => r[0]).join(', '),
      brand_names: A.name, updated_at: ago(30), request_id: '', ai_pulse: true, ai_growth: true, ai_pages_month: null, link_builder: true, stuck_weeks: null, ai_personas: '', ai_markets: '', ai_pulse_mode: '', ai_pulse_per_week: null,
      ai_alert_rules_json: '', ai_sov_set: '', ai_claude_weekly: false, ai_pulse_engines: '', ai_persona_context: false, ai_fanout_check: null, ai_demand_market: false, ai_pulse_scope: 'all', ai_focus_mode: '',
      index_watch: null, index_daily_cap: null, index_sitemap_submit: null,
      ai_rank_mode: mode === '' || mode == null ? null : mode, ai_rank_reserve: null, ai_rank_fanout_n: null, ai_rank_mentions: null, ai_rank_brave: null });
    T.seo_profiles.push({ site_id: sid, domain: A.domain, business_name: A.name, business_type: 'Organization', country_code: A.profile_cc, city: A === nova ? 'Dubai' : 'Riyadh', service_areas: A === nova ? 'Dubai, Abu Dhabi' : 'Riyadh, Jeddah', author_name: 'Test Author' });
    A.ladders.forEach(([kw, by], i) => T.seo_ladders.push({ ladder_id: 'lad_' + sid.slice(5, 12) + '_' + i, domain: A.domain, head_keyword: kw, rung: 1, page_no: 1, keyword: kw, supporting: '', page_type: 'Service Page',
      target_url: A === acme && i === 1 ? W + A.cited_page : W + A.pages[Math.min(i + 1, A.pages.length - 1)], page_exists: true, status: 'active', months: 6, start_date: ago(90).slice(0, 10), country: A.country, location_code: A.location_code,
      language_code: 'en', email: '', callback_url: '', request_id: '', target_words: 1500, status_note: '', chosen_by: by }));
    // the questions
    for (const q of A.questions) { const [pid, prompt, kind, keyword, stage, cluster, volume, market] = q;
      const win = A.winning === pid;
      T.seo_ai_prompts.push({ prompt_id: pid, site_id: sid, domain: A.domain, prompt, kind, topic: cluster, keyword, source: kind === 'brand' ? 'brand' : 'writer', status: 'active', created_at: ago(80),
        stage, cluster, volume: volume || null, origin: 'writer', updated_at: ago(7), persona: '', market, pinned: false, fit_note: '', keyword_source: 'writer',
        last_asked_run: 'ai_w' + (weeks - 1), last_asked_at: ago(7), asked_n_28d: 4, refused_at_run: '', focus_topic: win ? '' : cluster, focus_source: win ? '' : 'service', focus_state: win ? 'watch' : 'active',
        focus_seen_at: win ? ago(60) : ago(7), retired_at: '', retire_reason: '', core_until: null }); }
    // the answers, weekly for `weeks` weeks on 7 engines (+ two gemini_api rows a week, which AIR must ignore)
    for (let w = 0; w < weeks; w++) {
      const atMs = nowMs - (weeks - 1 - w) * 7 * DAY - 3600e3; const at = iso(atMs); const run_id = 'ai_' + sid.slice(5, 9) + '_w' + w; const units = [];
      for (const q of A.questions) { const [pid, prompt, kind, , , cluster] = q;
        for (const e of [...ENGINES, ...(kind !== 'brand' && q === A.questions[0] ? ['gemini_api'] : [])]) {
          if (e === 'claude' && w % 4 !== 0) continue;   // Claude monthly (the default)
          const b = behave(A, q, e, w, R);
          const ents = [...(b.named ? [{ id: A.domain, name: A.name, role: 'self', position: b.position, cited: b.citedUs }] : []), ...b.rivalsNamed];
          T.seo_ai_answers.push({ site_id: sid, domain: A.domain, run_id, checked_at: at, prompt_id: pid, prompt, kind, topic: cluster, engine: e, answered: true, mentioned: b.named || b.citedUs, cited: b.citedUs,
            rank: b.position, our_urls: b.cited.filter(c => c.host === A.domain).map(c => c.url).join(', '), competitors: b.rivalsNamed.map(r => r.id).join(', '), sources: [...new Set(b.cited.map(c => c.host))].join(', '),
            excerpt: '', cost: 0.004, error: '', run_kind: 'weekly', sentiment: b.named ? 'neutral' : '', brands: ents.map(x => x.name).join(', '), issues: '', fanout: b.fanout.join(' | '),
            cited_urls: JSON.stringify(b.cited.filter(c => c.host !== A.domain).slice(0, 8).map(c => ({ u: c.url, t: '' }))), named: b.named, position: b.position, entities_json: JSON.stringify(ents),
            answer_text: 'Synthetic answer for "' + prompt + '" on ' + e + (b.named ? ', naming ' + A.name : '') + '.',
            cited_json: JSON.stringify(b.cited.map((c, i) => ({ url: c.url, host: c.host, entity_id: c.host, role: c.host === A.domain ? 'self' : 'source', position: i + 1 }))),
            retrieved_json: e === 'chatgpt' ? JSON.stringify(b.retrieved.map(c => ({ url: c.url, host: c.host, entity_id: c.host }))) : '', fanout_json: b.fanout.length ? JSON.stringify(b.fanout) : '',
            products_json: '', ads_json: '', local_json: '', model: e, detail_json: JSON.stringify({ v: 1, answer_len: 80 }) });
          if (e !== 'gemini_api') units.push({ prompt_id: pid, engine: e, named: b.named, cited: b.citedUs, position: b.position, rivals: b.rivalsNamed.map(r => ({ id: r.id, position: r.position, cited: r.cited })) });
        } }
      // the weekly row's per-answer record, in AVX.packUnits' format
      const qs = [], es = [], ents = []; const ix = (arr, v) => { let i = arr.indexOf(v); if (i < 0) { arr.push(v); i = arr.length - 1; } return i; };
      const a = units.map(u => [ix(qs, u.prompt_id), ix(es, u.engine), u.named ? 1 : 0, u.cited ? 1 : 0, u.position || null, u.rivals.map(x => [ix(ents, x.id), x.position || null, x.cited ? 1 : 0])]);
      const named = units.filter(u => u.named).length;
      T.seo_ai_visibility.push({ site_id: sid, domain: A.domain, run_id, checked_at: at, prompts: A.questions.length, answers: units.length, mention_rate: +(named / units.length).toFixed(4), named_rate: +(named / units.length).toFixed(4),
        citation_rate: +(units.filter(u => u.cited).length / units.length).toFixed(4), run_kind: 'weekly', rule_version: AIV_RULE, units_json: JSON.stringify({ v: 1, rule_version: AIV_RULE, at, q: qs, e: es, ents, a }),
        panel_json: JSON.stringify({ ids: A.questions.map(q => q[0]), engines: ENGINES }), gaps_json: '[]', pages_json: '[]', competitors_json: '[]', access_json: '', demand_json: '', cost_usd: 0.3 });
    }
    // pulse mornings of the last 28 days (not Mondays): ChatGPT, Gemini, AI Mode on the whole panel, in Pulse Metrics' detail_json format
    for (let d = 1; d <= 28; d++) { const ms = nowMs - d * DAY; const dt = new Date(ms); if (dt.getUTCDay() === 1) continue;
      const ents = []; const ix = (v) => { let i = ents.indexOf(v); if (i < 0) { ents.push(v); i = ents.length - 1; } return i; }; const a = [];
      for (const q of A.questions) { if (q[2] === 'brand') continue; for (const e of ['chatgpt', 'gemini', 'ai_mode']) { const b = behave(A, q, e, weeks, R); a.push([q[0], e, b.named ? 1 : 0, b.citedUs ? 1 : 0, b.position || null, b.rivalsNamed.map(x => [ix(x.id), x.position, x.cited ? 1 : 0])]); } }
      const named = a.filter(x => x[2]).length;
      T.seo_ai_daily.push({ site_id: sid, domain: A.domain, date: iso(ms).slice(0, 10), checked_at: iso(ms - 3 * 3600e3), run_id: 'pulse_' + sid.slice(5, 9) + '_' + d, samples: a.length, mentioned: named, cited: a.filter(x => x[3]).length,
        mention_rate: +(named / a.length).toFixed(4), rule_version: AIV_RULE, sample_mode: 'full', questions_asked: A.questions.length - 1, engines_answered: 'chatgpt, gemini, ai_mode', partial: false,
        detail_json: JSON.stringify({ v: 1, rule_version: AIV_RULE, ents, a }) }); }
    // Google results pages for the searches the engines run (seo_cache serp:*; site_id '' as production writes them, F-85)
    for (const q of A.questions) { if (q[2] === 'brand') continue; const kw = q[3];
      const items = []; for (let p = 1; p <= 50; p++) items.push({ type: 'organic', rank_group: p, rank_absolute: p, url: 'https://result' + p + '.example/' + kw.replace(/\s+/g, '-'), domain: 'result' + p + '.example', title: kw + ' result ' + p });
      if (A === acme) { const p = 20 + Math.floor(R() * 30); items[p - 1] = { type: 'organic', rank_group: p, rank_absolute: p, url: 'https://' + A.domain + (q[2] === 'learn' ? A.cited_page : '/services/odoo-partner-riyadh'), domain: A.domain, title: q[1] }; }
      const at = ago(3 + Math.floor(R() * 10)); const r = { v: 1, keyword: kw, location_code: A.location_code, language_code: 'en', device: 'desktop', day: at.slice(0, 10), at, datetime: at, task_id: 'fx-' + fnv(kw).toString(16), cost: 0.002, depth: 50,
        aio_loaded: false, empty: false, se_results_count: 100000, item_types: ['organic'], ai_overview_seen: false, path: 'fixture', items };
      T.seo_cache.push({ key: 'serp:' + [kw, A.location_code, 'en', 'desktop'].join('|'), kind: 'serp', site_id: '', value: JSON.stringify(r), updated_at: at }); }
    // Google's index (Index Coverage rows) and the site's own pages
    for (const p of A.pages) { const url = W + p; const ok = A.indexed.includes(p);
      T.seo_index_pages.push({ site_id: sid, domain: A.domain, url, lane: 'old', sources: 'sitemap', in_sitemap: true, sitemap_lastmod: ago(40).slice(0, 10), first_seen_at: ago(100), published_at: '', impressions_28d: ok ? 40 : 0, clicks_28d: ok ? 2 : 0,
        last_impression_at: ok ? ago(2) : '', state: ok ? 'indexed' : 'not_indexed', evidence: '', cause: ok ? 'indexed' : 'crawled_not_indexed', action: ok ? '' : 'improve', verdict: ok ? 'PASS' : 'NEUTRAL',
        coverage: ok ? 'Submitted and indexed' : 'Crawled - currently not indexed', indexing_state: 'INDEXING_ALLOWED', robots_state: 'ALLOWED', page_fetch_state: 'SUCCESSFUL', crawled_as: 'MOBILE', google_canonical: ok ? url : '', user_canonical: url,
        last_crawl: ago(9), referring_count: 0, google_sitemaps: 1 });
      const words = A === nova && p !== '/' ? 40 : 900;   // nova's service pages are rendered by JavaScript: little text in the raw HTML
      const isCited = A === acme && (p === A.cited_page || p === '/guides/what-is-erp');
      T.seo_ai_pages.push({ site_id: sid, domain: A.domain, url, kind: isCited ? 'cited' : p === '/' ? 'home' : 'content', checked_at: ago(35), status: 200, score: words > 100 ? 72 : 30, checks_json: '[]', issues: words > 100 ? '' : 'little text without JavaScript',
        words_raw: words, title: p === '/' ? A.name : p.split('/').pop().replace(/-/g, ' '), updated_on: ago(isCited ? 20 : 200).slice(0, 10), bing_crawled_at: A.bing_in_account ? ago(12) : '', bing_status: A.bing_in_account ? 200 : 0,
        submitted_at: A.bing_in_account ? ago(30) : '', submitted_via: A.bing_in_account ? 'bing' : '', cited_by: isCited ? 'ai_overview, ai_mode' : '', questions: isCited ? (p === A.cited_page ? 'aq2' : 'aq3') : '' });
      pages[url] = { status: 200, html: '<!doctype html><html><head><title>' + A.name + ' ' + p + '</title></head><body><main><h1>' + A.name + '</h1><p>' + 'Synthetic page text. '.repeat(Math.max(2, Math.round(words / 3))) + '</p></main></body></html>' };
      if (A.bing_in_account) bing.crawled[url] = ago(12); }
    if (A.bing_in_account) bing.sites.push(W + '/');
    // robots.txt: nova blocked the AI search bots until week 2, open since; acme always open
    const open = 'User-agent: *\nAllow: /\n'; const blocked = 'User-agent: GPTBot\nDisallow: /\nUser-agent: OAI-SearchBot\nDisallow: /\nUser-agent: PerplexityBot\nDisallow: /\nUser-agent: *\nAllow: /\n';
    robots[A.domain] = open; robots_history[A.domain] = A === nova ? [{ from: ago((weeks - 1) * 7), text: blocked }, { from: ago((weeks - 2) * 7), text: open }] : [{ from: ago(weeks * 7), text: open }];
    // the third-party pages the answers cite, as fetched (names the client / rivals, a contact), one forbidden page (403)
    for (const [k, u] of Object.entries(A.sources)) { const names = A.rivals.map(r => r[1]).join(', ');
      pages[u] = k === 'forbidden' ? { status: 403, html: '<html><body>Forbidden</body></html>' } : { status: 200, html: '<html><head><title>' + (k === 'listicle' || k === 'listicle2' || k === 'rival_list' ? 'Top 10 ' : '') + host(u) + '</title></head><body><h1>' + k + '</h1><p>Providers: ' + names + '.</p>' + (k === 'listicle' ? '<a href="mailto:editor@' + host(u) + '">Write to the editor</a>' : '') + '</body></html>' }; }
    // listings, outreach and prospects
    T.seo_listings.push({ site_id: sid, domain: A.domain, listing_id: 'clutch', name: 'Clutch', category: 'directory', status: A === nova ? 'missing' : 'listed', profile_url: A === acme ? 'https://clutch.co/profile/acme-erp-example' : '', rel: '', competitors: A.rivals[0][0],
      submit_url: 'https://clutch.co/get-listed', priority: 1, why: 'cited in AI answers for this market', checked_at: ago(7), submitted_at: '', note: '' });
    T.seo_link_prospects.push({ site_id: sid, domain: A.domain, prospect_domain: host(A.sources.listicle), type: 'ai_source', rank: 0, spam_score: 0, detail: 'cited by AI answers', source_url: A.sources.listicle, target_url: W + '/', status: 'new',
      first_seen: ago(21), last_seen: ago(7), won_at: '', outreach_subject: '', outreach_body: '', note: '', score: 40, origin: 'ai_growth', contact_email: 'editor@' + host(A.sources.listicle), contact_url: '', contacted_at: '', followup_step: 0,
      followup_subject: '', followup_body: '', verified_at: '', drafted_at: '' });
    T.seo_link_outreach.push({ site_id: sid, domain: A.domain, prospect_domain: host(A.sources.listicle), type: 'ai_source', status: 'drafted', score: 40, fit: 'ok', fit_reason: '', checks_json: '{}', page_url: A.sources.listicle, page_title: 'Top 10',
      evidence: '', contacts_json: '[]', contact_email: 'editor@' + host(A.sources.listicle), contact_form_url: '', country: A.cc, language: 'en', target_url: W + '/', target_reason: '', anchor_hint: A.name, sequence_json: '[]', deadline: '', drafted_at: ago(7), checked_at: ago(7), request_id: '' });
    // what the site published and what AI Growth queued before AIR (the old logic)
    T.seo_content_log.push({ site_id: sid, domain: A.domain, keyword: A.ladders[0][0], source: 'ladder', page_type: 'Service Page', existing_page_url: '', rung: 1, ladder_id: 'lad_' + sid.slice(5, 12) + '_0', request_id: 'cad_fx_' + sid.slice(5, 9),
      started_at: ago(30), status: 'published', published_url: W + A.pages[1], published_at: ago(25), week: '', qa_reasons: '', publish_note: '' });
    const q0 = A.questions.find(q => q[2] === 'recommend');
    T.seo_ai_targets.push({ target_id: 'ait_' + sid.replace(/^site_/, '') + '_' + q0[0], site_id: sid, domain: A.domain, prompt_id: q0[0], question: q0[1], keyword: q0[3], kind: 'answer', page_url: '', page_type: 'Guide', fanout: q0[3],
      sources_json: '[]', competitors: A.rivals.map(r => r[0]).join(', '), engines: 'chatgpt', stage: q0[4], value: 1.2, status: 'queued', reason: 'not named in AI answers', created_at: ago(14), updated_at: ago(7), request_id: '',
      written_at: '', won_at: '', origin: null, action_id: null, live_at: null });
    for (const q of A.questions) { if (q[2] === 'brand') continue;
      T.seo_query_history.push({ site_id: sid, domain: A.domain, period_end: ago(2).slice(0, 10), checked_at: ago(2), query: q[3], clicks: A === acme ? 3 : 0, impressions: A === acme ? 120 : 4, ctr: 0, position: A === acme ? 24 : 61,
        prev_clicks: 0, prev_impressions: 0, prev_position: 0, page: W + (A === acme && q[2] === 'learn' ? A.cited_page : '/'), tracked: false, serp_position: null }); }
    T.seo_cycles.push({ site_id: sid, domain: A.domain, anchor_at: ago(56), tz: A === nova ? 'Asia/Dubai' : 'Asia/Riyadh', cycle_weekday: 1, local_time: '06:00', monthly_day: 1, next_due_at: iso(nowMs + 7 * DAY), next_preview_at: '', current_key: '',
      status: 'active', skip_jobs: '', last_cycle_at: ago(7), last_monthly_key: '', adopted: true, updated_at: ago(7) });
  }
  const sites = ALL.map(A => ({ site_id: A.site_id, domain: A.domain, name: A.name, cc: A.cc, location_code: A.location_code }));
  const out = { seed, now, nowMs, sites, tables: T, pages, robots, robots_history, bing, archetypes: archetypes(), AIV_RULE };
  if (o.diag_cases) out.diag_cases = diagCases({ seed: o.diag_cases === true ? 'air-p1-diag' : String(o.diag_cases), now: nowMs });   // P1: labelled stage cells (absent by default)
  return out;
}

// ---- P1 (AIR diagnosis, 2026-11-06): labelled question x engine cells for the stage classifier (harness AD6 / AD13) ----
// make({ diag_cases: true | '<seed>' }) adds `diag_cases`: [{ id, engine, label: { stage, sub, basis }, why, args }], `args` being ARD.diagnose's
// input. Each case is one situation a careful reader of the raw data would label without doubt (DESIGN.md 2.B), wrapped in noise the
// classifier must see through: other engines' answers, another question's answers that name the client, gemini_api rows that name it, answers
// older than the window, the client's host written with www or as a brand alias, a look-alike host, citations of unrelated pages, a Google
// reading for an unrelated search where the client ranks first. Seeded: same seed, same cases. Synthetic hosts only.
function diagCases(opts) {
  const o = opts || {}; const R = rngOf(String(o.seed || 'air-p1-diag')); const nowMs = typeof o.now === 'number' ? o.now : Date.parse('2026-11-02T10:00:00.000Z');
  const iso = (ms) => new Date(ms).toISOString(); const int = (a, b) => a + Math.floor(R() * (b - a + 1)); const pick = (a) => a[Math.floor(R() * a.length)];
  const DOM = 'case-co.example', ALIAS = 'casebrand.example', LOOK = 'notcase-co.example'; const site = { site_id: 'site_case-co-example', domain: DOM, canonical_host: 'www.' + DOM };
  const RIV = ['rival-a.example', 'rival-b.example', 'rival-c.example'];
  const THIRD = ['https://top-picks.example/best-erp-partners-uae', 'https://clutch.co/ae/it-services/erp', 'https://vendor-x.example/services/erp', 'https://news-daily.example/news/erp-market-2026', 'https://www.g2.com/categories/erp-systems'];
  const BOT = { chatgpt: 'OAI-SearchBot', chatgpt_api: 'OAI-SearchBot', perplexity: 'PerplexityBot', claude: 'Claude-SearchBot', ai_overview: 'Googlebot', ai_mode: 'Googlebot', gemini: 'Googlebot', copilot: 'Bingbot' };
  const ALL = ['chatgpt', 'gemini', 'ai_mode', 'ai_overview', 'perplexity', 'claude', 'copilot', 'chatgpt_api'];
  const cases = []; let k = 0;
  const ourUrl = (path, how) => 'https://' + (how === 'www' ? 'www.' + DOM : how === 'alias' ? ALIAS : DOM) + path;
  // spec: { kind, n, named, cited, retrieved, hasRetr, positions:[a,b], neg, wrong, nobody, robots, page, google, bing, serp, bingPos, brave, how, thin, old, intentRivals }
  const make1 = (engine, label, why, sp) => {
    const id = 'dc' + String(++k).padStart(3, '0'); const pid = 'p_' + id; const kw = sp.keyword || pick(['erp implementation partner', 'odoo consultants', 'erp software for retail', 'cloud erp migration', 'erp support services']);
    const fan = [kw + ' 2026', 'best ' + kw]; const queries = [kw, ...fan]; const how = sp.how || pick(['bare', 'www', 'bare']);
    const prompt = { prompt_id: pid, site_id: site.site_id, domain: DOM, prompt: sp.kind === 'learn' ? 'What should I know about ' + kw + '?' : 'Who are the best ' + kw + ' providers?', kind: sp.kind || 'recommend', keyword: kw, status: 'active', market: 'AE-en' };
    const rows = [], units = []; let seq = 0;
    const rivalsP = sp.nobody || sp.kind === 'learn' ? 0 : 0.9;   // an informational answer names no other business
    const answer = (e, daysAgo, f) => { const at = iso(nowMs - daysAgo * DAY - (seq++ % 50) * 60e3); const rivals = RIV.filter(() => R() < rivalsP).map((id2, i) => ({ id: id2, position: i + (f.named ? 2 : 1), cited: false }));
      const third = THIRD.filter(() => R() < 0.4).map(u => ({ url: u, host: u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, ''), role: 'source' }));
      const ownC = f.cited ? [{ url: ourUrl('/services/erp-partner', f.how || how), host: (f.how || how) === 'alias' ? ALIAS : DOM, role: 'self' }] : [];
      const cited = [...ownC, ...third].map((c, i) => ({ ...c, entity_id: c.host, position: i + 1 }));
      const retr = e === 'chatgpt' && f.hasRetr !== false ? [{ url: 'https://' + LOOK + '/erp', host: LOOK, entity_id: LOOK }, ...(f.retrieved ? [{ url: ourUrl('/services/erp-partner', f.how || how), host: (f.how || how) === 'alias' ? ALIAS : DOM, entity_id: DOM }] : [])] : null;
      const ents = [...(f.named ? [{ id: DOM, name: 'Case Co', role: 'self', position: f.position || 1, cited: !!f.cited }] : []), ...rivals.map(r => ({ id: r.id, name: r.id, role: 'competitor', position: r.position, cited: false }))];
      const row = { site_id: site.site_id, domain: DOM, run_id: 'run_' + id + '_' + seq, checked_at: at, prompt_id: f.pid || pid, prompt: prompt.prompt, kind: prompt.kind, engine: e, answered: true, error: '', named: !!f.named, position: f.named ? (f.position || 1) : null,
        cited: !!f.cited, mentioned: !!(f.named || f.cited), our_urls: ownC.map(c => c.url).join(', '), sentiment: f.named ? (f.neg ? 'negative' : 'neutral') : '', issues: f.wrong ? 'says you were founded in 1990 -> founded in 2015' : '',
        cited_json: JSON.stringify(cited), retrieved_json: retr ? JSON.stringify(retr) : '', fanout_json: (e === 'chatgpt' || e === 'ai_mode') && !f.param ? JSON.stringify(fan) : (f.param ? '[]' : ''), entities_json: JSON.stringify(ents) };
      if (f.param) row.cited_json = '[]';
      if (daysAgo <= 7.9) rows.push(row);
      units.push({ prompt_id: f.pid || pid, engine: e, named: !!f.named, cited: !!f.cited, position: f.named ? (f.position || 1) : null, rivals, answered: true, at }); };
    // the engine under test: `n` answers in its window, the signal ones in the last 8 days
    const thin = engine === 'claude'; const span = thin ? 50 : 26; const n = sp.n;
    const sig = []; for (let i = 0; i < n; i++) sig.push({});
    let j = 0; const mark = (cnt, fn) => { for (let i = 0; i < cnt && j < n; i++, j++) fn(sig[j]); };
    const named = sp.named || 0; const pos = sp.positions || [1, 3];
    mark(named, (f) => { f.named = true; f.position = int(pos[0], pos[1]); });
    for (let i = 0; i < Math.min(sp.neg || 0, named); i++) sig[i].neg = true;
    for (let i = 0; i < Math.min(sp.wrong || 0, n); i++) sig[i].wrong = true;
    for (let i = 0; i < Math.min(sp.cited || 0, n); i++) sig[n - 1 - i].cited = true;
    for (let i = 0; i < Math.min(sp.retrieved || 0, n); i++) sig[i].retrieved = true;
    sig.forEach((f, i) => { f.hasRetr = sp.hasRetr; f.how = sp.how; f.param = !!sp.param; const signal = f.named || f.cited || f.retrieved || f.neg || f.wrong || sp.param;
      answer(engine, thin ? (i === 0 ? 2 : 5 + i * 14) : signal ? 0.3 + R() * 7 : 0.3 + R() * span, f); });
    // noise: other engines, another question naming the client, gemini_api naming the client, old answers outside the window
    const noiseNamed = sp.kind === 'learn' ? 0 : 0.3;   // the searches the engines ran come from ChatGPT's and AI Mode's answers: at least one of each
    for (const e of ALL.filter(x => x !== engine && x !== 'chatgpt_api')) for (let i = 0, m = (e === 'chatgpt' || e === 'ai_mode') ? int(1, 3) : int(0, 3); i < m; i++) answer(e, 0.3 + R() * 7, { named: R() < noiseNamed, cited: R() < 0.2, position: int(1, 6) });
    for (let i = 0; i < 3; i++) answer(engine, 0.5 + R() * 6, { pid: 'p_other', named: true, cited: true, retrieved: true, position: 1 });
    for (let i = 0; i < 3; i++) answer('gemini_api', 0.5 + R() * 6, { named: true, cited: true, position: 1 });
    if (!thin && sp.old !== false) for (let i = 0; i < 4; i++) answer(engine, 35 + R() * 20, { named: true, cited: true, retrieved: true, position: 1 });
    // what the engine's index shows
    const pages = [{ site_id: site.site_id, url: ourUrl('/services/erp-partner', 'www'), title: 'ERP partner services', words_raw: 900, issues: '', questions: '', submitted_at: '', bing_crawled_at: '', checked_at: iso(nowMs - 9 * DAY) },
      { site_id: site.site_id, url: ourUrl('/', 'bare'), title: 'Case Co', words_raw: 700, issues: '', questions: '', checked_at: iso(nowMs - 9 * DAY) }];
    if (sp.page) pages.unshift({ site_id: site.site_id, url: ourUrl('/solutions/' + kw.replace(/\s+/g, '-'), 'bare'), title: kw, words_raw: 900, issues: '', questions: pid, submitted_at: '', bing_crawled_at: '', checked_at: iso(nowMs - 9 * DAY), ...sp.page });
    const google = new Map(sp.google || pages.map(g => [g.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''), g.state || 'indexed']));
    const serp = new Map(); serp.set('erp news today', { results: [{ url: ourUrl('/', 'bare'), pos: 1 }], read_at: iso(nowMs - 3 * DAY), location_code: 2784 });
    for (const [q, p] of Object.entries(sp.serp || {})) { const qq = q === 'K' ? kw : q === 'F' ? fan[0] : q === 'B' ? fan[1] : q; const res = []; for (let i = 1; i <= 50; i++) res.push({ url: 'https://result' + i + '.example/x', pos: i });
      if (p) res[p - 1] = { url: ourUrl('/services/erp-partner', how === 'alias' ? 'www' : how), pos: p }; serp.set(qq, { results: res, read_at: iso(nowMs - int(2, 40) * DAY), location_code: 2784 }); }
    const robots = {}; for (const b of ['OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Claude-SearchBot', 'Googlebot', 'Bingbot', 'Google-Extended']) robots[b] = { allowed_root: true, rule: '' };
    for (const [b, v] of Object.entries(sp.robots || {})) robots[b] = { allowed_root: v, rule: v ? '' : 'Disallow: /' };
    const bingPos = sp.bingPos ? { [fan[0]]: sp.bingPos } : null; const brave = sp.brave ? new Map([[fan[1], [{ url: 'https://other.example/', pos: 1 }, { url: ourUrl('/services/erp-partner', how === 'alias' ? 'bare' : how), pos: sp.brave }]]]) : null;
    const args = { site, prompt, answers8: rows, units60: units, evidence: '', access: { robots, blocked_engines: [], read_at: iso(nowMs - DAY) }, pages,
      index: { google, bing: { in_account: sp.bing ? sp.bing.in_account : null, crawled: new Map(sp.bing && sp.bing.crawled ? sp.bing.crawled : []) }, brave, cc_captures: null }, serp,
      bingStats: bingPos ? { read_at: iso(nowMs - 2 * DAY), positions: bingPos, pages: {}, crawl_issues: [] } : null, brave: null, brandKnown: {}, ourHosts: [DOM, ALIAS], rivals: RIV.slice(), engines: ALL, now: nowMs, cfg: {} };
    cases.push({ id, engine, label, why, args }); };
  const L = (stage, sub, basis) => ({ stage, sub: sub || '', basis });
  const times = (m, fn) => { for (let v = 0; v < m; v++) fn(v); };
  const G3 = ['ai_overview', 'ai_mode', 'gemini'];
  // S0 blocked (robots.txt read and blocking the engine's search bot)
  for (const [e, bot] of [['chatgpt', 'OAI-SearchBot'], ['perplexity', 'PerplexityBot'], ['ai_overview', 'Googlebot'], ['ai_mode', 'Googlebot'], ['copilot', 'Bingbot'], ['claude', 'Claude-SearchBot'], ['gemini', 'Google-Extended'], ['chatgpt_api', 'OAI-SearchBot']])
    times(2, (v) => make1(e, L('S0', 'blocked', 'direct'), 'robots.txt blocks ' + bot, { n: e === 'claude' ? 2 : int(4, 9), named: v, robots: { [bot]: false }, serp: { F: int(12, 30) } }));
  // S0 js_only (raw HTML almost empty, the rendered page holds the text) for the fetchers that do not render
  for (const e of ['chatgpt', 'perplexity', 'claude', 'chatgpt_api']) times(3, (v) => { const raw = int(10, 120);
    make1(e, L('S0', 'js_only', 'direct'), 'the page for this question has ' + raw + ' words without JavaScript', { n: e === 'claude' ? 2 : int(4, 9), page: v % 2 ? { words_raw: raw, words_rendered: raw * int(4, 12) } : { words_raw: raw, issues: 'little text without JavaScript' }, serp: { K: int(15, 40) } }); });
  // S0 not_indexed: Google (the mapped page, or no page of the site at all) and Bing (not in the account, or submitted and not crawled after 14 days)
  for (const e of G3) times(3, (v) => { if (v < 2) make1(e, L('S0', 'not_indexed', 'direct'), 'the page for this question is not in Google', { n: int(4, 9), page: { words_raw: 800, state: 'not_indexed' }, serp: { F: 0 } });
    else make1(e, L('S0', 'not_indexed', 'direct'), 'no page of the site is in Google', { n: int(4, 9), google: [[DOM, 'not_indexed'], [DOM + '/services/erp-partner', 'excluded']], serp: { K: 0 } }); });
  times(3, () => make1('copilot', L('S0', 'not_indexed', 'direct'), 'the site is not in the Bing Webmaster account', { n: int(4, 8), bing: { in_account: false } }));
  times(2, () => make1('copilot', L('S0', 'not_indexed', 'direct'), 'submitted to Bing 20 days ago, never crawled', { n: int(4, 8), bing: { in_account: true }, page: { words_raw: 800, submitted_at: iso(nowMs - 20 * DAY) } }));
  // S1: eligible, not retrieved (direct for ChatGPT's own readings, proxy from a results page, unknown when nothing can be read)
  times(4, () => make1('chatgpt', L('S1', '', 'direct'), 'ChatGPT read other pages (a look-alike host among them), not yours', { n: int(4, 10), hasRetr: true }));
  for (const e of [...G3, 'perplexity']) times(2, () => make1(e, L('S1', '', 'proxy_rank'), 'ranks below 10 for the searches the engines run', { n: int(4, 9), serp: { [pick(['K', 'F', 'B'])]: int(11, 30) } }));
  for (const e of G3) make1(e, L('S1', '', 'proxy_rank'), 'not in the results read, page indexed', { n: int(4, 9), serp: { K: 0 } });
  times(2, () => make1('claude', L('S1', '', 'unknown_index'), 'no Brave reading', { n: int(2, 3) }));
  times(2, () => make1('copilot', L('S1', '', 'unknown_index'), 'in Bing, crawled, no query positions', { n: int(4, 8), bing: { in_account: true, crawled: [[DOM + '/services/erp-partner', iso(nowMs - 5 * DAY)]] } }));
  times(2, () => make1('chatgpt', L('S1', '', 'unknown_index'), 'no retrieval reading', { n: int(4, 8), hasRetr: false }));
  times(2, () => make1('chatgpt_api', L('S1', '', 'unknown_index'), 'the API route shows no retrieval', { n: int(4, 8) }));
  for (const e of G3) make1(e, L('S1', '', 'unknown_index'), 'no Google reading for these searches, index unknown', { n: int(4, 9), google: [] });
  times(2, () => make1('ai_mode', L('S1', '', 'proxy_rank'), 'JavaScript page, but Google renders it', { n: int(4, 9), page: { words_raw: 40, issues: 'little text without JavaScript' }, serp: { F: int(12, 40) } }));
  times(2, () => make1('copilot', L('S1', '', 'unknown_index'), 'Bing account state not read', { n: int(4, 8), bing: null }));
  // S2: retrieved (ChatGPT direct, with www or the brand alias), or ranking in the top 10 of the engine's index (proxy)
  times(4, (v) => make1('chatgpt', L('S2', '', 'direct'), 'ChatGPT read your page', { n: int(4, 10), retrieved: int(1, 3), how: ['www', 'alias', 'bare', 'www'][v] }));
  for (const e of [...G3, 'perplexity']) times(2, () => make1(e, L('S2', '', 'proxy_rank'), 'ranks in the top 10 for a search the engines run', { n: int(4, 9), serp: { [pick(['K', 'F', 'B'])]: int(1, 10) } }));
  times(2, () => make1('copilot', L('S2', '', 'proxy_rank'), 'Bing position for a fan-out query', { n: int(4, 8), bing: { in_account: true }, bingPos: int(1, 9) }));
  times(2, () => make1('claude', L('S2', '', 'proxy_rank'), 'Brave position for a fan-out query', { n: int(2, 3), brave: int(2, 9) }));
  for (const e of G3) make1(e, L('S2', '', 'proxy_rank'), 'Index Coverage says not indexed, but it ranks: the ranking wins', { n: int(4, 9), page: { words_raw: 800, state: 'not_indexed' }, serp: { F: int(3, 9) } });
  times(2, () => make1('chatgpt', L('S2', '', 'direct'), 'JavaScript page, but ChatGPT read it', { n: int(4, 9), retrieved: 2, page: { words_raw: 40, issues: 'little text without JavaScript' } }));
  // S3: cited, never named (a recommendation question)
  for (const e of ['chatgpt', 'perplexity', 'ai_overview', 'ai_mode', 'gemini', 'copilot']) times(2, (v) => { const n = int(5, 10); make1(e, L('S3', '', 'direct'), 'your page is cited, you are never named', { n, cited: int(1, n - 1), how: v ? 'alias' : 'www' }); });
  // S4: named but weak, low in the list, negative, or wrong
  for (const e of ['chatgpt', 'ai_mode', 'perplexity', 'gemini']) times(2, (v) => { const n = int(8, 12); make1(e, L('S4', 'weak', 'direct'), 'named rarely', { n, named: v ? 1 : 2, cited: int(0, 2) }); });
  for (const e of ['chatgpt', 'ai_mode', 'ai_overview']) times(2, () => { const n = int(6, 10); make1(e, L('S4', 'low_position', 'direct'), 'named often, but low in the list', { n, named: int(Math.ceil(0.35 * n), n), positions: [4, 8] }); });
  for (const e of ['chatgpt', 'perplexity', 'gemini']) times(2, () => { const n = int(6, 10); const nm = int(Math.ceil(0.4 * n), n); make1(e, L('S4', 'negative', 'direct'), 'named often, spoken of negatively', { n, named: nm, neg: Math.ceil(0.5 * nm) }); });
  for (const e of ['chatgpt', 'ai_mode', 'claude']) times(2, () => { const n = e === 'claude' ? 2 : int(5, 10); make1(e, L('S4', 'wrong', 'direct'), 'an answer states something wrong about you', { n, named: int(1, n), wrong: 1 }); });
  times(3, () => { const n = int(6, 10); make1(pick(['ai_overview', 'gemini', 'perplexity']), L('S4', 'weak', 'direct'), 'informational, cited once: not yet often', { n, cited: 1, kind: 'learn', nobody: true }); });
  // S5 won
  for (const e of ['chatgpt', 'ai_mode', 'perplexity', 'ai_overview', 'gemini', 'copilot']) times(2, () => { const n = int(5, 12); make1(e, L('S5', '', 'direct'), 'named often, near the top', { n, named: int(Math.max(2, Math.ceil(0.35 * n)), n), positions: [1, 3] }); });
  times(2, () => make1('claude', L('S5', '', 'direct'), 'named in both monthly answers', { n: 2, named: 2, positions: [1, 2] }));
  times(4, () => { const n = int(5, 10); make1(pick(G3), L('S5', '', 'direct'), 'informational, nobody named, your page cited often', { n, cited: int(Math.max(2, Math.ceil(0.35 * n)), n), kind: 'learn', nobody: true }); });
  times(2, () => { const n = int(5, 10); make1('perplexity', L('S5', '', 'direct'), 'informational, named often (position does not matter)', { n, named: Math.max(2, Math.ceil(0.35 * n)), positions: [4, 7], kind: 'learn' }); });
  // unmeasured
  times(4, () => make1(pick(['chatgpt', 'ai_mode', 'perplexity', 'copilot']), L('unmeasured', 'too_few', 'direct'), 'fewer than 4 answers in 28 days', { n: int(1, 3), named: 1, old: true }));
  times(2, () => make1('claude', L('unmeasured', 'too_few', 'direct'), 'one monthly answer', { n: 1 }));
  return cases;
}
module.exports = { make, archetypes, ENGINES, AIV_RULE, rngOf, fnv, diagCases };
