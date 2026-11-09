import Link from 'next/link';

import { SetupGuideToggle } from '@/components/dashboard/setup-guide-toggle';
import type { SetupItem } from '@/lib/dashboard/setup-status';

// Shows what the owner still has to set up. Once everything is done it collapses to one line,
// and it can be opened again from there.
export function SetupChecklist({ items, hidden = false }: { items: SetupItem[]; hidden?: boolean }) {
  const remaining = items.filter((item) => !item.done);
  const nextStep = remaining[0]?.key;

  if (remaining.length === 0) {
    return (
      <details className="depth-card p-5">
        <summary className="cursor-pointer text-sm font-semibold text-[var(--muted)] focus-visible:outline-none">
          Setup complete. Show the checklist
        </summary>
        <ChecklistItems items={items} nextStep={undefined} />
      </details>
    );
  }

  if (hidden) {
    return (
      <section aria-label="Setup guide" className="depth-card p-5">
        <p className="text-sm font-semibold">
          Setup guide hidden · {items.length - remaining.length} of {items.length} steps done
        </p>
        <SetupGuideToggle hidden />
      </section>
    );
  }

  return (
    <section aria-labelledby="setup-heading" className="depth-card p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="setup-heading" className="text-lg font-semibold">Set up your school</h2>
        <span className="text-sm text-[var(--muted)]">
          {items.length - remaining.length} of {items.length} done
        </span>
      </div>
      <ChecklistItems items={items} nextStep={nextStep} />
      <SetupGuideToggle hidden={false} />
    </section>
  );
}

function ChecklistItems({ items, nextStep }: { items: SetupItem[]; nextStep: SetupItem['key'] | undefined }) {
  return (
    <ol className="mt-4 divide-y divide-[var(--border)]">
      {items.map((item) => (
        <li key={item.key} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-medium">
              <span aria-hidden="true" className={item.done ? 'text-[var(--tone-success-text)]' : 'text-[var(--muted)]'}>
                {item.done ? '✓' : '○'}
              </span>
              <span className={item.done ? 'text-[var(--muted)] line-through decoration-1' : undefined}>{item.label}</span>
              {item.key === nextStep && (
                <span className="badge bg-[var(--highlight)] text-[var(--highlight-text)]">Next step</span>
              )}
            </p>
            <p className="ml-6 text-xs text-[var(--muted)]">{item.description}</p>
          </div>
          {!item.done && (
            <Link href={item.href} aria-label={`${item.label}: open setup`} className="btn btn-ghost min-h-11 px-4 text-sm">
              Open
            </Link>
          )}
        </li>
      ))}
    </ol>
  );
}
