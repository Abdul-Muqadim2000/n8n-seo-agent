// Realistic fixtures for the SEO Agent v3 workflow (shapes follow DataForSEO v3, Jina Reader, PSI v5, n8n HTTP node).
const OUR = 'northwind-erp.com';
const COMPS = ['gulferp.ae', 'erpmasters.com', 'cloudledger.io', 'oracle.com', 'youtube.com', 'bizsuite.co', 'erpguide.net', 'sapconsult.ae', 'quickbooks.com'];

const words = (n, kw) => {
  const bank = ['implementation', 'business', 'system', 'process', 'data', 'team', 'planning', 'finance', 'inventory', 'migration', 'training', 'support', 'integration', 'reporting', 'workflow', 'vendor', 'module', 'cloud', 'timeline', 'budget'];
  const out = [];
  for (let i = 0; i < n; i++) {
    if (kw && i % 45 === 20) { out.push(kw); continue; }
    out.push(bank[(i * 7 + n) % bank.length]);
    if (i % 14 === 13) out[out.length - 1] += '.';
  }
  return out.join(' ');
};

// ---------- Forms ----------
const forms = {
  startKeyword: { 'What do you want?': 'I know my keyword', submittedAt: '2026-09-30T10:00:00.000Z', formMode: 'production' },
  startDiscover: { 'What do you want?': 'Suggest keywords for my business' },
  startDescribe: { 'What do you want?': 'Just describe my website' },
  startAudit: { 'What do you want?': 'Audit my website' },
  startVerdict: { 'What do you want?': 'Check if my keyword is right' },
  pageKeyword: { 'Target Keyword': '  ERP Implementation   Services ', 'Target Country': 'United Arab Emirates', 'Page Type': 'Service Page', 'Website Domain': 'https://www.northwind-erp.com/', 'Existing page URL (optional)': '', 'Extra Features': ['Check if page exists'], 'What do you want to receive?': ['Keyword Report', 'Page Content'], 'Business facts to include (optional)': 'Microsoft Gold Partner since 2022; 40 distributor go-lives; offices in Dubai and Sharjah', 'Main call to action (optional)': 'Book a free scoping call', 'Tone of voice': 'Professional', 'Content goal': 'Get leads and enquiries', 'Email me the report': 'Owner@Example.com ' },
  pageKeywordReportOnly: { 'Target Keyword': 'erp implementation services', 'Target Country': 'United Arab Emirates', 'Page Type': 'Service Page', 'Website Domain': 'northwind-erp.com', 'What do you want to receive?': ['Keyword Report'], 'Email me the report': 'owner@example.com' },
  pageDiscover: { 'What does your business do?': 'We implement and customise ERP systems for mid-sized distributors', 'Who are your customers?': 'wholesalers, distributors, manufacturers', 'Website Domain': 'northwind-erp.com', 'Target Country': 'United Arab Emirates', 'Extra Features': ['Site Audit'], 'What do you want to receive?': ['Page Content'], 'Email me the reports': 'owner@example.com' },
  pageDescribe: { 'Website Domain': 'northwind-erp.com', 'Email me the report': '' },
  pageAuditFull: { 'Website Domain': 'northwind-erp.com', 'Target Country': 'United Arab Emirates', 'Report type': 'Full SEO Report', 'Main competitors': 'gulferp.ae, https://www.erpmasters.com/, northwind-erp.com', 'Email me the report': 'owner@example.com' },
  pageAuditTech: { 'Website Domain': 'northwind-erp.com', 'Target Country': 'Germany', 'Report type': 'Site Audit (technical issues only)', 'Main competitors': '', 'Email me the report': 'owner@example.com' },
  pageVerdict: { 'Target Keyword': 'erp software dubai', 'Target Country': 'United Arab Emirates', 'What does your business do?': 'ERP implementation partner', 'Website Domain': '', 'Email me the result': 'owner@example.com' },
  webhookVerdict: { headers: { 'content-type': 'application/json' }, params: {}, query: {}, body: { mode: 'verdict', keyword: 'erp implementation services', country: 'AE', domain: 'northwind-erp.com', business: 'ERP implementation partner', callback_url: 'https://hooks.example.com/seo', email: '' } },
  webhookKeywordDefault: { headers: {}, params: {}, query: {}, body: { keyword: 'erp implementation services', country: 'United Arab Emirates', page_type: 'Landing Page' } },
  badCountry: { 'Target Keyword': 'x', 'Target Country': 'Atlantis', 'Page Type': 'Service Page' },
  badDomain: { 'Website Domain': '10.0.0.1', 'Target Country': 'United Arab Emirates', 'Report type': 'Full SEO Report', 'Email me the report': 'a@b.co' },
  localhostDomain: { 'Website Domain': 'http://sandbox-api:8080/', 'Email me the report': '' },
  startLadder: { 'What do you want?': 'Rank my site for a keyword' },
  pageLadder: { 'Keyword you want to rank for': ' E Invoicing in UAE ', 'Website Domain': 'https://www.northwind-erp.com', 'Target Country': 'United Arab Emirates', 'What does your business do?': 'ERP and e-invoicing implementation partner', 'Who are your customers?': 'UAE SMEs and finance teams', 'Business facts to include (optional)': 'Peppol-certified access point partner; 40 go-lives', 'Content goal': 'Get leads and enquiries', 'Tone of voice': 'Professional and direct', 'Main call to action (optional)': 'Book a demo', 'Pages to write now': '1 (recommended)', 'Email me the plan and the pages': 'Owner@Example.com' },
  pageLadderNoEmail: { 'Keyword you want to rank for': 'e invoicing in uae', 'Website Domain': 'northwind-erp.com', 'Target Country': 'United Arab Emirates', 'Pages to write now': '3', 'Email me the plan and the pages': '' },
};

