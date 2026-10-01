const d = $input.first().json;
const s = d.site_description || {};

const esc = (t) => String(t ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const list = (arr) => (arr || []).map(i => `<li>${esc(i)}</li>`).join('');
const tags = (arr) => (arr || []).map(i => `<span class="tag">${esc(i)}</span>`).join('');

const html = `
<style>
  .wrap{font-family:Arial,sans-serif;max-width:720px;margin:0 auto;color:#1e293b;text-align:left;line-height:1.6}
  h1{font-size:24px;margin:0 0 4px;color:#0f172a}
  .sub{color:#64748b;margin-bottom:20px}
  .card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 18px;margin-bottom:14px}
  .card h2{font-size:15px;margin:0 0 8px;color:#1e3a8a;text-transform:uppercase;letter-spacing:.5px}
  ul{margin:0;padding-left:18px}
  .tag{display:inline-block;background:#e0e7ff;color:#1e3a8a;border-radius:20px;padding:4px 10px;margin:3px 4px 3px 0;font-size:13px}
  .meta{background:#fff;border:1px dashed #94a3b8;border-radius:8px;padding:10px;font-size:14px;margin-top:6px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  @media(max-width:600px){.grid{grid-template-columns:1fr}}
</style>
<div class="wrap">
  ${d.site_read_failed ? '<div class="card" style="border-color:#f59e0b;background:#fffbeb"><b>We could not read ' + esc(d.domain) + ' automatically.</b> The site may block automated readers or was too slow to respond. The details below are limited to what you told us.</div>' : ''}
  <h1>${esc(s.business_name || d.domain)}</h1>
  <div class="sub">${esc(s.one_line_summary)}</div>

  <div class="card">
    <h2>What Your Business Does</h2>
    <p>${esc(s.business_description)}</p>
  </div>

  <div class="grid">
    <div class="card"><h2>Products / Services</h2><ul>${list(s.products_or_services)}</ul></div>
    <div class="card"><h2>Target Audience</h2><ul>${list(s.target_audience)}</ul></div>
    <div class="card"><h2>Why Customers Choose You</h2><ul>${list(s.unique_selling_points)}</ul></div>
    <div class="card"><h2>Details</h2>
      <p><b>Industry:</b> ${esc(s.industry)}<br>
      <b>Serves:</b> ${esc(s.location_served)}<br>
      <b>Brand Tone:</b> ${esc(s.tone_of_brand)}</p>
    </div>
  </div>

  <div class="card">
    <h2>Suggested SEO Meta Tags</h2>
    <div class="meta"><b>Title:</b> ${esc(s.suggested_meta_title)}</div>
    <div class="meta"><b>Description:</b> ${esc(s.suggested_meta_description)}</div>
  </div>

  <div class="card">
    <h2>Keywords Customers Might Search</h2>
    ${tags(s.seed_keywords)}
  </div>
</div>`;

return [{ json: { ...d, result_html: html } }];