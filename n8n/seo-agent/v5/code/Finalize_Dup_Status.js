// Production review 2026-11-12 (S3-05, build section 189): what each address the first check called "the same search" answers NOW, read by
// *Fetch Duplicate Pages* without following redirects (paired with *Duplicate Status Plan* by position). It goes on the request as
// `body.duplicate_status: [{ url, status, location }]` for Parse Brief; a read that failed (no status, 401 / 403 / 429, a bot wall) is
// `status: 0`, which Finalize Verdict treats as unknown: the duplicate then stays as the first check found it.
const plan = $('Duplicate Status Plan').all().map(i => i.json || {});
const res = $input.all().map(i => i.json || {});
const S = (v) => String(v == null ? '' : v);
const base = plan[0] || {};
const abs = (loc, from) => { const l = S(loc).trim(); if (!l) return ''; if (/^https?:\/\//i.test(l)) return l;
  const m = S(from).match(/^(https?:\/\/[^\/?#]+)/i); if (!m) return ''; return l.startsWith('/') ? m[1] + l : m[1] + '/' + l; };
const status = plan.map((p, i) => { const u = S((p.dup_check || {}).url); const r = res[i] || {};
  const st = Number(r.statusCode != null ? r.statusCode : r.status) || 0; const h = r.headers || {};
  const loc = st >= 300 && st < 400 ? abs(h.location || h.Location || '', u) : '';
  return { url: u, status: [401, 403, 429].includes(st) ? 0 : st, location: loc }; }).filter(x => x.url);
const body = { ...((base.body && typeof base.body === 'object') ? base.body : {}), duplicate_status: status };
const out = { ...base, body }; delete out.dup_check;
return [{ json: out }];