// ---------- Jina reader ----------
const jinaSite = `Title: Northwind ERP | ERP Implementation Partner in Dubai\n\nURL Source: https://northwind-erp.com/\n\nMarkdown Content:\n# ERP Implementation and Customisation for Distributors\n\nNorthwind ERP helps wholesalers and distributors across the UAE implement, migrate and customise ERP systems. ![logo](https://northwind-erp.com/logo.png) [Contact us](https://northwind-erp.com/contact/)\n\n## Our Services\n\n- **ERP implementation** for Odoo and Microsoft Dynamics 365 Business Central\n- Data migration and integration with e-commerce and WMS platforms\n- Training and ongoing support with 24/7 helpdesk\n\n## Why Northwind\n\nWe have delivered 40+ projects for distributors in Dubai, Abu Dhabi and Sharjah since 2021. Our certified consultants speak English and Arabic. ${words(180)}\n\n## Industries\n\nFood distribution, building materials, electronics, pharma wholesale. ${words(120)}\n`;
const jinaBlocked = 'Just a moment...\nEnable JavaScript and cookies to continue\nCloudflare Ray ID: 8ab';
const compPage = (i, w) => `Title: ERP Implementation Services in UAE - ${COMPS[i]}\n\nURL Source: https://www.${COMPS[i]}/erp-implementation\n\nMarkdown Content:\n# ERP Implementation Services\n\n${words(60, 'erp implementation services')}\n\n## What is ERP implementation?\n\n${words(w, 'erp implementation')}\n\n## Our implementation methodology\n\n${words(w)}\n\n### Discovery and planning\n\n${words(90)}\n\n## ERP implementation cost in the UAE\n\n${words(w, 'cost')}\n\n## Cookie policy\n\nWe use cookies. Accept all cookies.\n\n## FAQ\n\n${words(80)}\n`;

// ---------- DataForSEO ----------
const task = (result, extra = {}) => ({ version: '0.1.2026', status_code: 20000, status_message: 'Ok.', time: '1.2 sec.', cost: 0.002, tasks_count: 1, tasks_error: 0, tasks: [{ id: '09301000-1535-0066-0000-abcdef', status_code: 20000, status_message: 'Ok.', time: '1.1 sec.', cost: 0.002, result_count: 1, path: [], data: {}, result: [result], ...extra }] });
const organic = (rank, dom, path, title) => ({ type: 'organic', rank_group: rank, rank_absolute: rank + 1, domain: dom.startsWith('www.') ? dom : 'www.' + dom, url: `https://www.${dom}${path}`, title, description: 'Meta description for ' + dom + ' ' + words(12) });
const serpTop = task({
  keyword: 'erp implementation services', se_results_count: 14200000, items_count: 16,
  items: [
    { type: 'featured_snippet', rank_group: 1, domain: 'www.erpguide.net', title: 'What is ERP implementation?', description: 'ERP implementation is the process of planning, configuring and deploying an ERP system across a business.', url: 'https://www.erpguide.net/what-is-erp-implementation' },
    organic(1, 'gulferp.ae', '/erp-implementation-services?utm_source=google&gclid=abc', 'ERP Implementation Services Dubai | GulfERP'),
    organic(2, 'erpmasters.com', '/services/erp-implementation/', 'ERP Implementation Services | ERP Masters'),
    organic(3, 'youtube.com', '/watch?v=1', 'ERP Implementation explained'),
    organic(4, 'cloudledger.io', '/erp-implementation', 'ERP Implementation Company UAE'),
    organic(5, 'northwind-erp.com', '/services/erp-implementation/', 'ERP Implementation | Northwind'),
    organic(6, 'oracle.com', '/erp/implementation/', 'Oracle ERP implementation'),
    organic(7, 'bizsuite.co', '/erp-implementation-uae', 'ERP implementation UAE'),
    organic(8, 'erpguide.net', '/what-is-erp-implementation', 'What is ERP implementation'),
    organic(9, 'sapconsult.ae', '/services', 'SAP implementation services'),
    organic(10, 'quickbooks.com', '/erp', 'QuickBooks ERP'),
    organic(11, 'gulferp.ae', '/blog/erp-cost', 'ERP cost guide'),
    { type: 'people_also_ask', items: [{ type: 'people_also_ask_element', title: 'How much does ERP implementation cost in the UAE?' }, { type: 'people_also_ask_element', title: 'How long does an ERP implementation take?' }, { type: 'people_also_ask_element', title: 'What are the phases of ERP implementation?' }] },
    { type: 'related_searches', items: ['erp implementation cost', 'erp implementation steps', 'best erp for distributors uae'] },
    { type: 'ai_overview', items: [{ type: 'ai_overview_element', title: 'Overview', text: 'ERP implementation services cover planning, configuration, data migration, training and go-live support.', references: [{ domain: 'www.erpguide.net', url: 'https://www.erpguide.net/x' }, { domain: 'gulferp.ae', url: 'https://gulferp.ae/y' }] }], references: [{ domain: 'erpmasters.com', url: 'https://erpmasters.com/z' }] },
    { type: 'video', items: [] }
  ]
});
const serpEmpty = task({ keyword: 'zzz', se_results_count: 0, items: [] });
const keywordOverview = task({ items: [{ se_type: 'google', keyword: 'erp implementation services', keyword_info: { search_volume: 480, cpc: 14.2, competition_level: 'HIGH', competition: 0.82, monthly_searches: Array.from({ length: 12 }, (_, i) => ({ year: 2026, month: 12 - i, search_volume: 400 + i * 10 })), search_volume_trend: { yearly: 12, quarterly: -3, monthly: 2 } }, keyword_properties: { keyword_difficulty: 46 }, search_intent_info: { main_intent: 'commercial' }, avg_backlinks_info: { referring_domains: 35.4, backlinks: 212.7, dofollow: 151.3 } }] });
const keywordOverviewEmpty = task({ items: [] });

