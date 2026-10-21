/*__REACH__*/
/*__FIT_GATE__*/
/*__LADDER_DUP__*/
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
if (!lad || !lad.length) return [{ json: d }];   // not read (or no ladder yet): Ladder Plan judges it
const own = String(d.ladder_id || '');
if (own && lad.some(r => String(r.ladder_id) === own)) return [{ json: d }];
const archived = (rowsOf('Load Ladder Settings (Dup Check)') || []).filter(r => String(r.status || '').toLowerCase() === 'archived').map(r => String(r.ladder_id));
const m = LDUP.byWords(d.keyword, lad, { ladder_id: own, domain: d.domain, archived });
if (!m) return [{ json: d }];
return [{ json: { ...d, validation_error: LDUP.message(m, String(d.keyword || '').toLowerCase().trim()),
  refusal: { reason: 'duplicate', by: 'words', before_paid_steps: true, ladder_id: m.ladder_id, head: m.head, their_keyword: m.keyword } } }];
