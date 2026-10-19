// Site Kickoff: which of the website's weekly jobs start now, in Monday's order, each through its workflow's own Manual Run.
// A Manual Run given one site runs that job even when the site has it switched off (and the cadence even for a paused site), so the
// site's own settings are read HERE and only what it has on is started. Refused, with the reason: a website the engine does not
// track, a paused one, one already kicked off (unless `force`). A dry run starts only the two workflows that honour `dry_run` (AI Growth:
// no Bing / IndexNow submission; the Content Cadence: plans, writes nothing) — the catch-up's rule — and records nothing.
const v = $('Kickoff Validate').first().json;
const rowsOf = (name) => { try { return $(name).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error && Object.keys(r).length); } catch (e) { return []; } };
const normD = (x) => String(x || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const flag = (x, dflt) => (x === undefined || x === null || x === '') ? dflt : !(x === false || /^(false|0|no|off)$/i.test(String(x)));
const want = v.domain || v.site_id;
const site = rowsOf('Load Sites (Kickoff)').find(s => normD(s.domain) === v.domain || String(s.site_id || '') === (v.site_id || v.domain));
const refuse = (reason) => [{ json: { nothing_to_do: true, reason, domain: v.domain || '', site_id: v.site_id || '', request_id: v.request_id, dry_run: v.dry_run } }];
if (!site) return refuse('"' + want + '" is not tracked by the engine (start "Track my site" first)');
const domain = normD(site.domain), site_id = String(site.site_id);
if (String(site.status || 'active') === 'paused') return refuse(domain + ' is paused: its automatic work does not start');
const done = rowsOf('Load Kickoff Record').find(r => r.key === 'kickoff:' + site_id);
if (done && !v.force && !v.dry_run) return refuse(domain + ' was already kicked off (' + (done.updated_at || 'earlier') + '); send force: true to start its cycle again');
const m = rowsOf('Load Monitors (Kickoff)').find(r => r.site_id === site_id) || {};
const c = rowsOf('Load Cadence (Kickoff)').find(r => r.site_id === site_id);
const ai = flag(m.ai_visibility, true);
const base = { domain, site_id, trigger: 'kickoff', request_id: v.request_id };
// Monday's order: AI visibility 07:00 (writes the question panel the pulse and AI Growth read), backlinks 07:30, AI Growth 09:30,
// the Content Cadence 10:00, the Link Builder 11:00. The Site Tracker already ran when tracking was set up; the Rank Tracker has nothing
// to check before a ladder exists; the monthly audit keeps its own schedule.
const jobs = [
  { job: 'ai_visibility', workflow_id: 'SEOagentAIVisib1', on: ai, why: 'AI visibility is off', dry: false },
  { job: 'backlinks', workflow_id: 'SEOagentBacklnk1', on: flag(m.backlinks, true), why: 'the backlink monitor is off', dry: false, extra: { light: false } },
  { job: 'ai_growth', workflow_id: 'SEOagentAIGrow1', on: ai && flag(m.ai_growth, true), why: 'AI growth is off', dry: true },
  { job: 'content_cadence', workflow_id: 'SEOagentCadence1', on: !!c && String(c.status || 'active') !== 'off' && Number(c.pages_per_week) > 0, why: 'no blog posts a week are set', dry: true },
  { job: 'link_builder', workflow_id: 'SEOagentLinkBld1', on: flag(m.link_builder, true), why: 'link building is off', dry: false, extra: { free_only: false } },
];
const only = Array.isArray(v.jobs) && v.jobs.length ? v.jobs : null;   // the caller's subset (what the customer already ran today is left out)
const start = jobs.filter(j => j.on && (!only || only.includes(j.job)) && (!v.dry_run || j.dry));
const skipped = jobs.filter(j => !j.on).map(j => j.job + ': ' + j.why).concat(only ? jobs.filter(j => j.on && !only.includes(j.job)).map(j => j.job + ': not asked for') : []).concat(v.dry_run ? jobs.filter(j => j.on && !j.dry).map(j => j.job + ': not started in a dry run (it would spend)') : []);
if (!start.length) return refuse('nothing to start for ' + domain + (skipped.length ? ' (' + skipped.join('; ') + ')' : ''));
return start.map((j, i) => ({ json: { ...base, ...(j.extra || {}), ...(v.dry_run ? { dry_run: true } : {}), workflow_id: j.workflow_id, job: j.job, order: i + 1, of: start.length, skipped } }));
