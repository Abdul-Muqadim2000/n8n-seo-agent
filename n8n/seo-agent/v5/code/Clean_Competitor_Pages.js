// Turns the raw competitor pages into (1) a per-competitor digest for the analyst, (2) a TERM MODEL — the words and
// phrases most top pages share (what the topic is "made of"), (3) the questions competitors answer, (4) the statistics
// they cite, plus the SERP features from the same search. Longer excerpts than v3 (9,000 chars kept per page).
let input;
try { input = $('Collect Client Pages').first().json; } catch (e) { input = $('Collect Site URLs').first().json; }
const meta = $('Pick Top 6').all();
const pages = $('Read Competitor Pages').all().map(i => ({ json: i.json || {} }));
// pages that were blocked on the first read and recovered through the browser-engine retry replace the blocked ones
let retried_pages = 0;
try {
  const retried = $('Retry Blocked Pages').all();
  const items = $('Blocked Page Items').all().map(i => i.json);
  retried.forEach((r, k) => {
    const idx = items[k] ? items[k].index : null; const rj = r.json || {}; const raw = String(rj.page_text || rj.data || '');
    if (idx == null || rj.error || raw.split(/\s+/).length < 120 || /captcha|cloudflare ray id|access denied|just a moment|verify you are human/i.test(raw.slice(0, 1500))) return;
    pages[idx] = { json: { ...rj, retried: true } }; retried_pages++;
  });
} catch (e) {}

