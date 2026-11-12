// Index coverage wave 3 (DESIGN_WAVE3.md §2.3): the one IndexNow POST a website a run. The key file must answer 200 with exactly the key
// (body trimmed); anything else - a redirect (not followed), a 404, another body - sends nothing and says why once in the run note. A dry
// run (`dry_run` on the Manual Run, carried along the chain) sends nothing and hands on what it would have sent. At most IX.CFG.indexnow_cap
// URLs, all on the key's host. The POST never retries a 4xx (neverError: an answer, read with its status code) and never fails the run.
/*__PAGE_WATCH__*/
/*__INDEX_KIT__*/
const S = (v) => String(v == null ? '' : v).trim();
const n0 = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const grab = (n) => { try { return $(n).all().map(i => i.json); } catch (e) { return []; } };
const plan = grab('Index Plan')[0] || {};
const diag = grab('Index Diagnose').filter(x => x && x.site_id);
const checks = grab('IndexNow Key Check (Index)');
const asked = checks.filter(q => q && !q.skip && q.site_id);
const res = grab('Fetch IndexNow Key (Index)');
const reasons = { ...((checks.find(q => q && q.reasons) || {}).reasons || {}) };
const out = []; const dry = {};
asked.forEach((q, i) => {
  const r = res[i] || {}; const st = n0(r.statusCode ?? r.status); const body = S(r.body ?? r.data);
  if (!(st === 200 && body === q.key)) { reasons[q.site_id] = 'key_not_verified'; return; }
  const d = diag.find(x => x.site_id === q.site_id) || {};
  const urls = (((d.indexnow || {}).urls) || []).filter(u => IX.hostOf(u) === S(q.host)).slice(0, IX.CFG.indexnow_cap);
  if (!urls.length) { reasons[q.site_id] = 'nothing_new'; return; }
  if (plan.dry_run === true) { reasons[q.site_id] = 'dry_run'; dry[q.site_id] = urls; return; }
  out.push({ json: { site_id: q.site_id, url: 'https://api.indexnow.org/indexnow', urls, body: { host: S(q.host), key: q.key, keyLocation: q.url, urlList: urls } } });
});
// the reasons of the websites that send nothing ride on every item (one website an execution in practice; Index Run Rows reads them)
return out.length ? out.map(o => ({ json: { ...o.json, reasons, would_submit: dry } })) : [{ json: { skip: true, reasons, would_submit: dry } }];
