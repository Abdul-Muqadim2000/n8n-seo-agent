const base = $('Analyze Probes').first().json;
const domain = base.domain;
const picked = $('Pick Key Pages').all().map(i => i.json);
const res = $input.all().map(i => i.json);
const nowYear = new Date().getFullYear();

const strip = (s) => String(s || '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
const attr = (tag, name) => { const m = tag.match(new RegExp('\\s' + name + '\\s*=\\s*["\']([^"\']*)["\']', 'i')); return m ? m[1] : null; };
const asArr = (v) => v == null ? [] : (Array.isArray(v) ? v : [v]);
const typesOf = (n) => asArr(n['@type']).map(String);
const urlOf = (v) => typeof v === 'string' ? v : (v && (v.url || v['@id'])) || null;

const IGNORE_EXT = /cloudinary|apollo|googletagmanager|google-analytics|gstatic|googleapis|facebook\.net|doubleclick|hotjar|clarity|linkedin\.com\/company|vercel|jsdelivr|cdnjs|fonts\./i;

const P = [];
picked.forEach((pk, i) => {
  const r = res[i] || {};
  const html = String(r.html || r.body || r.data || '');
  const text = strip(html);

  // JSON-LD
  const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  const nodes = []; let invalid = 0;
  for (const b of blocks) {
    try {
      const j = JSON.parse(b.trim());
      for (const x of asArr(j)) { if (x && x['@graph']) nodes.push(...x['@graph']); else if (x) nodes.push(x); }
    } catch (e) { invalid++; }
  }
  const types = [...new Set(nodes.flatMap(typesOf))];

  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map(m => strip(m[1])).filter(Boolean);
  const headings = [...html.matchAll(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/gi)].map(m => strip(m[1]));
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map(m => m[0]);
  const tels = [...new Set([...html.matchAll(/href=["']tel:([^"']+)["']/gi)].map(m => m[1].trim()))];
  const extDomains = [...new Set([...html.matchAll(/href=["'](https?:\/\/[^"'\/]+)/gi)]
    .map(m => m[1].replace(/^https?:\/\/(www\.)?/, '').toLowerCase())
    .filter(d => !d.endsWith(domain) && !IGNORE_EXT.test(d)))];

  P.push({
    url: pk.url, kind: pk.kind, status: r.statusCode || 0, html, text, nodes, types, invalid,
    h1s, headings, imgs, tels, extDomains,
    forms: (html.match(/<form\b/gi) || []).length,
    inputs: (html.match(/<(input|textarea)\b/gi) || []).length,
    lang: (html.match(/<html[^>]*\slang=["']([^"']+)["']/i) || [])[1] || null,
    hreflang: /hreflang=/i.test(html),
    hreflangs: [...html.matchAll(/<link[^>]+hreflang=["']([^"']+)["'][^>]*>/gi)].map(m => ({ lang: m[1].toLowerCase(), href: (m[0].match(/href=["']([^"']+)["']/i) || [])[1] || '' })),
    speculation: /type=["']speculationrules["']/i.test(html),
    viewport: /<meta[^>]+name=["']viewport["']/i.test(html),
    noindex: /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html) || /<meta[^>]+content=["'][^"']*noindex[^"']*["'][^>]+name=["']robots["']/i.test(html),
    mixed: [...html.matchAll(/<(?:img|script|link|iframe|source|video|audio)\b[^>]*\s(?:src|href)=["']http:\/\/[^"']+["']/gi)].length,
    canonical: (html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i) || html.match(/<link[^>]+href=["']([^"']+)["'][^>]*rel=["']canonical["']/i) || [])[1] || null
  });
});

const findings = [];
const works = [];
const urlsToCheck = [];
const F = (category, severity, title, evidence, why, fix, sample_urls = [], affected = null, total = null) => findings.push({
  category, severity, title, evidence, why, fix, sample_urls,
  affected_count: affected, affected_pct: affected != null && total ? Math.round(affected / total * 100) : 100,
  scope: affected != null ? 'page' : 'site'
});

const home = P.find(p => p.kind === 'home') || P[0] || { nodes: [], types: [], h1s: [], imgs: [], text: '', html: '' };
const allNodes = P.flatMap(p => p.nodes);
const ORG_TYPES = /^(Organization|Corporation|LocalBusiness|ProfessionalService|Store|Restaurant|MedicalBusiness|LegalService|FinancialService|EducationalOrganization)$/;
const org = home.nodes.find(n => typesOf(n).some(t => ORG_TYPES.test(t))) || allNodes.find(n => typesOf(n).some(t => ORG_TYPES.test(t)));

// ---------- Schema basics ----------
const invalidTotal = P.reduce((s, p) => s + p.invalid, 0);
if (invalidTotal) F('Schema', 'High', 'Invalid structured data (JSON-LD will not parse)', invalidTotal + ' broken JSON-LD block(s) on sampled pages', 'Search engines ignore structured data that cannot be parsed.', 'Validate the markup with Google Rich Results Test and fix syntax errors.', P.filter(p => p.invalid).map(p => p.url));
if (!home.nodes.length) {
  F('Schema', 'High', 'No structured data on the homepage', 'No JSON-LD found on ' + home.url, 'Structured data helps Google and AI systems understand who you are and what you offer.', 'Add Organization (or LocalBusiness/ProfessionalService) JSON-LD with name, logo, address, contact details and sameAs profiles.');
} else works.push('Structured data present on the homepage (' + home.types.join(', ') + ')');

if (!org) {
  F('Schema', 'High', 'No Organization schema', 'None of ' + P.length + ' sampled pages declare Organization or LocalBusiness', 'Without it, search engines and AI tools have no machine-readable identity for the business.', 'Add Organization JSON-LD sitewide with @id, name, logo, address, telephone, email and sameAs.');
} else {
  works.push('Organization schema found (' + typesOf(org).join(', ') + ')');

  // logo
  const logo = urlOf(org.logo);
  if (!logo) F('Schema', 'Medium', 'Organization schema has no logo', 'logo property missing', 'Google uses the schema logo for knowledge panels and brand results.', 'Add a logo ImageObject with url, width and height.');
  else urlsToCheck.push({ url: logo, purpose: 'Organization logo' });
  if (urlOf(org.image)) urlsToCheck.push({ url: urlOf(org.image), purpose: 'Organization image' });

  // sameAs
  const sameAs = asArr(org.sameAs).map(String);
  const bad = sameAs.filter(u => {
    const m = u.match(/(?:twitter|x)\.com\/([^\/?#]+)/i);
    return m ? !/^[A-Za-z0-9_]{1,15}$/.test(m[1]) : !/^https?:\/\/[^\s]+\.[^\s]+/.test(u);
  });
  if (bad.length) F('Schema', 'High', 'Malformed sameAs profile link', 'Invalid: ' + bad.join(', '), 'A broken identity link is worse than none: it confuses entity matching in Google and AI systems.', 'Remove or correct the invalid entry and link only real, active profiles.');
  if (sameAs.length - bad.length < 3) F('Schema', 'Medium', 'Few verified profiles linked in sameAs', (sameAs.length - bad.length) + ' valid sameAs link(s): ' + (sameAs.join(', ') || 'none'), 'Entity recognition works best with 4-6 independent profiles (LinkedIn, directories, Wikidata, Crunchbase, review sites).', 'Add sameAs links to every real business profile.');
  else works.push(sameAs.length + ' sameAs profile links');

  // NAP
  const addr = org.address && typeof org.address === 'object' ? org.address : null;
  const missing = [];
  if (!addr || !addr.streetAddress) missing.push('streetAddress');
  if (!addr || !addr.addressLocality) missing.push('addressLocality');
  const cps = asArr(org.contactPoint);
  const hasTel = org.telephone || cps.some(c => c.telephone);
  const hasEmail = org.email || cps.some(c => c.email);
  const visibleTel = P.some(p => p.tels.length) || /\+\d[\d\s-]{7,}/.test(home.text);
  const visibleMail = /[\w.+-]+@[\w-]+\.[\w.]+/.test(P.map(p => p.text).join(' '));
  if (!hasTel && visibleTel) missing.push('telephone');
  if (!hasEmail && visibleMail) missing.push('email');
  if (missing.length) F('Schema', 'High', 'Structured contact details are thinner than what the site shows', 'Missing in schema: ' + missing.join(', '), 'Search engines cannot match your business listing to your site when the address and phone in schema are incomplete.', 'Add full PostalAddress (streetAddress, addressLocality, addressRegion, postalCode, addressCountry), telephone and email to Organization schema.');
  else works.push('Organization schema includes full address and contact details');
  if (!org.alternateName) F('Schema', 'Low', 'No alternateName in Organization schema', 'alternateName missing', 'Helps search engines and AI map spelling variants of the brand to one entity.', 'Add alternateName with common variants of the brand name.');
  if (!org['@id']) F('Schema', 'Low', 'Organization schema has no @id', '@id missing', 'An @id lets other schema (Service, Article) reference the same organisation cleanly.', 'Add "@id": "https://' + domain + '/#organization".');

  // founding date vs experience claims
  const fy = parseInt(String(org.foundingDate || '').slice(0, 4), 10);
  const claims = P.flatMap(p => [...p.text.matchAll(/(\d{1,2})\s*\+?\s*years?\b/gi)].map(m => ({ n: +m[1], url: p.url })));
  const maxClaim = claims.reduce((a, c) => c.n > a.n ? c : a, { n: 0 });
  if (fy && maxClaim.n && maxClaim.n > (nowYear - fy) + 1) {
    F('Content', 'High', 'Experience claim conflicts with the founding date', '"' + maxClaim.n + '+ years" on ' + maxClaim.url + ' but schema foundingDate is ' + org.foundingDate, 'Contradictory facts damage trust with buyers and with search quality systems.', 'Make the claims consistent (e.g. "leadership with ' + maxClaim.n + '+ years of experience") or correct the founding date.', [maxClaim.url]);
  }

  // language
  const langs = asArr(org.availableLanguage).length;
  if (langs > 1 && !P.some(p => p.hreflang)) F('Technical', 'Info', 'Multiple languages declared but no hreflang', 'Schema lists ' + langs + ' languages; no hreflang tags found', 'Only matters once other language versions exist.', 'Add hreflang when translated pages go live.');
}

// ---------- Service & Breadcrumb ----------
const services = P.filter(p => p.kind === 'service');
const noService = services.filter(p => !p.types.some(t => /Service|Product|Offer/i.test(t)));
if (services.length && noService.length) F('Schema', noService.length === services.length ? 'High' : 'Medium', 'Service pages have no Service schema', noService.length + ' of ' + services.length + ' sampled service pages', 'Service schema tells search engines exactly what you offer, where and by whom, and separates similar service pages.', 'Add Service JSON-LD (serviceType, provider → Organization @id, areaServed) on each service page.', noService.map(p => p.url), noService.length, services.length);
else if (services.length) works.push('Service schema present on sampled service pages');

const inner = P.filter(p => p.kind !== 'home');
const noCrumb = inner.filter(p => !p.types.includes('BreadcrumbList'));
if (inner.length && noCrumb.length) F('Schema', noCrumb.length === inner.length ? 'High' : 'Medium', 'No BreadcrumbList schema', noCrumb.length + ' of ' + inner.length + ' sampled inner pages', 'Breadcrumbs show site hierarchy in search results and help search engines understand structure.', 'Add BreadcrumbList JSON-LD to every inner page.', noCrumb.map(p => p.url), noCrumb.length, inner.length);
else if (inner.length) works.push('BreadcrumbList schema present');

// ---------- Articles ----------
const arts = P.filter(p => p.kind === 'article');
const artNodes = arts.map(p => ({ p, n: p.nodes.find(n => typesOf(n).some(t => /Article|BlogPosting|NewsArticle/.test(t))) }));
const noAuthor = artNodes.filter(({ n }) => {
  const a = n && asArr(n.author)[0];
  const name = a && (typeof a === 'string' ? a : a.name);
  const isOrg = a && typesOf(a).some(t => /Organization/.test(t));
  return !name || isOrg || /team|staff|admin|editor/i.test(name);
});
if (arts.length && noAuthor.length) F('Content', 'High', 'Articles have no named human author', noAuthor.length + ' of ' + arts.length + ' sampled articles', 'Expertise signals (E-E-A-T) depend on a real, credentialed author, especially on advice or compliance topics.', 'Credit a named expert with an author page, job title and LinkedIn (author @type Person with url and sameAs).', noAuthor.map(x => x.p.url), noAuthor.length, arts.length);
const frozen = artNodes.filter(({ n }) => n && n.datePublished && n.dateModified && n.datePublished === n.dateModified);
if (frozen.length) F('Content', 'Medium', 'No freshness signal on articles', frozen.length + ' of ' + arts.length + ' sampled articles have dateModified equal to datePublished', 'Time-sensitive content looks unmaintained without a genuine update date.', 'Show a visible "Last reviewed" date and update dateModified only after real edits.', frozen.map(x => x.p.url), frozen.length, arts.length);
artNodes.forEach(({ n }) => { const pl = n && n.publisher && urlOf(n.publisher.logo); if (pl) urlsToCheck.push({ url: pl, purpose: 'Article publisher logo' }); });
const noCite = arts.filter(p => p.extDomains.length === 0);
if (arts.length && noCite.length) F('Content', noCite.length === arts.length ? 'High' : 'Medium', 'Articles cite no external sources', noCite.length + ' of ' + arts.length + ' sampled articles link to no authoritative source', 'Uncited facts are less trustworthy and less likely to be quoted by Google AI Overviews, ChatGPT or Perplexity.', 'Link each key fact, law or statistic to its primary source (government, standards body, vendor docs).', noCite.map(p => p.url), noCite.length, arts.length);
else if (arts.length) works.push('Sampled articles link to external sources');

// ---------- Homepage H1 ----------
const brand = String((org && org.name) || domain.split('.')[0]).toLowerCase().replace(/[^a-z0-9]/g, '');
const h1 = home.h1s[0] || '';
if (h1 && brand && !h1.toLowerCase().replace(/[^a-z0-9]/g, '').includes(brand.slice(0, Math.max(4, brand.length - 1)))) {
  F('On-Page', 'Low', 'Homepage H1 does not name the business or what it does', 'Homepage H1: "' + h1 + '"', 'The homepage H1 is the strongest on-page signal of who you are, what you sell and where.', 'Rewrite the H1 to name the brand, the service category and the location.', [home.url]);
}

// ---------- Contact form ----------
const contact = P.find(p => p.kind === 'contact');
if (contact && contact.forms === 0 && contact.inputs === 0) F('Technical', 'Medium', 'Contact form is not in the server-rendered HTML', 'Raw HTML of ' + contact.url + ' has 0 <form> and 0 <input> elements', 'Crawlers and AI agents that do not run JavaScript see no way to contact you.', 'Server-render the form (fields, labels, submit) or add a <noscript> fallback form.', [contact.url]);

// ---------- Images ----------
const heroImg = home.imgs[0];
if (heroImg && !(attr(heroImg, 'alt') || '').trim()) F('Images', 'Medium', 'Main homepage image has empty alt text', 'First image on the homepage: ' + (attr(heroImg, 'src') || '').slice(0, 80), 'The main image is usually the LCP element and carries meaning; empty alt loses context for search and accessibility.', 'Write descriptive alt text for the hero image.', [home.url]);
const noDim = P.flatMap(p => p.imgs.filter(t => !attr(t, 'width') || !attr(t, 'height')).map(t => ({ url: p.url, src: attr(t, 'src') })));
if (noDim.length >= 3) F('Images', 'Medium', 'Images without width and height', noDim.length + ' images on sampled pages lack explicit dimensions', 'Images without reserved space can shift the layout while loading (CLS).', 'Add width and height (or aspect-ratio) to every image.', [...new Set(noDim.map(x => x.url))]);

// ---------- Phone numbers ----------
const hiddenTels = [];
P.forEach(p => p.tels.forEach(t => { const digits = t.replace(/\D/g, '').slice(-7); if (digits && !p.text.replace(/\D/g, '').includes(digits)) hiddenTels.push(t + ' (' + p.url + ')'); }));
if (hiddenTels.length) F('Content', 'Low', 'Phone number in a link but not shown on the page', [...new Set(hiddenTels)].slice(0, 5).join('; '), 'Hidden or unlabeled numbers can be picked up by directories and AI as conflicting contact details.', 'Confirm the number, display it, or remove the link.');

// ---------- Content defects ----------
const latex = P.filter(p => /\$\\(ge|le|geq|leq|lt|gt|times)\$|\$[<>]\$/.test(p.text));
if (latex.length) F('Content', 'Medium', 'Raw formatting code visible on the page (LaTeX)', latex.length + ' page(s) show symbols like $\\ge$', 'Visible code looks unprofessional and breaks the most quotable passages.', 'Replace with plain characters such as ≥, ≤, <, >.', latex.map(p => p.url));
const artifacts = P.filter(p => p.headings.some(h => /^h[1-6]\s*:/i.test(h)));
if (artifacts.length) F('Content', 'Medium', 'Authoring artifacts in headings', 'Headings start with "H4:" or similar on ' + artifacts.length + ' page(s)', 'Leftover drafting labels show in the page, table of contents and anchor links.', 'Remove the "H2:/H3:/H4:" prefixes from headings.', artifacts.map(p => p.url));

// ---------- Mobile, indexability, security, hreflang ----------
const noViewport = P.filter(p => p.status === 200 && p.html.length > 500 && !p.viewport);
if (noViewport.length) F('Technical', 'High', 'Missing viewport meta tag (mobile-first indexing)', noViewport.length + ' of ' + P.length + ' sampled pages have no <meta name="viewport">', 'Without a viewport tag the page is not mobile-friendly and Google indexes the mobile version first.', 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to the template.', noViewport.map(p => p.url), noViewport.length, P.length);
const noindexed = P.filter(p => p.noindex);
if (noindexed.length) F('Crawlability & Indexing', noindexed.some(p => p.kind === 'home' || p.kind === 'service') ? 'Critical' : 'Medium', 'Key pages carry a noindex tag', noindexed.map(p => p.kind + ': ' + p.url).join('; '), 'A noindex tag removes the page from Google entirely, however good it is.', 'Remove the noindex directive from pages that should rank; keep it only on utility pages.', noindexed.map(p => p.url), noindexed.length, P.length);
const mixedPages = P.filter(p => p.mixed > 0);
if (mixedPages.length) F('Security', 'Medium', 'Mixed content (HTTP resources on HTTPS pages)', mixedPages.reduce((s, p) => s + p.mixed, 0) + ' http:// resources referenced on ' + mixedPages.length + ' sampled pages', 'Browsers block or warn about insecure resources, which can break layout and scripts and undermines trust.', 'Reference every image, script and stylesheet over https://.', mixedPages.map(p => p.url), mixedPages.length, P.length);
const withHreflang = P.filter(p => p.hreflangs.length);
if (withHreflang.length) {
  const problems = [];
  withHreflang.forEach(p => {
    const langs = p.hreflangs.map(x => x.lang);
    if (!langs.includes('x-default')) problems.push(p.url + ': no x-default');
    const self = p.hreflangs.some(x => String(x.href).replace(/\/$/, '') === String(p.url).replace(/\/$/, ''));
    if (!self) problems.push(p.url + ': no self-referencing hreflang');
    langs.forEach(l => { if (l !== 'x-default' && !/^[a-z]{2,3}(-[a-z0-9]{2,4})?$/i.test(l)) problems.push(p.url + ': invalid code ' + l); });
  });
  if (problems.length) F('Technical', 'Medium', 'hreflang annotations are incomplete', problems.slice(0, 6).join('; '), 'Incomplete hreflang sets are ignored by Google, so the wrong language version can rank in each country.', 'Every language version must list all versions including itself, plus an x-default.', [...new Set(problems.map(x => x.split(':')[0]))]);
  else works.push('hreflang annotations look complete on sampled pages');
}
const absCanon = (p) => { let c = String(p.canonical || ''); if (c.startsWith('/')) c = 'https://' + domain + c; return c.replace(/\/$/, '').toLowerCase().replace(/^https?:\/\/(www\.)?/, ''); };
const canonMismatch = P.filter(p => p.canonical && p.status === 200 && (p.kind === 'home' || p.kind === 'service') && absCanon(p) !== String(p.url).replace(/\/$/, '').toLowerCase().replace(/^https?:\/\/(www\.)?/, ''));
if (canonMismatch.length) F('Crawlability & Indexing', 'Info', 'Key pages canonicalise to a different URL', canonMismatch.map(p => p.url + ' → ' + p.canonical).slice(0, 5).join('; '), 'Fine if intentional, but these pages will not rank on their own URL.', 'Confirm each canonical is intended.', canonMismatch.map(p => p.url));

// ---------- Misc ----------
if (!home.lang) F('Technical', 'Low', 'No language declared on the page', '<html> has no lang attribute', 'Helps browsers and search engines pick the right language.', 'Add lang="en" (or the correct language) to the <html> tag.');
if (!P.some(p => p.speculation)) F('Performance', 'Low', 'No speculation rules for instant navigation', 'No <script type="speculationrules"> found', 'Prefetching likely next pages makes navigation feel instant.', 'Add conservative speculation rules for key pages (e.g. contact and top services).');

return [{
  json: {
    ...base,
    html_analysis: {
      sampled_pages: P.map(p => ({ url: p.url, kind: p.kind, status: p.status, schema_types: p.types })),
      findings, works, urls_to_check: urlsToCheck
    }
  }
}];