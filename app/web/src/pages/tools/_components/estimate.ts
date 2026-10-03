import { estimateRunCost, estimateRunMinutes, type ModeId } from '@seo/shared';

// The shared estimate (@seo/shared estimate.ts) the server's budget check uses, so the form shows the same amount.

type V = Record<string, unknown>;

export const estimateCost = (mode: ModeId, v: V): number => estimateRunCost(mode, v);
export const estimateEta = (mode: ModeId, v: V): number => estimateRunMinutes(mode, v);

export const costLabel = (usd: number) => (usd <= 0 ? 'Free' : `about $${usd.toFixed(2)}`);
export const etaLabel = (min: number) => (min <= 1 ? 'about a minute' : min >= 60 ? `about ${Math.round(min / 60)} h` : `about ${min} min`);
