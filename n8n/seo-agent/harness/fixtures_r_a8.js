// Fixtures of fixer A8 (re-rating 2026-10-15, R38 / R52). Modelled on executions 608 and 606 (techand.ai's own public pages); the page's
// byline is a placeholder and no third party's data is kept. The proportions are the live ones: the existing page is ~16,000 characters of
// reader text (the live read was 15,999), the first flattened table sits at ~4,500, the mandate dates at ~7,000 and the byline is not in the
// reader's text at all (Jina removes header / aside blocks and flattens tables to plain lines).
const W = 'https://www.techand.ai';
const EXISTING = W + '/insights/top-peppol-e-invoicing-software-features-every-uae-cfo-must-look-for';
const SENT = ['Finance teams compare invoicing platforms on structured data, validation, integration and controls.',
  'A PDF invoice is not the same as an electronic invoice under the UAE framework, so selection covers more than creation.',
  'Software that connects to the network and to the ERP removes manual re-keying and the errors that come with it.',
  'Audit trails, approval workflows and role based access matter as much as the invoice format itself.',
  'Each requirement should be checked against the provider arrangement before a platform is chosen.'];
const fill = (chars) => { let out = '', i = 0; while (out.length < chars) { out += SENT[i % SENT.length] + (i % 7 === 6 ? '\n\n### Section ' + (i / 7 + 1) + ' of the evaluation\n\n' : ' '); i++; } return out.trim(); };
const TABLE_FLAT = 'Feature What It Does Why CFOs Should Care\nStructured invoicing Creates machine-readable invoice data Supports standardized processing\nInvoice validation Checks invoice information before transmission Helps reduce errors\nPeppol connectivity Enables electronic document exchange through the network Supports interoperability';
const DATES = 'In the UAE, an amendment moved the ASP appointment deadline for businesses with revenue of AED 50 million or more to 30 October 2026, while retaining the 1 January 2027 implementation date for the rest.';
const readerText = 'Title: Top Peppol E-Invoicing Software Features Every UAE CFO Must Look For\n\nURL Source: ' + EXISTING + '\n\nPublished Time: 2026-09-26T10:46:39.377Z\n\nMarkdown Content:\n'
  + fill(4300) + '\n\n' + TABLE_FLAT + '\n\n' + fill(2300) + '\n\n' + DATES + '\n\n' + fill(6200) + '\n\nTech& AI can support the broader technology conversation around e-invoicing and ERP integration.';
const tbl = (n) => '<table><thead><tr><th>Feature</th><th>What it does</th></tr></thead><tbody><tr><td>Structured invoicing ' + n + '</td><td>Creates machine-readable invoice data</td></tr><tr><td>Invoice validation</td><td>Checks the invoice before transmission</td></tr></tbody></table>';
const html = '<!doctype html><html><head><title>Top Peppol E-Invoicing Software Features | Tech&amp;</title>'
  + '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"Top Peppol E-Invoicing Software Features","author":{"@type":"Person","name":"A. Author"},"datePublished":"2026-09-26T10:46:39Z"}</script></head>'
  + '<body><header><nav><a href="/contact">Contact</a></nav></header><article><h1>Top Peppol E-Invoicing Software Features</h1><p class="byline">By <span class="author-name">A. Author</span> - System Architect</p>'
  + '<p>' + fill(900).replace(/\n+/g, ' ') + '</p>' + tbl(1) + '<p>' + fill(900).replace(/\n+/g, ' ') + '</p>' + tbl(2) + tbl(3)
  + '<p>' + fill(600).replace(/\n+/g, ' ') + '</p></article><footer>Footer</footer></body></html>';
// a client-rendered shell: the server sends the application, not the page
const shellHtml = '<!doctype html><html><head><title>Tech&amp;</title></head><body><div id="root"></div>' + '<script src="/static/app.js"></script>'.repeat(40) + '</body></html>';
// a page that really has no table and no byline (the negative control: an absence the digest can prove stays claimable)
const plainHtml = '<!doctype html><html><head><title>Plain page | Tech&amp;</title></head><body><main><h1>Plain page</h1><p>' + fill(1800).replace(/\n+/g, ' ') + '</p></main></body></html>';

// R52, exec 606: five menu pages, the reader answered the application's generic title for all of them
const GENERIC = 'Tech& | Enterprise Automation & Digital Transformation Solutions';
const nav = [['/industries', 'Banking Financial Services', 'Industries We Serve'], ['/capabilities/cloud-services', 'Cloud Services', 'Cloud Services overview'],
  ['/capabilities', 'AI', 'Tech& Capabilities'], ['/capabilities/business-applications', 'Business Applications', 'Business Applications'], ['/capabilities/data', 'Data', 'Data and Analytics']];
const navPlan = nav.map(([p, text]) => ({ url: 'https://www.techand.ai' + p, text, path: p, in_header: true, domain: 'techand.ai', nav_source: 'site model' }));
const navReads = nav.map(([p, , h]) => ({ page_text: 'Title: ' + GENERIC + '\n\nURL Source: https://www.techand.ai' + p + '\n\nMarkdown Content:\n## ' + h + '\n\n' + fill(500) }));
module.exports = { W, EXISTING, readerText, html, shellHtml, plainHtml, GENERIC, navPlan, navReads, HOME_TITLE: 'Tech& | Turning Technology into measurable Business Impact' };
