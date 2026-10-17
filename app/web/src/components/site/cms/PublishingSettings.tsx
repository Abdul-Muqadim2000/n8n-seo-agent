import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Plug, PlugZap, Plus, RefreshCw, Send, Trash2 } from 'lucide-react';
import {
  CMS_KIND_INFO,
  CMS_KINDS,
  CMS_SOURCE_FIELDS,
  fieldMapProblems,
  type CmsConnectionCreate,
  type CmsConnectionView,
  type CmsFieldMap,
  type CmsKind,
  type CmsSourceField,
} from '@seo/shared';
import { GuideButton } from '@/components/guide';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardBody, CardFooter } from '@/components/ui/card';
import { Callout, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { ChoiceCard, Field, Input, Select } from '@/components/ui/field';
import { CopyButton, KeyValue } from '@/components/ui/misc';
import { Dialog } from '@/components/ui/overlay';
import { TagInput } from '@/components/ui/tag-input';
import { SettingsCard } from '@/pages/settings/_components/SettingsCard';
import { ApiRequestError, errorMessage } from '@/lib/api';
import { useOrgCtx, useSiteCtx } from '@/lib/context';
import { useCmsConnections, useCreateCmsConnection, useDeleteCmsConnection, useTestCmsConnection, useUpdateCmsConnection } from '@/lib/queries';
import { fmtAgo } from '@/lib/utils';

/**
 * G2 — Website settings → Publishing (app/docs/CMS_PUBLISHING.md §7). Connect WordPress, Webflow, Contentful or a signed webhook,
 * test it, map the fields once. Secrets are write-only here: the server answers `hasSecret` and nothing else.
 */

const STATUS = {
  ok: { tone: 'good', label: 'Connected' },
  error: { tone: 'critical', label: 'Needs attention' },
  untested: { tone: 'warning', label: 'Not tested yet' },
} as const;

export function PublishingSettings({ admin }: { admin: boolean }) {
  const { org } = useOrgCtx();
  const { site } = useSiteCtx();
  const q = useCmsConnections(org.id, site.id);
  const [adding, setAdding] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);

  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  if (q.isLoading || !q.data) return <Skeleton className="h-64 max-w-3xl" />;
  const items = q.data.items;

  return (
    <div className="max-w-3xl space-y-5">
      {secret && (
        <Callout tone="good" title="Your webhook’s signing secret — copy it now" action={<Button size="sm" variant="secondary" onClick={() => setSecret(null)}>Done</Button>}>
          <p className="mb-2">This is the only time it is shown. Your endpoint checks every request with it.</p>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <code className="min-w-0 max-w-full break-all rounded-md border border-line bg-surface-2 px-2 py-1 font-mono text-xs">{secret}</code>
            <CopyButton text={secret} label="Copy secret" />
          </div>
        </Callout>
      )}
      <SettingsCard
        icon={<Send />}
        title="Publish to your CMS"
        description="Written pages go to your CMS as drafts with their title, slug, description and images. Only an owner or admin can publish one live, and a page the quality check did not pass, or one with text left to fill in, never goes out."
        actions={admin && items.length > 0 ? <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>Connect a CMS</Button> : undefined}
      >
        {!items.length && (
          <CardBody>
            <EmptyState
              icon={<Plug className="size-5" />}
              title="No CMS connected"
              description="Connect WordPress, Webflow or Contentful — or any other stack through a signed webhook — and send written pages from their report instead of copying them by hand."
              action={admin ? <Button icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>Connect a CMS</Button> : <span className="text-sm text-ink-3">Ask an admin of your company to connect one.</span>}
            />
          </CardBody>
        )}
      </SettingsCard>
      {items.map((c) => (
        <ConnectionCard key={c.id} c={c} admin={admin} />
      ))}
      {adding && <ConnectDialog onClose={() => setAdding(false)} onSecret={setSecret} />}
    </div>
  );
}

