import { parseCalibration, type CostTableInfo, type EngineCalibration } from '@seo/shared';
import { rows } from '../n8n/client';

// R100: the app's pre-run price and its budget check used to be the engine's *shipped defaults*. The engine does not reserve those:
// it reserves a rolling figure per mode (mean x 1.25, never below what the mode recently cost) read from its `seo_cache` rows of kind
// `cost` (`v5/code/_cost_cal.js` `estOf`). A written page was shown at about $0.84 while the engine held $1.40 for it.
//
// So the app reads those same rows through the n8n public Data Table API it already uses for the dashboards and applies the same
// formula (`estOf` in shared/src/cost.ts). One formula, the engine's own inputs. Cached for five minutes — the figures move by one
// settle at a time. When n8n cannot be read the last good reading is used, and when there never was one the shipped table, and the
// result says which it is (`source`), so a figure on screen is never presented as the engine's when it is the table's.

const TTL_MS = 5 * 60_000;
const READ_TIMEOUT_MS = 6000;

type Row = { key?: unknown; value?: unknown };
let last: { at: number; info: CostTableInfo } | null = null;
let inflight: Promise<CostTableInfo> | null = null;

const EMPTY: EngineCalibration = { ai: {}, dfs: {} };

const shipped = (why: string): CostTableInfo => ({
  source: 'table',
  asOf: null,
  basis: `The engine’s figures could not be read (${why}), so these are the shipped estimates for each kind of run.`,
  calibration: EMPTY,
});

async function read(): Promise<CostTableInfo> {
  const got = await Promise.race([
    rows<Row>('cache', { filters: [{ columnName: 'kind', condition: 'eq', value: 'cost' }], max: 500, fresh: true }),
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timed out')), READ_TIMEOUT_MS).unref?.()),
  ]);
  const calibration = parseCalibration(got);
  const n = Object.keys(calibration.ai).length + Object.keys(calibration.dfs).length;
  const at = new Date().toISOString();
  return n > 0
    ? { source: 'engine', asOf: at, basis: 'What the engine will reserve for this run, from what runs of each kind have recently cost.', calibration }
    : // n8n answered but holds no figures yet (a fresh engine): the shipped estimates are exactly what it would reserve
      { source: 'engine', asOf: at, basis: 'What the engine will reserve for this run (no run of these kinds has settled yet, so its shipped estimates apply).', calibration };
}

/** The engine's current cost figures, or — labelled as such — the shipped table. Never throws. */
export async function engineCostTable(opts: { fresh?: boolean } = {}): Promise<CostTableInfo> {
  if (!opts.fresh && last && Date.now() - last.at < TTL_MS) return last.info;
  if (!inflight)
    inflight = read()
      .then((info) => {
        last = { at: Date.now(), info };
        return info;
      })
      .catch((err: unknown) => {
        const why = String((err as Error)?.message ?? err).slice(0, 80);
        // keep serving the last good reading rather than dropping to the table on a blip, and say how old it is
        if (last) {
          const stale = { ...last.info, basis: `${last.info.basis} (the engine could not be re-read just now: ${why}; this is the reading from ${last.info.asOf})` };
          last = { at: Date.now() - TTL_MS + 30_000, info: stale }; // try again in 30 s, not on every request
          return stale;
        }
        return shipped(why);
      })
      .finally(() => {
        inflight = null;
      });
  return inflight;
}

/** Test hook: forget the cached reading. */
export function resetEngineCostTable(): void {
  last = null;
  inflight = null;
}
