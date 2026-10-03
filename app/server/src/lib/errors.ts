import type { ZodError } from 'zod';
import { fieldErrors } from '@seo/shared';

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, fields?: Record<string, string>, code?: string) => new HttpError(400, message, code, fields);
export const unauthorized = (message = 'Please sign in') => new HttpError(401, message, 'unauthorized');
export const forbidden = (message = 'You do not have access to this') => new HttpError(403, message, 'forbidden');
export const notFound = (message = 'Not found') => new HttpError(404, message, 'not_found');
export const conflict = (message: string, code?: string) => new HttpError(409, message, code);

export function validationError(error: ZodError): HttpError {
  const fields = fieldErrors(error);
  const first = Object.values(fields)[0] ?? 'Please check the form';
  return new HttpError(400, first, 'validation', fields);
}

/** Parses with a zod schema and throws a 400 with field errors on failure. */
export function parse<T>(schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: ZodError } }, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success) throw validationError(r.error);
  return r.data;
}
