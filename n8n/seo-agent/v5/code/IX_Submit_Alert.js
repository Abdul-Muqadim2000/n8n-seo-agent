// Index coverage wave 2 review W8 (2026-10-30): the sitemap submission could not be made because OUR write credential (SEOcredGoogleSvcW) is
// missing - n8n answers the PUT with its own error item (no status code, a message naming the credential), nothing reached Google. The
// client's note says so in plain words (Index Run Rows: "Sitemap submission is not set up on our side yet"); this node raises ONE ops alert
// for the run on the shared path (a seo_ops_alerts row, OA.plan: a repeat within OA.DEDUPE_MINUTES is one row and is not re-sent; due at
// once, so the retry sweep that ends this run posts it to SEO_ALERT_WEBHOOK_URL). The attempt is recorded `not_set_up`, which spaces the
// next try (and the next alert) 7 days apart. Nothing is written when every answer came from Google.
/*__PAGE_WATCH__*/
/*__INDEX_KIT__*/
/*__OPS_ALERT__*/
const S = (v) => String(v == null ? '' : v).trim();
const grab = (n) => { try { return $(n).all().map(i => i.json); } catch (e) { return []; } };
const asked = grab('Sitemap Submit Requests').filter(q => q && !q.skip && q.site_id);
const answers = grab('Submit Sitemap (Index)');
const res = IX.submitResults({}, asked, answers, Date.now()).today;
const miss = asked.map((q, i) => ({ q, t: res[i] || {} })).filter(x => x.t.status === 'not_set_up');
if (!miss.length) return [{ json: { skip: true, reason: 'every sitemap submission was answered by Google (or none was made)' } }];
const err0 = (() => { const r = answers[asked.indexOf(miss[0].q)] || {}; const e = r.error; return typeof e === 'string' ? e : S(e && (e.message || e.description)) || 'no answer'; })();
const prior = grab('Load Submit Alerts').filter(r => r && !r.error && r.alert_key);
const p = OA.plan({ workflow: 'SEO Agent — Index Coverage', node: 'Submit Sitemap (Index)',
  message: 'Sitemap submission is not set up: the write credential SEOcredGoogleSvcW is missing or unusable (deploy_engine.py --credentials --create-missing). '
    + miss.length + ' sitemap(s) of ' + [...new Set(miss.map(x => S(x.q.site_id)))].length + ' website(s) were not submitted. n8n said: ' + err0.slice(0, 200),
  subject: '[critical] Index coverage: sitemap submission is not set up', execution_id: S($execution.id), execution_url: '', mode: 'index_coverage' },
  prior, { webhook_url: OA.cfgUrl('__ALERT_WEBHOOK_URL__'), email_to: '' });
// due at once: the sweep that ends this run (Alert Retry Plan (Index)) posts it; a repeat within the dedupe window keeps its booking
return [{ json: { ...p.row, next_attempt_at: p.notify ? new Date().toISOString() : p.row.next_attempt_at } }];
