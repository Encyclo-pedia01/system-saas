'use client';

import { useActionState, useState } from 'react';

import {
  addClassAction,
  assignTeacherAction,
  createTeacherLinkAction,
  deleteClassAction,
  editClassAction,
  removeGroupAction,
} from '@/app/(app)/classes/actions';
import { FieldError } from '@/components/ui/field-error';
import { SubmitButton } from '@/components/ui/submit-button';
import { useActionToast } from '@/components/ui/use-action-toast';
import type { ActionResult } from '@/lib/actions/result';
import { classLevels, levelLabels, presetClassNames, type ClassLevel } from '@/lib/validation/classes';

export type StaffOption = { userId: string; label: string };

export type ClassRecord = {
  id: string;
  name: string;
  level: ClassLevel | null;
  hasGroups: boolean;
  groups: Array<{ id: string; name: string }>;
  studentCount: number;
  teacherUserId: string | null;
  teacherLabel: string | null;
  pendingEmail: string | null;
  pendingExpiresAt: string | null;
};

type TeacherLink = { link: string; expiresAt: string };

export function formatAccraTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Accra' });
}

function LinkBox({ link, expiresAt }: TeacherLink) {
  return (
    <div className="mt-2 space-y-1 rounded-md bg-[var(--hover)] p-3">
      <p className="text-xs text-[var(--muted)]">Send this link privately. It expires at {formatAccraTime(expiresAt)} (30 minutes after it was made).</p>
      <div className="flex gap-2">
        <input readOnly value={link} aria-label="Teacher invitation link" className="field-input min-w-0 flex-1 text-xs" onFocus={(event) => event.currentTarget.select()} />
        <button type="button" className="btn btn-ghost" onClick={() => void navigator.clipboard?.writeText(link)}>Copy</button>
      </div>
    </div>
  );
}

