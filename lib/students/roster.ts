import { readSheet } from 'read-excel-file/browser';

export const maxRosterRows = 500;

export type RosterRow = {
  line: number;
  fullName: string;
  admissionNumber: string;
  issue: string | null;
};

export type RosterParseResult = { ok: true; rows: RosterRow[] } | { ok: false; message: string };

const nameHeaders = ['fullname', 'name', 'studentname', 'student'];
const admissionHeaders = ['admissionnumber', 'admissionno', 'admissionnum', 'admission', 'admno'];

function normaliseHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, '');
}

// Splits one CSV line, honouring double-quoted fields with embedded commas.
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (quoted) {
      if (char === '"' && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

async function readTable(file: File): Promise<string[][]> {
  if (file.name.toLowerCase().endsWith('.xlsx')) {
    const sheet = await readSheet(file);
    return sheet.map((row) => row.map((cell) => (cell === null || cell === undefined ? '' : String(cell).trim())));
  }

  const text = await file.text();
  return text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map(splitCsvLine);
}

export async function parseRosterFile(file: File): Promise<RosterParseResult> {
  let table: string[][];

  try {
    table = await readTable(file);
  } catch {
    return { ok: false, message: 'That file could not be read. Save it as .csv or .xlsx and try again.' };
  }

  const [headerRow, ...dataRows] = table;
  if (!headerRow) {
    return { ok: false, message: 'The file is empty.' };
  }

  const headers = headerRow.map(normaliseHeader);
  const nameColumn = headers.findIndex((header) => nameHeaders.includes(header));
  const admissionColumn = headers.findIndex((header) => admissionHeaders.includes(header));

  if (nameColumn === -1 || admissionColumn === -1) {
    return { ok: false, message: 'The first row must include a Name column and an Admission number column.' };
  }

  if (dataRows.length > maxRosterRows) {
    return { ok: false, message: `Upload at most ${maxRosterRows} students at a time.` };
  }

  const seen = new Map<string, number>();
  const rows: RosterRow[] = [];

  dataRows.forEach((cells, index) => {
    const line = index + 2;
    const fullName = (cells[nameColumn] ?? '').trim();
    const admissionNumber = (cells[admissionColumn] ?? '').trim();

    if (fullName === '' && admissionNumber === '') {
      return;
    }

    let issue: string | null = null;
    const key = admissionNumber.toLowerCase();

    if (fullName.length < 2) {
      issue = 'Name is missing or too short.';
    } else if (fullName.length > 120) {
      issue = 'Name is longer than 120 characters.';
    } else if (admissionNumber === '') {
      issue = 'Admission number is missing.';
    } else if (admissionNumber.length > 40) {
      issue = 'Admission number is longer than 40 characters.';
    } else if (seen.has(key)) {
      issue = `Admission number repeats line ${seen.get(key)}.`;
    }

    if (admissionNumber !== '' && !seen.has(key)) {
      seen.set(key, line);
    }

    rows.push({ line, fullName, admissionNumber, issue });
  });

  if (rows.length === 0) {
    return { ok: false, message: 'No student rows were found under the header.' };
  }

  return { ok: true, rows };
}
