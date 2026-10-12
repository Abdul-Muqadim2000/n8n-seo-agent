const input = $('Normalize Input').first().json;
let raw = String($input.first().json.site_text || '');

// Title nikal lo
const titleMatch = raw.match(/^Title:\s*(.+)$/m);
const pageTitle = titleMatch ? titleMatch[1].trim() : '';

let text = raw
  .replace(/^Title:.*$/m, '')
  .replace(/^URL Source:.*$/m, '')
  .replace(/^Markdown Content:\s*$/m, '')
  .replace(/!\[[^\]]*\]\([^)]*\)/g, '')        // images hatao
  .replace(/\[\s*\]\([^)]*\)/g, '')            // khaali links hatao
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')     // [text](url) → text
  .replace(/\*\*/g, '')                        // bold marks
  .replace(/[ \t]+/g, ' ')
  .replace(/\n\s*\n+/g, '\n\n')
  .trim()
  .slice(0, 12000);

// Site padhi gayi ya block hui?
const blocked = /access denied|forbidden|captcha|cloudflare|403|just a moment/i.test(text.slice(0, 500));
const read_ok = text.length > 200 && !blocked;

// D22 (2026-10-11): the homepage's own header / menu links, so the service pages can be read too (same host, max 12, with their link text).
// Taken from the raw markdown before the links are stripped; the n8n Code sandbox has no URL constructor, so hosts come from a regex.
const NAV = { max: 12, header_chars: 3500, text_chars: 80 };
const navHost = (u) => ((String(u || '').match(/^https?:\/\/([^\/?#]+)/i) || [])[1] || '').toLowerCase().replace(/^www\./, '').replace(/:\d+$/, '');
const navSelf = navHost(((raw.match(/^URL Source:\s*(\S+)/m) || [])[1]) || '') || String(input.domain || '').toLowerCase().replace(/^www\./, '');
const navBody = raw.replace(/^Title:.*$/m, '').replace(/^URL Source:.*$/m, '').replace(/^Markdown Content:\s*$/m, '');
const navFirstH = navBody.search(/^#{1,3}\s/m);   // the menu sits above the first heading; below it a link is only a nav page if it looks like one
const NAV_SERVICE = /(service|solution|product|offering|expertise|capabilit|industr|platform|technolog|consult|what-?we-?do|whatwedo)/i;
const nav_pages = []; const navSeen = new Set();
for (const [region, inHeader] of [[navBody.slice(0, navFirstH > 0 ? Math.min(navFirstH, NAV.header_chars) : NAV.header_chars), true], [navBody, false]]) {
  for (const m of region.matchAll(/\[([^\]\n]{1,120})\]\((https?:\/\/[^)\s]+)\)/g)) {
    if (nav_pages.length >= NAV.max) break;
    const label = m[1].replace(/[*_`#!]/g, '').replace(/\s+/g, ' ').trim();
    const url = m[2].replace(/[.,;]+$/, '').replace(/[?#].*$/, '');
    if (navHost(url) !== navSelf || !navSelf) continue;
    const path = url.replace(/^https?:\/\/[^\/?#]*/i, '') || '/';
    if (path === '/' || /\.(pdf|jpe?g|png|gif|svg|webp|avif|mp4|mp3|zip|docx?|xlsx?|pptx?|css|js|xml|ico)$/i.test(path)) continue;
    const key = path.replace(/\/+$/, '').toLowerCase() || '/';
    if (navSeen.has(key)) continue;
    if (!inHeader && !NAV_SERVICE.test(path) && !NAV_SERVICE.test(label)) continue;   // below the header only service-looking links count
    navSeen.add(key);
    nav_pages.push({ url, text: label.slice(0, NAV.text_chars), path: key, in_header: inHeader });
  }
  if (nav_pages.length >= NAV.max) break;
}

return [{
  json: {
    ...input,
    page_title: pageTitle,
    site_text: text,
    read_ok,
    nav_pages
  }
}];