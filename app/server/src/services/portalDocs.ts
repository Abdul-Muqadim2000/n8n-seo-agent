import { isClientRole, PLATFORM_NAME, type ReportFile } from '@seo/shared';
import type { OrgAccess } from '../auth/access';
import { config } from '../config';
import type { FileRow, OrgRow } from '../db/schema';
import { brandForOrg, orgById } from './brandOf';
import { rebrandDocument } from './docRebrand';

/**
 * G5 (WHITE_LABEL.md §6): the documents a white-label client gets. Agency staff always get the engine's originals; a client person
 * (and anybody opening a share link of a white-label workspace) gets every file we can rewrite with the agency's name in place of
 * the engine's report brand and ours, and does not get the ones we cannot (the engine's PDF, an old .doc, an unknown binary).
 */

const NOT_REWRITABLE = new Set(['pdf', 'doc', 'other']);
export const rewritableKind = (kind: string) => !NOT_REWRITABLE.has(kind);

type Servable = Pick<FileRow, 'kind' | 'fileName' | 'data'>;

async function brandedFile(org: OrgRow | null, f: Servable): Promise<Servable | null> {
  const brand = await brandForOrg(org);
  if (!brand) return f;
  const r = rebrandDocument(f.kind, f.data, [config.engineBrand, PLATFORM_NAME], brand.name);
  if (!r.rewritable) return null;
  return { ...f, data: r.data };
}

/** the file list a person sees on a report */
export async function portalFiles(a: OrgAccess, files: ReportFile[]): Promise<ReportFile[]> {
  if (!isClientRole(a.role)) return files;
  if (!(await brandForOrg(a.org))) return files;
  return files.filter((f) => rewritableKind(f.kind));
}

/** one file as this person may receive it; null = not offered to them */
export async function portalFile(a: OrgAccess, f: FileRow): Promise<Servable | null> {
  if (!isClientRole(a.role)) return f;
  return brandedFile(a.org, f);
}

/** one file behind a share link of this company */
export async function shareFile(orgId: string, f: FileRow): Promise<Servable | null> {
  return brandedFile(await orgById(orgId), f);
}
