// Site Kickoff: the website's seo_cycles row - cycle 0 due at the anchor (now, or the app's trackingStartedAt), in the owner's time zone,
// with what the app already ran left out of cycle 0. The row is built by the cycle kit's own newCycleRow (the dispatcher's adoption uses
// the same one), so the two can never differ: weekday = the anchor's local weekday, local time 06:00, monthly day = the anchor's day of the
// month clamped to 28. Refused, with the reason (and answered 409): a website the engine does not track, a paused one, one whose cycle
// already exists (unless `force`: cycle 0 starts again from the new anchor; on the same local day it is the same cycle, so a job already
// done is not run twice). A dry run writes nothing and answers with the row it would write.
/*__CATCHUP__*/
/*__CYCLE__*/
const TZ = '__TZ__';
const v = $('Kickoff Validate').first().json;
const rowsOf = (name) => { try { return $(name).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error && Object.keys(r).length); } catch (e) { return []; } };
const normD = (x) => String(x || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const want = v.domain || v.site_id;
const refuse = (code, reason, extra) => [{ json: { refused: true, code, reason, domain: v.domain || '', site_id: v.site_id || '', request_id: v.request_id, dry_run: !!v.dry_run, ...(extra || {}) } }];
let badLoad = null; try { badLoad = $('Load Cycles (Kickoff)').all().map(i => i.json).find(r => r && r.error) || null; } catch (e) { badLoad = null; }
if (badLoad) return refuse('unreadable', 'the cycle table could not be read (' + String(badLoad.error.message || badLoad.error).slice(0, 160) + '), so nothing was written; try again');
const site = rowsOf('Load Sites (Kickoff)').find(s => normD(s.domain) === v.domain || String(s.site_id || '') === (v.site_id || v.domain));
if (!site) return refuse('not_tracked', '"' + want + '" is not tracked by the engine (start "Track my site" first; the kickoff can be sent again once its tracking row exists)');
const domain = normD(site.domain), site_id = String(site.site_id);
if (String(site.status || 'active') === 'paused') return refuse('paused', domain + ' is paused: its automatic work does not start', { domain, site_id });
const existing = rowsOf('Load Cycles (Kickoff)').find(r => String(r.site_id || '') === site_id) || null;
if (existing && !v.force && !v.dry_run)
  return refuse('already_started', domain + ' already has its cycle (anchored ' + (existing.anchor_at || '?') + ', next due ' + (existing.next_due_at || '?') + '); send force: true to start cycle 0 again', { domain, site_id });
const now = Date.now(), anchor = v.anchor_at ? Date.parse(v.anchor_at) : now, tz = v.tz || TZ;
const row = CYC.newCycleRow({ site_id, domain, tz, anchor, now, skip_jobs: v.skip_jobs, adopted: false });
const cycle_key = CYC.cycleKey(site_id, CYC.local(tz, anchor).date);
return [{ json: { refused: false, dry_run: !!v.dry_run, force: !!v.force, site_id, domain, cycle_key, next_due_at: row.next_due_at, request_id: v.request_id, row,
  exists: !!existing, replaces: existing ? { anchor_at: String(existing.anchor_at || ''), current_key: String(existing.current_key || ''), next_due_at: String(existing.next_due_at || '') } : null } }];
