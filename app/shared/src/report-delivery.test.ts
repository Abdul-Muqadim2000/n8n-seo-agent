import { describe, expect, it } from 'vitest';
import { MODES } from './constants';
import { shareCaveat } from './share';
import {
  DEFAULT_DELIVERY_SETTINGS,
  DELIVERY,
  deliveryDecision,
  deliveryDecisionFor,
  deliveryLines,
  deliveryOn,
  deliveryScheduleLabel,
  deliverySettingsSchema,
  clicksHeadline,
  deliverySubject,
  deliveryWebhookBody,
  figureLabel,
  figureLines,
  nextDeliveryAt,
  type DeliveryItem,
  type DeliveryPayload,
  webhookUrlOk,
  type DeliverySettings,
} from './report-delivery';

const settings = (over: Partial<DeliverySettings> = {}): DeliverySettings => ({
  ...DEFAULT_DELIVERY_SETTINGS,
  ...over,
  email: { ...DEFAULT_DELIVERY_SETTINGS.email, ...(over.email ?? {}) },
  webhook: { ...DEFAULT_DELIVERY_SETTINGS.webhook, ...(over.webhook ?? {}) },
});

const ready = (over: Record<string, unknown> = {}) => ({ stage: 'content', status: 'completed', payload: { keyword: 'e invoicing uae', verdict: 'GO', ...over } });

