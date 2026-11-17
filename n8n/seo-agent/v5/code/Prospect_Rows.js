// The link-prospect pipeline (seo_link_prospects, upsert by site + prospect domain + type; exact columns): this run's candidates merged with
// the stored rows (status, notes and drafts kept), outreach drafts attached, and prospects that now link to you marked "won" automatically.
// v4.10: score (value x likelihood) and origin, the contact found on the prospect's site, follow-up drafts (1 + 2) for contacted prospects,
// and "won" only for a link the check found on the page (or that an index reports live this run) — verified_at says when.
// CR17-E (client report 2026-11-17, build section 195): "won" is LK.wonCheck now. Live, every prospect whose domain had ANY ledger row was
// marked won (bebee.com through a Search Console sample of a job listing, github.com through a developer's profile), with nobody ever
// written to. Won = we contacted them + our own check found a link to the site on a page that passes the junk gates; a clean link nobody
// asked for is `linked` (already links to you), a link on a junk page `low_value`; a won row whose ledger row is lost is `lost`; a stored
// "won" that fails the rule is taken off won with the reason, so the old domain collisions heal on the next run.
/*__DRAFTS__*/
/*__LINK_KIT__*/
const sites = $('Parse Backlinks').all().map(i => i.json);
let existing = []; try { existing = $('Load Link Prospects').all().map(i => i.json).filter(x => x && x.prospect_domain); } catch (e) {}
let jobs = [], outs = []; try { jobs = $('Outreach Input').all().map(i => i.json).filter(j => !j.skip); outs = $('Outreach Writer').all().map(i => i.json); } catch (e) {}
const parse = (raw) => { if (raw && typeof raw === 'object') return raw; const s = String(raw || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, ''); try { return JSON.parse(s); } catch (e) { const a = s.indexOf('{'), b = s.lastIndexOf('}'); try { return JSON.parse(s.slice(a, b + 1)); } catch (e2) { return null; } } };
const rows = [];
for (const s of sites) {
  const now = s.checked_at; const ji = jobs.findIndex(j => j.site_id === s.site_id);
  const drafts = ji >= 0 && outs[ji] && !outs[ji].error ? ((parse(outs[ji].output) || {}).drafts || []) : [];
  const contacts = new Map(ji >= 0 ? jobs[ji].prospects.filter(p => p.contact_email).map(p => [p.prospect_domain, p]) : []);
  const ledger = s.ledger_rows || [];
  // the won rule (LK.wonCheck) -> the prospect's next status, its dates and note
  const decide = (c, old) => {
    const was = String(old.status || 'new'); const keep = { status: was, won_at: old.won_at || '', verified_at: old.verified_at || '', note: old.note || '' };
    if (c.type === 'reclaim') return keep;
    const wc = LK.wonCheck({ prospect: { ...old, prospect_domain: c.prospect_domain }, rows: ledger, site: s.domain, now });
    if (was === 'won') {
      if (!wc.contacted || wc.state === 'low_value' || wc.state === 'already_links') return { status: wc.state === 'already_links' ? 'linked' : wc.state === 'low_value' ? 'low_value' : 'new', won_at: '', verified_at: '', note: String('not a won link: ' + (wc.contacted ? wc.reason : 'nobody was written to; ' + wc.reason) + ' (corrected ' + String(now).slice(0, 10) + ')').slice(0, 300) };
      if (wc.state === 'lost') return { status: 'lost', won_at: old.won_at || '', verified_at: now, note: String('won ' + String(old.won_at || '').slice(0, 10) + ', ' + wc.reason).slice(0, 300) };
      return keep;
    }
    if (wc.state === 'won' && ['new', 'contacted', 'replied', 'linked', 'low_value'].includes(was)) return { status: 'won', won_at: now, verified_at: now, note: old.note || String('won ' + String(now).slice(0, 10) + ': ' + wc.reason + (wc.url ? ' (' + wc.url + ')' : '')).slice(0, 300) };   // a note someone wrote is kept
    if (wc.state === 'already_links' && ['new', 'low_value'].includes(was)) return { ...keep, status: 'linked', note: String(wc.reason + (wc.url ? ' (' + wc.url + ')' : '')).slice(0, 300) };
    if (wc.state === 'low_value' && was === 'new') return { ...keep, status: 'low_value', note: wc.reason.slice(0, 300) };
    if (wc.state === 'not_found' && ['linked', 'low_value'].includes(was)) return { ...keep, status: 'new', note: '' };
    return keep;
  };
  const key = (x) => x.prospect_domain + '|' + x.type;
  const mine = new Map(existing.filter(x => x.site_id === s.site_id).map(x => [key(x), x]));
  const seen = new Set();
  const emit = (c, old) => {
    // P34-1 (live 2026-10-12): a stored draft written before the D12 / D13 gates is withdrawn, not carried into the new row with its
    // old subject (run 476 re-wrote mof.gov.ae and uae-asp.ae as gap prospects with "A resource suggestion for your readers").
    const kept = DRAFTS.carry(old, { handover: !!s.link_builder });
    const d = drafts.find(x => String(x.prospect_domain || '').toLowerCase() === c.prospect_domain && !(Number(x.followup) > 0) && !kept.outreach_body);
    const f = drafts.find(x => String(x.prospect_domain || '').toLowerCase() === c.prospect_domain && Number(x.followup) > 0 && old.status === 'contacted' && Number(x.followup) === (Number(old.followup_step) || 0) + 1);
    const dz = decide(c, old);
    const ct = contacts.get(c.prospect_domain) || {};
    rows.push({ site_id: s.site_id, domain: s.domain, prospect_domain: c.prospect_domain, type: c.type, rank: Number(c.rank ?? old.rank) || 0, spam_score: Number(c.spam_score ?? old.spam_score) || 0, detail: String(c.detail || old.detail || '').slice(0, 300),
      source_url: c.source_url || old.source_url || '', target_url: c.target_url || old.target_url || '', status: dz.status, first_seen: old.first_seen || now, last_seen: c.fresh ? now : (old.last_seen || now),
      won_at: dz.won_at, outreach_subject: kept.outreach_subject || (d ? String(d.subject || '').slice(0, 120) : ''), outreach_body: kept.outreach_body || (d ? String(d.body || '').slice(0, 1500) : ''),
      drafted_at: d ? now : kept.drafted_at, note: kept.superseded ? DRAFTS.reason.slice(0, 300) : dz.note,
      score: Number(c.score ?? old.score) || 0, origin: c.origin || old.origin || '', contact_email: old.contact_email || ct.contact_email || '', contact_url: old.contact_url || ct.contact_url || '', contacted_at: old.contacted_at || '',
      followup_step: f ? Number(f.followup) : (Number(old.followup_step) || 0), followup_subject: f ? String(f.subject || '').slice(0, 120) : (old.followup_subject || ''), followup_body: f ? String(f.body || '').slice(0, 1200) : (old.followup_body || ''),
      verified_at: dz.verified_at }); };
  for (const c of s.candidates) { const k = key(c); if (seen.has(k)) continue; seen.add(k); emit({ ...c, fresh: true }, mine.get(k) || {}); }
  // stored prospects not seen this run: only touched when they now link (won), or a draft / follow-up / contact was written for them
  for (const [k, old] of mine) { if (seen.has(k)) continue; const won = decide({ prospect_domain: old.prospect_domain, type: old.type }, old).status !== String(old.status || 'new');   // CR17-E: a status the won rule changes (won, lost, corrected)
    const d = drafts.some(x => String(x.prospect_domain || '').toLowerCase() === old.prospect_domain && (Number(x.followup) > 0 ? old.status === 'contacted' : !old.outreach_body));
    if (won || d || DRAFTS.superseded(old) || (contacts.has(old.prospect_domain) && !old.contact_email)) { seen.add(k); emit({ prospect_domain: old.prospect_domain, type: old.type }, old); } }   // P34-1: a superseded draft is cleared even when the prospect was not seen again
}
return rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true } }];
