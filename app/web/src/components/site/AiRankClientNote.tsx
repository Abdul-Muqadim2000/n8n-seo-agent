// FX-C RC-1 (2026-11-06): the AI ranking plan's weekly note in the client's words (what changed, why it moved, did our steps work, what we did,
// what we need from you) and the cost per question won in credits. Used by the AI visibility page and the AI growth report. A client never
// sees the owner's memo: it is rendered only for a platform admin, folded, under its own label.
import { formatCredits, type AiRankClientView, type AiRankMemo } from '@seo/shared';

export function AiRankClientNote({ note }: { note: AiRankClientView }) {
  const won = note.wins;
  return (
    <div className="space-y-4">
      {note.sections.map((s) => (
        <div key={s.key}>
          <h3 className="text-[13px] font-semibold text-ink">{s.title}</h3>
          <ul className="mt-1 space-y-1.5 text-[13px] leading-relaxed text-ink-2">
            {s.lines.map((l, i) => (
              <li key={i} className="[overflow-wrap:anywhere]">
                {l}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {won != null && (
        <p className="text-xs text-ink-3">
          {won > 0
            ? `Questions won after a confirmed step: ${Math.round(won * 10) / 10}${note.creditsPerWin != null ? `, about ${formatCredits(note.creditsPerWin)} each` : ''}.`
            : `No question has been won after a confirmed step yet${note.creditsUsed != null ? ` (${formatCredits(note.creditsUsed)} used so far)` : ''}.`}
        </p>
      )}
    </div>
  );
}

/** The owner's raw memo (platform admins only): every part and figure as the engine wrote it, folded. */
export function AiRankRawMemo({ memo }: { memo: AiRankMemo }) {
  return (
    <details className="rounded-xl border border-line p-3">
      <summary className="cursor-pointer text-xs font-medium text-ink-2">Platform admins only: the engine&apos;s weekly memo</summary>
      <div className="mt-2 space-y-3">
        {memo.parts
          .filter((p) => p.lines.length)
          .map((p) => (
            <div key={p.key || p.title}>
              <p className="text-xs font-semibold text-ink-2">{p.title}</p>
              <ul className="mt-1 space-y-1 text-xs text-ink-3">
                {p.lines.map((l, i) => (
                  <li key={i} className="[overflow-wrap:anywhere]">
                    {l.text}
                    {l.figures.length > 0 && <span className="block">{l.figures.map((f) => `${f.name}: ${f.value}${f.basis ? ` (${f.basis})` : ''}`).join(' · ')}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </div>
    </details>
  );
}
