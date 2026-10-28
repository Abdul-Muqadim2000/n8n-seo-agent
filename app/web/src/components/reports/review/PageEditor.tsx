import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Minus, Plus, RotateCcw, Save, Trash2, Undo2 } from 'lucide-react';
import { diffBlocks, PAGE_MARKDOWN_MAX, parseBlocks, renderMarkdown, sanitizeMarkdown, type PageReviewView } from '@seo/shared';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/feedback';
import { Select, Textarea } from '@/components/ui/field';
import { Dialog } from '@/components/ui/overlay';
import { Segmented } from '@/components/ui/tabs';
import { errorMessage } from '@/lib/api';
import { useOrgCtx } from '@/lib/context';
import { useRevertVersion, useSaveVersion } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { srcDoc, useThemeTokens } from '../article';
import { CheckResult } from './ReviewPanels';
import { blocksToMarkdown, editableBlocks, historyPush, historyStart, historyUndo, KIND_LABEL, moveBlock, NEW_BLOCK, setHeadingLevel, type History } from './model';

interface EBlock {
  key: number;
  text: string;
}
let nextKey = 1;
const toBlocks = (md: string): EBlock[] => editableBlocks(md).map((b) => ({ key: nextKey++, text: b.text }));
const kindOf = (text: string) => parseBlocks(text).find((b) => b.kind !== 'blank') ?? { kind: 'paragraph' as const, level: undefined };

/**
 * H3: the client edits the page in the app, block by block (headings, paragraphs, lists, tables, quotes, links in Markdown). The preview is
 * our own renderer's escaped HTML in a sandboxed frame; what is saved is sanitised Markdown. The free check runs on every save.
 */
