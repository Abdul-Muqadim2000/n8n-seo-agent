// Comp Candidates (E2, DESIGN.md §2.3-§2.5): every domain that competes for the seeds, with what each source says about it, classified a first
// time by rules (KI.classifyDomain) so that only the unclear ones get their homepage read. Sources, each with its basis:
//   results pages (measured, this run or today's cache) | Labs serp_competitors (provider estimate) | Labs competitors_domain of the most
//   frequent rival, its own row skipped (provider estimate, weight 0.5) | AI answers already stored for this site (measured) | declared.
// A Labs answer that could not be read twice leaves its section `missing` with the reason; the run goes on with the results pages.
/*__KI_KITS__*/
const p = $('KI Plan').first().json || {};
const pic = $('Comp SERP Picture').first().json || {};
const all = (n) => { try { return $(n).all().map(i => (i && i.json) || {}); } catch (e) { return []; } };
const cache = all('Load KI Cache').filter(r => r && r.key);
const reqs = all('Any Comp Labs?').filter(r => r && !r.skip && r.ki_call);
const answers = all('Run Comp Labs Answers');
const pairs = KIW.paired(reqs, answers);
const ck = (what, ...x) => KIW.cacheKey(p.site_id, what, ...x);
const read = (k, kind) => { const e = KIW.cacheRead(cache, k); return KIW.fresh(e, kind, p.now, p.ki_force) ? e : null; };
const client = KIW.host(p.domain);
const seeds = (p.seeds || []).map(s => s.keyword);
const saveRows = [];
const sections = [];
// ---- serp_competitors ----
const scKey = ck('sc', p.market, p.seed_key || KIW.seedHash(p.seeds));
let sc = read(scKey, 'ranked');
const scPair = pairs.find(x => x.q.ki_call === 'serp_competitors');
if (scPair && scPair.ok) { sc = { fetched_at: p.now, total: KIW.N(KIW.result0(scPair.a).total_count), items: KIW.itemsOf(scPair.a).map(it => ({ d: KIW.host(it.domain), pos: it.keywords_positions || {}, etv: KIW.N(it.etv), kc: KIW.N(it.keywords_count) })).filter(x => KIW.isBusinessHost(x.d, client)) }; saveRows.push(KIW.cacheRow(p.site_id, scKey, sc)); }
sections.push({ key: 'labs_overlap', ...(sc ? { state: 'ok', reason: (sc.items || []).length ? '' : 'the data provider holds none of these searches in its stored results (common for small B2B markets): competitors come from the live results pages' } : KIW.callState(scPair ? [scPair] : [], 'the provider\'s stored results for your searches')), rows: sc ? (sc.items || []).length : 0 });
// ---- sizes: bulk traffic estimation (keywords, estimated visits) and referring domains ----
const sizes = {}, refd = {};
const te = pairs.find(x => x.q.ki_call === 'bulk_te'), rd = pairs.find(x => x.q.ki_call === 'bulk_rd');
if (te && te.ok) for (const it of KIW.itemsOf(te.a)) { const d = KIW.host(it.target); const o = ((it.metrics || {}).organic) || {}; sizes[d] = { etv: KIW.N(o.etv), keywords: KIW.N(o.count), fetched_at: p.now }; saveRows.push(KIW.cacheRow(p.site_id, ck('size', p.market, d), sizes[d])); }
if (rd && rd.ok) for (const it of KIW.itemsOf(rd.a)) { const d = KIW.host(it.target); refd[d] = { refdomains: KIW.N(it.referring_main_domains != null ? it.referring_main_domains : it.referring_domains), fetched_at: p.now }; saveRows.push(KIW.cacheRow(p.site_id, ck('rd', d), refd[d])); }
for (const r of cache) { const k = KIW.S(r.key); let mm;
  if ((mm = k.match(/^ki:[^:]+:size:[^:]+:(.+)$/)) && !sizes[mm[1]] && KIW.fresh(KIW.cacheRead(cache, k), 'ranked', p.now, p.ki_force)) sizes[mm[1]] = KIW.cacheRead(cache, k);
  if ((mm = k.match(/^ki:[^:]+:rd:(.+)$/)) && !refd[mm[1]] && KIW.fresh(KIW.cacheRead(cache, k), 'backlinks', p.now, p.ki_force)) refd[mm[1]] = KIW.cacheRead(cache, k); }
