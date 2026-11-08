/*__REACH__*/
/*__FIT_GATE__*/
/*__LADDER_DUP__*/
/*__LADDER_RULES__*/
// N2 (KW recheck 2026-10-21, exec 152): a new keyword ladder whose main keyword is, word for word, the same search as another ladder of
// this website (its main keyword or one of its planned pages) is refused HERE, right after Rate Limit and before any paid call: the run
// takes the input-refusal path (ledger row marked refused, nothing charged, the reason in the callback). Ladder Plan still applies the
// same words rule plus the results-page rule (3 of the top 7 pages in common), which needs results pages this check has not paid for.
// Only a NEW ladder is judged: a re-plan of a stored ladder, a ladder page run (client_ip "ladder:<id>") and every other mode pass through.
const d = $('Rate Limit').first().json || {};
if (d.validation_error || String(d.mode || '') !== 'ladder' || /^ladder:/i.test(String(d.client_ip || ''))) return [{ json: d }];
const rowsOf = (name) => { try { return $(name).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error && Object.keys(r).length); } catch (e) { return null; } };
// INVARIANTS rule 2: a stored rung is read back through the gate it was written through (a competitor brand is no ladder of yours)
const lad0 = rowsOf('Load Ladders (Dup Check)');
const lad = lad0 && lad0.filter(r => fitStored(r, { own_domain: d.domain || '', protect: [String(d.keyword || ''), String(r.head_keyword || '')] }).ok);
const own = String(d.ladder_id || '');
const replan = !!(own && (lad || []).some(r => String(r.ladder_id) === own));   // a re-plan of a stored ladder keeps its own market and words
const dupOf = () => {
  if (!lad || !lad.length || replan) return null;   // not read (or no ladder yet): Ladder Plan judges it
  const archived = (rowsOf('Load Ladder Settings (Dup Check)') || []).filter(r => String(r.status || '').toLowerCase() === 'archived').map(r => String(r.ladder_id));
  return LDUP.byWords(d.keyword, lad, { ladder_id: own, domain: d.domain, archived }); };
const m = dupOf();
if (m) return [{ json: { ...d, validation_error: LDUP.message(m, String(d.keyword || '').toLowerCase().trim()),
  refusal: { reason: 'duplicate', by: 'words', before_paid_steps: true, ladder_id: m.ladder_id, head: m.head, their_keyword: m.keyword } } }];
// ---- LADDER PACKAGE (2026-11-09, rule 3, v5/code/_ladder_rules.js LRU.market): one market per ladder, never another country ----
// devaicon.com (a Sharjah company measured in the UAE) typed "ai automation solutions gcc"; the run was sent with Pakistan and the ladder became
// "ai automation services pakistan" (rows 38-39, location 2586). A ladder is measured in the website's own market, or in the market its keyword
// names ("gcc", "uae", "dubai" -> AE; "pakistan" -> PK, said so). A new ladder sent for any other country is refused here, before anything is
// paid, with the market to use; the app sends the locked market by itself and asks first ("market_ack") before measuring a keyword that names
// no place in a country other than the website's.
if (replan || !d.domain) return [{ json: d }];
const sid = 'site_' + String(d.domain || '').toLowerCase().replace(/^www\./, '').replace(/[^a-z0-9]+/g, '-');
const site = (rowsOf('Load Site (Market Check)') || []).find(r => String(r.site_id || '') === sid) || {};
const siteIso = Object.keys(LRU.CFG.countries).find(k => LRU.CFG.countries[k] === String(site.country || '').trim()) || '';
const mk = LRU.market({ keyword: d.keyword, site_iso: siteIso, request_iso: String(d.country_iso || '') });
const acked = d.market_ack === true && mk.source === 'site' && !mk.named.length;   // the client chose another market on purpose for a keyword that names none
if (mk.ok || acked || !mk.iso) return [{ json: d }];   // the item passes unchanged (Ladder Plan states the market in the plan)
return [{ json: { ...d, ladder_market: mk, validation_error: LRU.marketRefusal(mk, d.keyword) + ' This was found before any research was paid for, so nothing was charged.',
  refusal: { reason: 'market', before_paid_steps: true, market: mk.iso, country: mk.country, requested: mk.request_iso, named: mk.named, source: mk.source } } }];
