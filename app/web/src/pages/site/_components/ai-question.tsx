// Client report 2026-11-16 (issue 1): every "write a page for this AI question" button on the AI visibility page goes through the shared
// resolver (shared/src/ai-question-action.ts): the question's own search (never the panel topic), a page type the form accepts, the AI target,
// "Improve <page>" when a page of the website owns the search, and no write button for a question whose page is written, being written or live.
import { ArrowRight, ExternalLink as ExternalIcon } from 'lucide-react';
import { aiQuestionAction, aiQuestionInputsOf, type AiData, type AiQuestionAction, type AiQuestionInputs, type AiQuestionRef, type EngineAction } from '@seo/shared';
import { ButtonLink } from '@/components/ui/button';
import { useSitePage } from './kit';

/** What the resolver reads from the AI page's data. */
export function aiInputsOf(d: Pick<AiData, 'prompts' | 'report' | 'growth' | 'pagesWritten'>, market: string): AiQuestionInputs {
  return aiQuestionInputsOf(d, market);
}

/** An engine action that writes a page for an AI question (the AI report's content actions: an API body with the question's AI target). */
export function isAiQuestionAction(a: Pick<EngineAction, 'apiBody' | 'source'>): boolean {
  const b = a.apiBody;
  if (!b || String(b.mode ?? '') !== 'keyword') return false;
  const t = (b.ai_target ?? b.aiTarget) as { question?: unknown } | undefined;
  return !!(t && typeof t === 'object' && String(t.question ?? '').trim());
}

/** The resolver on an engine action (an older report's topic keyword is corrected through the stored question). */
export function resolveAiAction(a: Pick<EngineAction, 'apiBody' | 'source'>, inputs: AiQuestionInputs): AiQuestionAction | null {
  if (!isAiQuestionAction(a)) return null;
  return aiQuestionAction({ apiBody: a.apiBody }, inputs);
}

/** The button (and the sentence) of one resolved question. `primary`: the first item of a list. */
export function AiQuestionButton({ action, primary, onDark }: { action: AiQuestionAction; primary?: boolean; onDark?: boolean }) {
  const { can, tool } = useSitePage();
  if (action.step === 'open' && action.pageUrl)
    return (
      <a
        href={action.pageUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={onDark ? 'inline-flex items-center gap-1 text-[13px] font-medium text-on-ink underline-offset-4 hover:underline' : 'inline-flex items-center gap-1 text-[13px] font-medium text-accent-text hover:underline transition-colors duration-150 ease-brand'}
      >
        {action.label}
        <ExternalIcon className="size-3.5" aria-hidden />
      </a>
    );
  if (!action.run || !can('member')) return null;
  return (
    <ButtonLink to={tool(action.run.mode, action.run.prefill)} size="sm" variant={primary ? 'primary' : 'secondary'} className="group/act">
      {action.label}
      <ArrowRight className="size-3.5 transition-transform duration-200 ease-brand group-hover/act:translate-x-0.5" aria-hidden />
    </ButtonLink>
  );
}

/** The resolver for one question the page lists (a lost question, a question to win). */
export function resolveAiQuestion(ref: AiQuestionRef, inputs: AiQuestionInputs): AiQuestionAction {
  return aiQuestionAction(ref, inputs);
}
