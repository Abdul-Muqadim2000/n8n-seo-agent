// Second look for pages a plain fetch could not read (v4.10): a bot challenge (Cloudflare, DataDome …) or a JavaScript shell is "not checked",
// never "lost". The ones that matter — links missed once or reported lost, won prospects, valuable links, new referrers with authority 100+
// (never spam), mentions from the news — are rendered through Jina Reader as HTML (`X-Return-Format: html`: the page after its scripts ran,
// links with their rel attributes), up to 10 per run.
/*__LINK_KIT__*/
const reqs = $('Verify Requests').all().map(i => i.json); let resps = []; try { resps = $('Fetch Linking Pages').all().map(i => i.json || {}); } catch (e) {}
const out = [];
reqs.forEach((r, i) => {
  if (r.skip || !r.url || r.purpose === 'target' || r.purpose === 'list') return;
  const v = LK.verify(resps[i] || {}, r.domain, { url: r.url });
  const important = r.purpose === 'link' ? Number(r.spam) < 40 && (['missed_once', 'reported_lost', 'won', 'valuable'].includes(r.why) || (r.why === 'new' && Number(r.authority) >= 100)) : r.source === 'news';   // spam pages behind a challenge are not worth a render
  if ((v.verify === 'blocked' || v.verify === 'js') && important) out.push({ json: { index: i, site_id: r.site_id, url: r.url, render_url: 'https://r.jina.ai/' + r.url } });
});
return out.length ? out.slice(0, 10) : [{ json: { skip: true } }];