const competitors = [];
const failed = [];
const stripMd = (s) => String(s || '')
  .replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[\s*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/https?:\/\/\S+/g, '').replace(/[*_`]+/g, '').replace(/[ \t]+/g, ' ').trim();
const junk = /cookie|consent|privacy|opt[- ]?out|personal (data|information)|gdpr|advertising|storage related|targeted|all rights reserved|copyright|©|trademark|terms (&|and) conditions|opens in a new (tab|window)|follow us|sign in|sign up|log in|register for free|create an account|password|download the app|lost network connectivity|javascript|browser settings|newsletter|subscribe|view all|happy to accept|save my preferences|^description |^duration /i;

pages.forEach((p, i) => {
  const j = p.json || {};
  const info = meta[i]?.json || {};
  const raw = String(j.page_text || j.data || j.body || '');
  if (info.no_competitors && !info.url) return;   // Pick Top 6's "nothing to read" placeholder is not a failed page
  if (j.error || !raw || !info.url) { failed.push({ url: info.url, reason: j.error ? (j.error.message || JSON.stringify(j.error)).slice(0, 150) : 'Empty response' }); return; }
  const lines = raw.replace(/^(Title|URL Source|Markdown Content|Published Time):.*$/gm, '').split('\n');
  const headings = [...new Set(lines.filter(l => /^#{1,3}\s/.test(l.trim())).map(l => { const level = l.trim().match(/^#+/)[0].length; return 'H' + level + ': ' + stripMd(l.replace(/^#+\s*/, '')); }).filter(h => h.length > 5 && !junk.test(h)))].slice(0, 30);
  const seenLines = new Set();
  const body = lines.map(l => l.trim()).filter(l => {
    const isHeading = /^#{1,6}\s/.test(l);
    const clean = stripMd(l.replace(/^[*\-•]\s*/, '').replace(/^#+\s*/, ''));
    if (!clean || junk.test(clean)) return false;
    if (!isHeading && clean.split(/\s+/).length < 6) return false;
    const key = clean.toLowerCase(); if (seenLines.has(key)) return false; seenLines.add(key); return true;
  }).map(l => /^#{1,6}\s/.test(l) ? '\n## ' + stripMd(l.replace(/^#+\s*/, '')) : stripMd(l.replace(/^[*\-•]\s*/, ''))).join('\n')
    .replace(/(\n## [^\n]+)(?=\n## |\s*$)/g, '').replace(/\n{3,}/g, '\n\n').trim();
  const blocked = /captcha|cloudflare ray id|access denied|just a moment/i.test(raw.slice(0, 800));
  const words = body.split(/\s+/).filter(Boolean).length;
  if (blocked || words < 80) { failed.push({ url: info.url, reason: blocked ? 'Blocked by CAPTCHA / bot protection' : `Too little text (${words} words)` }); return; }
  const has_author = /\b(by|author|written by|reviewed by)\s+[A-Z][a-z]+\s+[A-Z][a-z]+/.test(raw.slice(0, 3000)) || /Published Time:/.test(raw);
  const has_date = /\b(20[12]\d)\b/.test(raw.slice(0, 2500));
  competitors.push({ rank: info.rank, url: info.url, domain: info.domain, title: info.title, snippet: info.snippet, word_count: words, headings,
    has_author, has_date, lists: (body.match(/^\s*(\d+\.|[-*•])\s/gm) || []).length, tables: (raw.match(/^\|.*\|$/gm) || []).length,
    content: body.slice(0, 4500), content_full: body.slice(0, 9000) });
});
competitors.splice(6);
const avg = competitors.length ? Math.round(competitors.reduce((s, c) => s + c.word_count, 0) / competitors.length) : 1500;

// ---------- term model (1-3 word phrases shared by at least half of the competitors) ----------
const STOP = new Set('a an the and or but if then else when while of for to in on at by with from as is are was were be been being it its this that these those they them their there here you your we our us i me my he she his her which who whom whose what where why how all any each few more most other some such no nor not only own same so than too very can will just do does did done have has had having would could should may might must shall into over under again further about above below between through during before after out off up down also because until while both per via etc'.split(' '));
// generic business words are useless as single terms (they still count inside multi-word phrases)
const GENERIC = new Set('business businesses company companies help helps helping solution solutions need needs needed project projects team teams time times way ways work works working use used using make makes making get gets getting provide provides providing ensure ensures right best better good great new different important service services year years day days people thing things lot part parts number including based also well like one two three first second many much more most every able high low large small long key main specific several various within across throughout during ahead forward often always free full end top type types level levels example examples case cases result results option options area areas point points plan plans today experience experienced expert experts professional professionals partner partners client clients customer customers organization organizations organisation organisations industry industries process processes system systems software contact learn read'.split(' '));
const tokens = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9\s'-]/g, ' ').split(/\s+/).filter(w => w && w.length > 2 && !/^\d+$/.test(w)).slice(0, 3500);
const grams = (toks) => { const g = new Map(); const add = (s) => g.set(s, (g.get(s) || 0) + 1);
  for (let i = 0; i < toks.length; i++) { const a = toks[i]; if (!STOP.has(a)) add(a);
    if (i + 1 < toks.length) { const b = toks[i + 1]; if (!STOP.has(a) && !STOP.has(b)) add(a + ' ' + b);
      if (i + 2 < toks.length) { const c = toks[i + 2]; if (!STOP.has(a) && !STOP.has(c)) add(a + ' ' + b + ' ' + c); } } }
  return g; };
const docs = competitors.map(c => grams(tokens(c.content_full)));
const df = new Map(), tf = new Map();
docs.forEach(g => { for (const [k, v] of g) { df.set(k, (df.get(k) || 0) + 1); tf.set(k, (tf.get(k) || 0) + v); } });
const minDocs = Math.max(2, Math.ceil(docs.length / 2));
const kwToks = new Set(tokens(input.keyword));
const ranked = [...df.entries()].filter(([k, n]) => n >= minDocs)
  .map(([k, n]) => ({ term: k, docs: n, avg_count: +(tf.get(k) / n).toFixed(1), words: k.split(' ').length }))
  .filter(t => !t.term.split(' ').every(w => kwToks.has(w)) && !/^(\w+) \1$/.test(t.term) && !(t.words === 1 && GENERIC.has(t.term)))
  .sort((a, b) => b.words - a.words || b.docs - a.docs || b.avg_count - a.avg_count);   // longer phrases first
// keep a phrase only if no longer phrase already kept contains it with the same reach (avoids data / cloud data / cloud data support)
const term_model = [];
for (const t of ranked) {
  if (term_model.some(k => k.docs >= t.docs && (' ' + k.term + ' ').includes(' ' + t.term + ' '))) continue;
  term_model.push(t);
}
term_model.sort((a, b) => b.docs - a.docs || b.avg_count - a.avg_count);
const uni = term_model.filter(t => t.words === 1).slice(0, 12), multi = term_model.filter(t => t.words > 1).slice(0, 28);
term_model.splice(0, term_model.length, ...multi.sort((a, b) => b.docs - a.docs || b.avg_count - a.avg_count), ...uni.sort((a, b) => b.docs - a.docs || b.avg_count - a.avg_count));   // phrases first, then single words

// ---------- questions competitors answer, statistics they cite ----------
const competitor_questions = [...new Set(competitors.flatMap(c => c.headings.map(h => h.replace(/^H\d: /, '')).filter(h => /\?$/.test(h) || /^(how|what|why|when|which|where|who|can|do|does|is|are|should)\b/i.test(h))))].slice(0, 15);
const stats_seen = [];
for (const c of competitors) {
  const sents = c.content_full.split(/(?<=[.!?])\s+/);
  for (const s of sents) {
    if (stats_seen.length >= 15) break;
    if (/\d/.test(s) && /(%|percent|\$|€|£|aed|sar|pkr|inr|million|billion|thousand|\bhours?\b|\bdays?\b|\bweeks?\b|\bmonths?\b|\byears?\b)/i.test(s) && s.length > 40 && s.length < 260) stats_seen.push({ domain: c.domain, text: s.trim() });
  }
}

// ---------- SERP features (from the same SERP call) ----------
// 2026-10-09: the answer of the retry when the first call failed; a failed call (DataForSEO 50000 "Internal Server Error." with
// HTTP 200, or an HTTP error) is "unavailable", never "no featured snippet / no AI Overview" (the verdict used to claim that).
let serpItems = []; let seCount = null; let serpError = '';
try {
  let sj; try { sj = $('SERP Top 10 (Retry)').first().json; } catch (e) { sj = $('SERP Top 10').first().json; }
  sj = sj || {}; const t0 = (Array.isArray(sj.tasks) ? sj.tasks[0] : null) || {};
  if (sj.error || Number(sj.status_code) >= 40000 || !Array.isArray(sj.tasks) || Number(t0.status_code) >= 40000)
    serpError = String((sj.error && (sj.error.message || sj.error)) || t0.status_message || sj.status_message || 'no answer').slice(0, 120);
  const res = (t0.result || [])[0] || {}; serpItems = res.items || []; seCount = res.se_results_count ?? null;
} catch (e) { serpItems = []; serpError = 'no answer'; }
const norm = (d) => String(d || '').toLowerCase().replace(/^www\./, '');
const paa = [], related = [], forum = []; let featured = null, aio = null; const featureTypes = new Set();
for (const it of serpItems) {
  featureTypes.add(it.type);
  if (it.type === 'people_also_ask') (it.items || []).forEach(q => { const t = q.title || q.question || ''; if (t && !paa.includes(t)) paa.push(t); });
  else if (it.type === 'related_searches') (it.items || []).forEach(q => { const t = typeof q === 'string' ? q : (q.title || q.keyword || ''); if (t && !related.includes(t)) related.push(t); });
  else if (it.type === 'discussions_and_forums') (it.items || []).forEach(q => { const t = q.title || ''; if (t) forum.push({ title: t, source: norm(q.domain || q.source || ''), url: q.url || '' }); });
  else if (it.type === 'featured_snippet' && !featured) featured = { domain: norm(it.domain), title: it.title || '', text: String(it.description || it.text || '').slice(0, 400), url: it.url || '' };
  else if (it.type === 'ai_overview' && !aio) {
    const texts = []; (it.items || []).forEach(x => { if (x.text) texts.push(x.text); if (x.title) texts.push(x.title); });
    const refs = []; (it.references || []).forEach(r => refs.push(norm(r.domain || String(r.url || '').replace(/^https?:\/\//, '').split('/')[0])));
    (it.items || []).forEach(x => (x.references || []).forEach(r => refs.push(norm(r.domain || String(r.url || '').replace(/^https?:\/\//, '').split('/')[0]))));
    aio = { present: true, text: texts.join(' ').slice(0, 800), cited_domains: [...new Set(refs.filter(Boolean))].slice(0, 12) };
  }
}
const serp_features = { se_results_count: seCount, people_also_ask: paa.slice(0, 12), related_searches: related.slice(0, 10), forum_threads: forum.slice(0, 6),
  featured_snippet: featured, ai_overview: aio || { present: false, text: '', cited_domains: [] }, features_present: [...featureTypes].filter(t => t !== 'organic'),
  video_results: featureTypes.has('video'), shopping_results: featureTypes.has('shopping') || featureTypes.has('popular_products'), local_pack: featureTypes.has('local_pack') || featureTypes.has('map') };
if (serpError) Object.assign(serp_features, { unavailable: true, error: serpError, ai_overview: { present: null, text: '', cited_domains: [] } });

const digest = competitors.map(c => `\n=== COMPETITOR #${c.rank}: ${c.domain} ===\nURL: ${c.url}\nTitle: ${c.title}\nMeta Description: ${c.snippet}\nUseful Word Count: ${c.word_count} · Named author: ${c.has_author ? 'yes' : 'no'} · Dated: ${c.has_date ? 'yes' : 'no'} · Lists: ${c.lists} · Tables: ${c.tables}\nHeadings:\n${c.headings.join('\n')}\n\nContent Excerpt:\n${c.content}\n`).join('\n');
const serpDigest = serpError ? 'LIVE GOOGLE RESULTS: unavailable for this run (the search data provider failed: ' + serpError + '). There is no information about the pages in the top 10, a featured snippet, People Also Ask or an AI Overview for this query: do not state or assume whether any of them appear, and say that the results page could not be checked.' : [
  featured ? `FEATURED SNIPPET (held by ${featured.domain}): "${featured.text}"` : 'FEATURED SNIPPET: none',
  serp_features.ai_overview.present ? `AI OVERVIEW: present, cites ${serp_features.ai_overview.cited_domains.join(', ') || 'unknown sources'}. Summary: ${serp_features.ai_overview.text.slice(0, 500)}` : 'AI OVERVIEW: not shown for this query',
  paa.length ? 'PEOPLE ALSO ASK:\n- ' + paa.slice(0, 12).join('\n- ') : 'PEOPLE ALSO ASK: none',
  related.length ? 'RELATED SEARCHES: ' + related.slice(0, 10).join(' | ') : '',
  forum.length ? 'FORUM THREADS ON PAGE 1: ' + forum.map(f => f.title + ' (' + f.source + ')').join(' | ') : '',
  'OTHER SERP FEATURES: ' + (serp_features.features_present.join(', ') || 'none')
].filter(Boolean).join('\n');
const termDigest = term_model.slice(0, 30).map(t => `${t.term} (${t.docs}/${competitors.length} pages, ~${t.avg_count}x)`).join('; ');

return [{ json: { ...input, competitors, competitors_read: competitors.length, retried_pages, avg_competitor_words: avg, failed_pages: failed,
  competitor_digest: digest, serp_features, serp_digest: serpDigest, term_model, term_digest: termDigest, competitor_questions, stats_seen } }];
