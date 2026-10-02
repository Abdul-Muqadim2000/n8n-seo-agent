// Google Search Console notification e-mails (the agent's mailbox is a user of the property) -> typed alerts; anything else is ignored.
// Covers what the API cannot see: manual actions, security issues, site-wide indexing / Core Web Vitals / rich-result / sitemap notices.
const j = $input.first().json || {}; const meta = j.metadata || {};
const subject = String(j.subject || meta.subject || '').replace(/\s+/g, ' ').trim();
const from = String(j.from || meta.from || '').toLowerCase();
const text = String(j.textPlain || j.textHtml || '').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const rawDate = j.date || meta.date || ''; const received_at = isNaN(Date.parse(rawDate)) ? new Date().toISOString() : new Date(rawDate).toISOString();
const message_id = String(meta['message-id'] || j.messageId || '').trim() || ('gsc:' + Buffer.from(subject + '|' + received_at).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, 48));
const google = /sc-noreply@google\.com|search console|google search console|webmasters/i.test(from + ' ' + subject);
const s = subject + ' ' + text.slice(0, 800);
let kind = 'other', severity = 'info';
if (/manual action/i.test(s)) { kind = 'manual_action'; severity = 'critical'; }
else if (/security issue|hacked|malware|social engineering|deceptive pages|harmful downloads/i.test(s)) { kind = 'security'; severity = 'critical'; }
else if (/not (being )?indexed|indexing issue|page indexing|coverage|reasons preventing/i.test(s)) { kind = 'coverage'; severity = 'high'; }
else if (/core web vitals|\bcwv\b|page experience/i.test(s)) { kind = 'cwv'; severity = 'medium'; }
else if (/rich result|structured data|breadcrumb|faq|product snippet|merchant listing|video issue|review snippet/i.test(s)) { kind = 'rich_results'; severity = 'medium'; }
else if (/sitemap/i.test(s)) { kind = 'sitemap'; severity = 'medium'; }
else if (/https issue|mobile usability|crawl error|server error|robots\.txt/i.test(s)) { kind = 'crawl'; severity = 'medium'; }
else if (/new owner|added you|added as|removed|permission|verif/i.test(s)) { kind = 'access'; severity = 'info'; }
else if (/performance|top queries|search performance|monthly|summary|new report|tips/i.test(s)) { kind = 'summary'; severity = 'info'; }
const m = s.match(/(?:sc-domain:|for\s+(?:https?:\/\/)?(?:www\.)?)([a-z0-9][a-z0-9.-]*\.[a-z]{2,})/i) || subject.match(/([a-z0-9][a-z0-9.-]*\.[a-z]{2,})/i);
const domain = m ? m[1].toLowerCase().replace(/^www\./, '').replace(/\/$/, '') : '';
return [{ json: { relevant: google && kind !== 'summary' && !!domain, kind, severity, domain, site_id: domain ? 'site_' + domain.replace(/[^a-z0-9]+/g, '-') : '', subject: subject.slice(0, 200), summary: text.slice(0, 400), received_at, message_id: message_id.slice(0, 120), from: from.slice(0, 120), google } }];
