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
