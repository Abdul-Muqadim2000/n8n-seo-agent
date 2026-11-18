// Build section 194 (client report 2026-11-17, devaicon.com F5): where a redirect lands. The daily fetch does not follow redirects (a key page
// that starts redirecting is itself the news), so a page that answers 3xx used to be a High alert whatever it pointed at: the four moves the
// client made on our own advice ("redirect the old address to the improved page") were raised as High. Here, one more plain GET per
// redirecting key page reads the target (redirects followed, up to five like Google) so Watch Compare can tell a permanent move to a working
// page (Info) from a redirect to a broken, unindexable or foreign page; and robots.txt, when it redirects, is read at the end of its chain the
// way Google reads it. Only same-site targets are fetched (a page sent to another website is judged on its address alone). Free.
/*__PAGE_WATCH__*/
const reads = (() => { try { return $('Watch Read').all().map(i => i.json); } catch (e) { return $input.all().map(i => i.json); } })().filter(r => r && r.site_id);
const S = (v) => String(v == null ? '' : v).trim();
const CAP = 40;   // per run: a site has at most 25 key pages, so this only stops a runaway
const out = [];
for (const r of reads) {
  if (out.length >= CAP) break;
  if (r.kind === 'robots') {
    const rb = r.robots || {};
    if (S(rb.state) === 'unresolved' && S(rb.location)) {
      const to = PW.helpers.absUrl(rb.location, r.url);
      if (to) out.push({ json: { site_idx: r.site_idx, site_id: r.site_id, kind: 'robots', for_url: r.url, url: to, status: Number(rb.status) || 0 } });
    }
    continue;
  }
  const st = Number(r.status) || 0;
  if (r.ok === false || st < 300 || st >= 400) continue;
  const to = PW.helpers.absUrl(r.location, r.url);
  if (!to || PW.helpers.bare(PW.helpers.hostOf(to)) !== PW.helpers.bare(PW.helpers.hostOf(r.url))) continue;   // no address, or another website: judged without a fetch
  out.push({ json: { site_idx: r.site_idx, site_id: r.site_id, kind: 'page', for_url: r.url, url: to, status: st } });
}
return out.length ? out : [{ json: { skip: true, reason: 'no key page redirects today' } }];
