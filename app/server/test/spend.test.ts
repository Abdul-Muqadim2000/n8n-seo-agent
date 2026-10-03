import { describe, expect, it } from 'vitest';
import { schema } from '../src/db';
import { HttpError } from '../src/lib/errors';
import { checkRefusal } from '../src/services/keywordCheckStore';
import { assertBudget, budgetRefusal, orgSpendSince } from '../src/services/spend';

// The company's spend counts its runs and its keyword checks: the same locked budget check refuses a run or a check that would go
// over the monthly budget (402), and the platform's daily ceiling (429). A fake query object stands in for the database: it answers
// each `select … from <table>` with that table's total, so the test sees which tables are summed.

function fakeDb(totals: { runs: number; checks: number }) {
  const from: string[] = [];
  const q = {
    select: () => ({
      from: (t: unknown) => {
        const name = t === schema.runs ? 'runs' : t === schema.keywordChecks ? 'keyword_checks' : 'other';
        from.push(name);
        return { where: async () => [{ total: name === 'runs' ? totals.runs : name === 'keyword_checks' ? totals.checks : 0 }] };
      },
    }),
  };
  return { q: q as never, from };
}

const org = (budget: number) => ({ id: 'org-1', monthlyBudgetUsd: budget }) as never;

describe('spend: runs and keyword checks', () => {
  it('the month sums both tables', async () => {
    const f = fakeDb({ runs: 12.4, checks: 0.35 });
    expect(await orgSpendSince(f.q, 'org-1')).toEqual({ runs: 12.4, checks: 0.35, total: 12.75 });
    expect(f.from).toEqual(['runs', 'keyword_checks']);
  });

  it('a run is refused when the keyword checks tip the month over the budget (402)', async () => {
    // $23.10 of runs + $0.15 of checks + a $1.80 ladder > $25; without the checks it would pass
    await expect(assertBudget(fakeDb({ runs: 23.1, checks: 0.15 }).q, org(25), 1.8, 'This run')).rejects.toMatchObject({ statusCode: 402, code: 'budget' });
    await expect(assertBudget(fakeDb({ runs: 23.1, checks: 0 }).q, org(25), 1.8, 'This run')).resolves.toBeUndefined();
  });

  it('a keyword check is refused at the budget too; free things never are', async () => {
    await expect(assertBudget(fakeDb({ runs: 24.9, checks: 0.06 }).q, org(25), 0.05, 'This keyword check')).rejects.toBeInstanceOf(HttpError);
    await expect(assertBudget(fakeDb({ runs: 99, checks: 99 }).q, org(25), 0, 'This run')).resolves.toBeUndefined();
  });

  it('budgetRefusal: 402 over the company budget, 429 over the platform’s day, else null', () => {
    const base = { what: 'This run', estimated: 1.8, spent: 10, budget: 25, platformToday: 5, platformDaily: 40 };
    expect(budgetRefusal(base)).toBeNull();
    expect(budgetRefusal({ ...base, spent: 23.5 })?.statusCode).toBe(402);
    expect(budgetRefusal({ ...base, spent: 23.5 })?.message).toMatch(/^This run \(about \$1\.80\) would go over your company's monthly budget \(\$23\.50 of \$25\.00 used\)/);
    expect(budgetRefusal({ ...base, platformToday: 39 })?.statusCode).toBe(429);
    expect(budgetRefusal({ ...base, estimated: 0, spent: 99 })).toBeNull();
  });
});

describe('keyword check: limits', () => {
  const base = { keyword: 'erp dubai', running: false, today: 0, spent: 0, budget: 25, platformToday: 0, platformDaily: 40 };
  it('the same keyword being checked (409), 30 a day (429), the budget with the $0.05 estimate (402)', () => {
    expect(checkRefusal(base)).toBeNull();
    expect(checkRefusal({ ...base, running: true })?.statusCode).toBe(409);
    expect(checkRefusal({ ...base, today: 29 })).toBeNull();
    expect(checkRefusal({ ...base, today: 30 })?.code).toBe('check_limit');
    expect(checkRefusal({ ...base, spent: 24.96 })?.statusCode).toBe(402);
    expect(checkRefusal({ ...base, spent: 24.9 })).toBeNull();
    expect(checkRefusal({ ...base, platformToday: 39.99 })?.code).toBe('platform_capacity');
  });
});