export default function PageEditor({ view, onClose }: { view: PageReviewView; onClose: () => void }) {
  const { org } = useOrgCtx();
  const save = useSaveVersion(org.id, view.reportId);
  const revert = useRevertVersion(org.id, view.reportId);
  const start = view.clientVersion?.markdown ?? view.delivered.markdown;
  const [blocks, setBlocks] = useState<EBlock[]>(() => toBlocks(start));
  const [hist, setHist] = useState<History>(() => historyStart(blocksToMarkdown(toBlocks(start))));
  const [tab, setTab] = useState<'edit' | 'preview' | 'compare'>('edit');
  const [confirmRevert, setConfirmRevert] = useState(false);
  const [status, setStatus] = useState('');
  const md = useMemo(() => blocksToMarkdown(blocks), [blocks]);
  const savedMd = useRef(blocksToMarkdown(toBlocks(start)));
  const dirty = md !== savedMd.current;
  const tooLong = md.length > PAGE_MARKDOWN_MAX;

  // every change goes into the undo history (typing is grouped: a new step only when another block is touched or a structure changes)
  const lastTouched = useRef<number | null>(null);
  const commit = (next: EBlock[], key: number | null) => {
    setBlocks(next);
    const nm = blocksToMarkdown(next);
    setHist((h) => (key != null && key === lastTouched.current && h.past.length ? { ...h, present: nm } : historyPush(h, nm)));
    lastTouched.current = key;
  };
  const setText = (i: number, text: string) => commit(blocks.map((b, j) => (j === i ? { ...b, text } : b)), blocks[i]!.key);
  const undo = () => {
    const h = historyUndo(hist);
    setHist(h);
    setBlocks(toBlocks(h.present));
    lastTouched.current = null;
    setStatus('Undone');
  };
  const add = (i: number, kind: keyof typeof NEW_BLOCK) => {
    const next = blocks.slice();
    next.splice(i + 1, 0, { key: nextKey++, text: NEW_BLOCK[kind] });
    commit(next, null);
    setStatus(`${kind === 'heading' ? 'Heading' : kind.charAt(0).toUpperCase() + kind.slice(1)} added`);
  };
  const remove = (i: number) => {
    commit(blocks.filter((_, j) => j !== i), null);
    setStatus('Block deleted. Undo brings it back.');
  };
  const move = (i: number, d: -1 | 1) => {
    commit(moveBlock(blocks, i, i + d), null);
    setStatus(d < 0 ? 'Moved up' : 'Moved down');
  };

  const doSave = async () => {
    const clean = sanitizeMarkdown(md);
    try {
      await save.mutateAsync(clean);
      savedMd.current = md;
      setStatus('Saved. Your version is checked below.');
      toast.success('Your version is saved');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const doRevert = async () => {
    try {
      await revert.mutateAsync();
      const b = toBlocks(view.delivered.markdown);
      setBlocks(b);
      savedMd.current = blocksToMarkdown(b);
      setHist(historyStart(savedMd.current));
      setConfirmRevert(false);
      setStatus('Back to the delivered version');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented
          label="Editor view"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'edit', label: 'Edit' },
            { value: 'preview', label: 'Preview' },
            { value: 'compare', label: 'Compare' },
          ]}
        />
        <span className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="ghost" icon={<Undo2 className="size-4" />} disabled={!hist.past.length} onClick={undo}>
            Undo
          </Button>
          {view.clientVersion && (
            <Button size="sm" variant="ghost" icon={<RotateCcw className="size-4" />} onClick={() => setConfirmRevert(true)}>
              Back to the delivered version
            </Button>
          )}
          <Button size="sm" icon={<Save className="size-4" />} disabled={!dirty || tooLong} loading={save.isPending} onClick={doSave}>
            Save my version
          </Button>
          <Button size="sm" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </span>
      </div>
      <p className="min-h-4 text-xs text-ink-3" role="status" aria-live="polite">
        {status || (dirty ? 'Changes not saved yet' : '')}
      </p>
      {tooLong && <Callout tone="critical">The page is too long to save. Shorten it first.</Callout>}

      {tab === 'compare' ? (
        <Compare before={view.delivered.markdown} after={md} />
      ) : (
        <div className={cn('grid gap-4', tab === 'edit' && 'lg:grid-cols-2')}>
          {tab === 'edit' && (
            <ol className="space-y-2" aria-label="Blocks of the page">
              {blocks.map((b, i) => (
                <BlockRow key={b.key} b={b} i={i} n={blocks.length} onText={(t) => setText(i, t)} onMove={(d) => move(i, d)} onRemove={() => remove(i)} onAdd={(k) => add(i, k)} />
              ))}
              {blocks.length === 0 && (
                <li>
                  <Button size="sm" variant="secondary" icon={<Plus className="size-4" />} onClick={() => add(-1, 'paragraph')}>
                    Add a paragraph
                  </Button>
                </li>
              )}
            </ol>
          )}
          <div className={cn(tab === 'edit' && 'hidden lg:block')}>
            <Preview md={md} />
          </div>
        </div>
      )}
      {view.clientVersion?.check && !dirty && <CheckResult check={view.clientVersion.check} />}
      <p className="text-xs text-ink-3">
        Write links as [the words](https://address). A heading starts with ##. Lists start with a dash. Anything that looks like code or a script is removed when you save.
      </p>
      <Dialog
        open={confirmRevert}
        onOpenChange={setConfirmRevert}
        title="Go back to the delivered version?"
        description="Your saved changes are dropped and the page is as we delivered it. Your answers to the questions stay."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmRevert(false)}>
              Keep my version
            </Button>
            <Button variant="danger" loading={revert.isPending} onClick={doRevert}>
              Go back
            </Button>
          </>
        }
      />
    </div>
  );
}

