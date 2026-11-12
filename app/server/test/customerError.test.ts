import { describe, expect, it } from 'vitest';
import { CAPACITY_ERROR, customerError, ENGINE_NO_RESULT_ERROR, ENGINE_STOPPED_ERROR, isTechnicalError } from '../src/lib/customerError';
import { ENGINE_LOST_ERROR, ENGINE_NO_WORK_RETRIED, ENGINE_RESTART_ERROR, ENGINE_RESTART_RETRIED } from '../src/services/engineFailures';
import { failedRuns } from '../src/services/pipeline';
import { STALE_RUN_ERROR } from '../src/services/runs';

// S2-08 (prod review 2026-11-12): what a client reads when a run failed. The failure watcher's text names a node, the raw model or n8n
// error, the execution id and an instruction for our operator; a client reads one plain sentence (not charged, what to do).

const RAW_NODE = 'The SEO engine stopped with an error in "Parser — Strategy Brief": Model output doesn\'t fit required format (n8n execution 13196). Start it again; if it repeats, the operator can open that execution in n8n.';

describe('a run error as a client reads it', () => {
  it('a node error, a raw model error, our workflow tool and an instruction for the operator become one plain sentence', () => {
    for (const raw of [RAW_NODE, 'The SEO engine stopped with an error (n8n execution 6569). Start it again; if it repeats, the operator can open that execution in n8n.', 'TypeError: Cannot read properties of undefined (reading \'json\')', 'connect ECONNREFUSED 10.0.0.4:5678']) {
      const out = customerError(raw)!;
      expect(out).toBe(ENGINE_STOPPED_ERROR);
      expect(out).not.toMatch(/n8n|execution|operator|parser|node/i);
    }
    expect(ENGINE_STOPPED_ERROR).toMatch(/No credits are charged/);
  });

  it('the expiry sentence that pointed at n8n reads plainly', () => {
    expect(customerError(STALE_RUN_ERROR)).toBe(ENGINE_NO_RESULT_ERROR);
    expect(ENGINE_NO_RESULT_ERROR).not.toMatch(/n8n/i);
  });

  it('the watcher\'s plain sentences keep their words; only the execution id after them goes', () => {
    expect(customerError(`${ENGINE_RESTART_ERROR} (n8n execution 6569, crashed)`)).toBe(ENGINE_RESTART_ERROR);
    expect(customerError(`${ENGINE_RESTART_RETRIED} (n8n execution 6569, crashed)`)).toBe(ENGINE_RESTART_RETRIED);
    expect(customerError(`${ENGINE_NO_WORK_RETRIED} (n8n execution 12, missing)`)).toBe(ENGINE_NO_WORK_RETRIED);
    expect(customerError(`${ENGINE_LOST_ERROR} (n8n execution 9, success)`)).toBe(ENGINE_LOST_ERROR);
  });

  it('a plain engine refusal is unchanged; a provider or dollar figure still reads as capacity', () => {
    expect(customerError('The site could not be crawled (403).')).toBe('The site could not be crawled (403).');
    expect(customerError('This keyword is a competitor\'s brand name, so no page is written for it.')).toBe('This keyword is a competitor\'s brand name, so no page is written for it.');
    expect(customerError('AI budget of $15 per day reached')).toBe(CAPACITY_ERROR);
    expect(customerError(null)).toBeNull();
    expect(isTechnicalError(RAW_NODE)).toBe(true);
    expect(isTechnicalError('The site could not be crawled (403).')).toBe(false);
  });

  it('the Pipeline\'s "did not finish" item shows the plain sentence, never the raw text', () => {
    const items = failedRuns([{ id: 'r1', mode: 'keyword', keyword: 'crm uae', title: 'Page: crm uae', status: 'failed', createdAt: new Date().toISOString(), error: RAW_NODE } as never]);
    expect(items).toHaveLength(1);
    expect(items[0]!.detail).toBe(ENGINE_STOPPED_ERROR);
  });
});