export function AddClassForm({ staff }: { staff: StaffOption[] }) {
  const [state, action] = useActionState<ActionResult<{ teacherLink?: TeacherLink }> | null, FormData>(addClassAction, null);
  const [level, setLevel] = useState<ClassLevel | ''>('');
  const [presetName, setPresetName] = useState('');
  const [customName, setCustomName] = useState(false);
  const [hasGroups, setHasGroups] = useState(false);
  const [teacherMode, setTeacherMode] = useState<'none' | 'existing' | 'invite'>('none');
  useActionToast(state);
  const errors = state?.fieldErrors;

  const presets = level ? presetClassNames[level] : [];

  return (
    <form action={action} className="space-y-5" noValidate>
      <fieldset>
        <legend className="field-label mb-2">Level</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {classLevels.map((value) => (
            <label key={value} className="flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-sm">
              <input
                type="radio"
                name="level"
                value={value}
                checked={level === value}
                onChange={() => {
                  setLevel(value);
                  setPresetName('');
                  setCustomName(false);
                }}
                className="accent-[var(--accent)]"
              />
              {levelLabels[value]}
            </label>
          ))}
        </div>
        <FieldError messages={errors?.level} />
      </fieldset>

      <div>
        <label htmlFor="class-name" className="field-label">Class</label>
        {level && !customName ? (
          <select
            id="class-name"
            name="name"
            value={presetName}
            onChange={(event) => {
              if (event.target.value === '__other') {
                setCustomName(true);
                setPresetName('');
              } else {
                setPresetName(event.target.value);
              }
            }}
            className="field-input"
            aria-invalid={Boolean(errors?.name)}
          >
            <option value="">Choose a class</option>
            {presets.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
            <option value="__other">Another name…</option>
          </select>
        ) : (
          <input
            id="class-name"
            name="name"
            placeholder={level ? 'Type the class name' : 'Choose a level first'}
            disabled={!level}
            className="field-input"
            aria-invalid={Boolean(errors?.name)}
          />
        )}
        <FieldError messages={errors?.name} />
      </div>

      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" name="hasGroups" checked={hasGroups} onChange={(event) => setHasGroups(event.target.checked)} className="h-5 w-5 accent-[var(--accent)]" />
        This class is divided into groups (for example A and B)
      </label>
      {hasGroups ? (
        <div>
          <label htmlFor="group-names" className="field-label">Group names</label>
          <input id="group-names" name="groupNames" placeholder="A, B" className="field-input" aria-invalid={Boolean(errors?.groupNames)} />
          <FieldError messages={errors?.groupNames} />
        </div>
      ) : (
        <p className="text-xs text-[var(--muted)]">One class, no groups.</p>
      )}

      <fieldset className="space-y-3">
        <legend className="field-label mb-1">Class teacher</legend>
        <div className="flex flex-wrap gap-4 text-sm">
          {(['none', 'existing', 'invite'] as const).map((mode) => (
            <label key={mode} className="flex items-center gap-2">
              <input type="radio" name="teacherMode" value={mode} checked={teacherMode === mode} onChange={() => setTeacherMode(mode)} className="accent-[var(--accent)]" />
              {mode === 'none' ? 'Assign later' : mode === 'existing' ? 'Existing staff member' : 'Invite a new teacher'}
            </label>
          ))}
        </div>
        {teacherMode === 'existing' && (
          <div>
            <select name="teacherUserId" className="field-input" defaultValue="" aria-invalid={Boolean(errors?.teacherUserId)}>
              <option value="">Choose a teacher</option>
              {staff.map((member) => (
                <option key={member.userId} value={member.userId}>{member.label}</option>
              ))}
            </select>
            <FieldError messages={errors?.teacherUserId} />
          </div>
        )}
        {teacherMode === 'invite' && (
          <div>
            <input name="teacherEmail" type="email" placeholder="teacher@example.com" className="field-input" aria-invalid={Boolean(errors?.teacherEmail)} />
            <p className="mt-1 text-xs text-[var(--muted)]">A link is shown after saving. It expires 30 minutes after it is made.</p>
            <FieldError messages={errors?.teacherEmail} />
          </div>
        )}
      </fieldset>

      {state?.data?.teacherLink && <LinkBox {...state.data.teacherLink} />}
      <SubmitButton variant="primary" pendingLabel="Saving…">Save class</SubmitButton>
    </form>
  );
}

export function EditClassForm({ classItem }: { classItem: ClassRecord }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(editClassAction, null);
  const [hasGroups, setHasGroups] = useState(classItem.hasGroups);
  useActionToast(state);
  const errors = state?.fieldErrors;

  return (
    <div className="space-y-5">
      <form action={action} className="space-y-4" noValidate>
        <input type="hidden" name="classId" value={classItem.id} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`name-${classItem.id}`} className="field-label">Class name</label>
            <input id={`name-${classItem.id}`} name="name" defaultValue={classItem.name} className="field-input" aria-invalid={Boolean(errors?.name)} />
            <FieldError messages={errors?.name} />
          </div>
          <div>
            <label htmlFor={`level-${classItem.id}`} className="field-label">Level</label>
            <select id={`level-${classItem.id}`} name="level" defaultValue={classItem.level ?? ''} className="field-input" aria-invalid={Boolean(errors?.level)}>
              <option value="" disabled>Choose a level</option>
              {classLevels.map((value) => (
                <option key={value} value={value}>{levelLabels[value]}</option>
              ))}
            </select>
            <FieldError messages={errors?.level} />
          </div>
        </div>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="hasGroups" checked={hasGroups} onChange={(event) => setHasGroups(event.target.checked)} className="h-5 w-5 accent-[var(--accent)]" />
          Divided into groups
        </label>
        {hasGroups && (
          <div>
            <label htmlFor={`newgroups-${classItem.id}`} className="field-label">Add groups</label>
            <input id={`newgroups-${classItem.id}`} name="newGroupNames" placeholder="C, D" className="field-input" />
            <FieldError messages={errors?.newGroupNames} />
          </div>
        )}
        {state && !state.ok && state.message && <p role="alert" className="text-sm text-[var(--danger)]">{state.message}</p>}
        <SubmitButton variant="ghost" pendingLabel="Saving…">Save changes</SubmitButton>
      </form>

      {classItem.groups.length > 0 && (
        <div>
          <p className="field-label">Groups</p>
          <ul className="divide-y divide-[var(--border)] text-sm">
            {classItem.groups.map((group) => (
              <li key={group.id} className="flex items-center justify-between py-2">
                <span>{classItem.name} {group.name}</span>
                <form action={removeGroupAction}>
                  <input type="hidden" name="groupId" value={group.id} />
                  <button type="submit" className="btn btn-ghost text-xs">Remove</button>
                </form>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-[var(--muted)]">A group with students in it cannot be removed. Move them first.</p>
        </div>
      )}

      <DeleteClassForm classItem={classItem} />
    </div>
  );
}

function DeleteClassForm({ classItem }: { classItem: ClassRecord }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(deleteClassAction, null);
  useActionToast(state);
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(`Delete ${classItem.name}? This cannot be undone.`)) event.preventDefault();
      }}
    >
      <input type="hidden" name="classId" value={classItem.id} />
      <SubmitButton variant="danger" pendingLabel="Deleting…">Delete class</SubmitButton>
      <p className="mt-1 text-xs text-[var(--muted)]">Only empty classes can be deleted.</p>
    </form>
  );
}

