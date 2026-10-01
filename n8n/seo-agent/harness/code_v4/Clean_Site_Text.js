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

return [{
  json: {
    ...input,
    page_title: pageTitle,
    site_text: text,
    read_ok
  }
}];