describe('deliveryDecision — a report the run marked not ready is never sent', () => {
  it('delivers a finished report', () => {
    const d = deliveryDecision(ready());
    expect(d.deliver).toBe(true);
    expect(d.code).toBeNull();
    expect(d.reason).toBe('');
  });

  it('holds a page that failed its quality check (R11), and says so in the customer’s words', () => {
    const d = deliveryDecision(ready({ qa_not_ready: true, qa_reasons: ['3 placeholders left', 'word count 3,952 for 2,100'] }));
    expect(d.deliver).toBe(false);
    expect(d.code).toBe('not_ready');
    expect(d.reason).toContain('did not pass the quality check');
    expect(d.reason).toContain('3 placeholders left');
  });

  it('holds a page the engine marked unpublishable even without the not-ready flag', () => {
    expect(deliveryDecision(ready({ qa_publishable: false })).code).toBe('not_ready');
  });

  it('holds a rejected run and names the engine’s reason', () => {
    const d = deliveryDecision({ stage: 'rejected', status: 'rejected', payload: { error: 'The search-data budget for this day is used up' } });
    expect(d.deliver).toBe(false);
    expect(d.code).toBe('rejected');
    expect(d.reason).toContain('search-data budget');
  });

  it('holds anything whose status is not a completed report', () => {
    expect(deliveryDecision({ stage: 'content', status: 'failed', payload: {} }).code).toBe('rejected');
  });

  it('holds a run the engine refused on validation', () => {
    expect(deliveryDecision(ready({ validation_error: 'country is required' })).code).toBe('refused');
  });

  it('holds a ladder the engine would not plan (R22 / R23)', () => {
    const d = deliveryDecision({ stage: 'ladder_plan', status: 'completed', payload: { planned: false, refusal: { reason: 'the keyword pool is under 3 keywords' } } });
    expect(d.code).toBe('refused');
    expect(d.reason).toContain('under 3 keywords');
  });

  it('holds a verdict the engine could not check (R18) rather than sending “no demand”', () => {
    const d = deliveryDecision(ready({ verdict: 'NOT_CHECKED' }));
    expect(d.code).toBe('unavailable');
    expect(d.reason).toContain('could not be read');
  });

  it('holds a plan whose feasibility was not checked', () => {
    expect(deliveryDecision({ stage: 'ladder_plan', status: 'completed', payload: { feasibility: { status: 'not_checked' } } }).code).toBe('unavailable');
  });

  it('holds a report built on search results that could not be read', () => {
    expect(deliveryDecision(ready({ serp_features: { unavailable: true, error: 'DataForSEO 40101' } })).code).toBe('unavailable');
  });

  it('holds a description of a homepage that could not be read', () => {
    expect(deliveryDecision({ stage: 'site_description', status: 'completed', payload: { site_read_failed: true } }).code).toBe('unavailable');
  });

  it('holds a “started” acknowledgement, which is not a report — with the status the engine really sends (R110)', () => {
    for (const stage of ['case_study_started', 'ai_visibility_started', 'backlinks_started', 'site_tracker_setup']) {
      const d = deliveryDecision({ stage, status: 'accepted', payload: {} });
      expect(d.code).toBe('interim');
      expect(d.deliver).toBe(false);
    }
  });

  it('delivers a healthy audit, an AI check and a backlink report — monitors arrive as `progress` (R110)', () => {
    expect(deliveryDecision({ stage: 'site_audit', status: 'completed', payload: { health_score: 83 } }).deliver).toBe(true);
    expect(deliveryDecision({ stage: 'ai_visibility', status: 'progress', payload: { metrics: { mention_rate: 0.2 } } }).deliver).toBe(true);
    expect(deliveryDecision({ stage: 'backlinks', status: 'progress', payload: { summary: { backlinks: 12 } } }).deliver).toBe(true);
  });

  it('R110: every weekly / monitor report the engine ends with `progress` is a finished report', () => {
    for (const stage of ['ai_visibility', 'ai_pulse', 'ai_growth', 'backlinks', 'link_builder', 'rank_tracker', 'site_tracker', 'content_cadence', 'site_audit']) {
      const d = deliveryDecision({ stage, status: 'progress', payload: {} });
      expect(d, stage).toEqual({ deliver: true, reason: '', code: null });
    }
  });

  it('R110: a mode’s own final stage with `progress` is finished too', () => {
    for (const stage of [...new Set(Object.values(MODES).flatMap((m) => m.finalStages))].filter((s) => s !== 'site_tracker_setup'))
      expect(deliveryDecision({ stage, status: 'progress', payload: {} }).deliver, stage).toBe(true);
  });

  it('R110: still refuses failed, rejected, accepted and unknown statuses — and `progress` on a stage that is not a report', () => {
    expect(deliveryDecision({ stage: 'content', status: 'failed', payload: {} }).code).toBe('rejected');
    expect(deliveryDecision({ stage: 'site_tracker', status: 'failed', payload: {} }).code).toBe('rejected');
    expect(deliveryDecision({ stage: 'site_tracker', status: 'rejected', payload: { error: 'busy' } }).code).toBe('rejected');
    expect(deliveryDecision({ stage: 'site_tracker', status: 'weird', payload: {} }).code).toBe('rejected');
    expect(deliveryDecision({ stage: 'content', status: 'accepted', payload: {} }).code).toBe('rejected');
    expect(deliveryDecision({ stage: 'some_new_stage', status: 'progress', payload: {} }).code).toBe('rejected');
  });

  it('R110: a monitor report that arrives as `progress` still passes through the readiness rules after the status', () => {
    expect(deliveryDecision({ stage: 'content', status: 'progress', payload: { qa_not_ready: true } }).code).toBe('not_ready');
  });

  it('R110: a shared weekly site report carries no caveat; a started note reads as started, not as “no report”', () => {
    expect(shareCaveat(deliveryDecision({ stage: 'site_tracker', status: 'progress', payload: {} }))).toBeNull();
    expect(shareCaveat(deliveryDecision({ stage: 'backlinks_started', status: 'accepted', payload: {} }))?.code).toBe('interim');
  });
});