function BlockRow({ b, i, n, onText, onMove, onRemove, onAdd }: { b: EBlock; i: number; n: number; onText: (t: string) => void; onMove: (d: -1 | 1) => void; onRemove: () => void; onAdd: (k: keyof typeof NEW_BLOCK) => void }) {
  const k = kindOf(b.text);
  const label = k.kind === 'heading' ? `Heading ${k.level ?? 2}` : KIND_LABEL[k.kind];
  const id = `blk-${b.key}`;
  const rows = Math.min(14, Math.max(k.kind === 'heading' || k.kind === 'meta' ? 1 : 3, b.text.split('\n').length + 1));
  return (
    <li className="rounded-xl border border-line bg-surface p-3">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={id} className="text-xs font-medium text-ink-3">
          {label} <span className="sr-only">, block {i + 1} of {n}</span>
        </label>
        <span className="flex flex-wrap items-center gap-1">
          {k.kind === 'heading' && (
            <Select aria-label="Heading level" className="h-7 w-auto py-0 text-xs" value={String(k.level ?? 2)} onChange={(e) => onText(setHeadingLevel(b.text, Number(e.target.value)))}>
              <option value="1">Main heading</option>
              <option value="2">Section</option>
              <option value="3">Sub-section</option>
              <option value="4">Small heading</option>
            </Select>
          )}
          <Button size="icon" variant="ghost" aria-label={`Move block ${i + 1} up`} disabled={i === 0} onClick={() => onMove(-1)} icon={<ArrowUp className="size-4" />} />
          <Button size="icon" variant="ghost" aria-label={`Move block ${i + 1} down`} disabled={i === n - 1} onClick={() => onMove(1)} icon={<ArrowDown className="size-4" />} />
          <Button size="icon" variant="ghost" aria-label={`Delete block ${i + 1}`} onClick={onRemove} icon={<Trash2 className="size-4" />} />
        </span>
      </div>
      <Textarea id={id} rows={rows} value={b.text} onChange={(e) => onText(e.target.value)} className="font-mono text-[13px]" spellCheck />
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <span className="text-xs text-ink-3">Add below:</span>
        {(['paragraph', 'heading', 'list', 'table', 'quote'] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => onAdd(kind)}
            className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-accent-text transition-colors duration-150 ease-brand hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-accent-text/60 focus-visible:outline-none"
          >
            <Plus className="size-3" aria-hidden />
            <span className="sr-only">Add a</span> {kind === 'paragraph' ? 'Paragraph' : kind === 'heading' ? 'Heading' : kind === 'list' ? 'List' : kind === 'table' ? 'Table' : 'Quote'}
          </button>
        ))}
      </div>
    </li>
  );
}

function Preview({ md }: { md: string }) {
  const tokens = useThemeTokens();
  const doc = useMemo(() => srcDoc(renderMarkdown(md, { preview: true }), tokens), [md, tokens]);
  return <iframe title="Preview of your version" sandbox="" referrerPolicy="no-referrer" srcDoc={doc} className="h-[70vh] min-h-[420px] w-full rounded-xl border border-line bg-surface lg:sticky lg:top-4" />;
}

const DIFF_LABEL = { changed: 'Changed', added: 'Added', removed: 'Removed', same: 'Same' } as const;

export function Compare({ before, after }: { before: string; after: string }) {
  const d = useMemo(() => diffBlocks(before, after).filter((x) => x.kind !== 'same'), [before, after]);
  if (!d.length) return <p className="text-sm text-ink-2">Your version is the same as the delivered one.</p>;
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-ink">
        {d.length} {d.length === 1 ? 'difference' : 'differences'} from the delivered version
      </h3>
      <ol className="space-y-2">
        {d.map((x, i) => (
          <li key={i} className="rounded-xl border border-line bg-surface p-3 text-[13px]">
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-ink-2">
              {x.kind === 'added' ? <Plus className="size-3.5" aria-hidden /> : x.kind === 'removed' ? <Minus className="size-3.5" aria-hidden /> : <RotateCcw className="size-3.5" aria-hidden />}
              {DIFF_LABEL[x.kind]}
            </p>
            {x.before && (
              <p className="whitespace-pre-wrap text-ink-3 [overflow-wrap:anywhere]">
                <span className="font-medium">Before: </span>
                <del>{x.before}</del>
              </p>
            )}
            {x.after && (
              <p className="mt-1 whitespace-pre-wrap text-ink [overflow-wrap:anywhere]">
                <span className="font-medium">Now: </span>
                <ins className="no-underline">{x.after}</ins>
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
