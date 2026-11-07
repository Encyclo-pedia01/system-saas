import { readTable } from '@/lib/students/roster';

export const maxScoreRows = 500;

export type ScoreRow = {
  line: number;
  admissionNumber: string;
  score: number | null;
  issue: string | null;
};

export type ScoreParseResult = { ok: true; rows: ScoreRow[] } | { ok: false; message: string };

const admissionHeaders = ['admissionnumber', 'admissionno', 'admissionnum', 'admission', 'admno'];
const scoreHeaders = ['score', 'marks', 'mark', 'total', 'result'];
const numberPattern = /^\d+(\.\d{1,2})?$/;

function normaliseHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, '');
}

// Reads a score file and flags problems. Rows with a blank score are left out, not errors.
// The first row must have an Admission number column and a Score column.
export async function parseScoreFile(file: File, maxScore: number): Promise<ScoreParseResult> {
  let table: string[][];
  try {
    table = await readTable(file);
  } catch {
    return { ok: false, message: 'That file could not be read. Save it as .csv or .xlsx and try again.' };
  }

  const [headerRow, ...dataRows] = table;
  if (!headerRow) return { ok: false, message: 'The file is empty.' };

  const headers = headerRow.map(normaliseHeader);
  const admissionColumn = headers.findIndex((h) => admissionHeaders.includes(h));
  const scoreColumn = headers.findIndex((h) => scoreHeaders.includes(h));

  if (admissionColumn === -1 || scoreColumn === -1) {
    return { ok: false, message: 'The first row must include an Admission number column and a Score column. Download the template to see the right headers.' };
  }
  if (dataRows.length > maxScoreRows) {
    return { ok: false, message: `Upload at most ${maxScoreRows} scores at a time.` };
  }

  const seen = new Map<string, number>();
  const rows: ScoreRow[] = [];

  dataRows.forEach((cells, index) => {
    const line = index + 2;
    const admissionNumber = (cells[admissionColumn] ?? '').trim();
    const rawScore = (cells[scoreColumn] ?? '').trim();

    if (admissionNumber === '' && rawScore === '') return;

    let score: number | null = null;
    let issue: string | null = null;
    const key = admissionNumber.toLowerCase();

    if (admissionNumber === '') {
      issue = 'Admission number is missing.';
    } else if (seen.has(key)) {
      issue = `Admission number repeats line ${seen.get(key)}.`;
    }

    if (rawScore === '') {
      // No score entered: skipped on purpose.
    } else if (!numberPattern.test(rawScore)) {
      issue = issue ?? 'Score must be a number, such as 14 or 17.5.';
    } else {
      score = Number(rawScore);
      if (score > maxScore) issue = issue ?? `Score is above the maximum of ${maxScore}.`;
    }

    if (admissionNumber !== '' && !seen.has(key)) seen.set(key, line);

    rows.push({ line, admissionNumber, score, issue });
  });

  if (rows.length === 0) return { ok: false, message: 'No student rows were found below the header row.' };

  return { ok: true, rows };
}
