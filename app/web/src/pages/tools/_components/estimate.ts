import { estimateRunCost, estimateRunMinutes, type ModeId } from '@seo/shared';
import { engineCal } from '../../../lib/engine-cal';
import { quoteLabel } from '../../../lib/credits';

// The shared estimate (@seo/shared estimate.ts) the server's budget check uses, so the form shows the same amount.

type V = Record<string, unknown>;

export const estimateCost = (mode: ModeId, v: V): number => estimateRunCost(mode, v, engineCal());   // R100: the engine's calibrated figure, as the budget check
export const estimateEta = (mode: ModeId, v: V): number => estimateRunMinutes(mode, v);

// credits (app/docs/CREDITS.md): the quote the run is held at and never charged above
export const costLabel = (usd: number) => (usd <= 0 ? 'Free' : quoteLabel(usd));
export const etaLabel = (min: number) => (min <= 1 ? 'about a minute' : min >= 60 ? `about ${Math.round(min / 60)} h` : `about ${min} min`);
