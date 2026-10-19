import { describe, expect, it } from 'vitest';
import {
  eventsFor,
  nextAttemptAt,
  slackMessage,
  teamsMessage,
  webhookEndpointSchema,
  webhookUrlFor,
  WEBHOOKS,
  type CallbackFacts,
  type EventEnvelope,
} from './integrations';

// G4 (app/docs/INTEGRATIONS.md): the pure half of the integrations, which events a stored callback means, the Slack / Teams
// formats, the address rules, the backoff.

const facts = (over: Partial<CallbackFacts> & { payload?: Record<string, unknown> } = {}): CallbackFacts => ({
  stage: 'site_tracker',
  status: 'progress',
  payload: {},
  report: { id: 'rep-1', title: 'Weekly site report · northwind.example', stage: over.stage ?? 'site_tracker', status: 'progress', receivedAt: '2026-10-17T08:00:00.000Z', scheduled: true, runId: null, websiteId: 'site-1', url: 'https://app.example.com/o/org/reports/rep-1' },
  runBefore: null,
  runAfter: null,
  ...over,
});
const types = (f: CallbackFacts) => eventsFor(f).map((e) => e.type);

describe('eventsFor: what one stored callback means', () => {
  it('a weekly report is report.ready; its warning lines are one alert.raised, info lines are not', () => {
    const f = facts({ payload: { alerts: [{ level: 'high', text: 'Clicks fell 40% (a real change)' }, { level: 'info', text: 'Nothing else' }, 'Sitemap has 3 errors'] } });
    expect(types(f)).toEqual(['report.ready', 'alert.raised']);
    const alert = eventsFor(f).find((e) => e.type === 'alert.raised')!;
    expect(alert.data.alerts).toEqual([
      { level: 'high', text: 'Clicks fell 40% (a real change)' },
      { level: 'medium', text: 'Sitemap has 3 errors' },
    ]);
  });

  it('a run moving to completed or failed is said once, and only on the move', () => {
    const run = { id: 'run-1', mode: 'audit', title: 'Technical audit', status: 'completed', error: null, completedAt: '2026-10-17T08:00:00Z', url: 'u' };
    expect(types(facts({ stage: 'site_audit', status: 'completed', runBefore: { status: 'running' }, runAfter: run }))).toContain('run.completed');
    expect(types(facts({ stage: 'site_audit', status: 'completed', runBefore: { status: 'completed' }, runAfter: run }))).not.toContain('run.completed');
    const failed = { ...run, status: 'failed', error: 'Rejected by the SEO engine' };
    expect(types(facts({ stage: 'rejected', status: 'rejected', runBefore: { status: 'accepted' }, runAfter: failed }))).toEqual(['run.failed']);
  });

  it('a draft that failed its quality check is report.held with the reason, never report.ready', () => {
    const e = eventsFor(facts({ stage: 'content', status: 'completed', payload: { qa_not_ready: true, qa_reasons: ['3 placeholders left'] } }));
    expect(e.map((x) => x.type)).toEqual(['report.held']);
    expect(String(e[0]!.data.reason)).toContain('3 placeholders left');
  });

  it('a "started" note is neither ready nor held', () => {
    expect(types(facts({ stage: 'ai_visibility_started', status: 'accepted', payload: { alerts: ['x'] } }))).toEqual([]);
  });

  it('a Search Console alert is alert.raised (page-watch alerts keep their source)', () => {
    const e = eventsFor(facts({ stage: 'console_alert', status: 'completed', payload: { severity: 'critical', subject: 'Manual action on northwind.example' } }));
    expect(e.find((x) => x.type === 'alert.raised')!.data).toMatchObject({ source: 'search_console', alerts: [{ level: 'critical', text: 'Manual action on northwind.example' }] });
    expect(eventsFor(facts({ stage: 'console_alert', status: 'completed', payload: { source: 'page_watch', subject: 'Page went noindex' } })).find((x) => x.type === 'alert.raised')!.data.source).toBe('page_watch');
  });

  it('new audit findings only against an earlier audit of the same type (a baseline has none)', () => {
    const diff = { baseline: false, previous: { audit_id: 'aud_old' }, new: [{ title: 'Pages with no H1', category: 'Content', severity: 'High' }, { title: '' }] };
    const e = eventsFor(facts({ stage: 'site_audit', status: 'completed', payload: { audit_id: 'aud_new', health_score: 71, audit_diff: diff } }));
    const n = e.find((x) => x.type === 'audit.finding.new')!;
    expect(n.data).toMatchObject({ audit: { id: 'aud_new', reportType: 'site_audit', healthScore: 71, comparedWith: 'aud_old' }, findings: [{ title: 'Pages with no H1', severity: 'High' }] });
    expect(types(facts({ stage: 'site_audit', status: 'completed', payload: { audit_diff: { baseline: true, new: [{ title: 'x' }] } } }))).not.toContain('audit.finding.new');
    // the full report nests it under site_audit as well
    expect(types(facts({ stage: 'full_report', status: 'completed', payload: { site_audit: { audit_id: 'a', audit_diff: diff } } }))).toContain('audit.finding.new');
  });

  it('rank.changed for moves of five places or more, split into gains and drops', () => {
    const payload = {
      ladder_id: 'lad_1',
      head_keyword: 'e invoicing uae',
      positions: [
        { keyword: 'peppol uae', position: 4, previous: 12, delta: 8 },
        { keyword: 'e invoice format', position: 30, previous: 22, delta: -8 },
        { keyword: 'small move', position: 9, previous: 11, delta: 2 },
        { keyword: 'unread', position: null, previous: 5, delta: null },
      ],
    };
    const e = eventsFor(facts({ stage: 'rank_tracker', status: 'progress', payload })).find((x) => x.type === 'rank.changed')!;
    expect(e.data.gains).toEqual([{ keyword: 'peppol uae', position: 4, previous: 12, delta: 8, url: null }]);
    expect(e.data.drops).toEqual([{ keyword: 'e invoice format', position: 30, previous: 22, delta: -8, url: null }]);
    expect(types(facts({ stage: 'rank_tracker', status: 'progress', payload: { positions: [{ keyword: 'x', position: 9, previous: 11, delta: 2 }] } }))).not.toContain('rank.changed');
  });
});

