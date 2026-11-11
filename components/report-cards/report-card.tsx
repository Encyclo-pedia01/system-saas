// The printed terminal report card. Used by the owner's print page and the teacher preview,
// so both show exactly the same layout.

export type ReportCardData = {
  school: string;
  term: string;
  className: string;
  studentName: string;
  admissionNumber: string;
  subjects: Array<{ subject: string; grade: number; letter: string; label: string; subjectPosition: number; subjectOutOf: number }>;
  average: number | null;
  position: number | null;
  classSize: number;
  classTeacherRemark: string | null;
  headmasterRemark: string | null;
  nextTerm: { name: string; startsOn: string } | null;
};

export function ordinal(n: number): string {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
  return `${n}${suffix}`;
}

export function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export const reportCardCss = `
.print-area { font-family: system-ui, sans-serif; color: #1e2b2a; }
.rc-page { background: #fff; color: #1e2b2a; max-width: 780px; margin: 0 auto 28px; padding: 28px; border: 1px solid #e6dccb; border-radius: 8px; }
.rc-page h1 { font-size: 20px; margin: 0; }
.rc-page h2 { font-size: 14px; margin: 18px 0 6px; text-transform: uppercase; letter-spacing: .08em; color: #55625f; }
.rc-page table { width: 100%; border-collapse: collapse; font-size: 13px; }
.rc-page th, .rc-page td { border-bottom: 1px solid #ece4d4; padding: 6px 8px; text-align: left; }
.rc-page th { background: #faf6ee; }
.rc-page .num { text-align: right; font-variant-numeric: tabular-nums; }
.rc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; font-size: 13px; margin-top: 12px; }
.rc-sign { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; margin-top: 36px; font-size: 12px; }
.rc-sign div { border-top: 1px solid #1e2b2a; padding-top: 4px; }
.rc-notice { color: #55625f; font-size: 14px; }
.rc-draft { color: #9a6200; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; }
@media print {
  body * { visibility: hidden !important; }
  .print-area, .print-area * { visibility: visible !important; }
  .print-area { position: absolute; left: 0; top: 0; width: 100%; }
  .rc-page { border: 0; border-radius: 0; margin: 0; padding: 0; max-width: none; break-after: page; page-break-after: always; }
  .rc-page:last-child { break-after: auto; page-break-after: auto; }
  .no-print { display: none !important; }
  @page { size: A4; margin: 14mm; }
}
`;

export function ReportCardSection({
  card,
  name,
  blocked,
  draft = false,
  logoUrl = null,
}: {
  card: ReportCardData | null;
  name: string;
  blocked: boolean;
  draft?: boolean;
  logoUrl?: string | null;
}) {
  if (blocked || !card) {
    return (
      <section className="rc-page">
        <h1>Report card for {name}</h1>
        <p className="rc-notice">This card cannot be printed yet because some grades are missing. Compute the grades in Grading first.</p>
      </section>
    );
  }
  return (
    <section className="rc-page" aria-label={`Report card for ${card.studentName}`}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt={`${card.school} logo`} style={{ height: 56, width: 'auto', maxWidth: 160, objectFit: 'contain', marginBottom: 8 }} />
      ) : null}
      <p style={{ margin: 0, fontSize: 12, color: '#55625f' }}>{card.school}</p>
      {draft && <p className="rc-draft">Draft · not yet final</p>}
      <h1>Terminal report · {card.term}</h1>
      <div className="rc-meta">
        <div><strong>Student:</strong> {card.studentName}</div>
        <div><strong>Class:</strong> {card.className}</div>
        <div><strong>Admission no.:</strong> {card.admissionNumber}</div>
        <div><strong>Position in class:</strong> {card.position ? `${ordinal(card.position)} of ${card.classSize}` : '—'}</div>
      </div>

      <h2>Subjects</h2>
      <table>
        <thead>
          <tr>
            <th scope="col">Subject</th>
            <th scope="col" className="num">Score</th>
            <th scope="col">Grade</th>
            <th scope="col">Remark</th>
            <th scope="col">Position</th>
          </tr>
        </thead>
        <tbody>
          {card.subjects.map((row) => (
            <tr key={row.subject}>
              <td>{row.subject}</td>
              <td className="num">{row.grade}</td>
              <td>{row.letter}</td>
              <td>{row.label}</td>
              <td>{ordinal(row.subjectPosition)} of {row.subjectOutOf}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="rc-meta" style={{ marginTop: 14 }}>
        <div><strong>Average:</strong> {card.average ?? '—'}</div>
        <div><strong>Next term begins:</strong> {card.nextTerm ? formatDate(card.nextTerm.startsOn) : '—'}</div>
      </div>

      <h2>Class teacher&apos;s remark</h2>
      <p style={{ fontSize: 13, minHeight: 36 }}>{card.classTeacherRemark || ' '}</p>
      <h2>Headmaster&apos;s remark</h2>
      <p style={{ fontSize: 13, minHeight: 36 }}>{card.headmasterRemark || ' '}</p>

      <div className="rc-sign">
        <div>Class teacher</div>
        <div>Headmaster</div>
        <div>Parent or guardian</div>
      </div>
    </section>
  );
}
