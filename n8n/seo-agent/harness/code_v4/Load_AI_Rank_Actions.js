// FX-B (2026-11-06): the stored AIR actions the plan may count and learn from: those pre-registered under this rule (prereg_json.rule_version
// air-2) or carrying no pre-registration yet. An action registered under another rule is left out of the plan (never re-counted under
// the new rule, never learned from); its row stays in seo_ai_rank_actions.
const RULE = "air-2";
const P = (s) => { if (s && typeof s === 'object') return s; try { return JSON.parse(String(s || '')) || {}; } catch (e) { return {}; } };
const rows = (() => { try { return $('Load AI Rank Actions (Stored)').all().map(i => i.json || {}); } catch (e) { return []; } })();
const keep = rows.filter(r => { if (!r || r.error) return false; const v = String((P(r.prereg_json) || {}).rule_version || ''); return !v || v === RULE; });
return keep.length ? keep.map(r => ({ json: r })) : [{ json: {} }];