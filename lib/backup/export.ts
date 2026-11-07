import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

// Tables included in a school export. Each is read through the owner's own session,
// so the database access rules decide what appears. Nothing is read with the service key.
export const exportTables = [
  'institutions',
  'classes',
  'class_groups',
  'students',
  'subjects',
  'terms',
  'assessments',
  'assessment_scores',
  'exam_scores',
  'grading_keys',
  'results',
  'check_ins',
  'insights',
] as const;

const pageSize = 1000;

// PostgREST returns at most 1000 rows per request, so read in pages until a short page arrives.
async function readAll(supabase: SupabaseClient, table: string, institutionId: string): Promise<unknown[]> {
  const rows: unknown[] = [];
  for (let from = 0; ; from += pageSize) {
    // The schools table is keyed by its own id; every other table carries institution_id.
    const scopeColumn = table === 'institutions' ? 'id' : 'institution_id';
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq(scopeColumn, institutionId)
      .order('id')
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`Could not read ${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

export async function buildSchoolExport(supabase: SupabaseClient, institutionId: string) {
  const tables: Record<string, unknown[]> = {};
  for (const table of exportTables) {
    tables[table] = await readAll(supabase, table, institutionId);
  }

  return {
    format: 'campus-veritas-export',
    formatVersion: 1,
    schemaVersion: '0010',
    generatedAt: new Date().toISOString(),
    institutionId,
    counts: Object.fromEntries(Object.entries(tables).map(([name, rows]) => [name, rows.length])),
    tables,
  };
}
