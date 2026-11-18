// The reply for the Reply Reader, with what the link check found (a reply saying "done" is believed only when the link is on the page).
/*__LINK_KIT__*/
const r = $('Reply Input').first().json;
let reqs = [], resps = []; try { reqs = $('Reply Link Requests').all().map(i => i.json).filter(x => !x.skip); resps = $('Fetch Reply Pages').all().map(i => i.json || {}); } catch (e) {}
// CR17-E (client report 2026-11-17, build section 195): a link counts only on a page that passes the won rule's junk gates (LK.junkLink:
// not a job listing, a profile, a farm, a report page, a noindex page); a link on such a page is "found, low value", never won
const checks = reqs.map((q, i) => { const v = LK.verify(resps[i] || {}, r.domain, { url: q.url }); const junk = v.verify === 'found' ? LK.junkLink({ ...v, from_url: q.url, page_title: v.title || '' }) : '';
  return { url: q.url, verify: junk ? 'low_value' : v.verify, rel: v.rel || '', anchor: v.anchor || '', placement: v.placement || '', ...(junk ? { why: junk } : {}) }; });
const found = checks.find(c => c.verify === 'found') || null;
return [{ json: { ...r, link_found: !!found, link: found, checks, link_note: found ? 'OUR LINK IS LIVE on ' + found.url + ' (' + found.rel + ', anchor "' + found.anchor + '")' : (checks.length ? 'our link was NOT found on: ' + checks.map(c => c.url + ' (' + c.verify + ')').join(', ') : 'no page checked') } }];
