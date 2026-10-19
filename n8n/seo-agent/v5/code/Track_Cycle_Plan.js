// "Track my site" creates the website's cycle (2026-10-19, agent E4; SCHEDULING_KEYWORDS_PLAN.md §4.2 / §4.7 / §14.1 / §14.5).
// The seo_cycles row used to be written only by the Site Kickoff webhook, which answers 409 `not_tracked` until this very path has written
// the seo_sites row: an app that called it right after `track` raced it. Now the row is ensured HERE, after the seo_sites row is saved, with
// the cycle kit's one row builder (CYC.cycleRow - the kickoff uses the same one, so the two cannot drift):
//   * no row yet: anchor = the request's `tracking_started_at` (accepted within the last 6 days and at most 1 h ahead - CYC.anchorOf, the
//     kickoff's own window - else now), zone = the request's `timezone` when valid (Normalize Input checked it), else the engine's; cycle 0
//     due at the anchor; skip_jobs = site_tracker (this path starts the Site Tracker itself, right after this node);
//   * a row already: its anchor, weekday and due times are kept (a re-save never moves the website's week), its status is kept (a paused
//     website stays paused), and only an empty zone - or the engine zone of a row the dispatcher adopted - takes the request's zone;
//   * the seo_sites save failed: no cycle row (the dispatcher adopts a tracked website with no row, so a failure here only delays cycle 0).
// The Site Kickoff webhook stays for `force` restarts and ops. Output: the decision; *Track Cycle Row* gives the save exactly the columns.
/*__CATCHUP__*/
/*__CYCLE__*/
const TZ = '__TZ__';
const d = $('Normalize Input').first().json;
const r = $('Site Row (Track)').first().json;
let saved = {}; try { saved = ($('Save Site (Track)').first() || {}).json || {}; } catch (e) { saved = { error: 'no answer' }; }
let loaded = []; try { loaded = $('Load Cycle (Track)').all().map(i => i.json || {}); } catch (e) { loaded = []; }
const bad = loaded.find(x => x && x.error);
const existing = loaded.find(x => x && !x.error && String(x.site_id || '') === r.site_id) || null;
const base = { site_id: r.site_id, domain: r.domain, write: false, created: false, row: null };
if (saved.error) return [{ json: { ...base, reason: 'the seo_sites row was not saved (' + String(saved.error.message || saved.error).slice(0, 160) + '), so no cycle row was written; the dispatcher adopts the website once its row exists' } }];
if (bad) return [{ json: { ...base, reason: 'the cycle table could not be read (' + String(bad.error.message || bad.error).slice(0, 160) + '), so nothing was written; the dispatcher adopts a tracked website with no cycle row at its next sweep' } }];
const now = Date.now();
const A = CYC.anchorOf(d.tracking_started_at, now);
const tz = CYC.validTz(d.timezone) ? String(d.timezone) : '';
const c = CYC.cycleRow({ existing, site_id: r.site_id, domain: r.domain, tz, anchor: A.at, now, skip_jobs: ['site_tracker'], engine_tz: TZ });
const cycle_key = c.created ? CYC.cycleKey(r.site_id, CYC.local(c.row.tz, Date.parse(c.row.anchor_at)).date) : String(c.row.current_key || '');
return [{ json: { ...base, write: c.write, created: c.created, changed: c.changed, row: c.row, cycle_key, anchor_at: c.row.anchor_at, tz: c.row.tz, status: c.row.status,
  next_due_at: c.row.next_due_at, cycle_weekday: c.row.cycle_weekday, anchor_basis: c.created ? A.why : 'kept', tz_basis: tz ? 'the request\'s time zone' : (d.timezone ? 'the request\'s time zone "' + String(d.timezone).slice(0, 64) + '" is not one the engine knows: the engine zone' : 'no time zone was sent: the engine zone'),
  reason: c.why } }];
