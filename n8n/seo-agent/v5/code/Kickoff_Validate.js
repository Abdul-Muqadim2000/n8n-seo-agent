// Site Kickoff (POST /webhook/seo-site-kickoff, header X-API-Key; app/docs/CREDITS.md + the web app when "Track my site" is set up):
// { domain | site_id, force?, dry_run?, request_id? } — answered at once (accepted); the website's first weekly cycle then starts as
// separate executions through each workflow's own Manual Run.
const raw = $input.first().json || {}; const b = (raw.body && typeof raw.body === 'object' && !Array.isArray(raw.body)) ? raw.body : {};
const normD = (x) => String(x || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const yes = (v) => /^(true|1|yes|on)$/i.test(String(v ?? ''));
const domain = normD(b.domain); const site_id = String(b.site_id || '').trim();
const errors = []; if (!domain && !site_id) errors.push('domain or site_id is required');
return [{ json: { ok: !errors.length, error: errors.join('; '), domain, site_id, force: yes(b.force), dry_run: yes(b.dry_run), request_id: String(b.request_id || ('kickoff-' + $execution.id)) } }];
