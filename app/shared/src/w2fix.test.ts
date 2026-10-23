// W2-FIX (2026-10-23, n8n/seo-agent/docs/ai-visibility-2026-10-23/fixes/W2-FIX.md): the field names the app sends Site Admin `monitors` for every
// AI visibility wave-2 setting are the engine's (Admin_Action.js / Monitor_Row_Admin.js read exactly these), a list the owner empties is sent so
// Site Admin clears it, and an on-demand AI visibility check carries the server's quote of the website's panel. The engine side replays the same
// bodies (harness W2FIX-3, fixtures_platform_admin.json written by `npm run export:payloads`).
import { describe, expect, it } from 'vitest';
import { aiPanelQuoteBody, monitorsBody, siteAdminMonitorsBody } from './payload';
import { monitorSettingsSchema } from './schemas';

const W2_KEYS = ['ai_alert_rules_json', 'ai_sov_set', 'ai_claude_weekly', 'ai_pulse_engines', 'ai_persona_context', 'ai_fanout_check', 'ai_demand_market'];

describe('Site Admin monitors: the wave-2 keys', () => {
  const all = monitorSettingsSchema.partial().parse({
    aiClaudeWeekly: true, aiPulseEngines: ['chatgpt', 'perplexity'], aiPersonaContext: true, aiFanoutCheck: 50, aiSovSet: ['rival.com', 'other.ae'], aiDemandMarket: true,
    aiAlertRules: [{ id: 'r1', metric: 'named_rate', scope: { engine: 'chatgpt' }, direction: 'drop', threshold_points: 5 }],
  });
  it('every key the engine reads, with its exact name and the shape it parses', () => {
    const b = siteAdminMonitorsBody(all);
    expect(W2_KEYS.every((k) => k in b)).toBe(true);
    expect(b).toMatchObject({ ai_claude_weekly: true, ai_pulse_engines: 'chatgpt, perplexity', ai_persona_context: true, ai_fanout_check: 50, ai_sov_set: 'rival.com, other.ae', ai_demand_market: true });
    expect(JSON.parse(String(b.ai_alert_rules_json))).toEqual([{ id: 'r1', metric: 'named_rate', scope: { engine: 'chatgpt' }, direction: 'drop', threshold_points: 5, enabled: true }]);
  });
  it('a setting the owner did not touch is not sent (the engine keeps what it stores)', () => {
    const b = siteAdminMonitorsBody({ aiPromptsMax: 30 });
    expect(W2_KEYS.some((k) => k in b)).toBe(false);
  });
  it('an emptied list is sent so that Site Admin clears it: pulse engines back to the default four, the set and the rules cleared', () => {
    const b = siteAdminMonitorsBody({ aiPulseEngines: [], aiSovSet: [], aiAlertRules: [], brandNames: [], aiPersonas: [] });
    expect(b.ai_pulse_engines).toBe(' ');   // '' would be read as "not given" and keep the old choice
    expect(b.ai_sov_set).toBe('');          // Admin Action reads '' as "clear"
    expect(b.ai_alert_rules_json).toBe('[]');
    expect(b.brand_names).toBe(' ');
    expect(b.ai_personas).toBe(' ');
  });
  it('switching an option off sends false (not nothing), and the fan-out check 0', () => {
    expect(monitorsBody({ aiClaudeWeekly: false, aiPersonaContext: false, aiDemandMarket: false, aiFanoutCheck: 0 })).toEqual({ ai_claude_weekly: false, ai_persona_context: false, ai_demand_market: false, ai_fanout_check: 0 });
  });
  it('competitors ride along, an empty list cleared with a space', () => {
    expect(siteAdminMonitorsBody({}, ['a.com', 'b.com']).competitors).toBe('a.com, b.com');
    expect(siteAdminMonitorsBody({}, []).competitors).toBe(' ');
    expect('competitors' in siteAdminMonitorsBody({})).toBe(false);
  });
});

describe('the on-demand AI visibility quote sent to the engine', () => {
  it('rounds to 4 places and names the panel size', () => {
    expect(aiPanelQuoteBody({ dfs: 10.123456, ai: 0.55555 }, 200)).toEqual({ dfs_usd: 10.1235, ai_usd: 0.5556, panel: 200 });
  });
});
