// AI visibility wave 2 (W2-A, 2026-10-23): the CSV downloads of the AI visibility page (answers, questions, sources, competitors, our
// pages; built on the server, company-scoped and streamed) and the question import's optional keyword column (WAVE2_CONTRACTS.md §6).

import { csvCell } from './identity';
import { parseCsv } from './link-import';
import { parseAiPanelCsv, type AiPanelCsvResult } from './ai-panel';

export const AI_EXPORT_KINDS = ['answers', 'questions', 'sources', 'competitors', 'pages'] as const;
export type AiExportKind = (typeof AI_EXPORT_KINDS)[number];
export const AI_EXPORT_LABEL: Record<AiExportKind, string> = {
  answers: 'Answers (latest run)',
  questions: 'Question panel',
  sources: 'Sources cited',
  competitors: 'Competitors over time',
  pages: 'Your pages',
};
/** The column names of each download, in order (rates are percent 0-100, every rate beside its n). */
export const AI_EXPORT_COLUMNS: Record<AiExportKind, readonly string[]> = {
  answers: ['run_id', 'checked_at', 'run_kind', 'prompt_id', 'question', 'topic', 'buyer_role', 'market', 'stage', 'engine', 'model', 'answered', 'named', 'position', 'cited', 'our_urls', 'brands_in_order', 'citations_in_order', 'retrieved_not_cited', 'fanout_queries', 'sentiment', 'wrong_claims', 'answer_text', 'answer_cut', 'error'],
  questions: ['prompt_id', 'question', 'keyword', 'topic', 'buyer_role', 'market', 'stage', 'status', 'pinned', 'asked_next_run', 'source', 'ai_searches_month', 'last_asked_at', 'asked_28d', 'fit_note', 'created_at'],
  sources: ['domain', 'type', 'citations', 'share_pct', 'engines', 'questions_about', 'first_seen', 'last_seen', 'half_life_days', 'run_checked_at'],
  competitors: ['run_id', 'checked_at', 'basis', 'brand', 'share_pct', 'mentions', 'comparable_with_previous'],
  pages: ['url', 'cited', 'retrieved', 'cited_rate_pct', 'answers', 'engines', 'questions', 'cited_instead', 'run_checked_at'],
};

/** One CSV line (formula injection neutralised by csvCell) with CRLF, the RFC 4180 line end. */
export const aiCsvLine = (cells: readonly unknown[]): string => cells.map(csvCell).join(',') + '\r\n';
export const aiCsvHeader = (kind: AiExportKind): string => aiCsvLine(AI_EXPORT_COLUMNS[kind]);
export const aiExportFileName = (kind: AiExportKind, domain: string, day = new Date().toISOString().slice(0, 10)): string => `ai-${kind}-${domain.replace(/[^\w.-]+/g, '-')}-${day}.csv`;

/** The panel import with an optional keyword column ("keyword", "search phrase", "target keyword"): the engine stores it as the owner's. */
export type AiPanelCsvRow = AiPanelCsvResult['rows'][number] & { keyword?: string };
export function parseAiPanelCsvWithKeyword(text: string, max = 500): AiPanelCsvResult & { rows: AiPanelCsvRow[]; keywords: number } {
  const base = parseAiPanelCsv(text, max);
  const lines = parseCsv(String(text ?? ''));
  const norm = (h: string) => h.toLowerCase().replace(/[^a-z]+/g, ' ').trim();
  const head = (lines[0] ?? []).map(norm);
  const qi = head.findIndex((h) => ['question', 'prompt', 'questions'].includes(h));
  const ki = head.findIndex((h) => ['keyword', 'search phrase', 'target keyword', 'keyword phrase'].includes(h));
  if (qi < 0 || ki < 0) return { ...base, keywords: 0 };
  const byQ = new Map<string, string>();
  for (const l of lines.slice(1)) {
    const q = String(l[qi] ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
    const k = String(l[ki] ?? '').trim().replace(/\s+/g, ' ').slice(0, 120);
    if (q && k && !byQ.has(q)) byQ.set(q, k);
  }
  let keywords = 0;
  const rows: AiPanelCsvRow[] = base.rows.map((r) => {
    const k = byQ.get(r.prompt.toLowerCase());
    if (!k) return r;
    keywords++;
    return { ...r, keyword: k };
  });
  return { ...base, rows, keywords };
}
