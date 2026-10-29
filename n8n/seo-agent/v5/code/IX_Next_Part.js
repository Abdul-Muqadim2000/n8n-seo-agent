// Index coverage (fix wave 1, X1): this website's rows and run row are saved; start the NEXT website of today's chain (its own execution,
// `parent_run_id` = this one, so the run guard does not take this execution's open row for a twin). Nothing when the chain is done, when
// this run was not part of a chain (on demand), or when the chain started more than 20 hours ago (tomorrow's dispatch starts a new one).
const S = (v) => String(v == null ? '' : v).trim();
let t = {}; try { const x = $('Manual Run').first(); t = (x && x.json) || {}; } catch (e) { t = {}; }
if (t.body && typeof t.body === 'object') t = { ...t, ...t.body };
const ch = t.ix_chain && typeof t.ix_chain === 'object' ? t.ix_chain : null;
if (!ch) return [{ json: { skip: true, reason: 'not part of a chain' } }];
// R8 (fix wave 3): Index Plan found this website checked today by another chain of today: that chain goes on, this one stops
let plan = {}; try { plan = $('Index Plan').first().json || {}; } catch (e) { plan = {}; }
if (plan.stop_chain) return [{ json: { skip: true, reason: 'another chain of today is checking these websites: this chain stops (' + S(plan.reason) + ')' } }];
const rest = Array.isArray(ch.rest) ? ch.rest.map(S).filter(Boolean) : [];
if (!rest.length) return [{ json: { skip: true, reason: 'the last website of the chain (' + (Number(ch.part) || 1) + ' of ' + (Number(ch.of) || 1) + ')' } }];
const age = Date.now() - (Date.parse(S(ch.started_at)) || Date.now());
if (age > 20 * 3600e3) return [{ json: { skip: true, reason: 'the chain started more than 20 hours ago; ' + rest.length + ' website(s) wait for the next dispatch' } }];
return [{ json: { trigger: 'ix_chain', parent_run_id: String($execution.id), site_id: rest[0], ix_chain: { ...ch, rest: rest.slice(1), part: (Number(ch.part) || 1) + 1, attempt: 0 } } }];
