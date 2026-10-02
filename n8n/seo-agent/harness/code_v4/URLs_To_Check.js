const d = $input.first().json;
const list = d.html_analysis.urls_to_check || [];
// Only probe public http(s) URLs (schema can point anywhere, including internal hosts)
const publicUrl = (u) => { const m = String(u || '').trim().match(/^(https?):\/\/(?:[^@\/?#]*@)?([^\/?#]+)/i); if (!m) return false; const hp = m[2].toLowerCase(); if (hp.includes(':') || hp.startsWith('[')) return false; const h = hp; if (!h.includes('.')) return false; if (/^(\d{1,3}\.){3}\d{1,3}$/.test(h)) return false; if (/(^|\.)(localhost|local|internal|localdomain|lan|corp|intranet|test|invalid)$/.test(h)) return false; return true; };   // regex parser: the n8n Code sandbox has no URL constructor
const seen = new Set();
const out = [];
for (const u of list) {
  let url = u.url;
  if (url && url.startsWith('/')) url = 'https://' + d.domain + url;
  if (!url || seen.has(url) || !publicUrl(url)) continue;
  seen.add(url);
  out.push({ json: { url, purpose: u.purpose } });
}
if (!out.length) out.push({ json: { url: 'https://' + d.domain + '/', purpose: 'none' } });
return out;