import { useState } from 'react';
import { toast } from 'sonner';
import { BookCheck, Pencil, Trash2 } from 'lucide-react';
import { answerProblem, FACT_DECISION_LABEL, type FactAnswer, type FactAnswers } from '@seo/shared';
import { GuideButton } from '@/components/guide';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { ErrorState, Skeleton } from '@/components/ui/feedback';
import { Field, Select, Textarea } from '@/components/ui/field';
import { Dialog } from '@/components/ui/overlay';
import { IconTile } from '@/components/insight';
import { errorMessage } from '@/lib/api';
import { useDeleteFact, useSaveFact, useSiteFacts } from '@/lib/queries';
import { fmtDate } from '@/lib/utils';

type Decision = FactAnswer['decision'];
const DECISIONS: Decision[] = ['yes', 'edit', 'answer', 'general', 'remove'];

/** The facts as the list shows them: newest first, with their key kept for the API. */
export function factRows(facts: FactAnswers | null | undefined): (FactAnswer & { key: string })[] {
  return Object.entries(facts ?? {})
    .map(([key, f]) => ({ ...f, key }))
    .sort((a, b) => b.at.localeCompare(a.at) || a.key.localeCompare(b.key));
}

/**
 * H3 (2026-10-28): the answers given on written pages, kept once for the website (Website settings > Business details). Every later page
 * uses them and never asks them again; a person can change the wording, change the decision, or delete one (it may then be asked again).
 */
export function StoredFacts({ orgId, siteId, admin }: { orgId: string; siteId: string; admin: boolean }) {
  const q = useSiteFacts(orgId, siteId);
  const del = useDeleteFact(orgId, siteId);
  const [editing, setEditing] = useState<(FactAnswer & { key: string }) | null>(null);
  const rows = factRows(q.data?.facts);
  const remove = async (key: string) => {
    try {
      await del.mutateAsync(key);
      toast.success('Answer deleted', { description: 'A later page may ask about it again.' });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <Card className="max-w-3xl">
      <CardHeader
        icon={
          <IconTile size="sm" tone="blue" className="-mt-0.5">
            <BookCheck />
          </IconTile>
        }
        title="Answers from your pages"
        description="What you told us on written pages. Later pages use these answers and never ask the same question again."
        actions={<GuideButton id="business-facts" />}
      />
      <CardBody>
        {q.isLoading ? (
          <Skeleton className="h-24" />
        ) : q.error ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} title="Could not load your answers" />
        ) : rows.length === 0 ? (
          <p className="text-[13px] text-ink-3">No answers yet. When a written page has questions only you can answer, your answers are kept here.</p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((f) => (
              <li key={f.key} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-ink-2 [overflow-wrap:anywhere]">{f.question}</p>
                  {f.text ? <p className="mt-0.5 text-sm text-ink [overflow-wrap:anywhere]">{f.text}</p> : null}
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-3">
                    <Badge tone={f.decision === 'remove' ? 'warning' : f.decision === 'general' ? 'neutral' : 'good'}>{FACT_DECISION_LABEL[f.decision]}</Badge>
                    {f.at ? <span>{fmtDate(f.at)}</span> : null}
                  </p>
                </div>
                {admin && (
                  <span className="flex gap-1">
                    <Button size="sm" variant="ghost" icon={<Pencil className="size-3.5" />} onClick={() => setEditing(f)} aria-label={`Change the answer to: ${f.question}`}>
                      Change
                    </Button>
                    <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" />} loading={del.isPending && del.variables === f.key} onClick={() => remove(f.key)} aria-label={`Delete the answer to: ${f.question}`}>
                      Delete
                    </Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
      {editing && <EditFact orgId={orgId} siteId={siteId} fact={editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function EditFact({ orgId, siteId, fact, onClose }: { orgId: string; siteId: string; fact: FactAnswer & { key: string }; onClose: () => void }) {
  const save = useSaveFact(orgId, siteId);
  const [decision, setDecision] = useState<Decision>(fact.decision);
  const [text, setText] = useState(fact.text);
  const needsText = decision === 'yes' || decision === 'edit' || decision === 'answer';
  const problem = needsText ? answerProblem({ answer_type: 'text' }, 'answer', text) : '';
  const go = async () => {
    try {
      await save.mutateAsync({ key: fact.key, decision, text: needsText ? text.trim() : '' });
      toast.success('Answer saved', { description: 'Later pages use it from now on.' });
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Change this answer"
      description={fact.question}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={save.isPending} disabled={!!problem} onClick={go}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="What later pages do">
          {(p) => (
            <Select {...p} value={decision} onChange={(e) => setDecision(e.target.value as Decision)}>
              {DECISIONS.map((d) => (
                <option key={d} value={d}>
                  {FACT_DECISION_LABEL[d]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {needsText && (
          <Field label="The wording pages may use" error={problem || undefined}>
            {(p) => <Textarea {...p} rows={3} maxLength={600} value={text} onChange={(e) => setText(e.target.value)} />}
          </Field>
        )}
      </div>
    </Dialog>
  );
}
