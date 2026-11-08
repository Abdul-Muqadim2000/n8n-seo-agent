// KI Supersede Check (FX-L round 2, REVIEW_LOGIC N3 = REVIEW_PERF_SAFETY N1): may this run's rows replace the older rows of this site and
// market? Only when every keyword row it wrote was saved (Save KI Keywords returned one item per row and no error item), the run is not
// failed, and its discovery and results pages were read (a partial run never wipes a fuller one). Old gaps go only when this run's gap
// section is ok. Nothing is decided from the rows' contents.
const p = $('KI Plan').first().json || {};
let r = {}; try { r = $('Research Result').first().json || {}; } catch (e) { r = {}; }
let saved = []; try { saved = $('Save KI Keywords').all().map(i => (i && i.json) || {}); } catch (e) { saved = []; }
const expected = (r.kw_rows || []).length;
const errors = saved.filter(x => x && x.error).length;
const state = (k) => ((r.sections || []).find(s => s && s.key === k) || {}).state || '';
const savedOk = expected > 0 && errors === 0 && saved.length >= expected;
const readOk = r.status !== 'failed' && state('discovery') !== 'missing' && state('results_pages') !== 'missing';
const drop_keywords = savedOk && readOk;
const drop_gaps = drop_keywords && state('gap') === 'ok';
const reason = !savedOk ? 'the keyword rows were not all saved (' + (saved.length - errors) + ' of ' + expected + ', ' + errors + ' error(s)): older rows are kept'
  : !readOk ? 'a partial run (discovery or results pages not read) does not replace the older rows' : (!drop_gaps ? 'the gap section was not read in full: older gaps are kept' : '');
return [{ json: { drop_keywords, drop_gaps, saved: saved.length, expected, errors, reason, site_id: p.site_id, market: p.market } }];
