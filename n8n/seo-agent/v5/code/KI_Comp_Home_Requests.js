// Comp Home Requests (E2, DESIGN.md §2.5 / §7): the homepages of the candidates the rules could not place, read with one plain GET - public
// hosts only (no IP literal, no internal name: the SSRF rule every fetched address passes; the address is built from the host alone, never from
// text found on a page), at most CAPS.home_reads a run, each kept 14 days (KI.CONFIG ttl_days.homepage). What comes back is DATA: only its
// words are counted, nothing in it is followed.
/*__KI_KITS__*/
const c = $('Comp Candidates').first().json || {};
const items = (c.to_read || []).filter(KIW.publicHost).map(h => ({ domain: h, url: 'https://' + h + '/' }));
return items.length ? items.map(j => ({ json: j })) : [{ json: { skip: true, reason: 'every candidate is placed by rule or read in the last 14 days' } }];
