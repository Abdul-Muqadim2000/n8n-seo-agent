// What an admin can do to a person (the Users table's row menu and the person's page): suspend, sign out everywhere, a password reset
// link, mark verified, add to a company / change a role, remove from a company, delete. Nothing here acts on the signed-in admin.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Building2, KeyRound, LogOut, MailCheck, MoreHorizontal, Pause, Play, Trash2, UserRound } from 'lucide-react';
import { ADMIN_ROLES, ROLE_LABELS, type AdminUserRow } from '@seo/shared';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/feedback';
import { Field, Select } from '@/components/ui/field';
import { CopyButton } from '@/components/ui/misc';
import { Dialog, Menu, MenuItem, MenuSeparator } from '@/components/ui/overlay';
import { ApiRequestError, errorMessage } from '@/lib/api';
import { useAdminCompanies, useAdminDeleteUser, useAdminRevokeSessions, useAdminSetMembership, useAdminUpdateUser, useMe, usePost } from '@/lib/queries';
import { useAdminPeriod } from '../AdminLayout';
import { ConfirmDialog } from './kit';
import { adminPaths, withPeriod } from '../lib';

export type AdminRole = (typeof ADMIN_ROLES)[number];
export const roleLabel = (r: string) => ROLE_LABELS[r as keyof typeof ROLE_LABELS] ?? r;

type UserDlg = 'suspend' | 'revoke' | 'reset' | 'verify' | 'membership' | 'delete' | null;

/** the row menu (`compact`) or the person page's button row */
export function UserActions({ user, compact, afterDelete }: { user: AdminUserRow; compact?: boolean; afterDelete?: () => void }) {
  const me = useMe();
  const navigate = useNavigate();
  const [period] = useAdminPeriod();
  const [dlg, setDlg] = useState<UserDlg>(null);
  const self = me.data?.user.id === user.id;
  const close = () => setDlg(null);
  const items = (
    <>
      {compact && (
        <>
          <MenuItem icon={<UserRound className="size-4" />} onSelect={() => navigate(withPeriod(adminPaths.user(user.id), period))}>
            Open
          </MenuItem>
          <MenuSeparator />
        </>
      )}
      <MenuItem icon={<Building2 className="size-4" />} onSelect={() => setDlg('membership')}>
        Add to a company or change role
      </MenuItem>
      <MenuItem icon={<KeyRound className="size-4" />} onSelect={() => setDlg('reset')}>
        Password reset link
      </MenuItem>
      {!user.emailVerified && (
        <MenuItem icon={<MailCheck className="size-4" />} onSelect={() => setDlg('verify')}>
          Mark e-mail verified
        </MenuItem>
      )}
      <MenuSeparator />
      <MenuItem icon={<LogOut className="size-4" />} onSelect={() => setDlg('revoke')} disabled={self}>
        Sign out everywhere
      </MenuItem>
      <MenuItem icon={user.suspended ? <Play className="size-4" /> : <Pause className="size-4" />} onSelect={() => setDlg('suspend')} disabled={self}>
        {user.suspended ? 'Unsuspend' : 'Suspend'}
      </MenuItem>
      <MenuItem danger icon={<Trash2 className="size-4" />} onSelect={() => setDlg('delete')} disabled={self}>
        Delete user
      </MenuItem>
    </>
  );
  return (
    <>
      <Menu
        trigger={
          compact ? (
            <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${user.name}`} onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="size-4" />
            </Button>
          ) : (
            <Button variant="secondary" icon={<MoreHorizontal className="size-4" />}>
              Actions
            </Button>
          )
        }
      >
        {items}
      </Menu>
      {dlg === 'suspend' && <SuspendDialog user={user} onClose={close} />}
      {dlg === 'verify' && <VerifyDialog user={user} onClose={close} />}
      {dlg === 'revoke' && <RevokeDialog user={user} onClose={close} />}
      {dlg === 'reset' && <ResetDialog user={user} onClose={close} />}
      {dlg === 'membership' && <MembershipDialog user={user} onClose={close} />}
      {dlg === 'delete' && <DeleteUserDialog user={user} onClose={close} afterDelete={afterDelete} />}
    </>
  );
}

function SuspendDialog({ user, onClose }: { user: AdminUserRow; onClose: () => void }) {
  const update = useAdminUpdateUser();
  const suspend = !user.suspended;
  return (
    <ConfirmDialog
      open
      onClose={onClose}
      title={suspend ? `Suspend ${user.name}?` : `Unsuspend ${user.name}?`}
      description={
        suspend
          ? 'They are signed out everywhere and cannot sign in until unsuspended. Their companies, runs and reports are untouched.'
          : 'They can sign in again with their password, Google or single sign-on.'
      }
      confirmLabel={suspend ? 'Suspend' : 'Unsuspend'}
      danger={suspend}
      pending={update.isPending}
      error={update.error}
      onConfirm={() =>
        update.mutate(
          { id: user.id, suspended: suspend },
          {
            onSuccess: () => {
              toast.success(suspend ? `${user.name} is suspended` : `${user.name} can sign in again`);
              onClose();
            },
          },
        )
      }
    />
  );
}

function VerifyDialog({ user, onClose }: { user: AdminUserRow; onClose: () => void }) {
  const update = useAdminUpdateUser();
  return (
    <ConfirmDialog
      open
      onClose={onClose}
      title={`Mark ${user.email} verified?`}
      description="You vouch that this address belongs to them. They will not be asked to confirm it."
      confirmLabel="Mark verified"
      pending={update.isPending}
      error={update.error}
      onConfirm={() =>
        update.mutate(
          { id: user.id, markVerified: true },
          {
            onSuccess: () => {
              toast.success(`${user.email} is verified`);
              onClose();
            },
          },
        )
      }
    />
  );
}

function RevokeDialog({ user, onClose }: { user: AdminUserRow; onClose: () => void }) {
  const revoke = useAdminRevokeSessions();
  return (
    <ConfirmDialog
      open
      onClose={onClose}
      title={`Sign ${user.name} out everywhere?`}
      description={`Ends ${user.activeSessions} active session${user.activeSessions === 1 ? '' : 's'} on every device. They can sign in again straight away.`}
      confirmLabel="Sign out everywhere"
      pending={revoke.isPending}
      error={revoke.error}
      onConfirm={() =>
        revoke.mutate(user.id, {
          onSuccess: (r) => {
            toast.success(`${user.name} is signed out${r?.revoked != null ? ` (${r.revoked} session${r.revoked === 1 ? '' : 's'})` : ''}`);
            onClose();
          },
        })
      }
    />
  );
}

function ResetDialog({ user, onClose }: { user: AdminUserRow; onClose: () => void }) {
  const create = usePost<{ email: string }, { url: string; expiresInHours: number; name: string }>('/api/admin/users/reset-link');
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Password reset link for ${user.name}`}
      description="The platform sends no e-mails: create a one-time link and send it to them yourself."
      footer={
        create.data ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button loading={create.isPending} onClick={() => create.mutate({ email: user.email })}>
              Create link
            </Button>
          </>
        )
      }
    >
      {create.data ? (
        <div className="space-y-2">
          <p className="text-sm text-ink">Valid for {create.data.expiresInHours} hours. Anyone with this link can set the password of {user.email}.</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-lg bg-surface-2 px-3 py-2 font-mono text-xs text-ink-2">{create.data.url}</code>
            <CopyButton text={create.data.url} />
          </div>
        </div>
      ) : create.isError ? (
        <Callout tone="critical">{errorMessage(create.error)}</Callout>
      ) : (
        <p className="text-sm text-ink-2">
          For <span className="font-mono text-[13px]">{user.email}</span>.{' '}
          {!user.hasPassword && (user.google ? 'They sign in with Google today; the link lets them add a password.' : 'They have no password yet; the link lets them set one.')}
        </p>
      )}
    </Dialog>
  );
}