function ConnectionCard({ c, admin }: { c: CmsConnectionView; admin: boolean }) {
  const { org } = useOrgCtx();
  const { site } = useSiteCtx();
  const test = useTestCmsConnection(org.id, site.id);
  const del = useDeleteCmsConnection(org.id, site.id);
  const info = CMS_KIND_INFO[c.kind];
  const st = STATUS[c.status];
  const s = c.settings;

  const runTest = async () => {
    try {
      const r = await test.mutateAsync(c.id);
      if (r.ok) toast.success('Connected', { description: r.message });
      else toast.error(r.message);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const remove = async () => {
    if (!window.confirm(`Remove the ${info.label} connection? Pages already in your CMS stay there; the publishing history stays here.`)) return;
    try {
      await del.mutateAsync(c.id);
      toast.success('Connection removed');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const facts = [
    c.baseUrl && { label: 'Address', value: <span className="break-all">{c.baseUrl}</span> },
    c.username && { label: 'User', value: c.username },
    s.account && (c.kind === 'wordpress' || c.kind === 'webhook') && { label: c.kind === 'wordpress' ? 'Signed in as' : 'Endpoint', value: s.account },
    c.kind === 'wordpress' && { label: 'Creates', value: s.postType === 'pages' ? 'Pages' : `Posts${s.categories?.length ? ` in ${s.categories.join(', ')}` : ''}${s.tags?.length ? ` · tags ${s.tags.join(', ')}` : ''}` },
    c.kind === 'wordpress' && s.seoPlugin && { label: 'SEO fields', value: s.seoFields?.length ? `${s.seoPlugin === 'yoast' ? 'Yoast SEO' : 'Rank Math'} fields filled directly` : 'Meta description in the excerpt' },
    c.kind === 'webflow' && { label: 'Collection', value: s.collectionName || s.collectionId },
    c.kind === 'contentful' && { label: 'Content type', value: `${s.contentTypeId} · ${s.spaceId}/${s.environment}${s.locale ? ` · ${s.locale}` : ''}` },
    { label: 'Live page address', value: s.publicUrlTemplate || `The planned address on ${site.domain}` },
    { label: 'Last test', value: c.lastTestedAt ? fmtAgo(c.lastTestedAt) : 'Never' },
  ].filter(Boolean) as { label: string; value: ReactNode }[];

  return (
    <SettingsCard
      icon={c.status === 'ok' ? <CheckCircle2 /> : <PlugZap />}
      iconTone={c.status === 'ok' ? 'good' : c.status === 'error' ? 'critical' : 'blue'}
      title={
        <span className="inline-flex flex-wrap items-center gap-2">
          {c.label}
          <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
        </span>
      }
      description={info.description}
      actions={<GuideButton id={info.guide} vars={{ domain: site.domain }} />}
    >
      <CardBody className="space-y-4">
        {c.status === 'error' && c.statusReason && (
          <Callout tone="critical" title="The last test failed">
            {c.statusReason}
          </Callout>
        )}
        <KeyValue items={facts} />
        {(c.kind === 'webflow' || c.kind === 'contentful') && <FieldMapping c={c} admin={admin} />}
        {admin && <EditDefaults c={c} />}
      </CardBody>
      {admin && (
        <CardFooter className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" icon={<RefreshCw className="size-4" />} loading={test.isPending} onClick={() => void runTest()}>
            Test connection
          </Button>
          <Button size="sm" variant="ghost" icon={<Trash2 className="size-4" />} loading={del.isPending} onClick={() => void remove()}>
            Remove
          </Button>
        </CardFooter>
      )}
    </SettingsCard>
  );
}

/** Webflow / Contentful: which of the CMS's own fields holds each of ours (read by the last test). */
function FieldMapping({ c, admin }: { c: CmsConnectionView; admin: boolean }) {
  const { org } = useOrgCtx();
  const { site } = useSiteCtx();
  const update = useUpdateCmsConnection(org.id, site.id);
  const remote = c.settings.remoteFields ?? [];
  const [map, setMap] = useState<CmsFieldMap>(c.settings.fieldMap ?? {});
  useEffect(() => setMap(c.settings.fieldMap ?? {}), [c.settings.fieldMap]);
  if (!remote.length)
    return (
      <Callout tone="info" title="Map the fields after the first test">
        Test the connection: Ascentra reads the fields of your {c.kind === 'webflow' ? 'collection' : 'content type'}, then you choose which one holds the article.
      </Callout>
    );
  const problems = fieldMapProblems(c.kind, map, remote);
  const ours = CMS_SOURCE_FIELDS.filter((f) => !(c.kind === 'webflow' && (f.id === 'title' || f.id === 'slug')));
  const save = async () => {
    try {
      await update.mutateAsync({ id: c.id, fieldMap: Object.fromEntries(Object.entries(map).filter(([, v]) => v)) });
      toast.success('Field mapping saved');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <fieldset className="space-y-3 rounded-lg border border-line p-4">
      <legend className="px-1 text-sm font-medium text-ink">Field mapping</legend>
      <p className="text-[13px] text-ink-3">{c.kind === 'webflow' ? 'The name and the slug are filled for you. ' : ''}Leave a field on “Not sent” when your CMS has nothing for it.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {ours.map((f) => (
          <Field key={f.id} label={f.label} hint={f.hint || undefined}>
            {(p) => (
              <Select {...p} disabled={!admin} value={map[f.id] ?? ''} onChange={(e) => setMap({ ...map, [f.id as CmsSourceField]: e.target.value })}>
                <option value="">Not sent</option>
                {remote
                  .filter((r) => !(c.kind === 'webflow' && (r.id === 'name' || r.id === 'slug')))
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.type}{r.required ? ', required' : ''})
                    </option>
                  ))}
              </Select>
            )}
          </Field>
        ))}
      </div>
      {problems.length > 0 && (
        <Callout tone="warning" title="Before a page can go out">
          <ul className="list-disc space-y-0.5 pl-5">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Callout>
      )}
      {admin && (
        <Button size="sm" onClick={() => void save()} loading={update.isPending} disabled={problems.length > 0}>
          Save mapping
        </Button>
      )}
    </fieldset>
  );
}

/** The non-secret defaults an admin may change later: label, the address pattern, WordPress categories and tags, a new secret. */
function EditDefaults({ c }: { c: CmsConnectionView }) {
  const { org } = useOrgCtx();
  const { site } = useSiteCtx();
  const update = useUpdateCmsConnection(org.id, site.id);
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(c.label);
  const [pattern, setPattern] = useState(c.settings.publicUrlTemplate ?? '');
  const [cats, setCats] = useState<string[]>(c.settings.categories ?? []);
  const [tags, setTags] = useState<string[]>(c.settings.tags ?? []);
  const [secret, setSecret] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  if (!open)
    return (
      <Button size="sm" variant="link" onClick={() => setOpen(true)}>
        Change the settings
      </Button>
    );
  const save = async () => {
    try {
      await update.mutateAsync({ id: c.id, label, publicUrlTemplate: pattern, ...(c.kind === 'wordpress' ? { categories: cats, tags } : {}), ...(secret.trim() ? { secret: secret.trim() } : {}) });
      toast.success('Saved', { description: secret.trim() ? 'Test the connection again with the new secret.' : undefined });
      setSecret('');
      setOpen(false);
    } catch (e) {
      if (e instanceof ApiRequestError) setErrors(e.fields);
      toast.error(errorMessage(e));
    }
  };
  return (
    <div className="space-y-3 rounded-lg border border-line p-4">
      <Field label="Name" optional>
        {(p) => <Input {...p} value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} />}
      </Field>
      <Field label="Address of a live page" optional error={errors.publicUrlTemplate} hint={`With {slug}, e.g. https://${site.domain}/blog/{slug}/ — empty: the address the plan chose`}>
        {(p) => <Input {...p} value={pattern} placeholder={`https://${site.domain}/blog/{slug}/`} onChange={(e) => setPattern(e.target.value)} />}
      </Field>
      {c.kind === 'wordpress' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Categories" optional hint="Made in WordPress when missing">
            {(p) => <TagInput id={p.id} value={cats} onChange={setCats} max={10} placeholder="Guides" />}
          </Field>
          <Field label="Tags" optional>
            {(p) => <TagInput id={p.id} value={tags} onChange={setTags} max={10} placeholder="Tax" />}
          </Field>
        </div>
      )}
      {c.kind !== 'webhook' && (
        <Field label={`New ${CMS_KIND_INFO[c.kind].secretLabel.toLowerCase()}`} optional hint="Leave empty to keep the one stored. It is never shown again.">
          {(p) => <Input {...p} type="password" autoComplete="new-password" value={secret} onChange={(e) => setSecret(e.target.value)} />}
        </Field>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => void save()} loading={update.isPending}>
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function ConnectDialog({ onClose, onSecret }: { onClose: () => void; onSecret: (s: string) => void }) {
  const { org } = useOrgCtx();
  const { site } = useSiteCtx();
  const create = useCreateCmsConnection(org.id, site.id);
  const test = useTestCmsConnection(org.id, site.id);
  const [kind, setKind] = useState<CmsKind>('wordpress');
  const [f, setF] = useState<Record<string, string>>({ baseUrl: `https://${site.domain}`, environment: 'master', postType: 'posts' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const info = CMS_KIND_INFO[kind];
  const set = (k: string) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const submit = async () => {
    setErrors({});
    const common = { label: f.label ?? '', publicUrlTemplate: f.publicUrlTemplate ?? '' };
    const body: CmsConnectionCreate =
      kind === 'wordpress'
        ? { kind, ...common, baseUrl: f.baseUrl ?? '', username: f.username ?? '', secret: f.secret ?? '', postType: f.postType === 'pages' ? 'pages' : 'posts' }
        : kind === 'webflow'
          ? { kind, ...common, secret: f.secret ?? '', collectionId: f.collectionId ?? '' }
          : kind === 'contentful'
            ? { kind, ...common, secret: f.secret ?? '', spaceId: f.spaceId ?? '', environment: f.environment || 'master', contentTypeId: f.contentTypeId ?? '' }
            : { kind, ...common, baseUrl: f.baseUrl ?? '' };
    try {
      const r = await create.mutateAsync(body);
      if (r.signingSecret) onSecret(r.signingSecret);
      onClose();
      // test straight away: the customer learns now whether it works, and Webflow / Contentful read the fields for the mapping
      const t = await test.mutateAsync(r.connection.id).catch(() => null);
      if (t?.ok) toast.success(`${info.label} connected`, { description: t.message });
      else if (t) toast.error(t.message);
    } catch (e) {
      if (e instanceof ApiRequestError) setErrors(e.fields);
      toast.error(errorMessage(e));
    }
  };

  return (
    <Dialog
      open
      wide
      onOpenChange={(o) => !o && onClose()}
      title="Connect a CMS"
      description={`Pages of ${site.domain} go to it as drafts; only owners and admins can publish one live.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={create.isPending}>
            Connect and test
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div role="radiogroup" aria-label="Your CMS" className="grid gap-2 sm:grid-cols-2">
          {CMS_KINDS.map((k) => (
            <ChoiceCard key={k} selected={kind === k} onSelect={() => setKind(k)} title={CMS_KIND_INFO[k].label} description={CMS_KIND_INFO[k].description} />
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg bg-accent-soft/60 px-3.5 py-2.5 text-[13px] text-ink-2">
          <span>Where to find the {info.secretLabel.toLowerCase()}{kind === 'webflow' ? ' and the collection id' : kind === 'contentful' ? ' and the ids' : ''}.</span>
          <GuideButton id={info.guide} vars={{ domain: site.domain }} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {info.needsBaseUrl && (
            <Field label={kind === 'webhook' ? 'Your endpoint (https)' : 'WordPress site address'} error={errors.baseUrl} className="sm:col-span-2" hint={kind === 'wordpress' ? 'The site itself, not /wp-admin' : 'It receives a signed POST for every page'}>
              {(p) => <Input {...p} type="url" inputMode="url" value={f.baseUrl ?? ''} onChange={set('baseUrl')} />}
            </Field>
          )}
          {info.needsUsername && (
            <Field label="WordPress user name" error={errors.username} hint="The login name, not the e-mail address">
              {(p) => <Input {...p} autoComplete="off" value={f.username ?? ''} onChange={set('username')} />}
            </Field>
          )}
          {kind !== 'webhook' && (
            <Field label={info.secretLabel} error={errors.secret} hint="Stored encrypted and never shown again">
              {(p) => <Input {...p} type="password" autoComplete="new-password" value={f.secret ?? ''} onChange={set('secret')} />}
            </Field>
          )}
          {kind === 'wordpress' && (
            <Field label="Create">
              {(p) => (
                <Select {...p} value={f.postType} onChange={set('postType')}>
                  <option value="posts">Posts</option>
                  <option value="pages">Pages</option>
                </Select>
              )}
            </Field>
          )}
          {kind === 'webflow' && (
            <Field label="Collection id" error={errors.collectionId} hint="24 letters and digits, from the collection’s settings">
              {(p) => <Input {...p} value={f.collectionId ?? ''} onChange={set('collectionId')} className="font-mono" />}
            </Field>
          )}
          {kind === 'contentful' && (
            <>
              <Field label="Space id" error={errors.spaceId}>
                {(p) => <Input {...p} value={f.spaceId ?? ''} onChange={set('spaceId')} className="font-mono" />}
              </Field>
              <Field label="Environment" error={errors.environment}>
                {(p) => <Input {...p} value={f.environment ?? ''} onChange={set('environment')} className="font-mono" />}
              </Field>
              <Field label="Content type id" error={errors.contentTypeId}>
                {(p) => <Input {...p} value={f.contentTypeId ?? ''} onChange={set('contentTypeId')} className="font-mono" />}
              </Field>
            </>
          )}
          <Field label="Address of a live page" optional error={errors.publicUrlTemplate} className="sm:col-span-2" hint={`With {slug}, e.g. https://${site.domain}/blog/{slug}/ — so the live page can be checked and tracked. Empty: the address the plan chose.`}>
            {(p) => <Input {...p} value={f.publicUrlTemplate ?? ''} placeholder={`https://${site.domain}/blog/{slug}/`} onChange={set('publicUrlTemplate')} />}
          </Field>
          <Field label="Name" optional className="sm:col-span-2" hint="e.g. “Main blog” when you connect more than one">
            {(p) => <Input {...p} value={f.label ?? ''} maxLength={60} onChange={set('label')} />}
          </Field>
        </div>
      </div>
    </Dialog>
  );
}
