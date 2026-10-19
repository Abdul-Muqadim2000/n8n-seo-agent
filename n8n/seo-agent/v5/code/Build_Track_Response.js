// API answer for mode "track" (POSTed to callback_url): registration confirmed; the first report follows as stage "site_tracker".
const d = $input.first().json; const r = $('Site Row (Track)').first().json;
// 2026-10-19 (agent E4): the website's cycle, as "Track my site" ensured it (Track Cycle Plan): created or kept, its anchor, zone and next due time
let cy = null; try { cy = $('Track Cycle Plan').first().json || null; } catch (e) { cy = null; }
let cySaved = null; try { const s = ($('Save Cycle (Track)').first() || {}).json || {}; cySaved = !s.error; } catch (e) { cySaved = null; }
const cycle = cy && cy.row ? { created: !!cy.created, written: !!cy.write && cySaved !== false, site_id: cy.site_id, cycle_key: cy.cycle_key || null, anchor_at: cy.anchor_at, tz: cy.tz, status: cy.status,
  cycle_weekday: cy.cycle_weekday, next_due_at: cy.next_due_at, reason: cy.reason, ...(cy.write && cySaved === false ? { error: 'the cycle row could not be saved: the dispatcher adopts the website at its next sweep' } : {}) }
  : (cy ? { created: false, written: false, reason: cy.reason } : null);
return [{ json: { status: 'accepted', stage: 'site_tracker_setup', request_id: r.request_id || null, site_id: r.site_id, domain: r.domain, keywords: r.keywords ? r.keywords.split(', ') : [], ga4_property_id: r.ga4_property_id || null, blogs_per_week: Number(($('Normalize Input').first().json || {}).blogs_per_week) || 0,
  stored: !!d.stored, store_error: d.store_error || null, callback_url: r.callback_url, cycle,
  next: 'The first performance report is being generated now (about 3 minutes) and then once a week, on the weekday tracking started (the website\'s weekly cycle); each one is POSTed to callback_url with stage "site_tracker". Blog posts per week > 0: the Content Cadence writes up to that many pages each week in the website\'s cycle and delivers them as HTML + Markdown + meta.json; report each published URL with mode "published". If Google is not connected yet, the report names the service-account e-mail to add in Search Console (Settings → Users and permissions, Full) and GA4 (Admin → Property access management, Viewer).' } }];
