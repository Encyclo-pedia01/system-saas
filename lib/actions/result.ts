import type { ZodError } from 'zod';
import { z } from 'zod';

export type FieldErrors = Record<string, string[] | undefined>;

export type ActionResult<T = unknown> = {
  ok: boolean;
  message?: string;
  fieldErrors?: FieldErrors;
  data?: T;
};

export function failure(message: string, fieldErrors?: FieldErrors): ActionResult<never> {
  return { ok: false, message, fieldErrors };
}

export function success<T>(message?: string, data?: T): ActionResult<T> {
  return { ok: true, message, data };
}

export function fromZodError(error: ZodError): ActionResult<never> {
  return failure('Please correct the highlighted fields.', z.flattenError(error).fieldErrors);
}

// Maps a Postgres or PostgREST error into a message that is safe to show users.
export function databaseFailure(error: { code?: string; message: string }, fallback: string): ActionResult<never> {
  if (error.code === '42501') {
    return failure('You do not have permission to do that.');
  }

  if (error.code === '23505') {
    return failure('That record already exists.');
  }

  if (error.code === 'P0002') {
    return failure('That record could not be found.');
  }

  if (error.code === 'check_violation' || error.code === '23514') {
    return failure(error.message);
  }

  return failure(fallback);
}
