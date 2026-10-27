// The engine's keyword fit gate (n8n/seo-agent/v5/code/_fit_gate.js), the same code: the app's mirror of the Content Cadence
// (server/src/services/cadence.ts) refuses exactly the keywords the engine refuses: the website's own brand, another company's brand or
// product, a public body or an identity document, a login / portal / status task, a job or course search, and, with the website's topics on
// file, a keyword that is off topic or too broad.
//
// KW-PARITY (2026-10-21): this file used to be a hand-written port, and it fell behind the kit the day the kit was redesigned (KW-GATE). The
// code now lives in ONE place: n8n/seo-agent/build_v4.py writes the kit unchanged to fit-gate.generated.js (+ .d.ts); this module only
// re-exports it with types. fit-gate.parity.test.ts evaluates the kit straight from the engine folder and fails when the generated file is
// stale or decides any case of the labelled set (n8n/seo-agent/harness/accuracy/keywords.json) differently.
//
// fitGate(keyword, ctx) -> { ok: true } or { ok: false, reason, detail }; fitTopic(keyword, topics, ctx) -> the topic share;
// fitEvidence(keyword, topics, ctx) -> positive topic evidence; fitStored(row, ctx) -> the same gate for a stored row (a written page is
// kept and only flagged); FITR -> the read-path loop over stored rows.

export {
  fitGate,
  fitTopic,
  fitEvidence,
  fitStored,
  fitStoredLive,
  fitTokens,
  fitHost,
  fitLabels,
  fitOwnLabels,
  fitLearnedBrands,
  fitBrandList,
  FITR,
  FIT_PLACES,
  fitPlaces,
  fitMarket,
  fitDropPlaces,
  fitArabic,
  FIT_FAMILIES,
} from './fit-gate.generated.js';

export type {
  FitReason,
  FitResult,
  FitContext,
  FitCareerInput,
  TopicResult,
  TopicEvidence,
  StoredFit,
  FitSetAside,
  FitPlace,
  FitMarketResult,
} from './fit-gate.generated.js';
