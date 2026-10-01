// Which competitor pages came back blocked, empty or too thin? Those get a second attempt through Jina's browser engine + proxy pool.
const meta = $('Pick Top 6').all().map(i => i.json);
const res = $input.all().map(i => i.json);
const blocked = [];
res.forEach((j, i) => {
  const info = meta[i] || {};
  if (!info.url) return;
  const raw = String(j.page_text || j.data || j.body || '');
  const words = raw.split(/\s+/).filter(Boolean).length;
  const bad = !!j.error || !raw || /captcha|cloudflare ray id|access denied|just a moment|enable javascript and cookies|verify you are human|attention required/i.test(raw.slice(0, 1500)) || words < 120;
  if (bad) blocked.push({ index: i, url: info.url, domain: info.domain, reason: j.error ? 'request error' : (!raw ? 'empty response' : (words < 120 ? 'too little text' : 'bot protection')) });
});
return [{ json: { blocked, blocked_count: blocked.length, pages_ok: res.length - blocked.length } }];
