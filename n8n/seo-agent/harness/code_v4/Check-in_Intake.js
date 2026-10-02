// "Search Console check-in" form page: reads the optional Pages-report CSV upload into text (the file is only readable here, on the form item)
// and hands every field on to Normalize Input.
const item = $input.first(); const j = { ...(item.json || {}) }; const bin = item.binary || {};
const key = Object.keys(bin).find(k => /\.csv$/i.test(String((bin[k] || {}).fileName || '')) || /csv|pages_report|export/i.test(k)) || Object.keys(bin)[0];
let text = '';
if (key) { try { const buf = await this.helpers.getBinaryDataBuffer(0, key); text = buf.toString('utf8'); } catch (e) { const d = bin[key] && bin[key].data; if (d && String(d).length > 20) { try { text = Buffer.from(d, 'base64').toString('utf8'); } catch (e2) {} } } }
j.pages_csv_text = text.slice(0, 400000); j.pages_csv_file = key ? String((bin[key] || {}).fileName || key) : '';
return [{ json: j }];
