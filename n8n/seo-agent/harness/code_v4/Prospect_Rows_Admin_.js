// Site Admin "prospect": sets the status (and note) of a link prospect for the site — every type of that domain unless `type` is given.
// Rows keep all other fields (exact seo_link_prospects columns). Status won also stamps won_at.
const a = $('Admin Action').first().json;
let rows = []; try { rows = $('Load Link Prospects (Admin)').all().map(i => i.json).filter(x => x && x.site_id === a.site_id && x.prospect_domain === a.prospect_domain && (!a.prospect_type || x.type === a.prospect_type)); } catch (e) {}
const COLS = ['site_id', 'domain', 'prospect_domain', 'type', 'rank', 'spam_score', 'detail', 'source_url', 'target_url', 'status', 'first_seen', 'last_seen', 'won_at', 'outreach_subject', 'outreach_body', 'note'];
if (!rows.length) rows = [{ site_id: a.site_id, domain: a.domain, prospect_domain: a.prospect_domain, type: a.prospect_type || 'manual', rank: 0, spam_score: 0, detail: 'added by hand', source_url: '', target_url: '', status: 'new', first_seen: a.updated_at, last_seen: a.updated_at, won_at: '', outreach_subject: '', outreach_body: '', note: '' }];
return rows.map(r => { const o = {}; for (const c of COLS) o[c] = r[c] == null ? (['rank', 'spam_score'].includes(c) ? 0 : '') : r[c];
  if (a.prospect_status) { o.status = a.prospect_status; if (a.prospect_status === 'won' && !o.won_at) o.won_at = a.updated_at; }
  if (a.note !== null && a.note !== undefined) o.note = a.note; return { json: o }; });
