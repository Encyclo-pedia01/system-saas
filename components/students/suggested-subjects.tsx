'use client';

import { useActionState } from 'react';

import { createSuggestedSubjectAction } from '@/app/(app)/students/actions';
import { useActionToast } from '@/components/ui/use-action-toast';
import type { ActionResult } from '@/lib/actions/result';
import { levelLabels, type ClassLevel } from '@/lib/validation/classes';

type Group = { level: ClassLevel; subjects: string[] };

export function SuggestedSubjects({ groups }: { groups: Group[] }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(createSuggestedSubjectAction, null);
  useActionToast(state);

  if (groups.length === 0) {
    return <p className="text-sm text-[var(--muted)]">Every suggested subject is already on your list.</p>;
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <div key={group.level}>
          <h3 className="mb-2 text-sm font-semibold text-[var(--muted)]">{levelLabels[group.level]}</h3>
          <form action={action} className="flex flex-wrap gap-2">
            {group.subjects.map((subject) => (
              <button
                key={subject}
                type="submit"
                name="name"
                value={subject}
                disabled={pending}
                className="btn btn-ghost min-h-11"
              >
                + {subject}
              </button>
            ))}
          </form>
        </div>
      ))}
    </div>
  );
}
