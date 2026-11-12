import 'server-only';

import ExcelJS from 'exceljs';

type SchoolExport = {
  format: string;
  formatVersion: number;
  schemaVersion: string;
  generatedAt: string;
  institutionId: string;
  counts: Record<string, number>;
  tables: Record<string, unknown[]>;
};

// Excel sheet names are limited to 31 characters.
function sheetName(table: string): string {
  return table.slice(0, 31);
}

// Nested values (objects, arrays) are written as JSON text so every cell holds one value.
function cellValue(value: unknown): ExcelJS.CellValue {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object' && !(value instanceof Date)) return JSON.stringify(value);
  return value as ExcelJS.CellValue;
}

export async function buildSchoolWorkbook(exported: SchoolExport): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Campus Veritas';
  workbook.created = new Date(exported.generatedAt);

  const summary = workbook.addWorksheet('Summary');
  summary.columns = [
    { header: 'Item', key: 'item', width: 28 },
    { header: 'Value', key: 'value', width: 40 },
  ];
  summary.addRows([
    { item: 'Format', value: exported.format },
    { item: 'Format version', value: exported.formatVersion },
    { item: 'Schema version', value: exported.schemaVersion },
    { item: 'Generated at', value: exported.generatedAt },
    { item: 'Institution ID', value: exported.institutionId },
    ...Object.entries(exported.counts).map(([table, count]) => ({ item: `Rows: ${table}`, value: count })),
  ]);
  summary.getRow(1).font = { bold: true };

  for (const [table, rows] of Object.entries(exported.tables)) {
    const sheet = workbook.addWorksheet(sheetName(table));
    const keys = [...new Set(rows.flatMap((row) => Object.keys(row as object)))];
    sheet.columns = keys.map((key) => ({ header: key, key, width: Math.min(Math.max(key.length + 2, 12), 40) }));
    for (const row of rows) {
      const record = row as Record<string, unknown>;
      sheet.addRow(Object.fromEntries(keys.map((key) => [key, cellValue(record[key])])));
    }
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
  }

  const bytes = await workbook.xlsx.writeBuffer();
  return Buffer.from(bytes);
}