describe('deliveryDecisionFor — the customer’s own settings, on top of the readiness rule', () => {
  const on = settings({ frequency: 'each', email: { enabled: true, recipients: ['a@example.com'], attachFiles: true } });

  it('holds everything while delivery is off', () => {
    expect(deliveryDecisionFor(ready(), settings()).code).toBe('delivery_off');
  });

  it('holds when no channel is switched on', () => {
    expect(deliveryDecisionFor(ready(), settings({ frequency: 'each' })).code).toBe('no_channel');
  });

  it('holds a stage the company did not choose', () => {
    const d = deliveryDecisionFor({ stage: 'ai_pulse', status: 'progress', payload: {} }, settings({ ...on, stages: ['site_tracker'] }));
    expect(d.code).toBe('stage_not_chosen');
  });

  it('sends a stage the company did choose', () => {
    expect(deliveryDecisionFor({ stage: 'site_tracker', status: 'progress', payload: {} }, settings({ ...on, stages: ['site_tracker'] })).deliver).toBe(true);
  });

  it('still refuses a not-ready report even when every setting says send it', () => {
    expect(deliveryDecisionFor(ready({ qa_not_ready: true }), on).code).toBe('not_ready');
  });
});

describe('settings', () => {
  it('fills every field from the defaults', () => {
    const v = deliverySettingsSchema.parse({});
    expect(v.frequency).toBe('off');
    expect(v.email.recipients).toEqual([]);
    expect(v.shareLinks).toBe(true);
  });

  it('refuses a webhook that is not https', () => {
    expect(deliverySettingsSchema.safeParse({ webhook: { enabled: true, url: 'http://example.com/hook' } }).success).toBe(false);
    expect(deliverySettingsSchema.safeParse({ webhook: { enabled: true, url: 'https://example.com/hook' } }).success).toBe(true);
    // a developer pointing at their own machine is allowed
    expect(deliverySettingsSchema.safeParse({ webhook: { enabled: true, url: 'http://localhost:4000/hook' } }).success).toBe(true);
  });

  it('refuses an address inside our own network, so delivery cannot be used to fetch it', () => {
    for (const url of [
      'https://169.254.169.254/latest/meta-data/',
      'https://10.0.0.5/admin',
      'https://192.168.1.1/',
      'https://172.16.0.9/x',
      'https://127.0.0.1/x',
      'https://[::1]/x',
      'https://postgres.internal/hook',
      'https://db.local/hook',
    ])
      expect(webhookUrlOk(url), url).toBe(false);
  });

  it('accepts the addresses a customer would actually use', () => {
    for (const url of ['https://hooks.slack.com/services/T000/B000/xxx', 'https://example.webhook.office.com/webhookb2/abc', 'https://ops.example.com:8443/seo', 'https://discord.com/api/webhooks/1/x'])
      expect(webhookUrlOk(url), url).toBe(true);
  });

  it('refuses something that is not a URL at all', () => {
    for (const url of ['', 'example.com/hook', 'javascript:alert(1)', 'ftp://example.com/x', 'https://']) expect(webhookUrlOk(url), url).toBe(false);
  });

  it('lets a webhook be stored while it is switched off', () => {
    expect(deliverySettingsSchema.safeParse({ webhook: { enabled: false, url: '' } }).success).toBe(true);
  });

  it('refuses an address that is not one, and drops duplicates', () => {
    expect(deliverySettingsSchema.safeParse({ email: { enabled: true, recipients: ['not-an-address'] } }).success).toBe(false);
    const v = deliverySettingsSchema.parse({ email: { enabled: true, recipients: ['A@Example.com', 'a@example.com'] } });
    expect(v.email.recipients).toEqual(['a@example.com']);
  });

  it('caps the recipient list', () => {
    const many = Array.from({ length: DELIVERY.maxRecipients + 1 }, (_, i) => `p${i}@example.com`);
    expect(deliverySettingsSchema.safeParse({ email: { enabled: true, recipients: many } }).success).toBe(false);
  });

  it('knows when nothing would be sent', () => {
    expect(deliveryOn(settings())).toBe(false);
    expect(deliveryOn(settings({ frequency: 'weekly' }))).toBe(false);
    expect(deliveryOn(settings({ frequency: 'weekly', email: { enabled: true, recipients: [], attachFiles: true } }))).toBe(true);
  });
});

