// The link-prospect pipeline (seo_link_prospects, upsert by site + prospect domain + type; exact columns): this run's candidates merged with
// the stored rows (status, notes and drafts kept), outreach drafts attached, and prospects that now link to you marked "won" automatically.
const sites = $('Parse Backlinks').all().map(i => i.json);
let existing = []; try { existing = $('Load Link Prospects').all().map(i => i.json).filter(x => x && x.prospect_domain); } catch (e) {}
let jobs = [], outs = []; try { jobs = $('Outreach Jobs').all().map(i => i.json).filter(j => !j.skip); outs = $('Outreach Writer').all().map(i => i.json); } catch (e) {}
const parse = (raw) => { if (raw && typeof raw === 'object') return raw; const s = String(raw || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, ''); try { return JSON.parse(s); } catch (e) { const a = s.indexOf('{'), b = s.lastIndexOf('}'); try { return JSON.parse(s.slice(a, b + 1)); } catch (e2) { return null; } } };
const rows = [];
for (const s of sites) {
  const now = s.checked_at; const ji = jobs.findIndex(j => j.site_id === s.site_id);
  const drafts = ji >= 0 && outs[ji] && !outs[ji].error ? ((parse(outs[ji].output) || {}).drafts || []) : [];
  const linking = new Set([...s.refdomains, ...s.new_links.filter(l => !l.spammy).map(l => l.from_domain)]);
  const key = (x) => x.prospect_domain + '|' + x.type;
  const mine = new Map(existing.filter(x => x.site_id === s.site_id).map(x => [key(x), x]));
  const seen = new Set();
  const emit = (c, old) => { const d = drafts.find(x => String(x.prospect_domain || '').toLowerCase() === c.prospect_domain && !old.outreach_body);
    const won = c.type !== 'reclaim' && linking.has(c.prospect_domain) && (old.status || 'new') !== 'won';
    rows.push({ site_id: s.site_id, domain: s.domain, prospect_domain: c.prospect_domain, type: c.type, rank: Number(c.rank ?? old.rank) || 0, spam_score: Number(c.spam_score ?? old.spam_score) || 0, detail: String(c.detail || old.detail || '').slice(0, 300),
      source_url: c.source_url || old.source_url || '', target_url: c.target_url || old.target_url || '', status: won ? 'won' : (old.status || 'new'), first_seen: old.first_seen || now, last_seen: c.fresh ? now : (old.last_seen || now),
      won_at: won ? now : (old.won_at || ''), outreach_subject: old.outreach_subject || (d ? String(d.subject || '').slice(0, 120) : ''), outreach_body: old.outreach_body || (d ? String(d.body || '').slice(0, 1500) : ''), note: old.note || '' }); };
  for (const c of s.candidates) { const k = key(c); if (seen.has(k)) continue; seen.add(k); emit({ ...c, fresh: true }, mine.get(k) || {}); }
  // stored prospects not seen this run: only touched when they now link (won) or a draft was written for them (ai_source)
  for (const [k, old] of mine) { if (seen.has(k)) continue; const won = old.type !== 'reclaim' && linking.has(old.prospect_domain) && old.status !== 'won'; const d = drafts.find(x => String(x.prospect_domain || '').toLowerCase() === old.prospect_domain && !old.outreach_body);
    if (won || d) { seen.add(k); emit({ prospect_domain: old.prospect_domain, type: old.type }, old); } }
}
return rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true } }];
