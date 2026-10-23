// W2-E1 (2026-10-23, docs/ai-visibility-2026-10-23/WAVE2_CONTRACTS.md §1 §2, fixes/W2-E1.md): the answer-level data every engine call already
// returns and the tracker threw away (v5/code/_ai_answer_data.js, AAD). Every assertion here fails on 6953f27b (the fields, the analyst
// re-read, the aggregates, the report sections and the shopping stage did not exist) and passes after W2-E1.
//   W2E1-1  the answer rows on REAL responses (fixtures_live: scraper, AI Mode, AI Overview, Perplexity, Claude, Gemini; the free sandbox's
//           ChatGPT shape), weekly and pulse parser: full text, cited in order, read-not-cited, fan-out, model, '' vs '[]'
//   W2E1-2  product / ad / local cards in the documented shapes (cards_w2e1.json.gz): ChatGPT and AI Mode
//   W2E1-3  the 12,000-character cap and detail_json.answer_cut; the stored row keeps the text (AI Answer Rows)
//   W2E1-4  the analyst re-reads, in a run's last part, the answers an earlier part stored and never analysed (F2's open item), with no re-ask
//   W2E1-5  AI Metrics: urls_json, sources_json (+ the old list), shopping_json ("no shopping results", never 0%), ads_local_json, half-life
//           from three stored runs, and the report's sections (each only when it has something to say)
//   W2E1-SRC the labelled source-type set (accuracy/ai_source_types.json, 126 domains), >= 95% correct, ratcheted on its known misses
//   W2E1-6  the panel's "shopping" stage only for a site that sells products
const fs = require('fs'); const path = require('path'); const zlib = require('zlib');
const BAR_SRC = 95;   // measured 2026-10-23: 125 of 126 (99.2%)
const KNOWN_SRC_MISSES = ['gulftoday.ae'];   // a news site whose name carries "today" with no separator; the rule reads label tokens only
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const CD = process.env.CODE_DIR || path.join(__dirname, 'code_v4');
  const FXD = path.join(__dirname, 'fixtures_live');
  const rdJ = (f) => JSON.parse(fs.readFileSync(path.join(FXD, f), 'utf8'));
  const rdZ = (f) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(FXD, f))).toString('utf8'));
  const TC = JSON.parse(fs.readFileSync(path.join(__dirname, 'table_cols.json'), 'utf8'));
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 700), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 500))); };
  const kitOf = (file, name) => { const src = fs.readFileSync(path.join(CD, file), 'utf8'); const a = src.indexOf('const ' + name + ' = (() => {'); const b = src.indexOf('\n})();', a);
    if (a < 0 || b < 0) throw new Error(name + ' not inlined in ' + file); return new Function(src.slice(a, b + 6) + '\nreturn ' + name + ';')(); };
  const J = (s) => { try { return JSON.parse(s); } catch (e) { return undefined; } };
  const NEW = ['answer_text', 'cited_json', 'retrieved_json', 'fanout_json', 'products_json', 'ads_json', 'local_json', 'model', 'detail_json'];
  const VIS_NEW = ['urls_json', 'shopping_json', 'ads_local_json'];
  const day = (n) => new Date(Date.now() - n * 864e5).toISOString();
  // a plain URL key for the expectations (independent of the kit): lower-case host without www., no fragment, no utm_* / tracking parameters
  const key = (u) => { const m = String(u || '').match(/^(https?):\/\/([^/?#]+)([^?#]*)(\?[^#]*)?/i); if (!m) return String(u || '');
    const q = (m[4] || '').replace(/^\?/, '').split('&').filter(kv => kv && !/^utm_[a-z_]*$/i.test(kv.split('=')[0])).join('&');
    return m[2].toLowerCase().replace(/^www\./, '') + (m[3] || '/') + (q ? '?' + q : ''); };

  const TECH = { site_id: 'site_techand-ai', domain: 'techand.ai', business_name: 'Tech&', brand_names: ['techand.ai', 'Tech&', 'techand'], competitors: ['cleartax.com'], configured_competitors: ['cleartax.com'], aliases: {}, services: [], topics: ['e-invoicing'] };
  const req = (p, engine, i, o) => ({ json: { site_id: p.site_id, domain: p.domain, run_id: 'ai_w2e1', engine, prompt_id: 'q' + i, prompt: 'Which e-invoicing providers in the UAE?', kind: 'recommend', topic: 'e-invoicing', run_kind: (o && o.run_kind) || 'weekly' } });
  const parse = async (p, pairs, code) => { mock('AI Plan', [{ json: p }]); mock('Load Cache (AI)', [{ json: {} }]); mock('AI Requests', pairs.map(([e], i) => req(p, e, i, code ? { run_kind: 'pulse' } : null)));
    return (await run('Parse AI Answers', pairs.map(([, r]) => ({ json: r })), code ? { code } : {})).map(x => x.json); };

  // ===================================================================================================================================
  await guard('W2E1-1', async () => {
    reset(); const SN = 'W2E1-1 — the answer rows on real responses keep what each engine returned: the full text, every source cited in order, the pages ChatGPT read but did not cite, the searches, the model; "[]" where an engine can show cards and showed none, "" where it cannot';
    begin(SN); const check = mkCheck(SN);
    const SB = rdZ('sandbox_w2e1.json.gz');
    const scr = rdJ('scraper.json'), aim = rdJ('aimode.json'), aio = rdJ('aio.json'), ppx = rdJ('r_perplexity.json'), cla = rdJ('r_claude.json'), gem = rdJ('r_gemini.json');
    for (const [label, code] of [['weekly', null], ['pulse', 'Pulse__Parse_AI_Answers']]) {
      const rows = await parse(TECH, [['chatgpt', scr], ['ai_mode', aim], ['ai_overview', aio], ['perplexity', ppx], ['claude', cla], ['gemini', gem], ['chatgpt', SB.chatgpt_scraper], ['perplexity', { tasks: [{ status_code: 40501, status_message: 'Invalid Field' }] }]], code);
      const [c, m, o, p, l, g, s, bad] = rows;
      check(label + ': every row carries the nine new fields', rows.every(r => NEW.every(k => k in r)), JSON.stringify(Object.keys(rows[0])));
      const res = scr.tasks[0].result[0];
      check(label + ': ChatGPT keeps its full answer (whitespace normalised, not the 520-character excerpt)', c.answer_text.length > 1500 && c.answer_text.length >= res.markdown.replace(/\s+/g, ' ').trim().length - 50 && c.answer_text.startsWith('The UAE Ministry of Finance'), c.answer_text.length + ' vs ' + res.markdown.length);
      const cited = J(c.cited_json) || [];
      const srcKeys = [...new Set([...(res.sources || []), ...(res.items || []).flatMap(x => x.sources || [])].map(x => key(x.url)))];
      check(label + ': ChatGPT cited_json = every distinct source in order, 1-based positions, host + entity id + role', cited.length === srcKeys.length && cited.every((x, i) => x.position === i + 1 && x.host && x.entity_id && x.role) && key(cited[0].url) === srcKeys[0], JSON.stringify(cited.slice(0, 2)) + ' n=' + cited.length + '/' + srcKeys.length);
      const retr = J(c.retrieved_json) || [];
      const want = [...new Set(res.search_results.map(x => key(x.url)))].filter(k => !srcKeys.includes(k));
      check(label + ': ChatGPT retrieved_json = the search results it read minus the ones it cited (' + want.length + ' of ' + res.search_results.length + ')', retr.length === Math.min(40, want.length) && retr.every(x => !srcKeys.includes(key(x.url)) && x.host && x.entity_id) && want.length > 0, retr.length + ' vs ' + want.length);
      check(label + ': fan-out searches and the model the response reports', JSON.stringify(J(c.fanout_json)) === JSON.stringify(res.fan_out_queries) && c.model === 'gpt-5-6' && p.model === ppx.tasks[0].result[0].model_name && l.model === cla.tasks[0].result[0].model_name && m.model === '', [c.model, p.model, l.model, m.model].join(' | '));
      check(label + ': engines that can show cards and showed none store "[]"; engines that cannot store ""', c.products_json === '[]' && c.ads_json === '[]' && c.local_json === '[]' && m.products_json === '[]' && m.ads_json === '[]' && m.local_json === ''
        && p.products_json === '' && l.products_json === '' && g.products_json === '' && p.retrieved_json === '' && m.retrieved_json === '' && g.retrieved_json === '', JSON.stringify([c.products_json, m.products_json, m.local_json, p.products_json, p.retrieved_json]));
      check(label + ': AI Mode / AI Overview / Perplexity / Claude / Gemini keep their text and their cited sources', [m, o, p, l, g].every(r => r.answer_text.length > 200 && (J(r.cited_json) || []).length > 0), [m, o, p, l, g].map(r => r.engine + ':' + r.answer_text.length + '/' + (J(r.cited_json) || []).length).join(' '));
      check(label + ': the sandbox ChatGPT shape (model gpt-6, image items) reads the same way', s.model === 'gpt-6' && (J(s.retrieved_json) || []).length > 0 && (J(s.cited_json) || []).length > 0 && s.products_json === '[]', JSON.stringify({ model: s.model, r: (J(s.retrieved_json) || []).length }));
      check(label + ': detail_json records the full length (and no cut under 12,000)', J(c.detail_json).answer_len >= c.answer_text.length && !J(c.detail_json).answer_cut, c.detail_json);
      check(label + ': a failed request stores none of it', bad.error && NEW.every(k => bad[k] === ''), JSON.stringify(NEW.map(k => bad[k])));
    }
    reset();
  });

  // ===================================================================================================================================
  await guard('W2E1-2', async () => {
    reset(); const SN = 'W2E1-2 — product, ad and local-business cards (documented shapes): ChatGPT chat_gpt_products / chat_gpt_ad / chat_gpt_local_businesses, AI Mode ai_overview_shopping / ai_overview_paid; your own cards marked';
    begin(SN); const check = mkCheck(SN);
    const C = rdZ('cards_w2e1.json.gz');
    const SHOP = { site_id: 'site_runshop-ae', domain: 'runshop.ae', business_name: 'Run Shop Dubai', brand_names: ['runshop.ae', 'Run Shop Dubai'], competitors: [], configured_competitors: [], aliases: {} };
    const [c, m] = await parse(SHOP, [['chatgpt', C.chatgpt], ['ai_mode', C.ai_mode]]);
    const P = J(c.products_json) || [];
    check('ChatGPT: 3 product cards in order with merchant, price, currency, URL and entity', P.length === 3 && P.map(x => x.position).join() === '1,2,3' && P[0].merchant === 'Amazon.ae' && P[0].price === 549 && P[0].currency === 'AED' && /amazon\.ae\/dp\//.test(P[0].url) && !/utm_/.test(P[0].url) && P[0].entity_id === 'amazon.ae', JSON.stringify(P[0]));
    check('ChatGPT: only the card on the site\'s own domain is own', P.filter(x => x.own).map(x => x.position).join() === '2', JSON.stringify(P.map(x => [x.merchant, x.own])));
    const A = J(c.ads_json) || [];
    check('ChatGPT ads: the advertiser and whether the ad was shown (is_rendered false = in the response, not shown)', A.length === 2 && A[0].advertiser === 'Sun & Sand Sports' && A[0].rendered === true && A[1].rendered === false && A[1].host === 'decathlon.ae', JSON.stringify(A));
    const L = J(c.local_json) || [];
    check('ChatGPT local cards: in order, the site\'s own card marked', L.length === 2 && L[0].own === true && L[1].own === false && L[0].position === 1 && L[1].host === 'sunandsandsports.com', JSON.stringify(L));
    const MP = J(m.products_json) || [], MA = J(m.ads_json) || [];
    check('AI Mode: the shopping block inside the AI answer (seller, current price, currency), own marked; its paid block is an ad', MP.length === 2 && MP[0].own === true && MP[0].merchant === 'Run Shop Dubai' && MP[0].price === 579 && MP[1].merchant === 'Amazon.ae' && !MP[1].own && MA.length === 1 && MA[0].advertiser === 'Decathlon' && m.local_json === '', JSON.stringify({ MP, MA }));
    reset();
  });

  // ===================================================================================================================================
  await guard('W2E1-3', async () => {
    reset(); const SN = 'W2E1-3 — a 15,000-character answer is stored cut at 12,000 with answer_cut in detail_json; AI Answer Rows stores the full text (the exact table columns, the answer no longer dropped)';
    begin(SN); const check = mkCheck(SN);
    const long = 'Providers in the UAE. ' + 'A long paragraph about e-invoicing readiness and accredited providers. '.repeat(210);
    const rows = await parse(TECH, [['perplexity', { tasks: [{ status_code: 20000, cost: 0.006, result: [{ model_name: 'sonar', items: [{ sections: [{ text: long, annotations: [{ url: 'https://techand.ai/e-invoicing/', title: 'E-invoicing' }] }] }] }] }] }]]);
    const r = rows[0]; const d = J(r.detail_json);
    check('cut at 12,000 characters, the cut and the full length recorded', r.answer_text.length === 12000 && d.answer_cut === true && d.answer_len > 14000, JSON.stringify({ len: r.answer_text.length, d }));
    mock('Parse AI Answers', rows.map(x => ({ json: x })));
    const raw = (await run('AI Answer Rows', [{ json: {} }])).map(x => x.json);
    check('AI Answer Rows: exactly the table columns, the nine new ones included, the text kept', raw.length === 1 && JSON.stringify(Object.keys(raw[0])) === JSON.stringify(TC.AI_ANSWERS) && raw[0].answer_text.length === 12000 && J(raw[0].cited_json)[0].role === 'self', JSON.stringify(Object.keys(raw[0])));
    reset();
  });

  // ===================================================================================================================================
  await guard('W2E1-4', async () => {
    reset(); const SN = 'W2E1-4 — the last part of a split run: the Answer Analyst reads the answers an earlier part stored and never analysed, from their stored text (no paid re-ask); analysed, older (no text) and other runs\' rows are left alone; the reading is written back over the stored row';
    begin(SN); const check = mkCheck(SN);
    const RUN = 'ai_20261023_techand-ai';
    const plan = { ...TECH, run_id: RUN, checked_at: new Date().toISOString(), business_type: '', country: 'United Arab Emirates', profile: { city: 'Dubai', phone: '+971 4 000 0000', street_address: 'Business Bay' }, business_facts: 'Founded 2018', accreditation: '',
      chunk: { no: 3, going: true, final_expected: true, analyst_jobs_max: 2 }, cost_model: {} };
    mock('AI Plan', [{ json: plan }]);
    const base = { site_id: TECH.site_id, domain: TECH.domain, run_id: RUN, checked_at: day(0.2), prompt: 'Which e-invoicing providers in the UAE?', topic: 'e-invoicing', answered: 'true', cited: 'false', rank: '0', our_urls: '', competitors: 'cleartax.com', sources: '', excerpt: '', cost: '0.004', error: '', run_kind: 'weekly', sentiment: '', brands: '', issues: '', fanout: '', cited_urls: '', named: '', position: '', entities_json: '', cited_json: '[]', retrieved_json: '', fanout_json: '', products_json: '', ads_json: '', local_json: '', model: 'sonar' };
    const stored = [
      { ...base, prompt_id: 's1', engine: 'perplexity', kind: 'recommend', mentioned: 'true', named: 'true', position: '2', rank: '2', answer_text: '1. **ClearTax** - cleartax.com\n2. **Tech&** - techand.ai, a Dubai e-invoicing partner.', detail_json: '{"v":1,"answer_len":80}' },
      { ...base, prompt_id: 's2', engine: 'perplexity', kind: 'recommend', mentioned: 'true', answer_text: 'Tech& and ClearTax.', detail_json: '{"v":1,"analysed":true}' },
      { ...base, prompt_id: 's3', engine: 'claude', kind: 'recommend', mentioned: 'true', answer_text: 'Tech& is one option.', detail_json: '{"v":1}', run_id: 'ai_20261016_techand-ai' },
      { ...base, prompt_id: 's4', engine: 'claude', kind: 'recommend', mentioned: 'true', answer_text: '', detail_json: '' },
      { ...base, prompt_id: 's5', engine: 'claude', kind: 'compare', mentioned: 'false', answer_text: 'Compare ClearTax with EDICOM for UAE e-invoicing.', detail_json: '{"v":1}' }];
    mock('Load AI Run Answers', stored.map(r => ({ json: r })));
    const mineRow = { site_id: TECH.site_id, domain: TECH.domain, run_id: RUN, checked_at: new Date().toISOString(), prompt_id: 'q9', prompt: 'Best UAE e-invoicing partner?', kind: 'recommend', topic: 'e-invoicing', engine: 'chatgpt', answered: true, mentioned: true, cited: false, rank: 1, our_urls: '', competitors: '', sources: '', excerpt: '', cost: 0.004, error: '', run_kind: 'weekly',
      sentiment: '', brands: '', issues: '', fanout: '', cited_urls: '', named: true, position: 1, entities_json: JSON.stringify([{ id: 'techand.ai', name: 'Tech&', role: 'self', position: 1, cited: false }]), answer_text: 'Tech& is the best.', cited_json: '[]', retrieved_json: '[]', fanout_json: '[]', products_json: '[]', ads_json: '[]', local_json: '[]', model: 'gpt-5', detail_json: '{"v":1}', _text: 'Tech& is the best.' };
    mock('Parse AI Answers', [{ json: mineRow }]);
    const jobs = (await run('Analyst Jobs', [{ json: {} }])).map(x => x.json).filter(j => !j.skip);
    const ids = jobs.flatMap(j => j.ids); const sids = jobs.flatMap(j => j.stored_ids || []);
    check('the analyst reads this part\'s answer AND the two stored, unanalysed answers of this run (s1 named, s5 a comparison) from their text', ids.includes('q9|chatgpt') && ids.includes('s1|perplexity') && ids.includes('s5|claude') && sids.sort().join() === 's1|perplexity,s5|claude' && /Dubai e-invoicing partner/.test(jobs[0].answers), JSON.stringify({ ids, sids }));
    check('an answer already analysed (s2), another run\'s (s3) and a row stored before the text was kept (s4) are not re-read', !ids.includes('s2|perplexity') && !ids.includes('s3|claude') && !ids.includes('s4|claude'), JSON.stringify(ids));
    const job = jobs[0];
    mock('Answer Analyst', jobs.map(j => ({ json: { output: { answers: j.ids.map((id, k) => ({ n: k + 1, brands: [{ name: 'ClearTax', domain: 'cleartax.com', role: 'competitor' }, ...(/^s5/.test(id) ? [{ name: 'EDICOM', domain: 'edicomgroup.com', role: 'competitor' }] : [{ name: 'Tech&', domain: 'techand.ai' }])], sentiment: /^s5/.test(id) ? 'not_mentioned' : 'positive', wrong: [] })) } } })));
    const aa = (await run('Apply Analysis', store['Answer Analyst'])).map(x => x.json);
    const s1 = aa.find(r => r.prompt_id === 's1'), s5 = aa.find(r => r.prompt_id === 's5'), q9 = aa.find(r => r.prompt_id === 'q9');
    check('the stored answer gets the analyst\'s reading (sentiment, position, entities) and the mark that it was read; it is flagged as stored', s1 && s1.sentiment === 'positive' && s1.named === true && s1.position === 2 && J(s1.detail_json).analysed === true && s1._stored === true && s1.answer_text.length > 20 && /edicomgroup|cleartax/.test(s1.competitors), JSON.stringify(s1));
    check('this part\'s own answer is marked read too, and is not flagged stored', q9 && J(q9.detail_json).analysed === true && !q9._stored && s5 && J(s5.detail_json).analysed === true, JSON.stringify(q9 && q9.detail_json));
    mock('AI Answer Rows', [{ json: Object.fromEntries(TC.AI_ANSWERS.map(k => [k, mineRow[k] === undefined ? '' : mineRow[k]])) }]);
    const back = (await run('AI Analysed Rows', [{ json: {} }])).map(x => x.json);
    check('written back (upsert on run + question + engine): the stored rows s1 and s5 and this part\'s row, exact columns, text kept', back.length === 3 && back.every(r => JSON.stringify(Object.keys(r)) === JSON.stringify(TC.AI_ANSWERS)) && back.find(r => r.prompt_id === 's1').answer_text.length > 20, JSON.stringify(back.map(r => r.prompt_id)));
    const notLast = { ...plan, chunk: { ...plan.chunk, final_expected: false } }; mock('AI Plan', [{ json: notLast }]);
    const jobs2 = (await run('Analyst Jobs', [{ json: {} }])).map(x => x.json).filter(j => !j.skip);
    check('a part that is not the last leaves the stored answers for the last one', !jobs2.flatMap(j => j.ids).some(id => /^s/.test(id)), JSON.stringify(jobs2.flatMap(j => j.ids)));
    reset();
  });

  // ===================================================================================================================================
  await guard('W2E1-5', async () => {
    reset(); const SN = 'W2E1-5 — AI Metrics aggregates the answers: your pages read / cited and the page cited instead (urls_json), where AI gets its answers by kind with first seen and half-life (sources_json, the old list kept), shopping ("no shopping results", never 0%), ads / local; the report shows each section only when it has something';
    begin(SN); const check = mkCheck(SN);
    const SID = 'site_techand-ai', DOM = 'techand.ai', NOW = new Date().toISOString(), RUN = 'ai_w2e1_5';
    const cj = (list) => JSON.stringify(list.map((u, i) => { const h = key(u).split('/')[0]; return { url: 'https://' + key(u), host: h, entity_id: h, role: h === DOM ? 'self' : /cleartax/.test(h) ? 'competitor' : 'source', position: i + 1 }; }));
    const rj = (list) => JSON.stringify(list.map(u => { const h = key(u).split('/')[0]; return { url: 'https://' + key(u), host: h, entity_id: h }; }));
    const row = (pid, engine, o) => ({ site_id: SID, domain: DOM, run_id: RUN, checked_at: NOW, prompt_id: pid, prompt: 'Which UAE e-invoicing providers ' + pid + '?', kind: 'recommend', topic: 'e invoicing', engine, answered: true, mentioned: false, cited: !!o.ownCited, rank: 0,
      our_urls: o.ownCited ? 'https://techand.ai/a/' : '', competitors: 'cleartax.com', sources: '', excerpt: '', cost: 0.004, error: '', run_kind: 'weekly', sentiment: '', brands: '', issues: '', fanout: '', cited_urls: '[]', named: false, position: null,
      entities_json: JSON.stringify([{ id: 'cleartax.com', name: 'ClearTax', role: 'competitor', position: 1, cited: true }]), answer_text: 'text', cited_json: cj(o.cited), retrieved_json: o.retr ? rj(o.retr) : '', fanout_json: '[]',
      products_json: o.products === undefined ? (engine === 'chatgpt' ? '[]' : '') : JSON.stringify(o.products), ads_json: engine === 'chatgpt' ? '[]' : '', local_json: engine === 'chatgpt' ? '[]' : '', model: '', detail_json: '{"v":1}' });
    const amazon = { title: 'ERP starter kit', merchant: 'Amazon.ae', price: 99, currency: 'AED', url: 'https://amazon.ae/dp/x', position: 1, entity_id: 'amazon.ae', own: false };
    const rowsA = [
      row('q0', 'chatgpt', { cited: ['https://cleartax.com/x', 'https://techand.ai/a/'], retr: ['https://techand.ai/b/', 'https://en.wikipedia.org/wiki/E-invoicing'], ownCited: true }),
      row('q1', 'chatgpt', { cited: ['https://cleartax.com/x', 'https://reddit.com/r/uae/1'], retr: ['https://techand.ai/b/'] }),
      row('q2', 'chatgpt', { cited: ['https://gulfnews.com/business/e-invoicing'], retr: ['https://techand.ai/b/'], products: [amazon] }),
      row('q0', 'perplexity', { cited: ['https://techand.ai/a/', 'https://mof.gov.ae/en/einvoicing'], ownCited: true })];
    const prompt = (i) => ({ prompt_id: 'q' + i, prompt: 'Which UAE e-invoicing providers q' + i + '?', kind: 'recommend', topic: 'e invoicing', keyword: 'e invoicing uae', source: 'auto', stage: 'decision', cluster: 'e invoicing', persona: '', market: 'AE-en', volume: 100, origin: 'writer', created_at: '2026-10-01' });
    const plan = (o) => [{ json: { site_id: SID, domain: DOM, canonical_host: DOM, country: 'United Arab Emirates', location_code: 2784, language_code: 'en', country_iso: 'AE', email: '', callback_url: '', request_id: '', on_demand: false, adhoc: false, business_name: 'Tech&', business_type: '', city: 'Dubai', profile: {}, services: [], business_facts: [], accreditation: '',
      brand_names: [DOM, 'Tech&'], competitors: ['cleartax.com'], configured_competitors: ['cleartax.com'], aliases: {}, topics: ['e invoicing'], engines: ['chatgpt', 'perplexity'], prompts_max: 20, pulse: true, prompts: [0, 1, 2].map(prompt), full_due: false, run_kind: 'weekly', monthly_engines: [], carried: null,
      need_prompts: false, prompts_needed: 0, need_site_text: false, gsc_questions: [], discovery_due: false, volume_keywords: [], index_due: false, market_due: false, market_keyword: 'e invoicing', ga4_property_id: '', pulse_rows: [], key_paths: [], set_aside: [], set_aside_note: '',
      pulse_window: { from: day(7), to: NOW, days: 7 }, previous: null, run_id: RUN, checked_at: NOW } }];
    const hist = (n, share) => ({ site_id: SID, domain: DOM, run_id: 'ai_old_' + n, checked_at: day(n), sources_json: JSON.stringify({ v: 2, n: 10, types: {}, domains: [{ host: 'gulfnews.com', type: 'editorial', cited_n: share / 10, share, first_seen: day(28).slice(0, 10), last_seen: day(n).slice(0, 10) }] }) });
    const drive = async (rows, history) => { reset(); mock('AI Plan', plan()); mock('Apply Analysis', rows.map(r => ({ json: r }))); mock('AI Requests', [{ json: { site_id: SID, engine: 'chatgpt' } }]); mock('Run AI Requests', [{ json: {} }]);
      mock('Load AI Visibility', (history && history.length ? history : [{}]).map(r => ({ json: r })));
      return (await run('AI Metrics', store['Apply Analysis']))[0].json; };
    const X = await drive(rowsA, [hist(21, 50), hist(14, 40), hist(7, 20)]);
    const V = X.vis_row;
    check('the visibility row carries urls_json, shopping_json and ads_local_json (exact columns of the table)', VIS_NEW.every(k => typeof V[k] === 'string' && V[k].length > 2), JSON.stringify(VIS_NEW.map(k => [k, (V[k] || '').slice(0, 40)])));
    const U = J(V.urls_json);
    const a = U.own.find(x => /techand\.ai\/a\//.test(x.url)), b = U.own.find(x => /techand\.ai\/b\//.test(x.url));
    check('urls_json.own: /a/ cited in 2 of the 2 answers that read it (100%), /b/ read in 3 and cited in none; each with its engines and questions', a && a.cited_n === 2 && a.retrieved_n === 2 && a.cited_rate === 100 && a.rate_n === 2 && b && b.cited_n === 0 && b.retrieved_n === 3 && b.cited_rate === 0 && b.questions.length === 3 && a.engines.join() === 'chatgpt,perplexity', JSON.stringify(U.own));
    check('the rival page cited instead of /b/ (cleartax.com/x, twice) and the rival pages AI cites', b.rival_cited_instead[0] && /cleartax\.com\/x/.test(b.rival_cited_instead[0].url) && b.rival_cited_instead[0].n === 2 && U.rivals[0] && /cleartax\.com\/x/.test(U.rivals[0].url) && U.rivals[0].cited_n === 2, JSON.stringify({ i: b.rival_cited_instead, r: U.rivals }));
    const rnc = U.retrieved_not_cited[0];
    check('retrieved_not_cited: /b/ first, read 3 times, with the pages cited in its place (cleartax.com/x 2, then the others)', rnc && /techand\.ai\/b\//.test(rnc.url) && rnc.read_not_cited_n === 3 && rnc.top_competing[0].n === 2 && rnc.top_competing.length === 3, JSON.stringify(rnc));
    const S = J(V.sources_json);
    check('sources_json: kinds of source with their share (own 2, rival 2, ugc 1, editorial 1, government 1 = 7 citations), and the old list kept under `list`', S.v === 2 && S.n === 7 && S.types.own.n === 2 && S.types.rival.n === 2 && S.types.ugc.n === 1 && S.types.editorial.n === 1 && S.types.government.n === 1 && S.types.reference.n === 0 && Array.isArray(S.list), JSON.stringify(S.types));
    const gn = S.domains.find(d => d.host === 'gulfnews.com'), cl = S.domains.find(d => d.host === 'cleartax.com');
    check('half-life from three stored runs: gulfnews.com peaked at 50% three weeks ago and fell to 20% a week ago - its share halved in 12 days; first seen carried from the stored runs', gn && gn.half_life_days === 12 && gn.decay === 'halved' && gn.first_seen === day(28).slice(0, 10) && gn.last_seen === NOW.slice(0, 10), JSON.stringify(gn));
    check('a domain first seen this run has no half-life: "too little history"', cl && cl.half_life_days === null && cl.decay === 'too little history' && cl.first_seen === NOW.slice(0, 10), JSON.stringify(cl));
    const SH = J(V.shopping_json);
    check('shopping: product cards in 1 of the 3 answers that can show them (33.3%, with its 95% range), the merchant\'s share', SH.status === 'measured' && SH.trigger_n === 1 && SH.answers_n === 3 && SH.trigger_rate === 33.3 && Array.isArray(SH.trigger_ci) && SH.merchants[0].merchant === 'Amazon.ae' && SH.merchants[0].share === 100 && SH.own_presence_rate === 0 && SH.own_presence_n === 1, JSON.stringify(SH));
    const AL = J(V.ads_local_json);
    check('ads / local: none seen, with the answers that could have shown them (3 each)', AL.ads.seen_n === 0 && AL.ads.answers_n === 3 && AL.ads.rate === null && AL.local.seen_n === 0 && AL.local.answers_n === 3, JSON.stringify(AL));
    check('an action for the page AI reads and does not cite', (X.actions || []).some(x => x.type === 'cite' && /techand\.ai\/b\//.test(x.action)), JSON.stringify((X.actions || []).map(x => x.type)));
    const rep = (await run('AI Report', store['AI Metrics']))[0].json.html;
    check('the report: "Pages AI reads but does not cite" with the page cited instead, "Where AI gets its answers", the shopping section; no ads / local section (none seen)', /Pages AI reads but does not cite/.test(rep) && /cleartax\.com\/x/.test(rep) && /Where AI gets its answers/.test(rep) && /AI shopping results/.test(rep) && /1 of 3 answers/.test(rep) && !/Ads inside AI answers/.test(rep) && !/Local business cards/.test(rep) && /halved in 12 days/.test(rep), rep.slice(rep.indexOf('Pages AI reads'), rep.indexOf('Pages AI reads') + 300));
    const Y = await drive(rowsA.map(r => ({ ...r, products_json: r.engine === 'chatgpt' ? '[]' : '' })), []);
    const SY = J(Y.vis_row.shopping_json);
    check('no product card anywhere: "no shopping results" in 3 answers, the rate null (never 0%), and no shopping section in the report', SY.status === 'no shopping results' && SY.trigger_rate === null && SY.answers_n === 3 && /3 answers/.test(SY.note), JSON.stringify(SY));
    const rep2 = (await run('AI Report', store['AI Metrics']))[0].json.html;
    check('…the report says nothing about shopping', !/AI shopping results/.test(rep2) && /Where AI gets its answers/.test(rep2), '');
    reset();
  });

  // ===================================================================================================================================
  await guard('W2E1-SRC', async () => {
    reset(); const SN = 'W2E1-SRC — source types on the labelled set (accuracy/ai_source_types.json): ' + '>= ' + BAR_SRC + '% correct, ratcheted on KNOWN_SRC_MISSES'; begin(SN); const check = mkCheck(SN);
    const SET = JSON.parse(fs.readFileSync(path.join(__dirname, 'accuracy', 'ai_source_types.json'), 'utf8'));
    const AAD = kitOf('AI_Metrics.js', 'AAD'); const AIE = kitOf('AI_Metrics.js', 'AIE');
    const R = SET.context.rivals; const isRival = (h) => R.some(r => AIE.sameEntity(r, AAD.regD(h)));
    check('the set: at least 60 domains, every one of the eight types present, unique hosts', SET.cases.length >= 60 && AAD.SOURCE_TYPES.every(t => SET.cases.some(c => c.type === t)) && new Set(SET.cases.map(c => c.host)).size === SET.cases.length, SET.cases.length);
    const rows = SET.cases.map(c => ({ ...c, got: AAD.sourceType(c.host, { own: SET.context.own, isRival }) }));
    const ok = rows.filter(r => r.got === r.type).length; const acc = Math.round(1000 * ok / rows.length) / 10;
    console.log('   source types: ' + ok + ' of ' + rows.length + ' (' + acc + '%)');
    check('accuracy ' + acc + '% >= ' + BAR_SRC + '%', acc >= BAR_SRC, acc);
    const miss = rows.filter(r => r.got !== r.type);
    const fresh = miss.filter(r => !KNOWN_SRC_MISSES.includes(r.host)); const fixed = KNOWN_SRC_MISSES.filter(h => !miss.some(r => r.host === h));
    check('no NEW miss', !fresh.length, fresh.map(r => r.host + ': ' + r.type + ' read as ' + r.got).join(' | '));
    check('no known miss the rule now gets right (remove it from KNOWN_SRC_MISSES)', !fixed.length, fixed.join(', '));
    reset();
  });

  // ===================================================================================================================================
  await guard('W2E1-6', async () => {
    reset(); const SN = 'W2E1-6 — the panel gets a "shopping" stage only for a site that sells products (its pages or its services show it); every other site\'s writer jobs are unchanged; the panel kit accepts the stage';
    begin(SN); const check = mkCheck(SN);
    const base = { site_id: 'site_x', domain: 'x.ae', business_name: 'X', business_type: '', country: 'United Arab Emirates', city: 'Dubai', own_market: 'AE-en', markets: ['AE-en'], personas: [], prompts: [], prompts_max: 20, prompts_needed: 10, need_prompts: true,
      topics: ['running shoes'], services: [], gsc_questions: [] };
    const jobsFor = async (p, pages) => { reset(); mock('AI Plan', [{ json: p }]); mock('Load Pages (AI)', (pages.length ? pages : [{}]).map(u => ({ json: u.url ? { site_id: p.site_id, url: u.url } : {} })));
      return (await run('Prompt Jobs', [{ json: {} }])).map(x => x.json).filter(j => !j.skip); };
    const shop = await jobsFor({ ...base, site_id: 'site_runshop-ae', domain: 'runshop.ae', business_type: 'online store' }, [{ url: 'https://runshop.ae/products/nike-pegasus-41' }, { url: 'https://runshop.ae/collections/road' }, { url: 'https://runshop.ae/products/hoka-clifton-9' }, { url: 'https://runshop.ae/about' }]);
    check('a shop (product pages, "online store"): every writer job asks for shopping questions and says why', shop.length >= 1 && shop.every(j => j.shopping === true && /product page/.test(j.shopping_why)), JSON.stringify(shop.map(j => [j.shopping, j.shopping_why])));
    const svc = await jobsFor({ ...base, site_id: 'site_techand-ai', domain: 'techand.ai', services: ['ERP implementation', 'E-invoicing consulting'], topics: ['e-invoicing'] }, [{ url: 'https://techand.ai/services/erp' }, { url: 'https://techand.ai/blog/peppol' }]);
    check('a services firm (techand.ai): no shopping key at all - its jobs are exactly as before', svc.length >= 1 && svc.every(j => !('shopping' in j) && !('shopping_why' in j)), JSON.stringify(svc.map(j => Object.keys(j).filter(k => /shop/.test(k)))));
    const prompt = fs.readFileSync(path.join(CD, 'Prompt_Writer.prompt.txt'), 'utf8');
    check('the writer\'s prompt adds the shopping kind and stage only when the job says so', /\$json\.shopping \? '- shopping:/.test(prompt) && /brand\{\{ \$json\.shopping \? ' \| shopping'/.test(prompt), '');
    const AIP = kitOf('AI_Requests.js', 'AIP');
    check('the panel kit accepts the stage', AIP.stageOf('shopping') === 'shopping' && AIP.stageOf('Shopping') === 'shopping', AIP.stageOf('shopping'));
    reset();
  });
};
