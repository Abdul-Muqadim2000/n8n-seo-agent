import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { aiAnswerDetail, monitorSettingsSchema, parseAiImpact, parseAiSentiment, parseAiShopping, parseAiSov, type AiData } from '@seo/shared';
import type { ReactNode } from 'react';
import { RunStatusBadge } from '@/components/ui/badge';
import { TooltipProvider } from '@/components/ui/overlay';
import { aiPanelCostWith, completeMonitors } from '@/components/site/MonitorSettingsFields';
import { AnswerDetailCard } from '@/pages/site/_components/ai-answers';
import { breakMarks } from '@/pages/site/_components/ai-trends';
import { CompetitorsPanel, ImpactPanel, PersonaEffectPanel, SentimentPanel2, ShoppingPanel } from '@/pages/site/_components/ai-panels2';
import { ruleRunsOf } from '@/pages/site/_components/ai-rules';

// W2-A (2026-10-23, WAVE2_CONTRACTS.md): the web halves of the AI page's wave 2: the answer drill-down card, the new panels (each
// honest about n, ranges and withheld figures), the break markers, the open-run badge, the settings that are sent only when set.

const tip = (n: ReactNode) => <TooltipProvider>{n}</TooltipProvider>;
const text = (html: string) => html.replace(/<!-- -->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');

const answer = (over: Partial<AiData['answers'][number]> = {}): AiData['answers'][number] => ({
  promptId: 'q1', prompt: 'Which ERP partner fits a retailer in Dubai?', kind: 'custom', topic: 'erp', engine: 'chatgpt', answered: true, mentioned: true, cited: true, rank: 2, ourUrls: [], competitors: ['Acme'], sources: ['g2.com'], excerpt: 'short excerpt',
  error: '', checkedAt: '2026-10-19T07:00:00.000Z', runKind: 'weekly', sentiment: 'positive', brands: [], issues: [], fanout: [], citedUrls: [], position: 2, ...over,
});

describe('the answer drill-down card', () => {
  it('shows the whole answer, the brands in the order named with their role, every citation with ours marked, retrieved pages, searches, products, model', () => {
    const detail = aiAnswerDetail({
      answer_text: 'Acme leads, then Techand. ' + 'More text. '.repeat(10),
      cited_json: JSON.stringify([{ url: 'https://techand.ai/erp', position: 1 }, { url: 'https://acme.com/x', position: 2 }]),
      retrieved_json: JSON.stringify([{ url: 'https://globex.com/y' }]),
      fanout_json: JSON.stringify(['erp partner dubai']),
      products_json: JSON.stringify([{ title: 'ERP Pro', merchant: 'Acme', price: 99, currency: 'USD', url: 'https://acme.com/p', position: 1 }]),
      model: 'gpt-5',
    }, 'techand.ai');
    const html = text(renderToString(<AnswerDetailCard a={answer({ detail, entities: [{ id: 'acme', name: 'Acme', role: 'competitor', position: 1, cited: true }, { id: 'self', name: 'Techand', role: 'self', position: 2, cited: true }] })} engineName="ChatGPT" domain="techand.ai" />));
    expect(html).toContain('gpt-5');
    expect(html).toContain('Cited · named #2');
    expect(html).toMatch(/1\. Acme Competitor 2\. Techand You/);
    expect(html).toContain('Yours: /erp');
    expect(html).toContain('acme.com/x');
    expect(html).toContain('Read but not cited');
    expect(html).toContain('erp partner dubai');
    expect(html).toContain('ERP Pro · Acme · 99 USD');
    expect(html).toContain('The whole answer');
  });
  it('an older answer: the excerpt, said to be one; no empty wave-2 blocks', () => {
    const html = text(renderToString(<AnswerDetailCard a={answer({ mentioned: false, cited: false, position: null })} engineName="Gemini" domain="techand.ai" />));
    expect(html).toContain('Not named');
    expect(html).toContain('this run did not store the whole answer');
    expect(html).not.toContain('Read but not cited');
    expect(html).not.toContain('Product cards');
  });
});

describe('the new panels', () => {
  it('competitors: both denominators and the named-of-branded rate', () => {
    const sov = parseAiSov({ set: ['acme'], others_share: 20, by_entity: [{ id: 'acme', name: 'acme.com', share: 50, n: 40, avg_position: 1.4 }], denominators: { all_answers: 200, answers_naming_any_brand: 120 }, named_of_branded_rate: 25 })!;
    const html = text(renderToString(tip(<CompetitorsPanel sov={sov} domain="techand.ai" ownShare={30} />)));
    expect(html).toContain('All answers counted 200');
    expect(html).toContain('Answers that named any brand 120');
    expect(html).toContain('avg place 1.4');
    expect(html).toContain('Every other brand');
  });
  it('sentiment under 12 answers is withheld, with the count', () => {
    const html = text(renderToString(tip(<SentimentPanel2 sentiment={parseAiSentiment({ net: 50, n: 7 })!} />)));
    expect(html).toContain('Withheld: 7 answers name you');
    expect(html).not.toMatch(/Net sentiment \+?50/);
  });
  it('impact: verdicts in words, control and interval, never "caused"', () => {
    const html = text(renderToString(tip(<ImpactPanel impact={parseAiImpact([{ action_id: 'a1', kind: 'answer page', target_questions: ['q1'], control_questions: ['q2', 'q3'], before: { rate: 5, n: 40 }, after: { rate: 15, n: 40 }, did: { effect: 9, lo: 2, hi: 16 }, verdict: 'likely helped', window_days: 28 }])!} questionText={() => 'Which ERP partner?'} />)));
    expect(html).toContain('Likely helped');
    expect(html).toContain('against 2 control questions');
    expect(html).toContain('95% interval 2.0 to 16.0');
    expect(html.toLowerCase()).not.toMatch(/\bcaused\b(?! the change)/);
  });
  it('shopping with no product cards says so instead of 0%', () => {
    const html = text(renderToString(tip(<ShoppingPanel shopping={parseAiShopping({ answers_n: 40, products_n: 0 })!} />)));
    expect(html).toContain('No shopping results were shown');
    expect(html).not.toContain('0%');
  });
  it('the persona effect is labelled as API answers and a null effect is said in words', () => {
    const html = text(renderToString(tip(<PersonaEffectPanel effect={[{ role: 'CFO', withRate: 10, withN: 30, withoutRate: 9, withoutN: 30, delta: 1, lo: -4, hi: 6, significant: false }]} />)));
    expect(html).toContain('API answers');
    expect(html).toContain('no measurable difference');
  });
});

describe('trends, rules, the open run, settings', () => {
  it('a break marker per run that was not compared, with the reason', () => {
    expect(breakMarks([{ at: '2026-10-19T07:00:00Z', reason: 'a different panel' }])[0]).toMatchObject({ kind: 'data_break', date: '2026-10-19', detail: 'a different panel', tone: 'warning' });
  });
  it('the rule preview reads every run\'s engine rates and share of voice', () => {
    const runs = ruleRunsOf({ runs: [{ runId: 'a', checkedAt: 'x', compare: null, samples: 40, engineRates: [{ key: 'chatgpt', name: 'ChatGPT', mentionRate: 10, citationRate: 0, samples: 20, ci: null, carried: false }], sov: { basis: 'all', brands: [{ id: 'acme.com', name: 'acme.com', share: 30, n: 5 }] } }] } as unknown as AiData);
    expect(runs[0].engines?.[0]).toEqual({ key: 'chatgpt', mentionRate: 10, citationRate: 0, samples: 20 });
    expect(runs[0].sov?.[0].id).toBe('acme.com');
  });
  it('a start joined to the open run reads "Part of the open run", not "Failed"', () => {
    expect(text(renderToString(<RunStatusBadge status="failed" lastStage="joined_open_run" />))).toContain('Part of the open run');
    expect(text(renderToString(<RunStatusBadge status="failed" />))).toContain('Failed');
  });
  it('the wave-2 settings stay absent until set, and the cost reads them through the one formula', () => {
    const m = completeMonitors(monitorSettingsSchema.parse({}));
    expect(m).not.toHaveProperty('aiClaudeWeekly');
    expect(completeMonitors({ ...m, aiFanoutCheck: 50 }).aiFanoutCheck).toBe(50);
    expect(aiPanelCostWith(m).month.total).toBeGreaterThan(0);
  });
});
