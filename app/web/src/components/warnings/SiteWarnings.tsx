import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Warning } from '@seo/shared';
import { api, toastError } from '@/lib/api';
import { useOrgCtx, useSiteCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { qk } from '@/lib/queries';
import { Warnings } from './Warnings';

/**
 * MKT (2026-10-27, mismatch audit M2 / M3 / M5 / M6 / M7): what does not match about the website right now (the engine still measuring an
 * old country, a ladder in another country, a description about other markets, suggestions researched elsewhere, AI questions about other
 * places), on the Overview, the Pipeline and the Website settings. Accept applies the correction; the "... anyway" tick keeps it as it is
 * (recorded, and quiet until the facts change).
 */
export const consistencyKey = (siteId: string) => qk.siteData(siteId, 'consistency');

export function SiteWarnings() {
  const { org, can } = useOrgCtx();
  const { site } = useSiteCtx();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const base = `/api/orgs/${org.id}/sites/${site.id}`;
  const q = useQuery({ queryKey: consistencyKey(site.id), queryFn: () => api<{ warnings: Warning[]; acknowledged: Warning[] }>(`${base}/consistency`), staleTime: 60_000 });
  const [busy, setBusy] = useState<string | null>(null);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['site', site.id] });
    void qc.invalidateQueries({ queryKey: qk.sites(org.id) });
  };
  const keep = useMutation({
    mutationFn: (id: string) => api(`${base}/consistency/acknowledge`, { method: 'POST', body: { acknowledge: [id] } }),
    onSuccess: () => {
      toast.success('Kept as it is', { description: 'Your choice is recorded. We warn again if the facts change.' });
      refresh();
    },
    onError: (e) => toastError(e),
  });
  const accept = async (w: Warning) => {
    const c = w.accept?.change;
    if (!c) return;
    if (c.kind === 'link') {
      navigate(c.tool ? paths.tool(org.id, c.tool, { siteId: site.id }) : paths.site(org.id, site.id, c.sitePage ?? 'overview'));
      return;
    }
    if (c.kind !== 'call') return;
    setBusy(w.id);
    try {
      await api(c.path, { method: c.method, body: c.body ?? {} });
      toast.success(w.accept!.label, { description: 'Done. The next weekly checks use it.' });
      refresh();
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(null);
    }
  };
  const shown = (q.data?.warnings ?? []).filter((w) => w.tone === 'warning');
  if (!shown.length) return null;
  const admin = can('admin');
  return (
    <Warnings
      warnings={admin ? shown : shown.map((w) => ({ ...w, confirm: undefined }))}
      acked={[]}
      busy={busy ?? (keep.isPending ? keep.variables ?? null : null)}
      onToggle={(id, on) => on && keep.mutate(id)}
      onAccept={admin ? (w) => void accept(w as Warning) : undefined}
      linkFor={(w) => (w.link?.page ? paths.site(org.id, site.id, w.link.page) : null)}
      renderLink={(to, label) => (
        <Link to={to} className="text-[13px] font-medium text-accent-text hover:underline">
          {label}
        </Link>
      )}
    />
  );
}
