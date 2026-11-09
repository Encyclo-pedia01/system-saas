import { NextResponse } from 'next/server';

import { buildSchoolExport } from '@/lib/backup/export';
import { getViewer } from '@/lib/auth/viewer';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const viewer = await getViewer();

  // Owners of an active school only. Read-only impersonation is refused so a platform admin
  // cannot take a school's data out unnoticed.
  if (!viewer || viewer.effectiveRole !== 'owner' || viewer.readOnly || !viewer.institution) {
    return NextResponse.json({ message: 'Only the school owner can download a backup.' }, { status: 403 });
  }

  const supabase = await createClient();
  let exported;
  try {
    exported = await buildSchoolExport(supabase, viewer.institution.id);
  } catch {
    return NextResponse.json({ message: 'The backup could not be created. Try again.' }, { status: 500 });
  }

  const date = new Date().toISOString().slice(0, 10);
  const filename = `campus-veritas-${viewer.institution.slug}-${date}.json`;

  return new NextResponse(JSON.stringify(exported, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
