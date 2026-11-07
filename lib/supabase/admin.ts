import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

import { readEnv } from '@/lib/env';

// Service-role client. Used only for auth administration (sending invitations and
// rolling back a failed school provisioning). It never reaches the browser.
export function createAdminClient() {
  return createSupabaseClient(
    readEnv('NEXT_PUBLIC_SUPABASE_URL'),
    readEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
