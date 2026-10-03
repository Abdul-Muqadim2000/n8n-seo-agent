import { hash, verify } from '@node-rs/argon2';

// argon2id with the library defaults (19 MiB, 2 passes) — the OWASP-recommended baseline.
export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

/** Constant-ish work for unknown e-mails, so login timing does not reveal which addresses have accounts. */
const DUMMY = hash('not-a-real-password-0000');
export async function burnPasswordCheck(password: string): Promise<void> {
  await verifyPassword(await DUMMY, password);
}