// ---------- Sitemaps ----------
const sitemapIndex = `<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>https://northwind-erp.com/page-sitemap.xml</loc></sitemap><sitemap><loc>https://northwind-erp.com/post-sitemap.xml</loc></sitemap><sitemap><loc>https://northwind-erp.com/attachment-sitemap.xml</loc></sitemap></sitemapindex>`;
const siteUrls = ['/', '/services/', '/services/erp-implementation/', '/services/odoo-erp/', '/services/dynamics-365-business-central/', '/services/data-migration/', '/industries/food-distribution/', '/about/', '/contact/', '/privacy-policy/', '/careers/', '/blog/', '/blog/erp-implementation-cost-guide/', '/blog/odoo-vs-dynamics/', '/wp-content/uploads/brochure.pdf'];
const urlset = (paths) => `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(p => `<url><loc>https://northwind-erp.com${p}</loc><lastmod>2026-09-01</lastmod></url>`).join('')}</urlset>`;

// ---------- Agent outputs ----------
const competitorAnalysis = { search_intent: 'commercial', intent_explanation: 'Buyers are comparing ERP implementation partners.', ranking_page_types: 'Service pages from implementation partners plus one guide.', recommended_word_count: 1500, common_topics: ['methodology', 'cost', 'timeline'], common_heading_patterns: ['What is ERP implementation', 'Our methodology'], content_gaps: ['distributor-specific pitfalls', 'data migration checklist'], competitor_strengths: [{ domain: 'gulferp.ae', strength: 'detailed methodology' }], competitor_weaknesses: [{ domain: 'bizsuite.co', weakness: 'thin content' }], unique_angle: 'Distributor-first implementation playbook', must_include_entities: ['Odoo', 'Dynamics 365 Business Central', 'UAE VAT'], faq_opportunities: ['How much does ERP implementation cost in the UAE?', 'How long does an ERP implementation take?', 'What are the phases of ERP implementation?', 'Do you migrate historical data?', 'Which ERP is best for distributors?', 'What support do you offer after go-live?'], answer_block_question: 'What are ERP implementation services?', serp_feature_strategy: 'Win the snippet with a 50-word definition.', feasibility_note: 'Winnable: competitors are regional partners, not global brands.' };
const verdictGo = { verdict: 'GO_WITH_CHANGES', score: 66, reasons: ['480 searches/mo at KD 46', 'Commercial intent matches a service page'], risks: ['Featured snippet held by erpguide.net'], recommended_page: 'Service Page', secondary_keywords: ['erp implementation partner uae', 'erp implementation cost uae', 'odoo implementation dubai'] };
const verdictAvoid = { verdict: 'AVOID', score: 22, reasons: ['Near-zero volume'], risks: [], recommended_page: 'Blog Post', secondary_keywords: [] };
const brief = { meta_title: 'ERP Implementation Services in the UAE | Northwind ERP', meta_description: 'Plan, migrate and go live with ERP implementation services built for UAE distributors. Fixed scope, certified consultants. Get a quote today.', slug: 'erp-implementation-services', h1: 'ERP Implementation Services for UAE Distributors', primary_keyword: 'erp implementation services', secondary_keywords: ['erp implementation partner uae', 'erp implementation cost', 'odoo implementation'], target_audience: 'Operations and finance leaders at distributors', search_intent: 'commercial', tone: 'confident, practical', target_word_count: 1500, answer_block: 'ERP implementation services cover the planning, configuration, data migration, training and go-live support needed to move a business onto a new ERP system. A good partner scopes the work by department, migrates clean data and trains your team so the system pays back quickly.', outline: [{ h2: 'What Are ERP Implementation Services?', purpose: 'define', key_points: ['scope', 'phases'], h3s: [], target_words: 220 }, { h2: 'How Much Does ERP Implementation Cost in the UAE?', purpose: 'answer PAA', key_points: ['cost factors'], h3s: ['Licence vs services'], target_words: 260 }, { h2: 'Our Implementation Methodology', purpose: 'process', key_points: ['discovery', 'build', 'go-live'], h3s: [], target_words: 300 }, { h2: 'Data Migration Checklist for Distributors', purpose: 'gap', key_points: ['cleanse', 'map', 'validate'], h3s: [], target_words: 240 }, { h2: 'Odoo vs Dynamics 365 for Distribution', purpose: 'comparison', key_points: ['fit', 'cost'], h3s: [], target_words: 260 }, { h2: 'Why Choose Northwind ERP', purpose: 'trust', key_points: ['certified', 'local'], h3s: [], target_words: 220 }], gaps_to_cover: ['distributor pitfalls'], unique_angle: 'Distributor-first', entities_to_mention: ['Odoo', 'UAE VAT'], comparison_table: { title: 'Odoo vs Dynamics 365 Business Central', columns: ['Factor', 'Odoo', 'Dynamics 365 BC'], purpose: 'compare' }, internal_link_suggestions: [{ anchor: 'Odoo ERP services', url: 'https://northwind-erp.com/services/odoo-erp/' }, { anchor: 'data migration', url: 'https://northwind-erp.com/services/data-migration/' }, { anchor: 'contact us', url: 'https://northwind-erp.com/contact/' }], image_suggestions: [{ placement: 'after Our Implementation Methodology', alt_text: 'ERP implementation timeline for a UAE distributor' }], faqs: competitorAnalysis.faq_opportunities, cta: 'Book a free scoping call' };

