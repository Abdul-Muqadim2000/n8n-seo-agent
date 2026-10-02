const res = $input.first().json || {};
const task = res.tasks?.[0] || {};
const items = task.result?.[0]?.items || [];

let base;
try { base = $('Prepare Keyword Run').first().json; }
catch (e) { base = $('Route Mode').first().json; }
const ours = String(base.domain || '').toLowerCase().replace(/^www\./, '');

const SKIP = [
  // social, video, forums
  'youtube.com', 'wikipedia.org', 'reddit.com', 'quora.com', 'facebook.com', 'instagram.com', 'linkedin.com',
  'pinterest.com', 'tiktok.com', 'x.com', 'twitter.com', 'medium.com',
  // marketplaces, app stores
  'amazon.com', 'amazon.ae', 'daraz.pk', 'noon.com', 'play.google.com', 'apps.apple.com',
  // job boards
  'indeed.com', 'glassdoor.com', 'bayt.com', 'naukrigulf.com', 'rozee.pk', 'monster.com',
  // training, courses
  'udemy.com', 'coursera.org', 'euro-training.net', 'simplilearn.com',
  // software vendors' own product and docs pages (not service competitors)
  'microsoft.com', 'dynamics.com', 'sap.com', 'oracle.com', 'salesforce.com', 'google.com'
];
const isSkipped = (d) => SKIP.some(s => d === s || d.endsWith('.' + s));

const cleanUrl = (u) => { const s = String(u || ''); const i = s.indexOf('?'); if (i < 0) return s; const rest = s.slice(i + 1); const hi = rest.indexOf('#'); const hash = hi >= 0 ? rest.slice(hi) : ''; const q = (hi >= 0 ? rest.slice(0, hi) : rest).split('&').filter(p => p && !/^(srsltid|utm_source|utm_medium|utm_campaign|gclid|fbclid)=/i.test(p)); return s.slice(0, i) + (q.length ? '?' + q.join('&') : '') + hash; };   // regex version: the n8n Code sandbox has no URL constructor

const seen = new Set();
const picked = [];
const skipped = [];

for (const it of items) {
  if (it.type !== 'organic' || !it.url) continue;
  const d = String(it.domain || '').toLowerCase().replace(/^www\./, '');
  if (!d) continue;
  if (ours && (d === ours || d.endsWith('.' + ours))) { skipped.push(d + ' (your site)'); continue; }
  if (isSkipped(d)) { skipped.push(d); continue; }
  if (seen.has(d)) continue;
  seen.add(d);
  picked.push({
    rank: it.rank_group,
    url: cleanUrl(it.url),
    domain: d,
    title: it.title || '',
    snippet: it.description || ''
  });
  if (picked.length >= 8) break;
}

if (!picked.length) {
  return [{
    json: {
      rank: null, url: null, domain: null, title: null, snippet: null,
      no_competitors: true,
      serp_status: task.status_message || res.status_message || 'no results',
      serp_results: items.length,
      skipped
    }
  }];
}

return picked.map(p => ({ json: { ...p, no_competitors: false } }));