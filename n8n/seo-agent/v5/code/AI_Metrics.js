// Per site (v4.9): how often AI answers name / cite the business over the past 7 days (this run's answers + the daily AI Pulse samples) with a 95%
// interval, the position-weighted visibility score (questions weighted by their monthly AI search volume), share of voice against the competitors
// (brands named without a website count too), the per-engine picture, per buyer stage and topic cluster, the sources AI trusts (PR and listing
// targets), your pages it cites, the questions where competitors win (with the demand they carry), what AI searched to write its answers (fan-out),
// how AI speaks of the business and what it gets wrong, the visits / key events / revenue AI assistants send (GA4), whether AI crawlers may read the
// site, the market-wide index (the AI-answer database: your share against the competitors across every answer, not only the panel), the monthly
// market view, changes that are statistically real, alerts and value-ranked actions. Also the seo_ai_visibility row, 'ai_source' link prospects
// and the learned brand names (seo_cache).
/*__AI_STATS__*/
/*__AI_PANEL__*/
/*__DRAFTS__*/
/*__DFS_RETRY__*/
/*__RIVALS__*/
// G6 (2026-10-18, AI_VISIBILITY_SPEC.md §10): a weekly run split across executions is measured ONCE, in its last execution, over every answer
// of the run — this execution's and the ones earlier executions stored (seo_ai_answers, same run_id). A site whose run continues in another
// execution is not measured here (AI Chunk Handoff states its money); with no site finishing here the node says so and the report path ends.
const allPlans = $('AI Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
const plans = allPlans.filter(p => !p.chunk || p.chunk.final_expected);
if (!plans.length) return [{ json: { skip: true, nothing_final: true, reason: 'every site of this execution continues its run in another execution; the week is measured in the last one' } }];
let rows = []; try { rows = $('Apply Analysis').all().map(i => i.json).filter(r => !r.skip && r.engine); } catch (e) {}
if (!rows.length) { try { rows = $('Parse AI Answers').all().map(i => i.json).filter(r => !r.skip && r.engine); } catch (e) {} }
{ const seen = new Set(rows.map(r => r.site_id + '|' + r.run_id + '|' + r.prompt_id + '|' + r.engine)); const tb = (v) => v === true || String(v) === 'true';
  let stored = []; try { stored = $('Load AI Run Answers').all().map(i => i.json).filter(r => r && r.run_id && r.engine && r.prompt_id); } catch (e) {}
  for (const r of stored) { const p0 = plans.find(p => p.site_id === r.site_id && p.run_id === r.run_id && p.chunk && p.chunk.going); if (!p0) continue;
    const k = r.site_id + '|' + r.run_id + '|' + r.prompt_id + '|' + r.engine; if (seen.has(k)) continue; seen.add(k);
    rows.push({ ...r, answered: tb(r.answered), mentioned: tb(r.mentioned), cited: tb(r.cited), rank: Number(r.rank) || 0, cost: Number(r.cost) || 0, _stored: true }); } }
let reqs = [], resps = []; try { reqs = $('AI Requests').all().map(i => i.json); resps = $('Run AI Requests').all().map(i => i.json || {}); } catch (e) {}
try { const mg = $('Merge AI Answers').all().map(i => i.json || {}); if (mg.length === resps.length) resps = mg; } catch (e) {}   // D19: with the retry gate the merged answers replace the first, failed ones (same order)
let prospects = []; try { prospects = $('Load Link Prospects').all().map(i => i.json).filter(x => x && x.prospect_domain); } catch (e) {}
let treq = [], tres = []; try { treq = $('Traffic Requests').all().map(i => i.json).filter(q => !q.skip); tres = $('GA4 AI Report').all().map(i => i.json || {}); } catch (e) {}
let access = []; try { access = $('AI Access').all().map(i => i.json).filter(a => a && a.site_id); } catch (e) {}
let ajobs = [], aouts = []; try { ajobs = $('Analyst Jobs').all().map(i => i.json).filter(j => !j.skip); aouts = $('Answer Analyst').all().map(i => i.json || {}); } catch (e) {}
let dreq = [], dres = []; try { dreq = $('Discovery Requests').all().map(i => i.json); dres = $('Run Discovery').all().map(i => i.json || {}); } catch (e) {}
let freshP = []; try { freshP = $('Prompt Rows').all().map(i => i.json).filter(r => !r.skip && r.prompt_id); } catch (e) {}   // questions written or updated this run (stage, cluster, volume)
const GENERIC_SOCIAL = /(^|\.)(youtube\.com|linkedin\.com|facebook\.com|instagram\.com|x\.com|twitter\.com|tiktok\.com|reddit\.com|quora\.com|wikipedia\.org|medium\.com)$/i;
const MEDIA = /(^|\.)(gulfnews|khaleejtimes|thenationalnews|zawya|arabianbusiness|gulfbusiness|reuters|bloomberg|forbes|cnbc|bbc|ft|wsj|techcrunch|entrepreneur|economist|businessinsider|thenational|arabnews|timesofindia|dawn)\.[a-z.]+$/i;
const DIRECTORY = /(^|\.)(g2|capterra|clutch|trustpilot|goodfirms|getapp|softwareadvice|crunchbase|yelp|sortlist|designrush|themanifest|[a-z-]*yellowpages[a-z-]*|[a-z-]*directory[a-z-]*)\.[a-z.]+$/i;
const AUTHORITY = /(^|\.)(deloitte|pwc|kpmg|ey|gartner|forrester|mckinsey|accenture|statista|bcg|bain|idc)\.[a-z.]+$/i;
const GOV = /\.gov(\.[a-z]{2})?$|(^|\.)u\.ae$|\.int$|\.edu(\.[a-z]{2})?$/i;
const kindOf = (d) => GOV.test(d) ? 'official' : GENERIC_SOCIAL.test(d) ? 'platform' : MEDIA.test(d) ? 'media' : DIRECTORY.test(d) ? 'directory' : AUTHORITY.test(d) ? 'authority' : 'site';
const pct = (a, b) => b ? Math.round(1000 * a / b) / 10 : 0;
const ENG = { chatgpt: 'ChatGPT', perplexity: 'Perplexity', gemini: 'Gemini', claude: 'Claude', ai_overview: 'Google AI Overview', ai_mode: 'Google AI Mode', copilot: 'Copilot' };
const FORM_URL = '__FORM_URL__', API_URL = '__API_URL__';
const parseJ = (raw) => { if (raw && typeof raw === 'object') return raw; const s = String(raw || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, ''); try { return JSON.parse(s); } catch (e) { const a = s.indexOf('{'), b = s.lastIndexOf('}'); try { return JSON.parse(s.slice(a, b + 1)); } catch (e2) { return null; } } };
const normD = (x) => String(x || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const list = (s) => String(s || '').split(/,\s*/).filter(Boolean);
const task0 = (r) => ((r || {}).tasks || [])[0] || {};
// B-A10 (2026-10-15, INVARIANTS rule 3 + R28): a discovery answer's own money across BOTH attempts. The in-200 gate puts it on
// the item, because the merged item is the retry's and a first attempt that was billed and then replaced would vanish from the bill.
const dCost = (r) => { const v = Number((r || {}).__dfs_cost_usd); return Number.isFinite(v) ? v : (Number(task0(r).cost) || 0); };
const gErr = (r) => { if (!r) return 'no response'; const e = r.error; if (!e) return null; if (typeof e === 'string') return e.slice(0, 200); const ctx = (e.context && e.context.data) || {}; const inner = (ctx.error && typeof ctx.error === 'object') ? ctx.error : null; return String((inner && inner.message) || e.message || e.status || JSON.stringify(e)).slice(0, 200); };
const assistantOf = (src) => { const s = String(src || '').toLowerCase(); return /chatgpt|openai/.test(s) ? 'ChatGPT' : /perplexity/.test(s) ? 'Perplexity' : /gemini|bard/.test(s) ? 'Gemini' : /copilot|edgeservices\.bing/.test(s) ? 'Copilot' : /claude|anthropic/.test(s) ? 'Claude' : /deepseek/.test(s) ? 'DeepSeek' : /grok/.test(s) ? 'Grok' : /meta\.ai/.test(s) ? 'Meta AI' : /mistral/.test(s) ? 'Mistral' : (s || 'Other AI'); };
const weekOf = (d) => { const t = new Date(d + 'T00:00:00Z'); const wd = (t.getUTCDay() + 6) % 7; return new Date(t.getTime() - wd * 864e5).toISOString().slice(0, 10); };
return plans.map(p => {
  const Rall = rows.filter(r => r.site_id === p.site_id);
  // the brand question ("what is <brand>?") only measures recognition: rates, share of voice and competitors use the buyer questions
  const RB = Rall.filter(r => r.kind === 'brand'), R = Rall.filter(r => r.kind !== 'brand');
  // headline figures use the weekly engines (Claude, monthly, appears per engine) plus the AI Pulse samples of the past days on the fast engines
  const MONTHLY = p.monthly_engines || [];
  const RC = R.filter(r => !MONTHLY.includes(r.engine));
  const ans = RC.filter(r => r.answered); const ansAll = Rall.filter(r => r.answered);
  // D19 (2026-10-11): every rate below counts answered requests only — 7 of 42 requests of exec 362 / 363 failed (DataForSEO
  // "Internal SE Server Error" inside an HTTP 200 x5, ChatGPT "no response" x2) and the report said nothing about them. The
  // failures are now named per engine with their message (the retry gate has already re-sent each of them once).
  const errorRows = Rall.filter(r => r.error);
  const errors = errorRows.length;
  const errMap = new Map();
  for (const r of errorRows) { const k = r.engine + '|' + String(r.error).slice(0, 80); const x = errMap.get(k) || { engine: ENG[r.engine] || r.engine, message: String(r.error).slice(0, 160), count: 0 }; x.count++; errMap.set(k, x); }
  const error_list = [...errMap.values()].sort((a, b) => b.count - a.count).slice(0, 8);
  const retry = (() => { try { const m = $('Merge AI Answers').first().json || {}; return { asked: Number(m.retry_asked) || 0, answered: Number(m.retry_answered) || 0 }; } catch (e) { return { asked: 0, answered: 0 }; } })();
  const error_rate = pct(errors, Rall.length);
  const PR = p.pulse_rows || [];
  const pulseN = PR.reduce((s, d) => s + d.samples, 0), pulseM = PR.reduce((s, d) => s + d.mentioned, 0), pulseC = PR.reduce((s, d) => s + d.cited, 0);
  // ---- B8-3 (2026-10-15, benchmark area 8, INVARIANTS rule 1): the week's headline pools the daily pulse answers straight into
  // `samples` and `mentioned`, and a pulse morning on which one engine returned nothing contributes a DIFFERENT mix of engines.
  // The engines do not agree with each other — exec 526 (2026-10-13) measured ChatGPT and Google AI Mode at different citation
  // rates on the same panel — so a broken morning quietly reweights the week, and nothing said how many of the counted answers
  // came from one. The days are still pooled (throwing them away loses real answers); what changes is that the report can say so.
  const pulseSets = PR.map(d => ({ date: d.date, samples: Number(d.samples) || 0,
    engines: Object.entries(d.engines || {}).filter(([, v]) => (Number((v || {}).answered) || 0) > 0).map(([e]) => e).sort(),
    missing: Object.entries(d.engines || {}).filter(([, v]) => (Number((v || {}).asked) || 0) > 0 && !(Number((v || {}).answered) || 0)).map(([e]) => ENG[e] || e) }));
  const fullSet = pulseSets.reduce((best, d) => d.engines.length > best.length ? d.engines : best, []);
  const partialDays = pulseSets.filter(d => d.engines.join('+') !== fullSet.join('+'));
  const partialAnswers = partialDays.reduce((s, d) => s + d.samples, 0);
  // A5 / R95 (2026-10-16): `seo_ai_daily` holds a scheduled AND an on-demand reading for one date, so PR counts READINGS. The days
  // are the distinct dates; the note says both when they differ.
  const pulseDates = [...new Set(PR.map(d => String(d.date || '').slice(0, 10)).filter(Boolean))];
  const pulseDays = pulseDates.length || PR.length;
  const pulse_basis = PR.length ? { days: pulseDays, readings: PR.length, answers: pulseN, engines: fullSet.map(e => ENG[e] || e), basis: 'measured',
    partial_days: partialDays.map(d => ({ date: d.date, answers: d.samples, engines: d.engines.map(e => ENG[e] || e), missing: d.missing })), partial_answers: partialAnswers,
    note: (PR.length === pulseDays ? pulseDays + ' daily pulse day(s) are' : PR.length + ' daily pulse readings on ' + pulseDays + ' day(s) are') + ' counted in the figures below (' + pulseN + ' of the ' + (ans.length + pulseN) + ' answers)'
      + (partialDays.length ? ', and ' + partialDays.length + ' of them did not reach every engine (' + partialAnswers + ' answer(s) from '
        + partialDays.map(d => d.date + (d.missing.length ? ': no answer from ' + d.missing.join(', ') : ': ' + (d.engines.length || 'no') + ' engine(s) only')).join('; ') + ')' : '') + '.' } : null;
  // B8-5: *AI Requests* stops adding requests at 900 / $15 ($4 on the pulse) and records what it dropped in `skipped_by_cap` — which
  // nothing has ever read. A capped run asks fewer engines of fewer questions, every rate below is measured on what was left, and the
  // panel simply looked shorter. Named here, printed in the report (INVARIANTS rule 1).
  const capped = (() => { const s0 = ((reqs[0] || {}).skipped_by_cap || (reqs[0] || {}).skipped || []).filter(x => String(x).indexOf(p.domain + ':') === 0);
    if (!s0.length) return null; const byE = new Map(); for (const x of s0) { const e = String(x).split(':')[1] || ''; byE.set(e, (byE.get(e) || 0) + 1); }
    return { requests: s0.length, engines: [...byE.entries()].map(([e, k]) => ({ engine: ENG[e] || e, requests: k })), basis: 'not_available',
      note: s0.length + ' request(s) were not sent: this run reached its request or cost limit, so '
        + [...byE.entries()].map(([e, k]) => k + ' × ' + (ENG[e] || e)).join(', ') + ' were left unasked. Every rate below is measured on the answers that were asked for.' }; })();
  const mentioned = ans.filter(r => r.mentioned).length + pulseM, cited = ans.filter(r => r.cited).length + pulseC, samples = ans.length + pulseN;
  const ranks = ans.filter(r => r.rank > 0).map(r => Number(r.rank));
  const meta = new Map([...p.prompts, ...freshP.filter(r => r.site_id === p.site_id)].map(q => [q.prompt_id, q]));
  const volOf = new Map([...meta.values()].map(q => [q.prompt_id, Number(q.volume) || 0]));
  // competitors: configured ones always; plus businesses AI names in at least 2 answers (domains, or brand names without a known website)
  const counts = new Map(); const bump = (d, n) => counts.set(d, (counts.get(d) || 0) + n);
  for (const r of ans) for (const d of list(r.competitors)) bump(d, 1);
  for (const d of PR) for (const [k, n] of Object.entries(d.competitors || {})) bump(k, Number(n) || 0);
  { const merged = mergeBrands([...counts.entries()], p.aliases); counts.clear(); for (const [k, v] of merged) counts.set(k, v.reduce((x, y) => x + y, 0)); }   // "ClearTax" and cleartax.com are one business
  const comp = [...new Set([...p.configured_competitors, ...[...counts.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).map(([d]) => d)])].slice(0, 8)
    .map(d => ({ domain: d, mentions: counts.get(d) || 0, auto: !p.configured_competitors.includes(d), named_only: !/\./.test(d) }));
  // ---- R83 (2026-10-16, re-rating defect C-7): the businesses AI recommends INSTEAD of you are never a place to "get featured".
  // `comp` above is the 8-row display table ("Who AI recommends instead"); exec 623 kept cleartax … sap there, and wafeq.com — named
  // as an alternative in 10 answers, outside the cut — came out as "Get featured on wafeq.com" and as an `ai_source` link prospect,
  // with edicomgroup.com, aiverix.ae, comarch.com, pagero.com, flick.network and velmontcrest.ae. The EXCLUSION set is not the display
  // set: every configured competitor, every business named in two or more answers (this run and the pulse), and every business the
  // Answer Analyst has learned a website for (the `ai_brands:` aliases, this run's included) — compared by registrable domain, so
  // europe.thomsonreuters.com is Thomson Reuters. Only a plain business site can be a rival: an official body, a platform, a news
  // site, a directory or a research firm keeps its own kind (mof.gov.ae stays "official").
  const regD = (h) => { const x = normD(h); const parts = x.split('.').filter(Boolean); if (parts.length <= 2) return x;
    const sl = parts.slice(-2).join('.'); return /^(co|com|org|net|gov|ac|edu|ltd|plc|sch|nic|mil)\.[a-z]{2}$/.test(sl) ? parts.slice(-3).join('.') : sl; };
  const learned = {}; ajobs.forEach((j, i) => { if (j.site_id !== p.site_id) return; const o = aouts[i] && !aouts[i].error ? parseJ(aouts[i].output) : null; for (const a of ((o && o.answers) || [])) for (const b of ((a && a.brands) || [])) { const nm = String((b && b.name) || '').trim(), d = normD(b && b.domain); if (nm.length >= 3 && nm.length <= 60 && brandish(nm) && /\./.test(d) && d !== p.domain && !d.endsWith('.' + p.domain) && !p.brand_names.some(x => String(x).toLowerCase() === nm.toLowerCase())) learned[nm] = d; } });   // D19: only a name that reads like a business name is learned
  const ownReg = regD(p.domain); const rivalSet = new Set();
  const addRival = (d) => { const x = regD(d); if (x && /\./.test(x) && x !== ownReg && kindOf(x) === 'site') rivalSet.add(x); };
  for (const d of (p.configured_competitors || [])) addRival(d);
  for (const [d, n] of counts.entries()) if (n >= 2) addRival(d);
  for (const d of [...Object.values(p.aliases || {}), ...Object.values(learned)]) addRival(d);
  const isRival = (h) => rivalSet.has(regD(h));
  const compTotal = comp.reduce((s, c) => s + c.mentions, 0);
  const share_of_voice = pct(mentioned, mentioned + compTotal);
  comp.forEach(c => { c.share = pct(c.mentions, mentioned + compTotal); });
  // per engine (this run + pulse samples)
  const engines = {};
  const carriedE = (p.carried && p.carried.engines) || {};
  for (const e of p.engines) { const er = R.filter(r => r.engine === e), ea = er.filter(r => r.answered); const eb = RB.filter(r => r.engine === e && r.answered);
    const pe = PR.reduce((t, d) => { const x = (d.engines || {})[e] || {}; return { n: t.n + (Number(x.answered) || 0), m: t.m + (Number(x.mentioned) || 0), c: t.c + (Number(x.cited) || 0) }; }, { n: 0, m: 0, c: 0 });
    if (!er.length && !pe.n && carriedE[e] && Number(carriedE[e].asked) > 0) { engines[e] = { ...carriedE[e], name: ENG[e] || e, carried: true, checked_at: carriedE[e].checked_at || p.carried.checked_at }; continue; }   // not asked this week: last full run
    const n = ea.length + pe.n, m = ea.filter(r => r.mentioned).length + pe.m, c = ea.filter(r => r.cited).length + pe.c;
    engines[e] = { name: ENG[e] || e, asked: er.length, answered: ea.length, samples: n, mentioned: m, cited: c, mention_rate: pct(m, n), citation_rate: pct(c, n), ci: wilson(m, n), errors: Rall.filter(r => r.engine === e && r.error).length,
      knows_brand: eb.length ? eb.some(r => r.mentioned) : null, pulse_samples: pe.n, sentiment: (() => { const s = ea.filter(r => r.sentiment); return s.length ? Math.round(100 * (s.filter(r => r.sentiment === 'positive').length - s.filter(r => r.sentiment === 'negative').length) / s.length) : null; })() }; }
  const aio = R.filter(r => r.engine === 'ai_overview');
  // R84 (2026-10-16): a request that FAILED did not show whether Google shows an AI Overview, so it is not in the presence denominator
  // (exec 623: 5 shown, 1 with none, 1 failed = 5 of 6, 83.3%, not 5 of 7). The failure is still named in the failure line.
  const aioRead = aio.filter(r => !r.error);
  const aio_basis = { requests: aio.length, read: aioRead.length, shown: aio.filter(r => r.answered).length, failed: aio.length - aioRead.length };
  const aio_presence = pct(aio_basis.shown, aioRead.length), aio_citation_rate = pct(aio.filter(r => r.cited).length, aio.filter(r => r.answered).length);
  // sources AI cites (not you, not a competitor): where to get listed / featured
  const src = new Map();
  const citedOf = (r) => { try { const v = JSON.parse(r.cited_urls || '[]'); return Array.isArray(v) ? v.filter(x => x && x.u) : []; } catch (e) { return []; } };   // v4.12: the exact pages cited
  const hostOfU = (u) => { const m = String(u || '').match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); return m ? m[1].toLowerCase().replace(/^www\./, '') : ''; };
  const rivalSrc = new Map(); const asRival = (h, n) => { const k = regD(h); rivalSrc.set(k, (rivalSrc.get(k) || 0) + n); };   // R83: cited, but a business AI names instead of you
  for (const r of ansAll) for (const h of list(r.sources)) { if (h === p.domain || h.endsWith('.' + p.domain)) continue; if (comp.some(c => c.domain === h) || isRival(h)) { asRival(h, 1); continue; } const s = src.get(h) || { domain: h, citations: 0, engines: new Set(), topics: new Set(), urls: new Map() }; s.citations++; s.engines.add(ENG[r.engine] || r.engine); if (r.topic) s.topics.add(r.topic);
    for (const c of citedOf(r)) if (hostOfU(c.u) === h) { const x = s.urls.get(c.u) || { u: c.u, t: c.t || '', n: 0 }; x.n++; if (!x.t && c.t) x.t = c.t; s.urls.set(c.u, x); } src.set(h, s); }
  for (const d of PR) for (const [h, n] of Object.entries(d.sources || {})) { if (h === p.domain || h.endsWith('.' + p.domain)) continue; if (comp.some(c => c.domain === h) || isRival(h)) { asRival(h, Number(n) || 0); continue; } const s = src.get(h) || { domain: h, citations: 0, engines: new Set(), topics: new Set(), urls: new Map() }; s.citations += Number(n) || 0; s.engines.add('daily'); src.set(h, s); }
  // C-2 (re-rating 2026-10-17): a cited site that SELLS your category is a rival too, whatever AI said about it - erp-dubai.ae ("ERPNext
  // Implementation Partner in UAE & Dubai") and penieltech.com (/blog/odoo-implementation-umm-al-quwain) were labelled "site (PR target)" and
  // written as ai_source prospects. Judged by the one rule the Link Builder and AI Growth use (RV.providerOf): its cited page's title or address.
  const vendorWhy = new Map();
  for (const s of [...src.values()]) { if (kindOf(s.domain) !== 'site') continue; let why = '';
    for (const x of s.urls.values()) { why = RV.providerOf({ domain: s.domain, title: x.t, url: x.u, topics: p.topics || [], services: p.services || [] }); if (why) break; }
    if (why) { vendorWhy.set(regD(s.domain), why); asRival(s.domain, s.citations); src.delete(s.domain); } }
  const rival_sources = [...rivalSrc.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([domain, citations]) => vendorWhy.has(domain) ? { domain, citations, kind: 'vendor', why: vendorWhy.get(domain) } : { domain, citations, kind: 'rival' });
  // what is STORED is the whole set (rival_sources_json): the cited rivals above, every other vendor, and every business AI named (aliases, two or
  // more answers, configured), so AI Growth, the Backlink Monitor and the Link Builder read the same rivals this run saw - not its top ten
  const rival_store = [...rival_sources, ...[...vendorWhy.entries()].filter(([d]) => !rival_sources.some(r => r.domain === d)).map(([domain, why]) => ({ domain, citations: rivalSrc.get(domain) || 0, kind: 'vendor', why })),
    ...[...rivalSet].filter(d => !rival_sources.some(r => r.domain === d) && !vendorWhy.has(d)).map(domain => ({ domain, citations: 0, kind: 'named' }))].slice(0, 120);
  const sources = [...src.values()].sort((a, b) => b.citations - a.citations).slice(0, 15).map(s => ({ domain: s.domain, citations: s.citations, engines: [...s.engines].filter(x => x !== 'daily'), topics: [...s.topics].slice(0, 3), kind: kindOf(s.domain), urls: [...s.urls.values()].sort((a, b) => b.n - a.n).slice(0, 3) }));
  const pages = new Map(); for (const r of ansAll) for (const u of String(r.our_urls || '').split(/\s+/).filter(Boolean)) { const x = pages.get(u) || { url: u, citations: 0, engines: new Set() }; x.citations++; x.engines.add(r.engine); pages.set(u, x); }
  const our_pages = [...pages.values()].sort((a, b) => b.citations - a.citations).slice(0, 10).map(x => ({ url: x.url, citations: x.citations, engines: [...x.engines] }));
  // per question: who wins this run, and how often the business was named over the week's samples (win rate)
  const byQ = new Map();
  for (const r of Rall) { const q = byQ.get(r.prompt_id) || { prompt: r.prompt, kind: r.kind, topic: r.topic, engines: {}, competitors: new Set(), sources: new Set(), fanout: new Set(), urls: new Map(), n: 0, m: 0 }; q.engines[r.engine] = !r.answered ? (r.error ? 'error' : 'none') : r.cited ? 'cited' : r.mentioned ? 'mentioned' : 'absent';
    if (r.answered) { q.n++; if (r.mentioned) q.m++; list(r.competitors).forEach(d => q.competitors.add(d)); list(r.sources).forEach(d => q.sources.add(d)); String(r.fanout || '').split(' | ').filter(Boolean).forEach(f => q.fanout.add(f));
      for (const c of citedOf(r)) { const x = q.urls.get(c.u) || { u: c.u, t: c.t || '', n: 0, engines: new Set() }; x.n++; x.engines.add(r.engine); if (!x.t && c.t) x.t = c.t; q.urls.set(c.u, x); } } byQ.set(r.prompt_id, q); }
  for (const d of PR) for (const [id, st] of Object.entries(d.prompts || {})) { const q = byQ.get(id); if (!q) continue; for (const v of Object.values(st || {})) { if (v === 'n' || v === 'e') continue; q.n++; if (/^[mcMC]$/.test(v)) q.m++; } }   // G6: upper case = named FIRST — it was not counted as named at all
  for (const e of p.engines) if (MONTHLY.includes(e) && !Rall.some(r => r.engine === e)) for (const q0 of byQ.values()) if (!(e in q0.engines)) q0.engines[e] = 'monthly';   // asked on the month's full run
  const questions = [...byQ.entries()].map(([id, q]) => { const m0 = meta.get(id) || {}; return { prompt_id: id, prompt: q.prompt, kind: q.kind, topic: q.topic, stage: m0.stage || '', cluster: m0.cluster || q.topic || '', volume: m0.volume == null ? null : Number(m0.volume), engines: q.engines,
    won: Object.values(q.engines).some(v => v === 'cited' || v === 'mentioned'), win_rate: q.n ? pct(q.m, q.n) : 0, samples: q.n, competitors: [...q.competitors].slice(0, 6), sources: [...q.sources].filter(h => h !== p.domain).slice(0, 5), fanout: [...q.fanout].slice(0, 6),
    // B8-4 (2026-10-15, benchmark area 8, INVARIANTS rule 1): a per-question rate off one or two answers is not a rate. With an
    // 8-question panel on the weekly engines a question can carry a single answer, and "0%" read exactly like a question the
    // business reliably loses — which is what then picked the top actions and the ready-to-send API bodies below.
    win: rateOf(q.m, q.n, { min: MIN_Q_SAMPLES }), decided: q.n >= MIN_Q_SAMPLES,
    cited_urls: [...q.urls.values()].sort((a, b) => b.n - a.n).slice(0, 6).map(x => ({ u: x.u, t: x.t, n: x.n, engines: [...x.engines] })) }; });
  // B8-4: a gap is a question we have enough answers to say we lose. The rest are named as undecided, with what they would need.
  const lostQ = questions.filter(q => !q.won && q.kind !== 'brand' && q.competitors.length).sort((a, b) => (Number(b.volume) || 0) - (Number(a.volume) || 0));
  const gaps = lostQ.filter(q => q.decided).slice(0, 8);
  const undecided = lostQ.filter(q => !q.decided).slice(0, 8).map(q => ({ prompt_id: q.prompt_id, prompt: q.prompt, samples: q.samples, volume: q.volume, competitors: q.competitors, why: q.win.why }));
  // buyer stages and topic clusters: where the business is visible and where it is not
  const group = (key) => { const g = new Map(); for (const q of questions.filter(x => x.kind !== 'brand')) { const k = String(q[key] || 'other').toLowerCase(); const x = g.get(k) || { key: k, questions: 0, volume: 0, n: 0, m: 0, rivals: new Map() }; x.questions++; x.volume += Number(q.volume) || 0; x.n += q.samples; x.m += Math.round(q.win_rate * q.samples / 100); q.competitors.forEach(c => x.rivals.set(c, (x.rivals.get(c) || 0) + 1)); g.set(k, x); }
    return [...g.values()].map(x => ({ key: x.key, questions: x.questions, volume: x.volume, samples: x.n, mention_rate: pct(x.m, x.n), leader: [...x.rivals.entries()].sort((a, b) => b[1] - a[1]).map(([d]) => d)[0] || '' })).sort((a, b) => b.volume - a.volume || b.questions - a.questions); };
  const clusters = { stages: group('stage'), clusters: group('cluster').slice(0, 12) };
  // demand: AI searches a month behind the panel, and the estimated share of them that name the business (volume x win rate; an estimate)
  const demand = questions.filter(q => q.kind !== 'brand' && q.volume != null);
  const demand_total = demand.reduce((s, q) => s + (Number(q.volume) || 0), 0), ai_impressions = Math.round(demand.reduce((s, q) => s + (Number(q.volume) || 0) * q.win_rate / 100, 0));
  const lost_demand = gaps.reduce((s, g) => s + (Number(g.volume) || 0), 0);
  // what AI searched to write its answers (fan-out queries): pages that answer these get read and cited
  const fan = new Map(); for (const r of ansAll) for (const f of String(r.fanout || '').split(' | ').filter(Boolean)) { const k = f.toLowerCase().trim(); const x = fan.get(k) || { query: f.trim(), count: 0, engines: new Set(), questions: new Set() }; x.count++; x.engines.add(ENG[r.engine] || r.engine); x.questions.add(r.prompt); fan.set(k, x); }
  const fanout = [...fan.values()].sort((a, b) => b.count - a.count).slice(0, 15).map(x => ({ query: x.query, count: x.count, engines: [...x.engines], questions: [...x.questions].slice(0, 2) }));
  // brand recognition (the brand question, monthly)
  const bAns = RB.filter(r => r.answered); let brand = { asked: RB.length, answered: bAns.length, known: bAns.filter(r => r.mentioned).length, engines: bAns.filter(r => r.mentioned).map(r => ENG[r.engine] || r.engine) };
  if (!RB.length && p.carried) { const kb = Object.entries(carriedE).filter(([, v]) => v && v.knows_brand != null); brand = { asked: 0, answered: kb.length, known: kb.filter(([, v]) => v.knows_brand).length, engines: kb.filter(([, v]) => v.knows_brand).map(([k]) => ENG[k] || k), carried: true, checked_at: p.carried.checked_at };
    for (const [k, v] of kb) if (engines[k] && !engines[k].carried) engines[k].knows_brand = v.knows_brand; }
  // ---- B8-10 (2026-10-17, wave 3, benchmark area 8): recognition was a 2-of-5 MAJORITY RULE over at most six engines, one answer each,
  // with no interval - and it raised "Only N of M AI assistants recognise ..." as a medium alert. It is now what it is: a count with
  // its denominator and the same 95% Wilson range every other rate carries, and no verdict. `brand_known` stays in the payload as
  // null (no verdict drawn), so nothing downstream reads a majority it was never entitled to.
  brand.ci = brand.answered ? wilson(brand.known, brand.answered) : null;
  brand.basis = brand.answered ? (brand.carried ? 'carried' : 'measured') : 'not_available';
  brand.note = !brand.answered ? 'The brand question was not answered this month, so recognition was not measured.'
    : brand.known + ' of ' + brand.answered + ' AI assistant' + (brand.answered === 1 ? '' : 's') + ' asked directly about ' + (p.business_name || p.domain) + ' named it (95% range ' + brand.ci[0] + '–' + brand.ci[1] + '%'
      + (brand.carried ? ', from the month\'s full run of ' + String(brand.checked_at || '').slice(0, 10) : '') + ').'
      + (brand.answered < MIN_RATE_SAMPLES ? ' One answer per assistant is too few to call this a rate, so no verdict is drawn from it.' : '');
  const brand_known = null;   // B8-10: no verdict (it was a majority of the assistants asked)
  // perception: sentiment of the answers that name the business, the words AI uses for it, wrong claims (Answer Analyst)
  const sRows = ansAll.filter(r => r.mentioned && r.sentiment);
  const pos = sRows.filter(r => r.sentiment === 'positive').length, neg = sRows.filter(r => r.sentiment === 'negative').length;
  const sentiment_score = sRows.length ? Math.round(100 * (pos - neg) / sRows.length) : null;
  const descriptors = new Map(); ajobs.forEach((j, i) => { if (j.site_id !== p.site_id) return; const o = aouts[i] && !aouts[i].error ? parseJ(aouts[i].output) : null; for (const d of ((o && o.descriptors) || [])) { const k = String(d || '').trim().toLowerCase(); if (k && k.length <= 60) descriptors.set(k, (descriptors.get(k) || 0) + 1); } });
  const issueMap = new Map(); for (const r of ansAll.filter(r => r.issues)) for (const it of String(r.issues).split(' | ').filter(Boolean)) { const k = it.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 80); const x = issueMap.get(k) || { text: it, engines: new Set(), questions: new Set() }; x.engines.add(ENG[r.engine] || r.engine); x.questions.add(r.prompt); issueMap.set(k, x); }
  const prevIssues = new Set((((p.previous || {}).perception || {}).issues || []).map(x => String(x.text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 80)));
  const issues = [...issueMap.entries()].map(([k, x]) => ({ text: x.text, engines: [...x.engines], questions: [...x.questions].slice(0, 2), new: !prevIssues.has(k) })).slice(0, 10);
  // G10 (2026-10-11): what AI gets wrong is only ever "none" when there was a fact sheet to check against. With fewer than two
  // checkable facts on file (Analyst Jobs sets fact_check off) the result is "not checked" — the owner has to fill the business
  // profile first — and the same when no answer reached the analyst at all.
  const myJobs = ajobs.filter(j => j.site_id === p.site_id);
  const analysed = ajobs.some((j, k) => j.site_id === p.site_id && aouts[k] && !aouts[k].error);
  const fact_check = !myJobs.length || !analysed ? 'not_checked' : myJobs.every(j => j.facts_ok === false) ? 'no_facts' : 'checked';
  const perception = { analysed: sRows.length, positive: pos, neutral: sRows.length - pos - neg, negative: neg, score: sentiment_score, descriptors: [...descriptors.entries()].sort((a, b) => b[1] - a[1]).map(([d]) => d).slice(0, 10),
    negatives: sRows.filter(r => r.sentiment === 'negative').slice(0, 4).map(r => ({ engine: ENG[r.engine] || r.engine, prompt: r.prompt, excerpt: r.excerpt })), issues,
    fact_check, fact_check_note: fact_check === 'checked' ? '' : fact_check === 'no_facts' ? 'What AI says about you was not checked: nothing on file can judge what the answers claim — fill the business profile (city, address, phone, price range) and the next run checks every answer against it. Your country and the services read off your website are context, not facts to check a claim against.' : 'What AI says about you was not checked this run (no answer reached the analyst).' };
  // AI referral traffic (GA4): what the answers are worth
  let traffic = null; const tq = treq.map((q, i) => ({ q, r: tres[i] || {} })).filter(x => x.q.site_id === p.site_id);
  if (tq.length) { const errs = []; const R_ = {};
    for (const { q, r } of tq) { const e = gErr(r); if (e) { errs.push(q.kind + ': ' + e); continue; } const dims = (r.dimensionHeaders || []).map(h => h.name), mets = (r.metricHeaders || []).map(h => h.name);
      R_[q.kind] = (r.rows || []).map(row => { const o = {}; dims.forEach((d, j) => o[d] = ((row.dimensionValues || [])[j] || {}).value); mets.forEach((m, j) => o[m] = Number(((row.metricValues || [])[j] || {}).value) || 0); return o; }); }
    const sum = (rs) => rs.reduce((t, x) => ({ sessions: t.sessions + (x.sessions || 0), engaged: t.engaged + (x.engagedSessions || 0), key_events: t.key_events + (x.keyEvents || 0), revenue: t.revenue + (x.totalRevenue || 0), users: t.users + (x.totalUsers || 0) }), { sessions: 0, engaged: 0, key_events: 0, revenue: 0, users: 0 });
    const src0 = R_.ai_sources || [], ch = R_.channels || [];
    const curS = src0.filter(x => x.dateRange !== 'previous'), prevS = src0.filter(x => x.dateRange === 'previous');
    const byA = new Map(); for (const x of curS) { const a = assistantOf(x.sessionSource); const t = byA.get(a) || []; t.push(x); byA.set(a, t); }
    const prevByA = new Map(); for (const x of prevS) { const a = assistantOf(x.sessionSource); prevByA.set(a, (prevByA.get(a) || 0) + (x.sessions || 0)); }
    const cur = sum(curS), prev = sum(prevS);
    const chCur = ch.filter(x => x.dateRange !== 'previous'), all = sum(chCur), org = sum(chCur.filter(x => x.sessionDefaultChannelGroup === 'Organic Search'));
    const weekly = new Map(); for (const x of (R_.ai_daily || [])) { const d = String(x.date || '').replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3'); if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue; const w = weekOf(d); const t = weekly.get(w) || { week: w, sessions: 0, key_events: 0, revenue: 0 }; t.sessions += x.sessions || 0; t.key_events += x.keyEvents || 0; t.revenue += x.totalRevenue || 0; weekly.set(w, t); }
    const cpaths = new Set(our_pages.map(x => String(x.url).replace(/^https?:\/\/[^\/]+/i, '').replace(/\/$/, '') || '/'));
    traffic = { period: tq[0].q.period, connected: !errs.length || !!src0.length || !!ch.length, error: errs.join('; ') || null, ...cur, prev_sessions: prev.sessions, prev_key_events: prev.key_events, prev_revenue: prev.revenue,
      change_pct: prev.sessions ? Math.round(100 * (cur.sessions - prev.sessions) / prev.sessions) : null, share_of_sessions: all.sessions ? Math.round(1000 * cur.sessions / all.sessions) / 10 : 0,
      conv_rate: cur.sessions ? Math.round(1000 * cur.key_events / cur.sessions) / 10 : 0, organic_conv_rate: org.sessions ? Math.round(1000 * org.key_events / org.sessions) / 10 : 0, organic_sessions: org.sessions, total_sessions: all.sessions,
      assistants: [...byA.entries()].map(([name, rs]) => ({ name, ...sum(rs), prev_sessions: prevByA.get(name) || 0 })).sort((a, b) => b.sessions - a.sessions),
      landing: (R_.ai_landing || []).map(x => ({ page: x.landingPage || '/', sessions: x.sessions || 0, key_events: x.keyEvents || 0, revenue: x.totalRevenue || 0, cited_by_ai: cpaths.has(String(x.landingPage || '/').replace(/\?.*$/, '').replace(/\/$/, '') || '/') })).slice(0, 15),
      weekly: [...weekly.values()].sort((a, b) => a.week.localeCompare(b.week)).slice(-12) }; }
  else if (!p.ga4_property_id) traffic = { connected: false, error: 'GA4 is not connected for this site (connect it through "Track my site"; the Site Tracker detects the property)' };
  // AI crawler access
  const acc = access.find(a => a.site_id === p.site_id) || null;
  // the AI-answer database: market view (who AI cites for the main topic), market-wide index (your share against the competitors), questions citing you
  const mine = reqs.map((q, i) => ({ q, r: resps[i] })).filter(x => x.q.site_id === p.site_id);
  let market = null; const mk = mine.find(x => x.q.engine === 'market');
  if (mk) { const t = task0(mk.r); const res = (t.result || [])[0] || null;
    const items = (res && res.items) || []; const tot = res && res.total ? (Array.isArray(res.total.platform) ? (res.total.platform[0] || {}) : res.total) : ((res && res.aggregated_metrics && res.aggregated_metrics.total) || {});
    const val = (x, k) => ((x.location || [])[0] || {})[k] || (x.total || {})[k] || x[k] || 0;
    const ls = items.map(x => ({ domain: normD(x.domain || x.key), mentions: val(x, 'mentions'), ai_search_volume: val(x, 'ai_search_volume') })).filter(x => x.domain);
    market = { keyword: p.market_keyword, checked_at: p.checked_at.slice(0, 10), total_mentions: tot.mentions || null, ai_search_volume: tot.ai_search_volume || null, top: ls.slice(0, 12), you: ls.findIndex(x => x.domain === p.domain || x.domain.endsWith('.' + p.domain)) + 1 || null, error: t.status_code && t.status_code !== 20000 ? t.status_message : null }; }
  else if (p.previous && p.previous.market) market = { ...p.previous.market, carried: true };
  let index = null;
  const ix = mine.filter(x => /^index_/.test(x.q.engine));
  if (ix.length) { index = { checked_at: p.checked_at.slice(0, 10), platforms: [], brands: [], questions: [], answers_citing_you: 0, errors: [] }; const brandMap = new Map();
    for (const { q, r } of ix) { const t = task0(r); if (t.status_code !== 20000) { index.errors.push(q.engine + ' ' + q.topic + ': ' + (t.status_message || 'no response')); continue; } const res = (t.result || [])[0] || {};
      // R14 (2026-10-13): `you` comes from a DOMAIN match only — a name-only row ("name:Tech&") is never this website, whatever the index matched it against
      if (q.engine === 'index_sov') { index.platforms.push(q.topic); for (const it of (res.items || [])) { const key = String(it.key || ''); const tot = it.total || ((it.platform || [])[0]) || {}; const b = brandMap.get(key) || { key, domain: key.startsWith('name:') ? '' : key, name: key.startsWith('name:') ? key.slice(5) : '', you: !key.startsWith('name:') && (key === p.domain || normD(key) === p.domain || normD(key).endsWith('.' + p.domain)), mentions: 0, ai_search_volume: 0 };
        b.mentions += Number(tot.mentions) || 0; b.ai_search_volume += Number(tot.ai_search_volume) || 0; brandMap.set(key, b); } }
      else { index.answers_citing_you += Number(res.total_count) || 0; for (const it of (res.items || []).slice(0, 20)) index.questions.push({ question: String(it.question || '').slice(0, 200), volume: Number(it.ai_search_volume) || 0, platform: it.platform || q.topic, model: it.model_name || '', sources: (it.sources || []).map(s => normD(s.domain)).filter(Boolean).slice(0, 5) }); } }
    const doms = [...brandMap.values()].filter(b => b.domain); const totM = doms.reduce((s, b) => s + b.mentions, 0), totV = doms.reduce((s, b) => s + b.ai_search_volume, 0);
    // R14: a row the index matched by name alone is judged before it is shown — a name shorter than the brand-token bar, or one claiming
    // orders of magnitude more answers than this run measured and than any website in the same table, is dropped with its reason; a
    // distinctive one is kept, labelled "not matched to your website" and left out of the share arithmetic (it never had a share).
    const peerMax = doms.reduce((m, b) => Math.max(m, b.mentions), 0);
    const nameDropped = [];
    const kept = [...brandMap.values()].filter(b => {
      if (b.domain) return true;
      const v = indexNameRow(b.name, b.mentions, { peer_max: peerMax, measured_mentions: mentioned });
      if (!v.ok) { nameDropped.push({ name: b.name, mentions: b.mentions, ai_search_volume: b.ai_search_volume, why: v.why }); return false; }
      b.name_only = true; b.name_note = v.why; return true;
    });
    index.brands = kept.map(b => ({ ...b, share: b.domain ? pct(b.mentions, totM) : null, volume_share: b.domain ? pct(b.ai_search_volume, totV) : null })).sort((a, b) => b.mentions - a.mentions);
    index.name_rows_dropped = nameDropped.sort((a, b) => b.mentions - a.mentions).slice(0, 5);
    const youI = index.brands.find(b => b.you) || null; index.sov = youI ? youI.share : null; index.impressions = youI ? youI.ai_search_volume : 0;
    index.name_mentions = (index.brands.find(b => b.name_only && normD(b.name) === normD(p.business_name)) || {}).mentions || 0;
    index.questions = index.questions.sort((a, b) => b.volume - a.volume).slice(0, 15); }
  else if (p.previous && p.previous.index) index = { ...p.previous.index, carried: true };
  // questions people ask AI about the topics that the panel does not track yet (discovery), and the searches AI ran (fan-out)
  const tracked = new Set(p.prompts.map(q => String(q.prompt).toLowerCase()));
  const suggestions = []; dreq.forEach((q, i) => { if (q.site_id !== p.site_id || q.kind !== 'discover') return; const t = task0(dres[i]); if (t.status_code !== 20000) return; for (const it of (((t.result || [])[0] || {}).items || [])) { const qq = String(it.question || '').trim(); if (qq.split(/\s+/).length < 3 || tracked.has(qq.toLowerCase())) continue; suggestions.push({ question: qq, volume: Number(it.ai_search_volume) || 0, platform: q.platform, you_cited: (it.sources || []).some(s => normD(s.domain) === p.domain || normD(s.domain).endsWith('.' + p.domain)) }); } });
  const sugg = [...new Map(suggestions.sort((a, b) => b.volume - a.volume).map(s => [s.question.toLowerCase(), s])).values()].slice(0, 12);
  // changes vs last week that are statistically real, alerts
  const prev = p.previous; const mention_rate = pct(mentioned, samples), citation_rate = pct(cited, samples);
  const [mention_lo, mention_hi] = wilson(mentioned, samples);
  const visWeek = visibilityScore(ans, (a) => volOf.get(a.prompt_id) || 0);
  const visibility_score = samples ? Math.round(10 * (visWeek * ans.length + PR.reduce((s, d) => s + d.visibility_score * d.samples, 0)) / samples) / 10 : 0;
  // ---- B-L4 (2026-10-15, INVARIANTS rule 1, lineage_lint.py "like_for_like"): a delta compares like with like, or it is not a
  // delta. R19's shape on a different figure: the question panel is settable from 3 to 50, so a site that went from 8 questions
  // to 20 read as a collapse in share of voice and visibility when nothing about its visibility had moved; and a weekly check
  // asks fewer engines than the monthly full one, so the engine mix moves the same figures. Both are checked through the one
  // shared guard (RT, v5/code/_dfs_retry.js): the KIND of run first, because it explains more, then the panel the figures were
  // measured on, at R19's 20% drift. When they do not match there is no delta at all and `delta_not_compared` says why — the
  // report prints the reason where the arrows would have been, and every alert that reads a delta stays silent.
  // The KIND here is the set of engines the headline rates were counted over. It is NOT the run kind: a monthly full run asks
  // more engines than a weekly one, but `RC` above already leaves the monthly engines out of every rate for exactly that reason,
  // so weekly and full ARE comparable. What is not comparable is a changed engine list — switch Perplexity off and the rates move
  // on their own. A stored row says which engines it asked: the ones it did not are marked `carried`.
  // C-9 (re-rating 2026-10-17, exec 776): an engine that was ASKED but answered nothing counted in the set all the same — run 722's
  // Gemini had answered 0 of 7 (8 errors), so "compared with 2026-10-16 (… Gemini …)" set 54 answers on five engines against 28 on
  // four. An engine is in the set only when it was READ: it answered (samples, else answered, > 0), or some of its requests came back
  // without an error — the Google AI Overview "answers" only when Google shows one, and a week with none shown is a reading, not a
  // failure. An engine whose every request failed is out. A stored row of an older shape that records none of these fields keeps the
  // engine (unknown is not "none").
  const answeredOn = (v) => { const x = v || {}; if (x.samples == null && x.answered == null) return true;
    if ((Number(x.samples != null ? x.samples : x.answered) || 0) > 0) return true;
    const asked = Number(x.asked) || 0; return asked > 0 && (Number(x.errors) || 0) < asked; };
  const engSet = (obj) => Object.keys(obj || {}).filter(e => !MONTHLY.includes(e) && !(obj[e] || {}).carried && answeredOn(obj[e])).sort();
  const engNow = engSet(engines), engBefore = engSet(prev && prev.engines);
  const engText = (l) => l.map(e => ENG[e] || e).join(', ') || 'no engine';
  const panel = byQ.size, panel_before = prev ? Number(prev.prompts) || 0 : 0;
  const same_kind = prev ? RT.likeForLike(engNow.join('+'), engBefore.join('+'),
    { labels: { [engNow.join('+')]: engText(engNow), [engBefore.join('+')]: engText(engBefore) }, what: 'this week\'s figures and the stored ones' }) : null;
  const same_panel = prev ? RT.comparable(panel, panel_before, { unit: 'questions' }) : null;
  const like = prev ? (same_kind.comparable ? same_panel : same_kind) : null;
  const delta_not_compared = prev && !like.comparable
    ? 'Not compared with ' + String(prev.checked_at || '').slice(0, 10) + ': ' + like.why + '.' : '';
  // ---- B8-1 (2026-10-15, benchmark area 8, INVARIANTS rule 1): FOUR headline tiles printed an arrow and only ONE of them had been
  // tested. "Named in" carried its 95% range and a two-proportion z-test from v4.9; "Your pages cited", "Share of voice" and the
  // visibility score were subtractions printed in the same type, in the same row, from the same 33-54 answers — and the subject line
  // put the untested points in front of every reader before they opened the mail. Each one now goes through the same test and carries
  // its own verdict, in its own words. The share of voice is a proportion of a DIFFERENT denominator (yours out of yours plus the
  // competitors'), so it is tested on that denominator and not on the answer count, and the earlier run's competitor counts come from
  // the stored row itself rather than from reconstructing them out of a rounded percentage.
  const compTotalBefore = ((prev && prev.competitors) || []).reduce((s, c) => s + (Number(c.mentions) || 0), 0);
  const citedBefore = prev ? Math.round((Number(prev.citation_rate) || 0) * (prev.samples || 0) / 100) : 0;
  const score_band = scoreBand(ans, (a) => volOf.get(a.prompt_id) || 0);
  const tests = (prev && like.comparable) ? {
    mention_rate: changeOf(mentioned, samples, prev.mentioned_k, prev.samples),
    citation_rate: changeOf(cited, samples, citedBefore, prev.samples),
    share_of_voice: changeOf(mentioned, mentioned + compTotal, prev.mentioned_k, prev.mentioned_k + compTotalBefore),
    visibility_score: scoreChange(visibility_score, prev.visibility_score, score_band) } : null;
  const delta = (prev && like.comparable) ? { mention_rate: +(mention_rate - prev.mention_rate).toFixed(1), citation_rate: +(citation_rate - prev.citation_rate).toFixed(1), share_of_voice: +(share_of_voice - prev.share_of_voice).toFixed(1),
    visibility_score: prev.visibility_score == null ? null : +(visibility_score - prev.visibility_score).toFixed(1),
    // kept as the headline verdict the alerts and the subject read; `tests` holds the same answer for every other figure
    significant: prev.samples ? significant(mentioned, samples, prev.mentioned_k, prev.samples) : null, tests } : null;
  // ---- R84 (2026-10-16, re-rating defect C-8): say exactly what the headline counts. Exec 623 printed "8 buyer questions × 6 AI
  // engines · 74 answers" while the 74 were 7 buyer questions on the 5 weekly engines (33 this run + 41 from the pulse) — the 8th
  // question is the brand question (recognition only) and Claude, asked monthly, is shown per engine and kept out of the headline on
  // purpose (the week-on-week comparison depends on the weekly engine set). The words change, not the denominator.
  const buyerQ = new Set(R.map(r => r.prompt_id)).size, brandQ = new Set(RB.map(r => r.prompt_id)).size;
  const headEng = [...new Set([...RC.map(r => r.engine), ...PR.flatMap(d => Object.entries(d.engines || {}).filter(([, v]) => (Number((v || {}).answered) || 0) > 0).map(([e]) => e))])];
  const monthlyOut = MONTHLY.filter(e => R.some(r => r.engine === e)).map(e => ({ engine: ENG[e] || e, answers: R.filter(r => r.engine === e && r.answered).length }));
  const came_back = Rall.filter(r => !r.error).length;
  const headline = { buyer_questions: buyerQ, brand_questions: brandQ, engines: headEng.map(e => ENG[e] || e), engine_count: headEng.length, run_answers: ans.length, pulse_answers: pulseN, samples,
    monthly_left_out: monthlyOut, brand_answers: RB.filter(r => r.answered).length, requests: Rall.length, came_back,
    text: samples + ' answers to the ' + buyerQ + ' buyer question' + (buyerQ === 1 ? '' : 's') + ' on the ' + headEng.length + ' weekly engine' + (headEng.length === 1 ? '' : 's')
      + (pulseN ? ' (' + ans.length + ' this run + ' + pulseN + ' from the daily pulse)' : '')
      + (monthlyOut.some(x => x.answers) ? '; ' + monthlyOut.filter(x => x.answers).map(x => x.engine + '\'s ' + x.answers + ' answer' + (x.answers === 1 ? '' : 's')).join(' and ') + ' (asked monthly) are shown per engine and not in the headline' : '')
      + (brandQ ? '; the brand question measures recognition only' : '') };
  // ---- R85 (2026-10-16, re-rating defect C-9): the AI search-volume lookup failed twice in exec 623 (HTTP 500 around task 50000
  // "Internal Error.", 50 s each) and the report said "0 questions with a volume" as if it had been read. A lookup that failed is
  // "not read", and the stored volumes (0 here, read on an earlier run) are named as stored, not as this month's.
  const innerMsg = (r) => { const t = task0(r); if (t.status_message && t.status_code !== 20000) return String(t.status_message); const er = (r || {}).error; const e = er ? String(typeof er === 'string' ? er : (er.message || JSON.stringify(er))) : (gErr(r) || '');
    const msgs = [...String(e).matchAll(/status_message[\\"]*:\s*[\\"]*([^\\"]+)/g)].map(m => m[1]).filter(x => !/^ok\.?$/i.test(x)); return msgs.length ? msgs[msgs.length - 1] : (e ? e.slice(0, 120) : 'no answer'); };
  const volQ = dreq.map((q, i) => ({ q, r: dres[i] })).filter(x => x.q.site_id === p.site_id && x.q.kind === 'volume');
  const volBad = volQ.filter(x => task0(x.r).status_code !== 20000);
  const volRetried = volBad.some(x => Number(((x.r || {}).__dfs || {}).retried) > 0);
  const volStored = [...meta.values()].filter(q => q.kind !== 'brand');
  const volume_lookup = { asked: volQ.length > 0, read: volQ.length ? !volBad.length : null, keywords: volQ.reduce((n, x) => n + (((x.q.body || [])[0] || {}).keywords || []).length, 0),
    error: volBad.length ? innerMsg(volBad[0].r) : '', retried: volRetried, stored_measured: volStored.filter(q => q.volume != null && q.volume !== '').length,
    stored_positive: volStored.filter(q => Number(q.volume) > 0).length, questions: volStored.length,
    note: volBad.length ? 'AI search volume could not be read this run (DataForSEO failed' + (volRetried ? ' twice' : '') + ': ' + innerMsg(volBad[0].r) + ')'
      + ', so the volumes shown are the ones stored from an earlier run, not this month\'s.' : '' };
  // ---- B8-8 (2026-10-17, wave 3, benchmark area 8): "X no longer cites any of your pages" fired on `cited > 0` then `cited === 0`
  // whatever that engine's own sample was - 2 citations in 6 Gemini answers, then none in 10, is not evidence Gemini stopped citing
  // anyone. Every engine that cited the site last time is now judged by the same `changeOf` on ITS OWN answers (this run + the pulse
  // mornings), and under MIN_ENGINE_SAMPLES on either side it is "too few answers from this engine to tell", in those words.
  // A changed question panel moves every engine's rate on its own (B-L4), so the per-engine comparison needs the same panel.
  const engine_changes = {};
  if (prev && prev.engines) for (const [e, v] of Object.entries(prev.engines)) { const x = engines[e];
    if (!x || x.carried || !v || v.carried || !((Number(v.cited) || 0) > 0)) continue;
    const nB = Number(v.samples != null ? v.samples : v.answered) || 0, nN = Number(x.samples != null ? x.samples : x.answered) || 0;
    const fell = nN ? (x.cited || 0) / nN < (Number(v.cited) || 0) / (nB || 1) : true;
    if (!(same_panel && same_panel.comparable)) { engine_changes[e] = { name: ENG[e] || e, tested: false, fell, samples: nN, samples_before: nB, k: x.cited || 0, k_before: Number(v.cited) || 0, why: 'not compared: ' + (same_panel ? same_panel.why : 'no earlier run') }; continue; }
    engine_changes[e] = { name: ENG[e] || e, fell, ...engineChange(x.cited || 0, nN, Number(v.cited) || 0, nB) }; }
  // ---- B8-9 (2026-10-17, wave 3, benchmark area 8): the alerts below that rest on a test share ONE sample, so they are one family and
  // are corrected together (Holm, 5% family-wise). A test joins the family when its alert could fire on it - the change points the way
  // the alert reads - and each alert that fires states the adjusted threshold it cleared.
  const prevComp = new Map((((prev && like.comparable) ? prev.competitors : null) || []).map(c => [c.domain, c]));   // B-L4: a competitor's share moves with the panel too
  const family = [];
  if (tests && tests.mention_rate && tests.mention_rate.z != null && tests.mention_rate.delta < 0) family.push({ id: 'mention_rate', label: 'AI mentions', z: tests.mention_rate.z });
  for (const [e, c] of Object.entries(engine_changes)) if (c.tested && c.z != null && c.delta < 0) family.push({ id: 'engine:' + e, label: c.name + ' citations', z: c.z });
  // B8-1: "gained 10+ points" was a fixed rule over two noisy samples, raised beside a mention-rate change that had been z-tested.
  // The same test, on the same denominator as the share it is about.
  const compTests = [];
  for (const c of comp) { const b0 = prevComp.get(c.domain); if (!b0) continue; const t = changeOf(c.mentions, mentioned + compTotal, Number(b0.mentions) || 0, prev.mentioned_k + compTotalBefore, { min_points: 10 });
    if (t.z != null && t.delta > 0 && c.mentions >= 5) { compTests.push({ c, t }); family.push({ id: 'comp:' + c.domain, label: c.domain + ' share of voice', z: t.z }); } }
  const multiple_tests = holm(family, 0.05);
  const passes = (id) => !!(multiple_tests.by[id] && multiple_tests.by[id].reject);
  const alerts = [];
  if (delta) { const mT = tests.mention_rate;
    if (mT && mT.z != null ? (passes('mention_rate') && mT.delta < 0 && Math.abs(mT.delta) >= (mT.min_points || 5)) : delta.mention_rate <= -15)
      alerts.push({ level: 'high', text: 'AI mentions dropped ' + Math.abs(delta.mention_rate) + ' points to ' + mention_rate + '% of answers'
        + (mT && mT.z != null ? ' (a real change, not sampling noise: ' + samples + ' answers this week vs ' + prev.samples + '; ' + holmWords(multiple_tests, 'mention_rate') + ')' : ' (not tested: the earlier run recorded no sample size)') + '.' }); }
  for (const [e, c] of Object.entries(engine_changes)) if (c.tested && passes('engine:' + e) && c.delta < 0 && Math.abs(c.delta) >= (c.min_points || 5))
    alerts.push({ level: 'medium', text: c.name + (c.k === 0 ? ' no longer cites any of your pages: ' : ' cites your pages less: ') + c.k + ' of ' + c.samples + ' answers this week vs ' + c.k_before + ' of ' + c.samples_before + ' before (a real drop on this engine\'s own answers; ' + holmWords(multiple_tests, 'engine:' + e) + ').' });
  // D19: the failures are reported with their reason, and above 10% they are an alert of their own (every rate counts answered requests only)
  if (errors) alerts.push({ level: error_rate > 50 ? 'high' : error_rate >= 10 ? 'medium' : 'low',
    text: errors + ' of ' + Rall.length + ' AI requests failed' + (retry.asked ? ' (' + retry.answered + ' of ' + retry.asked + ' answered on the retry)' : '') + ': ' + error_list.map(e => e.engine + ' — ' + e.message).slice(0, 3).join('; ') + '. ' + came_back + ' of ' + Rall.length + ' came back; the rates below count ' + headline.text + '.' });
  if (volume_lookup.note) alerts.push({ level: 'low', text: volume_lookup.note });
  for (const { c, t } of compTests) if (passes('comp:' + c.domain) && t.significant === true)
    alerts.push({ level: 'medium', text: c.domain + ' gained ' + Math.round(t.delta) + ' points of AI share of voice (now ' + c.share + '%) — ' + t.why + '; ' + holmWords(multiple_tests, 'comp:' + c.domain) + '.' });
  for (const it of issues.filter(x => x.new).slice(0, 3)) alerts.push({ level: 'high', text: 'AI states something wrong about you (' + it.engines.join(', ') + '): ' + it.text });
  if (neg && (!prev || !like.comparable || prev.sentiment_score == null || sentiment_score < prev.sentiment_score - 20)) alerts.push({ level: 'medium', text: neg + ' AI answer(s) speak negatively about you (sentiment ' + sentiment_score + ').' });
  if (acc) for (const it of acc.issues.filter(x => x.level === 'critical' || x.level === 'high')) alerts.push({ level: 'high', text: it.text });
  if (traffic && traffic.connected && traffic.prev_sessions >= 30 && traffic.change_pct != null && traffic.change_pct <= -30) alerts.push({ level: 'medium', text: 'Visits from AI assistants fell ' + Math.abs(traffic.change_pct) + '% (' + traffic.sessions + ' in the last 28 days vs ' + traffic.prev_sessions + ').' });
  // actions, most valuable first (value = the demand behind a question, or how much a fix unblocks)
  const actions = [];
  if (acc) for (const it of acc.issues.filter(x => x.level === 'critical' || x.level === 'high').slice(0, 2)) actions.push({ priority: 1, type: 'access', action: it.fix, why: it.text });
  for (const it of issues.slice(0, 2)) actions.push({ priority: 1, type: 'accuracy', action: 'Correct what AI says: ' + it.text.split(' → ')[0].slice(0, 120), why: (it.engines.join(', ') + ' state this; the fact on file is "' + (it.text.split(' → ')[1] || 'different') + '". State the right fact plainly on the About and service pages, in the Organization schema and on the profiles AI reads (Google Business Profile, LinkedIn, directories).').slice(0, 400) });
  for (const g of gaps.slice(0, 3)) actions.push({ priority: 1, type: 'content', action: 'Win the answer to "' + g.prompt + '"', why: 'AI recommends ' + g.competitors.slice(0, 3).join(', ') + ' here and not you' + (g.volume ? ' (' + g.volume.toLocaleString('en-GB') + ' AI searches a month)' : '') + (g.sources.length ? '; it relies on ' + g.sources.slice(0, 3).join(', ') : '') + (g.fanout.length ? '; to answer it searched "' + g.fanout[0] + '"' : '') + '.', keyword: g.topic || g.prompt,
    api_body: { mode: 'keyword', keyword: (g.topic || g.prompt).toLowerCase().slice(0, 80), country: p.country, domain: p.domain, page_type: g.kind === 'compare' ? 'Comparison Page' : 'Guide', receive: ['Keyword Report', 'Page Content'],
      ai_target: { question: g.prompt, kind: 'answer', target_id: 'ait_' + p.site_id.replace(/^site_/, '') + '_' + g.prompt_id, fanout: g.fanout || [], sources: (g.cited_urls || []).slice(0, 6).map(c => ({ u: c.u, t: c.t || '' })), competitors: (g.competitors || []).slice(0, 8) } } });   // v4.12: the page is written to be the one AI cites
  const VERB = { site: 'Get featured on ', media: 'Pitch an expert comment to ', directory: 'Get listed (with reviews) on ' };
  for (const s of sources.filter(s => VERB[s.kind] && s.citations >= 2).slice(0, 4)) actions.push({ priority: 2, type: s.kind === 'site' ? 'pr' : s.kind, action: VERB[s.kind] + s.domain, why: 'AI answers cite it ' + s.citations + ' times (' + (s.engines.join(', ') || 'daily checks') + ')' + (s.topics.length ? ' for ' + s.topics.join(', ') : '') + (s.kind === 'site' ? '. A guest article, a comparison mention or a quote there feeds the answers directly.' : s.kind === 'media' ? '. Assistants quote news coverage: offer data, a deadline explainer or a client story.' : '. Assistants lean on these lists when they recommend providers.') });
  const plat = sources.filter(s => s.kind === 'platform').slice(0, 2);
  if (plat.length) actions.push({ priority: 3, type: 'platform', action: 'Publish where AI looks: ' + plat.map(s => s.domain).join(', '), why: 'AI answers cite these platforms ' + plat.reduce((n, s) => n + s.citations, 0) + ' times for your topics (e.g. a short explainer video, a LinkedIn article, an answer in a relevant thread).' });
  const off = sources.filter(s => s.kind === 'official').slice(0, 2);
  if (off.length) actions.push({ priority: 3, type: 'official', action: 'Be listed on ' + off.map(s => s.domain).join(', '), why: 'Official sources AI trusts for this topic; registry listings (e.g. accredited-provider lists) are cited directly.' });
  if (brand.answered && brand.known < brand.answered) actions.push({ priority: 2, type: 'entity', action: 'Make the brand recognisable to AI', why: (brand.answered - brand.known) + ' of ' + brand.answered + ' AI assistants asked directly did not name you' + (brand.carried ? ' (the month\'s full run)' : '') + '. Complete the business profile, add Organization schema with sameAs (LinkedIn, Google Business Profile), keep name / address / phone identical everywhere, publish an About page and get listed on the sources above.' });
  if (cited === 0 && samples >= MIN_RATE_SAMPLES) actions.push({ priority: 2, type: 'citable', action: 'Give AI something to cite', why: 'No answer cited your pages across ' + samples + ' answers. Pages with a direct 40-60 word answer, a dated fact table and clear headings (every page the agent writes has them) are the ones assistants quote.' });
  if (fanout.length && gaps.length) actions.push({ priority: 3, type: 'fanout', action: 'Answer what AI searches for: "' + fanout.slice(0, 3).map(f => f.query).join('", "') + '"', why: 'Before answering your buyers\' questions the assistants ran these searches; a page that ranks for them is the page they read and cite.' });
  // seo_ai_visibility row (exact columns), ai_source prospects (status kept), learned brand names (seo_cache)
  const J = (o) => JSON.stringify(o);
  // G6: what THIS execution spent on DataForSEO (the ledger settles each execution's own money) — the earlier executions of a split run
  // settled theirs; the row and the report carry the whole run
  const exec_cost = +(Rall.filter(r => !r._stored).reduce((s, r) => s + (Number(r.cost) || 0), 0) + mine.filter(x => /^(market|index_)/.test(x.q.engine)).reduce((s, x) => s + (Number(task0(x.r).cost) || 0), 0) + dreq.reduce((s, q, i) => s + (q.site_id === p.site_id ? dCost(dres[i]) : 0), 0)).toFixed(4);
  const run_split = p.chunk ? { executions: (p.chunk.executions || []).length + 1, chunk: p.chunk.no, requests: Rall.length, stored_before: Rall.filter(r => r._stored).length, resumed: !!p.chunk.resumed,
    note: (p.chunk.executions || []).length ? 'This run was asked over ' + ((p.chunk.executions || []).length + 1) + ' executions (' + Rall.filter(r => r._stored).length + ' of its ' + Rall.length + ' answers were stored by the earlier ones' + (p.chunk.resumed ? '; it was resumed after a pause' : '') + '); every figure below counts all of them once.' : '' } : null;
  const vis_row = { site_id: p.site_id, domain: p.domain, run_id: p.run_id, checked_at: p.checked_at, prompts: byQ.size, answers: samples, mention_rate, citation_rate, share_of_voice, avg_rank: ranks.length ? +(ranks.reduce((a, b) => a + b, 0) / ranks.length).toFixed(1) : 0,
    aio_presence, aio_citation_rate, engines_json: J(engines), competitors_json: J(comp), sources_json: J(sources), pages_json: J(our_pages), gaps_json: J(gaps.map(g => ({ prompt_id: g.prompt_id, prompt: g.prompt, kind: g.kind, topic: g.topic, competitors: g.competitors, sources: g.sources, volume: g.volume, stage: g.stage, cluster: g.cluster, fanout: g.fanout, cited_urls: g.cited_urls, engines: g.engines }))), market_json: market ? J(market) : '',
    market_month: market && !market.carried && !market.error ? p.checked_at.slice(0, 7) : ((prev && prev.market_month) || ''), cost_usd: +(exec_cost + ((p.chunk && p.chunk.going && p.spent_before) ? Number(p.spent_before.dfs) || 0 : 0)).toFixed(4),   // G6: the whole run, every execution of it
    alerts: alerts.map(a => a.level + ': ' + a.text).join(' | '),
    run_kind: p.run_kind || 'weekly', samples, visibility_score, mention_lo, mention_hi, sentiment_score, accuracy_issues: fact_check === 'checked' ? issues.length : null, ai_sessions: traffic && traffic.connected ? traffic.sessions || 0 : null, ai_conversions: traffic && traffic.connected ? traffic.key_events || 0 : null, ai_revenue: traffic && traffic.connected ? Math.round(100 * (traffic.revenue || 0)) / 100 : null,
    index_sov: index && index.sov != null ? index.sov : null, ai_impressions: ai_impressions || null, perception_json: J(perception), traffic_json: traffic ? J(traffic) : '', access_json: acc ? J({ checked_at: acc.checked_at, robots: acc.robots, llms_txt: acc.llms_txt, bots: acc.bots.map(b => ({ bot: b.bot, owner: b.owner, group: b.group, allowed: b.allowed_root, rule: b.rule, blocked_paths: b.blocked_paths })), fetch: acc.fetch, issues: acc.issues, ok: acc.ok }) : '',
    index_json: index ? J({ ...index, suggestions: sugg, fanout, demand: { total: demand_total, named: ai_impressions, lost: lost_demand } }) : J({ suggestions: sugg, fanout, demand: { total: demand_total, named: ai_impressions, lost: lost_demand } }), clusters_json: J(clusters),
    rival_sources_json: J(rival_store),   // wave 3 (W3-F): AI Growth reads the rival businesses AI cites from the latest row
    // G6: the segments and the panel (filled in below) and how many executions the run took
    segments_json: '', panel_json: '', chunks: run_split ? run_split.executions : 1 };   // wave 3 (W3-F): AI Growth reads the rival businesses AI cites from the latest row
  const now = p.checked_at;
  const prospect_rows = sources.filter(s => !['platform', 'authority'].includes(s.kind) && s.citations >= 1).slice(0, 10).map(s => { const old = prospects.find(x => x.site_id === p.site_id && x.prospect_domain === s.domain && x.type === 'ai_source') || {};
    const top = (s.urls || [])[0] || null;   // v4.12: the exact page AI cites on that site (the one to be named on)
    const kept = DRAFTS.carry(old);   // P34-1: a draft written before the D12 / D13 gates is withdrawn, not carried into the refreshed row
    return { site_id: p.site_id, domain: p.domain, prospect_domain: s.domain, type: 'ai_source', rank: Number(old.rank) || 0, spam_score: Number(old.spam_score) || 0,
      detail: 'Cited ' + s.citations + 'x in AI answers (' + (s.engines.join(', ') || 'daily checks') + ')' + (s.topics.length ? ' about ' + s.topics.join(', ') : '') + (top && top.t ? ' — most cited page: "' + top.t + '"' : ''), source_url: top ? top.u : (old.source_url || ''), target_url: old.target_url || '',
      status: old.status || 'new', first_seen: old.first_seen || now, last_seen: now, won_at: old.won_at || '', outreach_subject: kept.outreach_subject, outreach_body: kept.outreach_body, drafted_at: kept.drafted_at, note: (kept.superseded ? DRAFTS.reason : '') || old.note || ({ official: 'official source: ask to be listed', media: 'news site: pitch a story or expert comment', directory: 'directory / review site: get listed' }[s.kind] || ''),
      // v4.10 columns kept as stored (the Backlink Monitor scores, finds contacts and writes follow-ups for these rows)
      score: old.score === '' || old.score == null ? null : Number(old.score), origin: old.origin || 'ai_visibility', contact_email: old.contact_email || '', contact_url: old.contact_url || '', contacted_at: old.contacted_at || '',
      followup_step: Number(old.followup_step) || 0, followup_subject: old.followup_subject || '', followup_body: old.followup_body || '', verified_at: old.verified_at || '' }; });
  // brand names AI uses for businesses, with their website (Answer Analyst): the parser finds them next time even without a link
  // C-9: the period the headline rates were counted over, as counted — this run plus the pulse readings *AI Plan* took since the last
  // stored run (`since = previous.checked_at`), not a fixed "7 days" (exec 776 counted ONE pulse day and printed "the 7 days to …").
  const rate_period = (() => { const to = String(p.checked_at || '').slice(0, 10); const from = prev && prev.checked_at ? String(prev.checked_at).slice(0, 10) : ([...pulseDates].sort()[0] || '');
    if (!PR.length) return 'this run on ' + to + ' (no daily pulse reading' + (from ? ' since ' + from : '') + ')';
    return 'this run on ' + to + ' + ' + pulseDays + ' daily pulse day' + (pulseDays === 1 ? '' : 's') + (from ? ' since ' + from : ''); })();
  const aliases = { ...(p.aliases || {}), ...learned };   // R83: the same names the rival set above was built from (D19: only a name that reads like a business name is learned)
  const aliasKeys = Object.keys(aliases).slice(-200); const aliasesTrim = Object.fromEntries(aliasKeys.map(k => [k, aliases[k]]));
  const cache_rows = Object.keys(aliasesTrim).length !== Object.keys(p.aliases || {}).length || JSON.stringify(aliasesTrim) !== JSON.stringify(p.aliases || {}) ? [{ key: 'ai_brands:' + p.site_id, kind: 'ai', site_id: p.site_id, value: J(aliasesTrim), updated_at: now }] : [];
  // G6: the run is measured — its state row says so, so no later start resumes it
  if (p.chunk) { const sb = p.spent_before || {}; cache_rows.push(AIP.stateRow(p.site_id, { run_id: p.run_id, run_kind: p.run_kind, site_id: p.site_id, domain: p.domain, started_at: p.checked_at, updated_at: new Date().toISOString(),
    chunk: p.chunk.no, status: 'done', asked: Rall.length, total: Rall.length, spent_dfs_usd: vis_row.cost_usd, spent_ai_usd: Number(sb.ai) || 0, executions: [...(p.chunk.executions || []), String($execution.id)].slice(-60) }, new Date().toISOString())); }
  return { json: { ...p, metrics: { asked: RC.length, asked_all: R.length, requests: Rall.length, answered: ans.length, samples, pulse_samples: pulseN, pulse_days: pulseDays, pulse_readings: PR.length, came_back, headline, aio_basis, volume_lookup, errors, error_rate, errors_list: error_list, retried: retry.asked, retry_answered: retry.answered, mentioned, cited, mention_rate, mention_ci: [mention_lo, mention_hi], citation_rate, share_of_voice, visibility_score, avg_rank: vis_row.avg_rank, aio_presence, aio_citation_rate, brand_known, brand, delta,
    // B-L4: when the two runs are not like for like the customer is TOLD, in the place the change would have been
    delta_not_compared, panel, panel_before, delta_basis: prev ? (like.comparable ? 'compared with ' + String(prev.checked_at || '').slice(0, 10) + ' (' + panel_before + ' questions on ' + engText(engBefore) + ')' : like.why) : 'first run (baseline)',
    // B8-1: the other three headline tiles now carry what "Named in" always had — their own 95% range and their own verdict on the
    // change. B8-3 / B8-5: what the week's sample is actually made of, and what was never asked.
    citation_ci: wilson(cited, samples), sov_ci: wilson(mentioned, mentioned + compTotal), sov_denominator: mentioned + compTotal,
    score_band, tests: delta ? delta.tests : null, enough_samples: samples >= MIN_RATE_SAMPLES, min_samples: MIN_RATE_SAMPLES,
    sample_note: samples >= MIN_RATE_SAMPLES ? '' : rateOf(mentioned, samples).why, pulse_basis, rate_period, capped, undecided_questions: undecided.length,
    // B8-8 / B8-9: each engine's own change test (or why it was not tested), and the one correction the tested alerts were judged by
    engine_changes, min_engine_samples: MIN_ENGINE_SAMPLES, multiple_tests: { method: multiple_tests.method, alpha: multiple_tests.alpha, tests: multiple_tests.tests, threshold_p: multiple_tests.threshold_p, threshold_z: multiple_tests.threshold_z, rejected: multiple_tests.rejected, results: multiple_tests.results, note: multiple_tests.note },
      sentiment_score, accuracy_issues: fact_check === 'checked' ? issues.length : null, fact_check, index_sov: vis_row.index_sov, ai_impressions, demand_total, lost_demand },
    engines, competitors: comp, sources, rival_sources, our_pages, questions, gaps, undecided, clusters, fanout, perception, traffic, access: acc, index, suggestions: sugg, market, alerts, actions: actions.slice(0, 10), vis_row, prospect_rows, cache_rows, cost_usd: exec_cost, run_cost_usd: vis_row.cost_usd, run_split, form_url: FORM_URL, api_url: API_URL } };
});