describe('when the next summary is due', () => {
  const from = new Date('2026-10-15T09:30:00Z');   // a Thursday

  it('has no due time when it is off or sent per report', () => {
    expect(nextDeliveryAt(settings({ frequency: 'off' }), from)).toBeNull();
    expect(nextDeliveryAt(settings({ frequency: 'each' }), from)).toBeNull();
  });

  it('daily: later today, or tomorrow once the hour has passed', () => {
    expect(nextDeliveryAt(settings({ frequency: 'daily', hour: 18 }), from)!.toISOString()).toBe('2026-10-15T18:00:00.000Z');
    expect(nextDeliveryAt(settings({ frequency: 'daily', hour: 8 }), from)!.toISOString()).toBe('2026-10-16T08:00:00.000Z');
  });

  it('weekly: the next chosen weekday, counting Monday as 0', () => {
    expect(nextDeliveryAt(settings({ frequency: 'weekly', weekday: 0, hour: 8 }), from)!.toISOString()).toBe('2026-10-19T08:00:00.000Z');
    // today is Thursday (3): an hour still ahead stays today
    expect(nextDeliveryAt(settings({ frequency: 'weekly', weekday: 3, hour: 18 }), from)!.toISOString()).toBe('2026-10-15T18:00:00.000Z');
    // and an hour already gone moves a whole week
    expect(nextDeliveryAt(settings({ frequency: 'weekly', weekday: 3, hour: 8 }), from)!.toISOString()).toBe('2026-10-22T08:00:00.000Z');
  });

  it('monthly: this month if the day is still ahead, otherwise next month', () => {
    expect(nextDeliveryAt(settings({ frequency: 'monthly', dayOfMonth: 20, hour: 8 }), from)!.toISOString()).toBe('2026-10-20T08:00:00.000Z');
    expect(nextDeliveryAt(settings({ frequency: 'monthly', dayOfMonth: 1, hour: 8 }), from)!.toISOString()).toBe('2026-11-01T08:00:00.000Z');
  });

  it('reads back in plain words', () => {
    expect(deliveryScheduleLabel(settings({ frequency: 'weekly', weekday: 0, hour: 8 }))).toBe('Every Monday at 08:00 UTC');
    expect(deliveryScheduleLabel(settings({ frequency: 'off' }))).toBe('Reports stay in the app');
  });
});

describe('what is sent', () => {
  const item = (over: Partial<DeliveryItem> = {}): DeliveryItem => ({
    reportId: 'r1',
    stage: 'site_tracker',
    stageLabel: 'Weekly tracking report',
    title: 'Weekly tracking report · techand.ai',
    siteDomain: 'techand.ai',
    receivedAt: '2026-10-15T08:00:00.000Z',
    scheduled: true,
    figures: { clicks: 34, impressions: 5282, clicksPct: 79.4, actions: 3 },
    url: 'https://app.example.com/o/o1/reports/r1',
    shareUrl: 'https://app.example.com/share/tok',
    files: [{ id: 'f1', kind: 'pdf', fileName: 'report.pdf', size: 120_000 }],
    ...over,
  });
  const payload = (over: Partial<DeliveryPayload> = {}): DeliveryPayload => ({
    company: 'Techand',
    kind: 'each',
    generatedAt: '2026-10-15T08:00:00.000Z',
    reports: [item()],
    held: [],
    ...over,
  });

  it('names one report in the subject and counts several', () => {
    expect(deliverySubject(payload())).toBe('Weekly tracking report · techand.ai — techand.ai');
    expect(deliverySubject(payload({ kind: 'weekly', reports: [item(), item({ reportId: 'r2' })] }))).toBe('This week: 2 SEO reports for techand.ai');
  });

  it('carries the figures and both links in the body', () => {
    const lines = deliveryLines(payload()).join('\n');
    expect(lines).toContain('Clicks: 34');
    expect(lines).toContain('Impressions: 5282');
    expect(lines).toContain('https://app.example.com/o/o1/reports/r1');
    expect(lines).toContain('https://app.example.com/share/tok');
  });

  it('states what was held, instead of leaving it out', () => {
    const lines = deliveryLines(payload({ held: [{ reportId: 'r9', title: 'Page: erp software uae', reason: 'The page did not pass the quality check.', code: 'not_ready' }] }));
    expect(lines.join('\n')).toContain('Not sent — Page: erp software uae: The page did not pass the quality check.');
  });

  it('builds a webhook body a chat app can render and a system can read', () => {
    const body = deliveryWebhookBody(payload()) as { text: string; event: string; reports: { id: string; share_url: string }[] };
    expect(typeof body.text).toBe('string');
    expect(body.text).toContain('Weekly tracking report');
    expect(body.event).toBe('reports.delivered');
    expect(body.reports[0]!.id).toBe('r1');
    expect(body.reports[0]!.share_url).toBe('https://app.example.com/share/tok');
  });

  it('never puts more than a readable number of figures in one card', () => {
    const many = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`k${i}`, i]));
    expect(figureLines(item({ figures: many }))).toHaveLength(12);
  });

  it('leaves out figures with no value', () => {
    expect(figureLines(item({ figures: { clicks: 0, grade: null, verdict: '' } })).map((f) => f.label)).toEqual(['Clicks']);
  });

  it('names engine fields in the customer’s words and falls back readably', () => {
    expect(figureLabel('mentionRate')).toBe('AI mention rate');
    expect(figureLabel('somethingNew')).toBe('Something New');
  });
});

