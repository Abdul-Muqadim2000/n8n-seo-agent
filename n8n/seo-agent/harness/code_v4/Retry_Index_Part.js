// Index coverage (fix wave 1, X1): a website of today's chain that the run guard refused because other runs were in flight (the same
// website on demand, or too many analyses at once) is started again five minutes later (at most 12 times, one hour), so one busy moment
// does not end the chain for every website after it. Any other refusal, and every run that is not a chain part, ends here.
const S = (v) => String(v == null ? '' : v).trim();
let t = {}; try { const x = $('Manual Run').first(); t = (x && x.json) || {}; } catch (e) { t = {}; }
if (t.body && typeof t.body === 'object') t = { ...t, ...t.body };
let g = {}; try { g = $('After Run Ledger (Index)').first().json || {}; } catch (e) { g = {}; }
const ch = t.ix_chain && typeof t.ix_chain === 'object' ? t.ix_chain : null;
if (!ch || !S(t.site_id)) return [{ json: { skip: true, reason: 'not a chain part' } }];
if (!['same_mode', 'too_many_open', 'heavy_busy'].includes(S(g.reason))) return [{ json: { skip: true, reason: 'refused for ' + (S(g.reason) || 'an unknown reason') + ': not retried' } }];
const attempt = (Number(ch.attempt) || 0) + 1;
if (attempt > 12) return [{ json: { skip: true, reason: 'refused 12 times in a row: the chain stops; the next dispatch starts these websites first' } }];
return [{ json: { trigger: 'ix_chain', parent_run_id: String($execution.id), site_id: S(t.site_id), ix_chain: { ...ch, attempt } } }];