function draft(opts = {}) {
  const kw = 'ERP implementation services';
  const sec = (h2, n, extra = '') => `## ${h2}\n\n${words(n, 'ERP implementation services')} ${extra}\n\n`;
  let md = `Title: ${opts.longTitle ? 'ERP Implementation Services in the United Arab Emirates for Distributors | Northwind ERP' : brief.meta_title}\nMeta Description: ${brief.meta_description}\nSlug: erp-implementation-services\nPrimary Keyword: erp implementation services\nSecondary Keywords: erp implementation partner uae, erp implementation cost, odoo implementation\n\n# ${brief.h1}\n\nChoosing ${kw} is the biggest operational decision a distributor makes this decade. ${words(50)}\n\n**Quick answer:** ${brief.answer_block}\n\n`;
  md += sec('What Are ERP Implementation Services?', 200, 'Over 500 clients trust structured ${kw} (placeholder for client count).');
  md += sec('How Much Does ERP Implementation Cost in the UAE?', 220, 'Projects typically start at AED 45,000 and 30% of budgets go to data work. We guarantee delivery on time.');
  md += sec('Our Implementation Methodology', 260, '[Image: ERP implementation timeline for a UAE distributor] See our [Odoo ERP services](https://northwind-erp.com/services/odoo-erp/) and [data migration](https://northwind-erp.com/services/data-migration/) pages, or read the [pricing page](https://northwind-erp.com/pricing/) and [this guide](https://www.gartner.com/erp).');
  md += `## Odoo vs Dynamics 365 for Distribution\n\n${words(120)}\n\n| Factor | Odoo | Dynamics 365 BC |\n|---|---|---|\n| Typical licence | [Price] | [Price] |\n| Implementation timeline | [Timeline] | [Timeline] |\n| Best for | SMB distributors | Multi-entity groups |\n\n${words(80)}\n\n`;
  md += sec('Data Migration Checklist for Distributors', 220);
  md += sec('Why Choose Northwind ERP', 180, 'Our team of [Number] certified consultants has 12+ years of experience.');
  if (!opts.noFaq) {
    md += `## Frequently Asked Questions\n\n`;
    brief.faqs.forEach((q, i) => { md += `Q${i + 1}: ${q}\nA${i + 1}: ${words(52)}\n\n`; });
  }
  md += `## Book Your Free Scoping Call\n\n${words(70)} [Contact us](https://northwind-erp.com/contact/) today.\n`;
  if (opts.truncate) md = md.slice(0, Math.floor(md.length * 0.55));
  return md;
}