describe('the mode list and the delivery rules stay in step', () => {
  // `site_tracker_setup` is the one final stage that is an acknowledgement rather than a report: it ends the "Track my site" run and
  // says the first weekly report is coming. It is held as interim on purpose, and the next test is where that is stated.
  const ACKNOWLEDGEMENTS = new Set(['site_tracker_setup']);

  it('every final stage of every mode is delivered, bar the one acknowledgement', () => {
    for (const mode of Object.values(MODES))
      for (const stage of mode.finalStages) {
        if (ACKNOWLEDGEMENTS.has(stage)) continue;
        expect(deliveryDecision({ stage, status: 'completed', payload: {} }).deliver, stage).toBe(true);
      }
  });

  it('every “started” stage, and the tracking acknowledgement, is held as interim', () => {
    const stages = [...new Set([...Object.values(MODES).flatMap((m) => m.startStages ?? []), ...ACKNOWLEDGEMENTS])];
    expect(stages.length).toBeGreaterThan(2);
    for (const stage of stages) expect(deliveryDecision({ stage, status: 'completed', payload: {} }).code, stage).toBe('interim');
  });
});

describe('R113 — the weekly site report headline follows its own significance test', () => {
  // exec 634: clicks 21 → 32 is "up 52%" in arithmetic and "not a real change" in the test printed under it
  const SIG = {
    clicks: { pct: 52, real: false, significant: false, watch: true },
    impressions: { pct: 224, real: true, significant: true },
    sessions: { pct: 83, real: true, significant: true },
  };

  it('no "up 52%" for a change the test calls not real; the real change leads', () => {
    const h = clicksHeadline(32, 52, SIG);
    expect(h).not.toMatch(/up 52%/);
    expect(h).toBe('Impressions in Google up 224% — a real change · 32 clicks from Google, within normal variation');
  });

  it('with no real change anywhere, the clicks read "within normal variation"', () => {
    expect(clicksHeadline(32, 52, { clicks: SIG.clicks })).toBe('32 clicks from Google, within normal variation');
  });

  it('a real clicks change and a report without the test (Search Console off, older runs) keep today’s headline', () => {
    expect(clicksHeadline(32, 52, { ...SIG, clicks: { pct: 52, real: true } })).toBe('Clicks from Google are up 52% to 32');
    expect(clicksHeadline(32, 52)).toBe('Clicks from Google are up 52% to 32');
    expect(clicksHeadline(null, null)).toBe('Weekly site report');
  });
});
