// KI (W0 2026-11-08, E2 2026-11-08, docs/keyword-intel-2026-11-08/CONTRACTS.md §3): the request as the API front door forwards it ({ headers, body }, the body
// being the app's payload: mode, keyword, country, domain, email, callback_url, business, customers, competitors, seeds, ki_force, request_id).
// Pure reading and normalising: nothing is decided here. No URL constructor (the n8n sandbox has none): hosts by regex.
const raw = $input.first().json || {};
const b = (raw.body && typeof raw.body === 'object' && !Array.isArray(raw.body)) ? raw.body : raw;
const S = (v) => (v == null ? '' : String(v)).trim();
const mode = S(b.mode).toLowerCase();
const kind = mode === 'competitors' || mode === 'keyword_research' ? mode : '';
const STAGE = { competitors: 'ki_competitors', keyword_research: 'ki_research' };
const normD = (x) => S(x).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#:].*$/, '');
const domain = normD(b.domain);
const list = (v) => (Array.isArray(v) ? v : S(v).split(/[\n,;]+/)).map(S).filter(Boolean);
const uniq = (a) => a.filter((x, i) => a.indexOf(x) === i);
const competitors = uniq(list(b.competitors).map(normD).filter(x => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(x) && x !== domain)).slice(0, 5);
const seeds = uniq(list(b.seeds).map(x => x.replace(/\s+/g, ' ').toLowerCase().slice(0, 120))).slice(0, 20);
// FX-L H4: the keywords the client's own checks said AVOID (the app's keyword checks and content verdicts): never a candidate without an override
const avoid = uniq(list(b.avoid).map(x => x.replace(/\s+/g, ' ').toLowerCase().slice(0, 120))).slice(0, 200);
const cb = S(b.callback_url);
const callbackOk = /^(https:\/\/\S+|http:\/\/(localhost|127\.0\.0\.1|host\.docker\.internal|n8n)(:\d+)?\/\S*)$/.test(cb);
return [{ json: {
  kind, mode, stage: STAGE[kind] || 'ki_competitors', rule_version: '__RULE_VERSION__',
  domain, site_id: domain ? 'site_' + domain.replace(/[^a-z0-9]+/g, '-') : '',
  request_id: S(b.request_id), run_id: S($execution.id), client_ip: S(b.client_ip), country: S(b.country),
  competitors, seeds, avoid, ki_force: b.ki_force === true || /^(true|1|yes)$/i.test(S(b.ki_force)),
  callback_url: callbackOk ? cb : '', started_at: new Date().toISOString(),
  // E2: the caller's identity, the key the main workflow's Rate Limit counts a company's runs by (app:<company id>), and the business text
  client_key: S(b.client_ip).toLowerCase(), business: S(b.business).slice(0, 2000), customers: S(b.customers).slice(0, 500)
} }];