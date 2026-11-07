// ---- SU SHIM (E2, 2026-11-08): the guarded stand-in for the SERP-GOTO hotfix kit v5/code/_serp_url.js (branch hotfix/serp-goto) ----
// Live organic and local-pack items now come back as google.com/goto redirects (R5 §13 L-1); the real host survives in `breadcrumb`
// ("https://sqitconsulting.com › microsoft-dynamics-365") and sometimes `website_name`. Every organic / local item the KI worker reads goes
// through SU.normalize(items). When the hotfix kit is inlined before this file, its own SU is kept and only `normalize` is added (its
// `fixItems`); otherwise this minimal copy of the same rule stands in: host from the breadcrumb, else a host-shaped website_name, else the
// item is left UNRESOLVED (domain null, url null, never google.com). A recovered url is approximate (`url_exact: false`). Removed by E2
// once hotfix/serp-goto is merged (fixes/E2.md). Regex only: the n8n sandbox has no URL constructor.
var SU = (typeof SU === 'object' && SU) ? SU : (() => {
  const S = (x) => (x == null ? '' : String(x));
  const REDIR = /^https?:\/\/(?:[a-z0-9-]+\.)*(?:google\.[a-z]{2,3}(?:\.[a-z]{2})?\/(?:goto|url|search\/url|aclk)(?=[?\/#]|$)|bing\.com\/ck\/a(?=[?\/#]|$))/i;
  const HOST = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/i;
  const isRedirect = (u) => REDIR.test(S(u).trim());
  const crumbHost = (b) => { const m = S(b).trim().match(/^https?:\/\/([^\/\s›]+)/i); const h = m ? m[1].toLowerCase().replace(/:\d+$/, '') : ''; return HOST.test(h) ? h : ''; };
  const fixItem = (it) => {
    if (!it || typeof it !== 'object' || !isRedirect(it.url)) return it;
    const ch = crumbHost(it.breadcrumb); const wn = S(it.website_name).trim().toLowerCase(); const host = ch || (HOST.test(wn) ? wn : '');
    let path = '/';
    if (ch) { const segs = S(it.breadcrumb).split(/\s*›\s*/).slice(1).map(x => x.trim()).filter(Boolean); const ok = []; for (const p of segs) { if (/(\.\.\.|…)$/.test(p)) break; ok.push(p.replace(/\s+/g, '-')); } path = '/' + ok.join('/'); }
    return { ...it, domain: host || null, url: host ? 'https://' + host + (path === '/' ? '/' : path) : null, main_domain: host ? host.replace(/^www\./, '') : null,
      url_exact: false, url_recovered: ch ? 'breadcrumb' : (host ? 'website_name' : null), redirect_url: S(it.url) };
  };
  const fixItems = (items) => (Array.isArray(items) ? items.map(fixItem) : items);
  return { v: 0, shim: true, REDIR, isRedirect, fixItem, fixItems, crumbHost };
})();
if (typeof SU.normalize !== 'function') SU.normalize = (items) => SU.fixItems(items);