// ---------- Crawl ----------
const crawlTaskPost = { status_code: 20000, tasks: [{ id: '09301012-1535-0216-0000-3b2fd5a7d3c2', status_code: 20100, status_message: 'Task Created.', cost: 0.0125 }] };
const crawlTaskPostFail = { status_code: 20000, tasks: [{ id: 'x', status_code: 40501, status_message: 'Invalid Field: target.' }] };
const domainInfo = { name: OUR, cms: 'WordPress', ip: '1.2.3.4', server: 'cloudflare', crawl_start: '2026-09-30 09:40:00 +00:00', crawl_end: '2026-09-30 09:58:00 +00:00', extended_crawl_status: 'no_errors', ssl_info: { valid_certificate: true, certificate_issuer: "Let's Encrypt", certificate_expiration_date: '2026-10-20 00:00:00 +00:00' }, checks: { sitemap: true, robots_txt: true, start_page_deny_flag: false, ssl: true, http2: true, test_canonicalization: false, test_www_redirect: true, test_hidden_server_signature: false, test_page_not_found: true, test_directory_browsing: true, test_https_redirect: true } };
const pageMetrics = { links_external: 210, links_internal: 1800, duplicate_title: 4, duplicate_description: 6, duplicate_content: 2, broken_links: 3, broken_resources: 2, links_relation_conflict: 0, redirect_loop: 0, onpage_score: 81.4, non_indexable: 5, checks: { no_h1_tag: 3, no_title: 0, no_description: 9, canonical: 40, no_image_alt: 22, seo_friendly_url: 44, is_orphan_page: 4, has_render_blocking_resources: 30, low_content_rate: 12 } };
const summaryRunning = task({ crawl_progress: 'in_progress', crawl_status: { max_crawl_pages: 200, pages_in_queue: 90, pages_crawled: 42 }, domain_info: domainInfo, page_metrics: null });
const summaryDone = task({ crawl_progress: 'finished', crawl_status: { max_crawl_pages: 200, pages_in_queue: 0, pages_crawled: 58 }, domain_info: domainInfo, page_metrics: pageMetrics });
const CHECK_KEYS = ['is_broken', 'is_4xx_code', 'is_5xx_code', 'no_title', 'lorem_ipsum', 'no_h1_tag', 'is_orphan_page', 'canonical_to_broken', 'canonical_to_redirect', 'recursive_canonical', 'https_to_http_links', 'is_http', 'high_loading_time', 'high_waiting_time', 'has_render_blocking_resources', 'large_page_size', 'no_content_encoding', 'is_redirect', 'redirect_chain', 'has_links_to_redirects', 'no_description', 'duplicate_meta_tags', 'duplicate_title_tag', 'low_content_rate', 'low_character_count', 'low_readability_rate', 'no_image_alt', 'deprecated_html_tags', 'no_favicon', 'no_doctype', 'has_micromarkup_errors', 'irrelevant_title', 'irrelevant_description', 'has_meta_refresh_redirect', 'size_greater_than_3mb', 'canonical_chain', 'is_link_relation_conflict', 'no_encoding_meta_tag', 'seo_friendly_url'];
function crawledPages() {
  const pages = [];
  siteUrls.filter(p => !p.endsWith('.pdf')).forEach((p, i) => {
    const url = 'https://' + OUR + p;
    const checks = {}; CHECK_KEYS.forEach(k => checks[k] = false); checks.seo_friendly_url = true;
    if (i % 4 === 1) checks.no_description = true;
    if (i === 3) checks.no_h1_tag = true;
    if (i === 6) checks.is_orphan_page = true;
    if (i % 3 === 0) checks.has_render_blocking_resources = true;
    if (i === 10) { checks.is_broken = true; checks.is_4xx_code = true; }
    const isLegal = /privacy/.test(p);
    pages.push({
      resource_type: 'html', status_code: i === 10 ? 404 : 200, url, size: 180000 + i * 5000, encoded_size: 60000, total_dom_size: 90000, click_depth: p === '/' ? 0 : (p.split('/').filter(Boolean).length + (i === 12 ? 3 : 0)),
      fetch_time: '2026-09-30 09:45:00 +00:00', cache_control: { cachable: false }, checks,
      page_timing: { time_to_interactive: 4200 + i * 300, dom_complete: 3000, largest_contentful_paint: i === 0 ? 4500 : 2100 + i * 100, first_input_delay: 20, connection_time: 40, time_to_secure_connection: 30, request_sent_time: 1, waiting_time: i === 0 ? 950 : 300 + i * 20, download_time: 30, duration_time: 3500, fetch_start: 0, fetch_end: 3500 },
      meta: {
        title: i === 2 ? 'ERP' : (i === 5 ? 'Data Migration Services for Distributors in the UAE and GCC Region | Northwind ERP | Northwind ERP' : 'Page ' + i + ' | Northwind ERP'),
        charset: 65001, follow: true, generator: 'WordPress', htags: { h1: i === 3 ? [] : (i === 4 ? ['One', 'Two'] : ['Heading ' + i]), h2: i === 7 ? [] : ['Sub a', 'Sub b'], h3: ['Deep'] },
        description: i % 4 === 1 ? '' : (i === 8 ? 'Short desc' : 'A meta description of the page that explains what visitors will find and why they should click through to learn more about it here.'),
        favicon: 'https://northwind-erp.com/favicon.ico', meta_keywords: null, canonical: i === 9 ? '' : (i === 11 ? 'https://northwind-erp.com/blog/' : url),
        internal_links_count: 40 + i, external_links_count: isLegal ? 0 : (i === 12 ? 0 : 3), inbound_links_count: i === 6 ? 0 : (i === 13 ? 1 : 12),
        images_count: 8, images_size: i === 0 ? 2400000 : 300000, scripts_count: 20, scripts_size: 500000, stylesheets_count: 6, stylesheets_size: 90000,
        title_length: 20, description_length: 120, render_blocking_scripts_count: 4, render_blocking_stylesheets_count: 2, cumulative_layout_shift: i === 0 ? 0.18 : 0.02,
        content: { plain_text_size: 9000, plain_text_rate: 0.05, plain_text_word_count: isLegal ? 2400 : (i === 1 ? 180 : (i === 6 ? 420 : 900 + i * 40)), automated_readability_index: 12, coleman_liau_readability_index: 11, dale_chall_readability_index: 8, flesch_kincaid_readability_index: 60, smog_readability_index: 9, description_to_content_consistency: 0.4, title_to_content_consistency: 0.5, meta_keywords_to_content_consistency: null },
        social_media_tags: i % 2 ? { 'og:title': 'x', 'og:image': 'y', 'twitter:card': 'summary' } : {}
      }
    });
  });
  return pages;
}
const crawledPagesRes = task({ crawl_progress: 'finished', crawl_status: { pages_crawled: 58 }, total_items_count: 14, items_count: 14, items: crawledPages() });
const extrasRes = [
  task({ total_items_count: 2, items: [{ accumulator: 'Page 1 | Northwind ERP', total_count: 3, pages: [{ url: 'https://northwind-erp.com/a' }, { url: 'https://northwind-erp.com/b' }, { url: 'https://northwind-erp.com/c' }] }] }),
  task({ total_items_count: 1, items: [{ accumulator: 'A meta description of the page that explains...', total_count: 4, pages: [{ url: 'https://northwind-erp.com/a' }] }] }),
  task({ total_items_count: 2, items: [{ url: 'https://northwind-erp.com/thank-you/', reason: 'meta_robots_noindex', status_code: 200 }, { url: 'https://northwind-erp.com/tag/erp/', reason: 'canonical', status_code: 200 }] }),
  { tasks: [{ status_code: 40400, status_message: 'Not Found.' }] }
];

