import { useState } from 'react';
import { CircleCheck, CircleSlash, ClipboardCheck, ShieldQuestion } from 'lucide-react';
import type { PublishCheckResult } from '@seo/shared';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/feedback';
import { Field, Input, Textarea } from '@/components/ui/field';
import { ApiRequestError, errorMessage } from '@/lib/api';
import { usePublishCheck } from '@/lib/queries';
import { Panel } from './kit';

/**
 * B3-7 (v4.18) — "Check a page before you publish". The same deterministic quality gate a page written by the engine must pass
 * (placeholders, invented prices, unsourced figures, coverage, readability, answer-first), over a page the person pastes. Free, and
 * nothing is stored: the verdict is shown here and nowhere else. What the check could not judge (the editor's review is a model call,
 * coverage needs competitor pages, figures need their sources) is listed as such — never counted as a pass.
 */
export function PublishCheckPanel({ orgId, siteId }: { orgId: string; siteId: string }) {
  const check = usePublishCheck(orgId, siteId);
  const [keyword, setKeyword] = useState('');
  const [markdown, setMarkdown] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [result, setResult] = useState<PublishCheckResult | null>(null);
  const words = markdown.trim() ? markdown.trim().split(/\s+/).length : 0;

  const run = async () => {
    setFields({});
    setResult(null);
    try {
      setResult(await check.mutateAsync({ markdown, keyword: keyword.trim() }));
    } catch (e) {
      if (e instanceof ApiRequestError && Object.keys(e.fields ?? {}).length) setFields(e.fields);
      else setResult({ ok: false, publishable: false, verdict: 'error', exit_code: 2, error: errorMessage(e) });
    }
  };

  return (
    <Panel
      icon={<ClipboardCheck />}
      title="Check a page before you publish"
      description="Paste any page — written here, by your team or by another tool — and get the verdict our own pages must pass, with every reason named. Free; nothing is stored."
    >
      <div className="space-y-4">
        <Field label="The search this page is for" error={fields.keyword}>
          {(p) => <Input {...p} value={keyword} maxLength={120} placeholder="e.g. warehouse management software" onChange={(e) => setKeyword(e.target.value)} />}
        </Field>
        <Field
          label="The page (Markdown or plain text)"
          hint={`Optional "Title:" and "Meta Description:" lines above the first heading are read too. ${words} words.`}
          error={fields.markdown}
        >
          {(p) => <Textarea {...p} rows={10} value={markdown} maxLength={200000} className="font-mono text-sm" onChange={(e) => setMarkdown(e.target.value)} />}
        </Field>
        <Button onClick={() => void run()} loading={check.isPending} disabled={!keyword.trim() || words < 50}>
          <ClipboardCheck /> Check the page
        </Button>
        {result && <PublishCheckVerdict r={result} />}
      </div>
    </Panel>
  );
}

export function PublishCheckVerdict({ r }: { r: PublishCheckResult }) {
  if (r.verdict === 'error' || r.exit_code === 2)
    return (
      <Callout tone="critical" title="The page was not checked">
        {r.error || 'The check did not run.'}
        {r.errors?.length ? <ul className="mt-2 list-disc pl-5">{r.errors.slice(0, 6).map((e) => <li key={e}>{e}</li>)}</ul> : null}
      </Callout>
    );
  const ok = r.publishable;
  return (
    <div className="space-y-4 rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge tone={ok ? 'good' : 'critical'}>{ok ? 'Ready to publish' : 'Not ready to publish'}</StatusBadge>
        {r.content_score != null && (
          <span className="font-mono text-sm text-ink-2">
            Content score {Math.round(r.content_score)} / 100 (the bar is {r.score_bar ?? 80})
          </span>
        )}
      </div>
      {r.summary && <p className="text-sm">{r.summary}</p>}
      {!!r.reasons?.length && (
        <div>
          <h4 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
            <CircleSlash className="size-4" /> What stops it
          </h4>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {r.reasons.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      )}
      {!!r.warnings?.length && !(r.reasons ?? []).length && (
        <div>
          <h4 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
            <CircleCheck className="size-4" /> Worth a look
          </h4>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {r.warnings.slice(0, 8).map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      )}
      {!!r.not_checked?.length && (
        <div>
          <h4 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
            <ShieldQuestion className="size-4" /> Not checked
          </h4>
          <ul className="space-y-1 text-sm text-ink-2">
            {r.not_checked.map((n) => (
              <li key={n.check}>
                <span className="font-medium text-ink">{n.check.replace(/_/g, ' ')}</span> — {n.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-ink-3">{r.basis || 'The deterministic half of the quality gate a written page must pass.'} Nothing was stored and nothing was charged.</p>
    </div>
  );
}