function MembershipDialog({ user, onClose }: { user: AdminUserRow; onClose: () => void }) {
  const [period] = useAdminPeriod();
  const companies = useAdminCompanies(period);
  const save = useAdminSetMembership();
  const [orgId, setOrgId] = useState(user.companies[0]?.id ?? '');
  const current = user.companies.find((c) => c.id === orgId);
  const [role, setRole] = useState<AdminRole>((current?.role as AdminRole) ?? 'member');
  const list = (companies.data ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Company access · ${user.name}`}
      description="Add them to a company, or change their role in one they are already in."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!orgId}
            loading={save.isPending}
            onClick={() =>
              save.mutate(
                { userId: user.id, orgId, role },
                {
                  onSuccess: () => {
                    const name = list.find((c) => c.id === orgId)?.name ?? 'the company';
                    toast.success(current ? `${user.name} is now ${roleLabel(role)} in ${name}` : `${user.name} added to ${name} as ${roleLabel(role)}`);
                    onClose();
                  },
                },
              )
            }
          >
            {current ? 'Change role' : 'Add to company'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
        <Field label="Company">
          {(p) => (
            <Select
              {...p}
              value={orgId}
              onChange={(e) => {
                setOrgId(e.target.value);
                const m = user.companies.find((c) => c.id === e.target.value);
                if (m) setRole(m.role as AdminRole);
              }}
              disabled={companies.isPending}
            >
              <option value="">{companies.isPending ? 'Loading…' : 'Choose a company'}</option>
              {list.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {user.companies.some((m) => m.id === c.id) ? ' (member)' : ''}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Role">
          {(p) => (
            <Select {...p} value={role} onChange={(e) => setRole(e.target.value as AdminRole)}>
              {ADMIN_ROLES.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      {companies.isError && <Callout tone="critical" className="mt-3">{errorMessage(companies.error)}</Callout>}
      {save.isError && <Callout tone="critical" className="mt-3">{errorMessage(save.error)}</Callout>}
    </Dialog>
  );
}

type SoleCompany = { id: string; name: string; slug?: string };
const companiesOf = (e: unknown): SoleCompany[] => {
  const list = e instanceof ApiRequestError ? e.data.companies : null;
  return Array.isArray(list) ? (list as SoleCompany[]).filter((c) => c && typeof c.id === 'string') : [];
};

/**
 * Delete, typed e-mail first. The server refuses when the person is the only owner of a company with other members (`sole_owner`:
 * shown verbatim with those companies), and asks when they are the only member of a company (`sole_member_companies`): the admin then
 * chooses to delete those companies too or keep them without members, and the request is sent again with that choice.
 */
function DeleteUserDialog({ user, onClose, afterDelete }: { user: AdminUserRow; onClose: () => void; afterDelete?: () => void }) {
  const del = useAdminDeleteUser();
  const [period] = useAdminPeriod();
  const [sole, setSole] = useState<SoleCompany[] | null>(null);
  const [choice, setChoice] = useState<'delete' | 'keep'>('keep');
  const err = del.error instanceof ApiRequestError ? del.error : null;
  const blocking = err?.code === 'sole_owner' ? companiesOf(err) : [];
  const send = () =>
    del.mutate(
      { id: user.id, soleCompanies: sole ? choice : undefined },
      {
        onSuccess: (r) => {
          const gone = r?.deletedCompanies?.length ? ` with ${r.deletedCompanies.map((c) => c.name).join(', ')}` : '';
          toast.success(`${user.email} is deleted${gone}`);
          onClose();
          afterDelete?.();
        },
        onError: (e) => {
          if (e instanceof ApiRequestError && e.code === 'sole_member_companies') setSole(companiesOf(e));
        },
      },
    );
  const showError = del.error != null && !(err?.code === 'sole_member_companies' && sole);
  return (
    <ConfirmDialog
      open
      onClose={onClose}
      title={`Delete ${user.name}?`}
      description={`Deletes the account, its sessions and its memberships in ${user.companies.length} compan${user.companies.length === 1 ? 'y' : 'ies'}. Companies and their runs stay unless you choose otherwise below. This cannot be undone.`}
      confirmLabel={sole ? (choice === 'delete' ? `Delete user and ${sole.length} compan${sole.length === 1 ? 'y' : 'ies'}` : 'Delete user, keep companies') : 'Delete user'}
      danger
      typed={user.email}
      typedLabel={
        <>
          Type their e-mail <code className="break-all font-mono text-[13px]">{user.email}</code> to confirm
        </>
      }
      pending={del.isPending}
      error={showError ? del.error : undefined}
      onConfirm={send}
    >
      {sole && (
        <fieldset className="space-y-2 rounded-lg border border-line px-4 py-3">
          <legend className="px-1 text-[13px] font-medium text-ink">
            {user.name} is the only member of {sole.map((c) => c.name).join(', ')}
          </legend>
          {(['keep', 'delete'] as const).map((v) => (
            <label key={v} className="flex cursor-pointer items-start gap-2.5 text-sm">
              <input type="radio" name="sole-companies" value={v} checked={choice === v} onChange={() => setChoice(v)} className="mt-1 accent-[var(--accent)]" />
              <span>
                <span className="block text-ink">{v === 'keep' ? 'Keep the companies, without members' : 'Delete the companies too'}</span>
                <span className="block text-[13px] text-ink-3">
                  {v === 'keep'
                    ? 'Their websites, runs, reports and credits stay; you can add someone to them later.'
                    : 'Their websites (with the engine’s keyword ladders), runs, reports and credit ledgers are deleted.'}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      {!!blocking.length && (
        <ul className="space-y-1 text-[13px]">
          {blocking.map((c) => (
            <li key={c.id}>
              <Link to={withPeriod(adminPaths.company(c.id), period)} className="font-medium text-accent-text hover:underline">
                {c.name}
              </Link>{' '}
              <span className="text-ink-3">: make another member owner there first</span>
            </li>
          ))}
        </ul>
      )}
    </ConfirmDialog>
  );
}

export function UserFlags({ u }: { u: AdminUserRow }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {u.suspended && <StatusBadge tone="critical">Suspended</StatusBadge>}
      {u.platformAdmin && <Badge tone="accent">Platform admin</Badge>}
      {!u.emailVerified && <StatusBadge tone="warning">Unverified</StatusBadge>}
    </span>
  );
}