const env = (type: EventEnvelope['type'], data: Record<string, unknown>): EventEnvelope => ({
  id: 'evt-1',
  type,
  createdAt: '2026-10-17T08:00:00.000Z',
  company: { id: 'org', name: 'Northwind <Ltd> & Co' },
  website: { id: 'site', domain: 'northwind.example' },
  data,
});

describe('Slack and Teams formats', () => {
  it('Slack: a notification text, one section, a button to the report, Slack\'s control characters escaped', () => {
    const m = slackMessage(env('alert.raised', { alerts: [{ level: 'high', text: 'Clicks fell <40%> & more' }], report: { url: 'https://app.example.com/o/org/reports/rep-1' } }));
    expect(m.text).toBe('Alert · northwind.example');
    const blocks = m.blocks as { type: string; text?: { text: string }; elements?: { url?: string; text?: unknown }[] }[];
    expect(blocks.map((b) => b.type)).toEqual(['section', 'actions', 'context']);
    expect(blocks[0]!.text!.text).toContain('High: Clicks fell &lt;40%&gt; &amp; more');
    expect(blocks[1]!.elements![0]!.url).toBe('https://app.example.com/o/org/reports/rep-1');
    expect(JSON.stringify(blocks[2])).toContain('Northwind &lt;Ltd&gt; &amp; Co');
  });

  it('Teams: a message with one Adaptive Card and an Open URL action', () => {
    const m = teamsMessage(env('rank.changed', { ladder: { head: 'e invoicing uae' }, gains: [{ keyword: 'peppol uae', position: 4, previous: 12, delta: 8 }], drops: [], report: { url: 'https://app.example.com/r' } }));
    expect(m.type).toBe('message');
    const card = (m.attachments as { contentType: string; content: { type: string; body: { text: string }[]; actions: { url: string }[] } }[])[0]!;
    expect(card.contentType).toBe('application/vnd.microsoft.card.adaptive');
    expect(card.content.type).toBe('AdaptiveCard');
    expect(card.content.body.map((b) => b.text)).toContain('Up peppol uae: 12 to 4 (+8)');
    expect(card.content.actions[0]!.url).toBe('https://app.example.com/r');
  });
});

describe('endpoint addresses', () => {
  it('Slack and Teams addresses must be theirs; everything must be https on a public host', () => {
    expect(webhookUrlFor('slack', 'https://hooks.slack.com/services/T000/B000/XXXX')).toBeNull();
    expect(webhookUrlFor('slack', 'https://example.com/services/T000')).toMatch(/hooks\.slack\.com/);
    expect(webhookUrlFor('teams', 'https://prod-12.westus.logic.azure.com:443/workflows/abc/triggers/manual/paths/invoke?sig=x')).toBeNull();
    expect(webhookUrlFor('teams', 'https://default123.environment.api.powerplatform.com/powerautomate/automations/direct/workflows/x')).toBeNull();
    expect(webhookUrlFor('teams', 'https://hooks.slack.com/services/T/B/X')).toMatch(/logic\.azure\.com/);
    for (const bad of ['http://example.com/hook', 'https://10.0.0.5/hook', 'https://169.254.169.254/latest', 'https://metadata.internal/x', 'ftp://x.com']) expect(webhookUrlFor('json', bad)).not.toBeNull();
    expect(webhookUrlFor('json', 'https://hooks.zapier.com/hooks/catch/1/abc/')).toBeNull();
  });

  it('the endpoint schema needs a name, at least one event and a valid address; repeated events collapse', () => {
    const ok = webhookEndpointSchema.parse({ name: '#seo-alerts', format: 'slack', url: 'https://hooks.slack.com/services/T1/B2/c3', events: ['alert.raised', 'alert.raised', 'rank.changed'] });
    expect(ok.events).toEqual(['alert.raised', 'rank.changed']);
    expect(webhookEndpointSchema.safeParse({ name: 'x', url: 'https://example.com/h', events: [] }).success).toBe(false);
    expect(webhookEndpointSchema.safeParse({ name: 'x', url: 'https://example.com/h', events: ['made.up'] }).success).toBe(false);
    const r = webhookEndpointSchema.safeParse({ name: 'x', format: 'slack', url: 'https://example.com/h', events: ['run.failed'] });
    expect(r.success).toBe(false);
  });
});

describe('retries', () => {
  it('backs off 1, 5, 30, 120, 720 minutes and then gives up', () => {
    const now = new Date('2026-10-17T00:00:00.000Z');
    const mins = [1, 2, 3, 4, 5].map((n) => (nextAttemptAt(n, now)!.getTime() - now.getTime()) / 60_000);
    expect(mins).toEqual([...WEBHOOKS.backoffMinutes]);
    expect(nextAttemptAt(6, now)).toBeNull();
  });
});