sections.push({ key: 'sizes', ...((te && !te.ok) || (rd && !rd.ok) ? { state: 'partial', reason: 'the size of some businesses could not be read: ' + [te, rd].filter(x => x && !x.ok).map(x => x.why).join('; ') + ' (shown as "size not known")' } : { state: 'ok', reason: '' }), rows: Object.keys(sizes).length });
// ---- competitors_domain of the most frequent rival (its own first row skipped, R5 §13 C3) ----
const cdRows = {};
for (const x of pairs.filter(x => /^cd:/.test(x.q.ki_call))) { const tgt = KIW.host(x.q.target);
  if (!x.ok) { sections.push({ key: 'rival_overlap', state: 'missing', reason: 'the businesses competing with ' + tgt + ' could not be read: ' + x.why, rows: 0 }); continue; }
  const v = { fetched_at: p.now, total: KIW.N(KIW.result0(x.a).total_count), items: KIW.itemsOf(x.a).map(it => ({ d: KIW.host(it.domain), n: KIW.N(it.intersections), pos: KIW.N(it.avg_position) })).filter(it => it.d !== tgt && KIW.isBusinessHost(it.d, client)) };
  cdRows[tgt] = v; saveRows.push(KIW.cacheRow(p.site_id, ck('cd', p.market, tgt), v)); }
for (const r of cache) { const mm = KIW.S(r.key).match(/^ki:[^:]+:cd:[^:]+:(.+)$/); if (mm && !cdRows[mm[1]] && KIW.fresh(KIW.cacheRead(cache, r.key), 'ranked', p.now, p.ki_force)) cdRows[mm[1]] = KIW.cacheRead(cache, r.key); }
// ---- AI answers already stored (measured; their text is data, only the businesses named are counted) ----
const aiHits = KIW.aiHitsOf(all('Load AI Answers (KI)').filter(r => r && !r.error), all('Load AI Visibility (KI)').filter(r => r && !r.error), client);
const aiRead = all('Load AI Answers (KI)').filter(r => r && r.site_id).length + all('Load AI Visibility (KI)').filter(r => r && r.site_id).length;
// ---- every candidate, with its evidence ----
const stored = all('Load KI Competitors').filter(r => r && KIW.S(r.market) === p.market && r.comp_domain);
const C = {};
const cand = (d) => { const h = KIW.host(d); if (!KIW.isBusinessHost(h, client)) return null; return C[h] || (C[h] = { domain: h, positions: [], titles: [], labs: 0, cd: 0, ai_hits: aiHits[h] || 0, sources: [] }); };
for (const h of Object.values(pic.hosts || {})) { const c = cand(h.domain); if (!c) continue; c.positions = h.positions.slice(0, 20); c.titles = h.titles; c.sources.push('serp'); }
for (const it of ((sc && sc.items) || [])) { const c = cand(it.d); if (!c) continue; c.labs = Object.keys(it.pos || {}).length; if (!c.sources.includes('labs')) c.sources.push('labs');
  for (const [kw, ps] of Object.entries(it.pos || {})) if (!c.positions.some(x => x.seed === KIW.normKw(kw))) c.positions.push({ seed: KIW.normKw(kw), position: (() => { const v = [].concat(ps).map(Number).filter(Number.isFinite); return v.length ? Math.min(...v) : 10; })(), url: '', src: 'labs' }); }
for (const v of Object.values(cdRows)) for (const it of (v.items || [])) { const c = cand(it.d); if (!c) continue; c.cd = Math.max(c.cd, KIW.N(it.n) || 0); if (!c.sources.includes('labs_rival')) c.sources.push('labs_rival'); }
for (const h of Object.keys(aiHits)) { const c = cand(h); if (c && !c.sources.includes('ai')) c.sources.push('ai'); }
for (const d of [...(p.declared || []), ...(p.chosen || [])]) { const c = cand(d); if (c && !c.sources.includes('declared')) c.sources.push('declared'); }
for (const r of stored) cand(r.comp_domain);
const homes = {}; for (const r of cache) { const mm = KIW.S(r.key).match(/^ki:[^:]+:home:(.+)$/); if (mm && KIW.fresh(KIW.cacheRead(cache, r.key), 'homepage', p.now, p.ki_force)) homes[mm[1]] = KIW.cacheRead(cache, r.key); }
const list = Object.values(C).map(c => ({ ...c, cls: KIW.classify(p, c, homes[c.domain]) })).filter(c => c.cls && c.cls.class);
// only the unclear ones are read, the most visible first, and never a site whose class the rules already know
const evidence = (c) => c.positions.length * 3 + c.labs + (c.cd ? 1 : 0) + (c.ai_hits ? 2 : 0);
// FX-L perf H2: only a host that appeared on a results page this run is ever fetched (never one taken from a provider list or a request)
const toRead = list.filter(c => !homes[c.domain] && (c.positions || []).some(x => x.src === 'serp') && ['direct', 'adjacent'].includes(c.cls.class) && (c.cls.needs_review || c.cls.basis === 'rule') && KIW.publicHost(c.domain))
  .sort((a, b) => evidence(b) - evidence(a) || a.domain.localeCompare(b.domain)).slice(0, KIW.CAPS.home_reads).map(c => c.domain);
return [{ json: { candidates: list, sizes, refd, cd: cdRows, sc_total: sc ? sc.total : null, homes, to_read: toRead, ai_rows_read: aiRead, cache_rows: saveRows, sections,
  labs_unavailable: !!(scPair && !scPair.ok) } }];