// ---------- Probes ----------
const homeHtml = () => `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Northwind ERP</title><link rel="canonical" href="https://northwind-erp.com/"><script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Northwind ERP","url":"https://northwind-erp.com/","logo":"https://northwind-erp.com/wp-content/uploads/logo.png","sameAs":["https://www.linkedin.com/company/northwind-erp","https://twitter.com/northwind erp"],"telephone":"+971 4 123 4567","foundingDate":"2021-03-01","address":{"@type":"PostalAddress","addressLocality":"Dubai"}}</script></head><body><h1>ERP Implementation for Distributors</h1><img src="/hero.jpg" alt=""><img src="/a.png"><img src="/b.png"><img src="/c.png" width="10" height="10"><p>Call <a href="tel:+97141234567">+971 4 123 4567</a>. We have 15+ years of experience. Email info@northwind-erp.com</p><h2>Services</h2><a href="https://www.linkedin.com/company/x">li</a><img src="http://cdn.example.net/x.png"></body></html>`;
const bodyOf = (len) => '<html><body>' + 'x'.repeat(len) + '</body></html>';
function probeResults(variant = 'apex') {
  const H = (extra = {}) => ({ 'content-type': 'text/html; charset=utf-8', server: 'cloudflare', 'cache-control': 'public, max-age=0, must-revalidate', 'cf-cache-status': 'DYNAMIC', 'strict-transport-security': 'max-age=31536000', 'x-content-type-options': 'nosniff', ...extra });
  const home = variant === 'www' ? { statusCode: 301, headers: H({ location: 'https://www.northwind-erp.com/' }), body: '' } : { statusCode: 200, headers: H(), body: homeHtml() + bodyOf(20000) };
  const list = [
    home, home,
    variant === 'www' ? { statusCode: 200, headers: H(), body: homeHtml() + bodyOf(20000) } : { statusCode: 301, headers: H({ location: 'https://northwind-erp.com/' }), body: '' },
    { statusCode: 301, headers: H({ location: variant === 'www' ? 'https://www.northwind-erp.com/' : 'https://northwind-erp.com/' }), body: '' },
    { statusCode: 301, headers: H({ location: 'https://northwind-erp.com/' }), body: '' },
    { statusCode: 200, headers: { 'content-type': 'text/plain' }, body: 'User-agent: *\nDisallow: /wp-admin/\nAllow: /wp-admin/admin-ajax.php\n\nUser-agent: GPTBot\nDisallow: /\n\nUser-agent: CCBot\nDisallow: /\n\nSitemap: https://northwind-erp.com/sitemap.xml\n' },
    { statusCode: 200, headers: { 'content-type': 'application/xml' }, body: urlset(siteUrls.slice(0, 12)) },
    { statusCode: 404, headers: H(), body: '<html>not found</html>' },
    { statusCode: 200, headers: H(), body: homeHtml() }
  ];
  const bots = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'PerplexityBot', 'Googlebot', 'Bingbot', 'CCBot', 'Amazonbot', 'Applebot', 'Meta-ExternalAgent'];
  bots.forEach(b => list.push(b === 'ClaudeBot' ? { statusCode: 403, headers: H(), body: '<html>blocked</html>' } : (b === 'PerplexityBot' ? { statusCode: 200, headers: H(), body: bodyOf(500) } : { statusCode: 200, headers: H(), body: homeHtml() + bodyOf(20000) })));
  return list;
}

// ---------- Key page HTML ----------
function pageHtmlResults(picked) {
  return picked.map(p => {
    if (p.kind === 'home') return { statusCode: 200, headers: {}, html: homeHtml() };
    if (p.kind === 'contact') return { statusCode: 200, headers: {}, html: '<!DOCTYPE html><html lang="en"><head><meta name="viewport" content="width=device-width"></head><body><h1>Contact</h1><div id="root"></div><script>/* react */</script></body></html>' };
    if (p.kind === 'article') return { statusCode: 200, headers: {}, html: `<!DOCTYPE html><html lang="en"><head><meta name="viewport" content="x"><script type="application/ld+json">{"@type":"BlogPosting","headline":"ERP cost guide","author":{"@type":"Organization","name":"Northwind Team"},"datePublished":"2025-01-01","dateModified":"2025-01-01","publisher":{"@type":"Organization","logo":{"@type":"ImageObject","url":"https://northwind-erp.com/missing-logo.png"}}}</script></head><body><h1>ERP cost guide</h1><h2>H2: Intro</h2><p>Costs are $\\ge$ 50k. ${words(200)}</p></body></html>` };
    if (p.url.endsWith('/odoo-erp/')) return { statusCode: 200, headers: {}, html: '<!DOCTYPE html><html><head><meta name="viewport" content="x"><script type="application/ld+json">{ this is not json</script><link rel="canonical" href="https://northwind-erp.com/services/"></head><body><h1>Odoo</h1><p>' + words(300) + '</p></body></html>' };
    return { statusCode: 200, headers: {}, html: '<!DOCTYPE html><html lang="en"><head><meta name="viewport" content="x"><script type="application/ld+json">{"@type":"BreadcrumbList","itemListElement":[]}</script></head><body><h1>' + p.kind + '</h1><p>' + words(400) + '</p></body></html>' };
  });
}
const headResults = (urls) => urls.map(u => ({ statusCode: /missing/.test(u.url) ? 404 : 200, headers: {} }));

