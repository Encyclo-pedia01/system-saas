import 'server-only';

import { createHash, randomBytes } from 'node:crypto';

// Invitation tokens are random and shown once. Only the SHA-256 hash is stored.
export function createInvitationToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
