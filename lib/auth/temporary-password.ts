import 'server-only';

import { randomInt } from 'node:crypto';

// Set by the platform administrator. Only the server can write app metadata, so the user cannot clear it.
export const MUST_CHANGE_PASSWORD_KEY = 'must_change_password';
export const TEMP_PASSWORD_EXPIRES_KEY = 'temp_password_expires_at';
export const TEMP_PASSWORD_HOURS = 24;

// No characters that are easy to confuse (0/O, 1/l/I).
const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

export function generateTemporaryPassword(length = 16): string {
  let password = '';
  for (let index = 0; index < length; index += 1) {
    password += alphabet[randomInt(alphabet.length)];
  }
  return password;
}

export type TemporaryPasswordState = {
  mustChange: boolean;
  expiresAt: string | null;
  expired: boolean;
};

export function readTemporaryPasswordState(appMetadata: Record<string, unknown> | null | undefined, now = new Date()): TemporaryPasswordState {
  const mustChange = appMetadata?.[MUST_CHANGE_PASSWORD_KEY] === true;
  const expiresAt = typeof appMetadata?.[TEMP_PASSWORD_EXPIRES_KEY] === 'string' ? (appMetadata[TEMP_PASSWORD_EXPIRES_KEY] as string) : null;
  const expired = mustChange && expiresAt !== null && new Date(expiresAt).getTime() <= now.getTime();
  return { mustChange, expiresAt, expired };
}
