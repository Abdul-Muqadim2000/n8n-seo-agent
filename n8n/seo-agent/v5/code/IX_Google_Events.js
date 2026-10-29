// Index coverage: Google's own news, read once per run for every website (DESIGN §1.9). The Search Status Dashboard feed
// (status.search.google.com/incidents.json: every product, keyed on the incident id) and the fingerprint of the spam-policies page's MAIN text
// (a change to the page chrome is not a policy change). What is new or changed becomes a seo_google_events row; a rollout that started or
// finished today is news for the callback; a core or spam update still rolling out holds every quality suggestion (the freeze). A feed that
// could not be read changes nothing and says so - the events already stored still decide the freeze.
/*__PAGE_WATCH__*/
/*__INDEX_KIT__*/
const S = (v) => String(v == null ? '' : v).trim();
const now = Date.now();
const rowsOf = (name) => { try { return $(name).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error); } catch (e) { return []; } };
const stored = rowsOf('Load Google Events').filter(e => S(e.event_id));
let feed = null, feedWhy = '';
try {
  const it = $('Fetch Google Incidents').first(); const j = (it && it.json) || {};
  // a JSON array arrives as one item per element in n8n unless the whole body is kept; both shapes are read
  const all = $('Fetch Google Incidents').all().map(i => i.json);
  if (Number(j.statusCode) >= 400) feedWhy = 'the feed answered ' + j.statusCode;
  else if (Array.isArray(j)) feed = j;
  else if (Array.isArray(j.data)) feed = j.data;
  else if (typeof j.data === 'string' || typeof j.body === 'string') { try { feed = JSON.parse(S(j.data || j.body)); } catch (e) { feedWhy = 'the feed was not JSON'; } }
  else if (all.length && all.every(x => x && x.id && x.begin)) feed = all;
  else feedWhy = S((j.error && (j.error.message || j.error)) || 'no answer').slice(0, 160);
} catch (e) { feedWhy = 'not fetched'; }
const parsed = Array.isArray(feed) ? IX.parseEvents(feed) : [];
const ev = IX.eventRows(parsed, stored, now);
let policy = { read: false, why: 'not fetched', row: null, news: false };
try { const p = $('Fetch Spam Policies').first(); policy = IX.policyEvent((p && p.json) || {}, stored, now); } catch (e) { policy = { read: false, why: 'not fetched', row: null, news: false }; }
const rows = ev.rows.concat(policy.row ? [policy.row] : []);
// the events as they stand after this run (stored, overwritten by what changed), newest first
const byId = new Map(stored.map(e => [S(e.event_id), e]));
for (const r of rows) byId.set(r.event_id, { ...(byId.get(r.event_id) || {}), ...r });
const events = [...byId.values()].sort((a, b) => S(b.started_at).localeCompare(S(a.started_at)));
const fr = IX.freeze(events, now);
return [{ json: { events, rows, started: ev.started, completed: ev.completed, policy_news: policy.news ? policy.row : null, freeze: fr,
  feed_read: Array.isArray(feed), feed_why: Array.isArray(feed) ? '' : (feedWhy || 'not read'), feed_events: parsed.length,
  policy_read: !!policy.read, policy_why: policy.read ? '' : S(policy.why), policy_hash: S(policy.hash), policy_last_updated: S(policy.last_updated) } }];
