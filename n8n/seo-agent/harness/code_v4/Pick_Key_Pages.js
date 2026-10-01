const all = $('Get Crawled Pages').first().json.tasks?.[0]?.result?.[0]?.items || [];
const domain = $('Check Crawl').first().json.domain;
const pages = all.filter(p => p && p.url && (p.status_code == null || p.status_code === 200));

const isHome = (u) => /^https?:\/\/[^\/]+\/?$/.test(u);
const isLegal = (u) => /privacy|cookie|terms|security|legal|disclaimer/i.test(u);
const isArticle = (u) => /\/(insights|blog|news|articles?|guides?)\/./i.test(u);
const isContact = (u) => /contact/i.test(u);
const isAbout = (u) => /about|why|who-we|company|team/i.test(u);
const byImportance = (a, b) => (a.click_depth ?? 9) - (b.click_depth ?? 9) ||
  (((b.meta || {}).inbound_links_count || 0) - ((a.meta || {}).inbound_links_count || 0));

const pick = [];
const add = (p, kind) => { if (p && p.url && !pick.some(x => x.url === p.url)) pick.push({ url: p.url, kind }); };

add(pages.find(p => isHome(p.url)), 'home');
add(pages.find(p => isContact(p.url)), 'contact');
add(pages.find(p => isAbout(p.url) && !isContact(p.url)), 'about');
const isHub = (u) => /\/(insights|blog|news|articles?|guides?|tag|category|author)\/?$/i.test(u);
pages.filter(p => !isHome(p.url) && !isLegal(p.url) && !isArticle(p.url) && !isHub(p.url) && !isContact(p.url) && !isAbout(p.url))
  .sort(byImportance).slice(0, 5).forEach(p => add(p, 'service'));
pages.filter(p => isArticle(p.url)).sort(byImportance).slice(0, 2).forEach(p => add(p, 'article'));

// Kuch na mile to kam az kam homepage
if (!pick.some(p => p.kind === 'home')) pick.unshift({ url: 'https://' + domain + '/', kind: 'home' });

return pick.slice(0, 10).map(p => ({ json: p }));