export function TeacherRow({ classItem, staff }: { classItem: ClassRecord; staff: StaffOption[] }) {
  const [linkState, linkAction] = useActionState<ActionResult<TeacherLink> | null, FormData>(createTeacherLinkAction, null);
  const [assignState, assignAction] = useActionState<ActionResult | null, FormData>(assignTeacherAction, null);
  useActionToast(assignState);
  const [mode, setMode] = useState<'assign' | 'invite'>('assign');
  const hasTeacher = Boolean(classItem.teacherUserId);
  const currentLink = linkState?.ok && linkState.data ? linkState.data : null;

  return (
    <tr className="align-top">
      <td className="py-3 pr-4 font-medium">{classItem.name}</td>
      <td className="py-3 pr-4 text-sm text-[var(--muted)]">{classItem.level ? levelLabels[classItem.level] : 'Level not set'}</td>
      <td className="py-3 pr-4 text-sm">
        {hasTeacher ? (
          <div className="flex flex-wrap items-center gap-2">
            <span>{classItem.teacherLabel}</span>
            <form action={assignAction}>
              <input type="hidden" name="classId" value={classItem.id} />
              <input type="hidden" name="userId" value="" />
              <button type="submit" className="btn btn-ghost text-xs">Remove</button>
            </form>
          </div>
        ) : classItem.pendingEmail ? (
          <span className="text-[var(--muted)]">Waiting for {classItem.pendingEmail}{classItem.pendingExpiresAt ? `, link expires ${formatAccraTime(classItem.pendingExpiresAt)}` : ''}</span>
        ) : (
          <span className="text-[var(--muted)]">No teacher yet</span>
        )}
        {assignState && !assignState.ok && <p role="alert" className="mt-1 text-xs text-[var(--danger)]">{assignState.message}</p>}
      </td>
      <td className="py-3 text-sm">
        {!hasTeacher && (
          <div className="space-y-2">
            <div className="flex gap-3 text-xs">
              <button type="button" onClick={() => setMode('assign')} className={mode === 'assign' ? 'font-semibold' : 'text-[var(--muted)]'}>Assign staff</button>
              <button type="button" onClick={() => setMode('invite')} className={mode === 'invite' ? 'font-semibold' : 'text-[var(--muted)]'}>Invite teacher</button>
            </div>
            {mode === 'assign' ? (
              <form action={assignAction} className="flex gap-2">
                <input type="hidden" name="classId" value={classItem.id} />
                <select name="userId" className="field-input text-xs" defaultValue="" aria-label={`Teacher for ${classItem.name}`}>
                  <option value="">Choose a teacher</option>
                  {staff.map((member) => (
                    <option key={member.userId} value={member.userId}>{member.label}</option>
                  ))}
                </select>
                <SubmitButton variant="ghost" pendingLabel="…">Assign</SubmitButton>
              </form>
            ) : (
              <form action={linkAction} className="flex gap-2">
                <input type="hidden" name="classId" value={classItem.id} />
                <input name="email" type="email" placeholder="teacher@example.com" className="field-input text-xs" aria-label={`Teacher email for ${classItem.name}`} />
                <SubmitButton variant="ghost" pendingLabel="…">Make link</SubmitButton>
              </form>
            )}
          </div>
        )}

        {!hasTeacher && linkState && !linkState.ok && linkState.message && (
          <p role="alert" className="mt-1 text-xs text-[var(--danger)]">{linkState.message}</p>
        )}

        {classItem.pendingEmail && !hasTeacher && (
          <form action={linkAction} className="mt-2">
            <input type="hidden" name="classId" value={classItem.id} />
            <input type="hidden" name="email" value={classItem.pendingEmail} />
            <SubmitButton variant="ghost" pendingLabel="Making link…">Regenerate link</SubmitButton>
          </form>
        )}

        {currentLink && <LinkBox {...currentLink} />}
      </td>
    </tr>
  );
}
