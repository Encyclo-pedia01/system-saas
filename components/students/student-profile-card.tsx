// Profile card for one student. Shows initials until students have photos.
export function StudentProfileCard({
  name,
  classLabel,
  admissionNumber,
}: {
  name: string;
  classLabel: string;
  admissionNumber: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <li className="flex items-center gap-3 rounded-xl border border-[var(--border)] p-3">
      <span
        aria-hidden="true"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--hover)] text-sm font-semibold text-[var(--muted)]"
      >
        {initials}
      </span>
      <div className="min-w-0">
        <p className="truncate font-semibold">{name}</p>
        <p className="truncate text-xs text-[var(--muted)]">
          {classLabel} · {admissionNumber}
        </p>
      </div>
    </li>
  );
}