// ---------- Labs / Backlinks / PSI / LLM ----------
const labsCompetitors = task({ total_count: 30, items_count: 6, items: ['gulferp.ae', 'erpmasters.com', 'linkedin.com', 'cloudledger.io', 'bizsuite.co', 'oracle.com'].map((d, i) => ({ se_type: 'google', domain: d, avg_position: 8 + i, sum_position: 100, intersections: 140 - i * 20, full_domain_metrics: {}, metrics: {}, competitor_metrics: {} })) });
const rankOverview = (dom) => task({ items: [{ se_type: 'google', location_code: 2784, language_code: 'en', metrics: { organic: dom === OUR ? { pos_1: 0, pos_2_3: 0, pos_4_10: 0, pos_11_20: 4, pos_21_30: 6, count: 25, etv: 12.4, estimated_paid_traffic_cost: 60 } : { pos_1: 12, pos_2_3: 30, pos_4_10: 80, pos_11_20: 90, count: 620, etv: 3400.8, estimated_paid_traffic_cost: 21000 } } }] });
const whois = (dom) => dom === 'gulferp.ae' ? { tasks: [{ status_code: 20000, result: [{ items: [] }] }] } : task({ items: [{ domain: dom, created_datetime: dom === OUR ? '2026-01-15 00:00:00 +00:00' : '2012-05-01 00:00:00 +00:00', tld: 'com' }] });
const ranked = (dom) => {
  const kws = dom === OUR ? [['northwind erp', 90, 1], ['erp implementation dubai', 320, 14], ['odoo partner uae', 210, 18], ['erp for distributors', 150, 26]] : [['erp implementation services', 480, 2], ['erp implementation cost', 700, 4], ['best erp for distributors uae', 260, 6], ['erp software dubai', 1900, 9], ['what is erp implementation', 2400, 3], ['erp implementation partner uae', 170, 5], ['erp implementation dubai', 320, 7]];
  return task({ total_count: kws.length, items: kws.map(([k, v, pos]) => ({ se_type: 'google', keyword_data: { keyword: k, keyword_info: { search_volume: v, cpc: 9.5, competition_level: 'HIGH' }, keyword_properties: { keyword_difficulty: k.includes('what is') ? 55 : 28 }, search_intent_info: { main_intent: k.includes('what is') ? 'informational' : (k.includes('cost') ? 'transactional' : 'commercial') } }, ranked_serp_element: { serp_item: { type: 'organic', rank_group: pos, rank_absolute: pos, url: `https://www.${dom}/${k.replace(/\s+/g, '-')}` } } })) });
};
const keywordIdeas = task({ total_count: 40, items: [['erp implementation services', 480, 46, 'commercial'], ['erp implementation cost uae', 260, 22, 'transactional'], ['erp implementation steps', 880, 35, 'informational'], ['erp implementation checklist', 720, 25, 'informational'], ['odoo implementation dubai', 190, 18, 'commercial'], ['erp implementation partner', 140, 27, 'commercial'], ['erp implementation price', 90, 19, 'transactional'], ['northwind erp login', 40, 5, 'navigational'], ['what is erp implementation', 2400, 55, 'informational'], ['erp for food distributors', 110, 15, 'commercial'], ['zero volume kw', 0, 10, 'informational']].map(([k, v, d, i]) => ({ se_type: 'google', keyword: k, keyword_info: { search_volume: v, cpc: v ? 7.2 : null, competition_level: 'MEDIUM' }, keyword_properties: { keyword_difficulty: d }, search_intent_info: { main_intent: i } })) });
const backlinkSummary = (dom) => dom === 'cloudledger.io' ? { tasks: [{ status_code: 40201, status_message: 'Access denied. Backlinks API is not active.' }] } : task({ target: dom, rank: dom === OUR ? 45 : 380, backlinks: dom === OUR ? 60 : 4200, referring_domains: dom === OUR ? 9 : 310, referring_domains_nofollow: dom === OUR ? 6 : 40, backlinks_spam_score: dom === OUR ? 35 : 8, broken_backlinks: dom === OUR ? 14 : 3 });
const backlinkGap = task({ total_count: 3, items: [{ domain_intersection: { 1: { domain: 'clutch.co', rank: 800 }, 2: { domain: 'clutch.co', rank: 800 } } }, { domain_intersection: { 1: { domain: 'uaebusinessdirectory.com', rank: 300 } } }, { domain_intersection: { 2: { domain: 'gulfnews.com', rank: 900 } } }] });
const psi = (dom) => dom === 'bizsuite.co' ? { error: { code: 500, message: 'Lighthouse returned error' } } : { lighthouseResult: { categories: { performance: { score: dom === OUR ? 0.41 : 0.78 } }, audits: { 'largest-contentful-paint': { numericValue: dom === OUR ? 4300 : 2200 }, 'cumulative-layout-shift': { numericValue: dom === OUR ? 0.21 : 0.03 }, 'total-blocking-time': { numericValue: 820 }, 'server-response-time': { numericValue: 910 }, interactive: { numericValue: 6400 }, 'render-blocking-resources': { title: 'Eliminate render-blocking resources', displayValue: 'Potential savings of 1,210 ms', details: { type: 'opportunity', overallSavingsMs: 1210 } }, 'uses-optimized-images': { title: 'Efficiently encode images', details: { type: 'opportunity', overallSavingsMs: 640 } }, 'unused-javascript': { title: 'Reduce unused JavaScript', details: { type: 'opportunity', overallSavingsMs: 50 } } } }, loadingExperience: { metrics: { LARGEST_CONTENTFUL_PAINT_MS: { percentile: dom === OUR ? 3900 : 2100 }, CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: dom === OUR ? 14 : 4 }, INTERACTION_TO_NEXT_PAINT: { percentile: dom === OUR ? 260 : 120 } }, overall_category: dom === OUR ? 'AVERAGE' : 'FAST' } };
const contentReview = { business_context: 'Northwind ERP implements Odoo and Dynamics 365 for distributors in the UAE.', eeat_signals: { named_authors: 'no', case_studies: 'partial', testimonials_reviews: 'no', credentials_certifications: 'yes', pricing_transparency: 'no', team_or_leadership_info: 'partial', clear_contact_details: 'yes' }, findings: [{ severity: 'Critical', title: 'Experience claim contradicts founding date', evidence: '"15+ years of experience" vs foundingDate 2021', why: 'Contradiction erodes trust', fix: 'Rephrase to leadership experience', url: 'https://northwind-erp.com/' }, { severity: 'High', title: 'No named authors on articles', evidence: 'Author: Northwind Team', why: 'E-E-A-T', fix: 'Add expert bylines', url: 'https://northwind-erp.com/blog/erp-implementation-cost-guide/' }, { severity: 'Weird', title: 'Unknown severity finding', evidence: 'x', why: 'y', fix: 'z', url: '' }], strengths: ['Clear contact details on every page'], competitor_comparison: [{ domain: 'gulferp.ae', named_authors: 'yes', case_studies: 'yes', testimonials: 'yes', pricing: 'no', content_depth: 'deep', standout: 'Publishes case studies with numbers' }], binding_constraint: 'The site shows almost no third-party proof.' };
const aiSerp = (q) => {
  if (q.type === 'index') return task({ keyword: q.query, se_results_count: 31, items: [] });
  if (q.type === 'brand') return task({ keyword: q.query, se_results_count: 1200, items: [organic(1, 'northwind-erp.com', '/', 'Northwind ERP'), organic(2, 'linkedin.com', '/company/northwind-erp', 'Northwind ERP | LinkedIn')] });
  return task({ keyword: q.query, se_results_count: 500000, items: [{ type: 'ai_overview', items: [{ type: 'ai_overview_element', text: 'Top ERP implementation partners in the UAE include GulfERP and ERP Masters.', references: [{ domain: 'gulferp.ae', url: 'https://gulferp.ae/' }, { domain: 'clutch.co', url: 'https://clutch.co/ae/erp' }] }], references: [] }, organic(1, 'clutch.co', '/ae/erp', 'Top ERP consultants UAE'), organic(2, 'gulferp.ae', '/', 'GulfERP'), organic(3, 'erpmasters.com', '/', 'ERP Masters'), organic(14, 'northwind-erp.com', '/services/erp-implementation/', 'Northwind')] });
};
const llmAnswers = (prompts) => prompts.map(p => {
  if (p.platform === 'perplexity') return { tasks: [{ status_code: 40201, status_message: 'Access denied. AI Optimization API is not active.' }] };
  const text = p.kind === 'who' ? 'Northwind ERP (northwind-erp.com) is a Dubai-based ERP implementation partner that deploys Odoo and Microsoft Dynamics 365 Business Central for wholesalers and distributors in the UAE. It serves mid-sized distribution businesses.' : '1. GulfERP - gulferp.ae\n2. ERP Masters - erpmasters.com\n3. CloudLedger - cloudledger.io\n4. SAP Consult - sapconsult.ae';
  return task({ model_name: 'gpt-4.1-mini', input_tokens: 120, output_tokens: 90, money_spent: 0.01, items: [{ type: 'message', sections: [{ type: 'text', text, annotations: p.kind === 'who' ? [{ type: 'url_citation', url: 'https://northwind-erp.com/about/', title: 'About' }] : [{ type: 'url_citation', url: 'https://clutch.co/ae/erp', title: 'Clutch' }] }] }] }, { cost: 0.0123 });
});

module.exports = { OUR, COMPS, forms, jinaSite, jinaBlocked, compPage, serpTop, serpEmpty, keywordOverview, keywordOverviewEmpty, sitemapIndex, urlset, siteUrls, competitorAnalysis, verdictGo, verdictAvoid, brief, draft, crawlTaskPost, crawlTaskPostFail, summaryRunning, summaryDone, crawledPagesRes, extrasRes, probeResults, pageHtmlResults, headResults, labsCompetitors, rankOverview, whois, ranked, keywordIdeas, backlinkSummary, backlinkGap, psi, contentReview, aiSerp, llmAnswers, words };
