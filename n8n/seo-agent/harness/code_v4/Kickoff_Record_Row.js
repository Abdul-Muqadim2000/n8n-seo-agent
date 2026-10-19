// one seo_cache row per website: when its first cycle was started and which jobs (a dry run writes none)
const jobs = $('Kickoff Plan').all().map(i => i.json);
const j = jobs[0] || {};
if (j.dry_run) return [{ json: { skip_record: true } }];
return [{ json: { key: 'kickoff:' + j.site_id, kind: 'kickoff', site_id: j.site_id, value: JSON.stringify({ at: new Date().toISOString(), jobs: jobs.map(x => x.job), request_id: j.request_id }), updated_at: new Date().toISOString() } }];