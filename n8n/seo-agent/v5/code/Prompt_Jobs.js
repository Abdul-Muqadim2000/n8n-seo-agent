// Sites whose question panel is short get Prompt Writer jobs (Claude writes the buyer questions once; they are stored and reused weekly).
// v4.9: the writer also gets real questions to start from — what people ask AI about the topic (the AI-answer database, with monthly AI search
// volume) and the long / question-shaped searches the site already appears for (Search Console) — so the panel mirrors real demand.
// G6 (2026-10-18, AI_VISIBILITY_SPEC.md §10): a panel of up to 500 questions is written in CELLS — market (country + language) x persona (buyer
// role) — each cell its own job of at most AIP.LIMITS.writer_batch questions, so every buyer role and every market gets its share and one
// answer always fits the writer's budget. The writer is also given the People-Also-Ask questions of the site's topics (Google's own
// question box, read from the results page) and what up to three competitors' homepages say they sell (topic ideas, never names). With no
// personas on file a panel over 50 questions is written for four generic buyer roles, so it is still segmented; the owner sets real ones.
/*__AI_PANEL__*/
/*__AI_FOCUS__*/
/*__AI_ANSWER_DATA__*/
/*__COUNTRIES__*/
const plans = $('AI Plan').all().map(i => i.json).filter(p => p.need_prompts && !p.nothing_to_do);
if (!plans.length) return [{ json: { skip: true } }];
let reads = [], texts = []; try { reads = $('Site Text Jobs').all().map(i => i.json).filter(j => !j.skip); texts = $('Read Site (AI)').all().map(i => String((i.json || {}).site_text || '')); } catch (e) {}
const textOf = (id) => { const k = reads.findIndex(r => r.site_id === id && r.kind !== 'competitor'); return k >= 0 ? (texts[k] || '').replace(/\n{3,}/g, '\n\n').slice(0, 3500) : ''; };
// what a competitor's homepage says it sells: its headings and menu lines (short lines), never its name — topic ideas for the writer
const offersOf = (id) => reads.map((r, k) => ({ r, t: texts[k] || '' })).filter(x => x.r.site_id === id && x.r.kind === 'competitor' && x.t)
  .map(x => [...new Set(x.t.split('\n').map(l => l.replace(/^[#*\-\s]+/, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').trim()).filter(l => l.length >= 6 && l.length <= 70 && !/[@©]|cookie|privacy|login|sign in|contact us|copyright/i.test(l)))].slice(0, 25).join(' · ')).filter(Boolean).slice(0, 3);
let dreq = [], dres = []; try { dreq = $('Discovery Requests').all().map(i => i.json); dres = $('Run Discovery').all().map(i => i.json || {}); } catch (e) {}
const discovered = (siteId) => { const out = [];
  dreq.forEach((q, i) => { if (q.site_id !== siteId || q.kind !== 'discover') return; const t = ((dres[i] || {}).tasks || [])[0] || {}; if (t.status_code !== 20000) return;
    for (const it of (((t.result || [])[0] || {}).items || [])) { const qq = String(it.question || '').replace(/\s+/g, ' ').trim(); if (qq.split(' ').length < 3 || qq.length > 220) continue;
      out.push({ question: qq, volume: Number(it.ai_search_volume) || 0, platform: q.platform, brands: (it.brand_entities || []).map(b => b.title).filter(Boolean).slice(0, 4) }); } });
  const seen = new Set(); return out.sort((a, b) => b.volume - a.volume).filter(x => { const k = x.question.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 30); };
// G6: People-Also-Ask — the questions Google itself lists on the results page of each topic (serp/google/organic, $0.002 a page)
const paaOf = (siteId, market) => { const out = [];
  dreq.forEach((q, i) => { if (q.site_id !== siteId || q.kind !== 'paa' || (market && q.market && q.market !== market)) return; const t = ((dres[i] || {}).tasks || [])[0] || {}; if (t.status_code !== 20000) return;
    for (const it of (((t.result || [])[0] || {}).items || [])) { if (!it || it.type !== 'people_also_ask') continue;
      for (const el of (it.items || [])) { const qq = String((el && (el.title || el.question)) || '').replace(/\s+/g, ' ').trim(); if (qq.length >= 12 && qq.length <= 200) out.push(qq + ' (' + q.topic + ')'); } } });
  return [...new Set(out)].slice(0, 30); };
const LANG = { en: 'English', ar: 'Arabic', fr: 'French', de: 'German', es: 'Spanish', it: 'Italian', nl: 'Dutch', pt: 'Portuguese', tr: 'Turkish', hi: 'Hindi', ur: 'Urdu', ja: 'Japanese', zh: 'Chinese', ko: 'Korean', ru: 'Russian', pl: 'Polish', sv: 'Swedish', da: 'Danish', no: 'Norwegian', fi: 'Finnish', id: 'Indonesian', ms: 'Malay', th: 'Thai', vi: 'Vietnamese', he: 'Hebrew', fa: 'Persian' };
const COUNTRY = (cc) => { try { const c = Object.entries(typeof COUNTRIES === 'object' ? COUNTRIES : {}).find(([, v]) => String(v.iso || '').toUpperCase() === cc); return c ? c[0] : cc; } catch (e) { return cc; } };
const DEFAULT_PERSONAS = ['business owner', 'finance lead', 'IT lead', 'operations lead'];
// W2-E1 (2026-10-23, MARKET_RND §3.1 gap 1): a site whose services or pages show it sells products gets a "shopping" stage in its panel (the
// questions a shopper types, where AI shows product cards); every other site's panel is written exactly as before
let pagesAll = []; try { pagesAll = $('Load Pages (AI)').all().map(i => i.json).filter(r => r && r.site_id && r.url); } catch (e) {}
const out = [];
for (const p of plans) {
  const shop = AAD.sellsProducts(p, pagesAll.filter(r => r.site_id === p.site_id));
  // AI-FOCUS (2026-10-27, docs/ai-panel-focus-2026-10-27 §5 step 4): with the focus model on, every job carries the TOPICS it writes for and how many
  // each (the reconcile's quotas, handed out over the market x buyer-role cells below), the topics' phrases as sub-topics, and the place rule: only
  // places in the cell's country. The writer can no longer spread one onboarding keyword over the whole panel, or name Dubai for a Pakistan website.
  const fw = (p.focus && Array.isArray(p.focus.write)) ? p.focus.write.filter(w => w && Number(w.count) > 0).map(w => ({ ...w, left: Number(w.count) })) : [];
  const takeTopics = (n) => { const got = []; let k = n;
    for (const w of fw) { if (k <= 0) break; if (w.left <= 0) continue; const t = Math.min(w.left, k); w.left -= t; k -= t; got.push({ label: w.label, count: t, source: w.source || '', state: w.state || '', terms: (w.terms || []).slice(0, 6) }); }
    return got; };
  const placeRule = (cc) => { const nm = COUNTRY(cc) || ''; const cities = AIF.citiesOf(cc); return nm ? 'Name only places in ' + nm + (cities.length ? ' (its cities, for example ' + cities.join(', ') + ')' : '') + ', and only where a buyer would name a place; never another country or region.' : ''; };
  const markets = fw.length && Array.isArray(p.focus.write_markets) && p.focus.write_markets.length ? p.focus.write_markets.filter(m => (p.markets || []).includes(m) || m === p.own_market) : (p.markets && p.markets.length ? p.markets : [p.own_market || 'US-en']);   // AI-FOCUS: written in the website's markets only
  const personas = (p.personas && p.personas.length) ? p.personas : (Number(p.prompts_max) > 50 ? DEFAULT_PERSONAS : ['']);
  const cells = []; for (const m of markets) for (const pe of personas) cells.push({ market: m, persona: pe });
  // what each cell already has, and its fair share of the panel: the cells furthest below their share get the new questions first
  const have = (c) => p.prompts.filter(q => q.kind !== 'brand' && (q.market || p.own_market) === c.market && String(q.persona || '').toLowerCase() === c.persona.toLowerCase()).length;
  const share = Math.ceil(Math.max(1, Number(p.prompts_max) - 1) / cells.length);
  let left = Number(p.prompts_needed) || 0;
  const plan = cells.map(c => ({ ...c, have: have(c), want: 0 })).sort((a, b) => a.have - b.have);
  while (left > 0) { let moved = false; for (const c of plan) { if (left <= 0) break; if (c.have + c.want < share || plan.every(x => x.have + x.want >= share)) { c.want++; left--; moved = true; } } if (!moved) break; }
  const clusters = [...new Set([...(p.topics || []), ...p.prompts.map(q => String(q.cluster || '').toLowerCase()).filter(x => x && x !== 'brand')])].slice(0, 16);
  const competitor_offers = offersOf(p.site_id);
  let first = true;
  for (const c of plan.filter(x => x.want > 0)) {
    const [cc, lang] = String(c.market || '').split('-');
    for (let n = c.want; n > 0 && out.length < AIP.LIMITS.writer_jobs_per_run; n -= AIP.LIMITS.writer_batch) {
      const count = Math.min(AIP.LIMITS.writer_batch, n);
      const brandHere = first && !p.prompts.some(x => x.kind === 'brand');
      const ft = fw.length ? takeTopics(count - (brandHere ? 1 : 0)) : [];   // AI-FOCUS: the topics this job writes for (the brand question counts in the first job)
      if (fw.length && !ft.length && !brandHere) continue;
      out.push({ json: { site_id: p.site_id, domain: p.domain, business_name: p.business_name || p.domain, business_type: p.business_type || '', country: COUNTRY(cc) || p.country || '', city: (c.market === p.own_market ? p.city : '') || '',
        market: c.market, language: LANG[lang] || lang || 'English', persona: c.persona, clusters: ft.length ? ft.map(x => x.label) : clusters,
        topics: ft.length ? [...new Set(ft.flatMap(x => [x.label, ...x.terms]))].slice(0, 8) : p.topics,
        ...(fw.length ? { focus_topics: ft, focus_topic: ft.length === 1 ? ft[0].label : '', place_rule: placeRule(cc), propose: !!(p.focus && p.focus.propose_only) } : {}),
        count: fw.length ? ft.reduce((t, x) => t + x.count, 0) + (brandHere ? 1 : 0) : count, existing: p.prompts.filter(q => (q.market || p.own_market) === c.market).map(x => x.prompt).slice(0, 80), has_brand_prompt: !first || p.prompts.some(x => x.kind === 'brand'), site_text: first ? textOf(p.site_id) : textOf(p.site_id).slice(0, 1500),
        market_questions: discovered(p.site_id).map(x => x.question + ' (' + x.volume + '/mo' + (x.brands.length ? '; AI names ' + x.brands.join(', ') : '') + ')'),
        search_questions: (p.gsc_questions || []).map(x => x.query + ' (' + x.impressions + ' impressions)'),
        paa_questions: paaOf(p.site_id, c.market), competitor_offers, ...(shop.sells ? { shopping: true, shopping_why: shop.why } : {}) } });   // W2-E1
      first = false;
    }
  }
}
return out.length ? out : [{ json: { skip: true } }];
