'use server';

import { revalidatePath } from 'next/cache';

import type { ActionResult } from '@/lib/actions/result';
import { databaseFailure, failure, fromZodError, success } from '@/lib/actions/result';
import { resolveWriteContext } from '@/lib/auth/write-guard';
import { createInvitationToken, hashInvitationToken } from '@/lib/invitations/token';
import { siteUrl } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import {
  addClassSchema,
  assignTeacherSchema,
  classTeacherSchema,
  editClassSchema,
  parseGroupList,
} from '@/lib/validation/classes';

type TeacherLink = { link: string; expiresAt: string };

// Creates a teacher invitation for a class. Any open link for that class is revoked first, so
// there is only ever one live link per class. The database sets the 30-minute expiry.
async function createClassTeacherInvite(
  institutionId: string,
  classId: string,
  email: string,
  ownerId: string,
): Promise<ActionResult<TeacherLink>> {
  const supabase = await createClient();
  const sentAt = Date.now();

  const { error: revokeError } = await supabase
    .from('invitations')
    .update({ revoked_at: new Date().toISOString() })
    .eq('institution_id', institutionId)
    .eq('class_id', classId)
    .eq('kind', 'class_teacher')
    .is('accepted_at', null)
    .is('revoked_at', null);
  if (revokeError) return databaseFailure(revokeError, 'Could not replace the old link.');

  const token = createInvitationToken();
  const { data: created, error } = await supabase
    .from('invitations')
    .insert({
      institution_id: institutionId,
      email,
      role: 'staff',
      invited_by: ownerId,
      token_hash: hashInvitationToken(token),
      class_id: classId,
      kind: 'class_teacher',
    })
    .select('expires_at')
    .single();

  if (error || !created) {
    if (error?.code === '23505') {
      return failure('That email already has a pending invitation. Cancel it on the Team page first.');
    }
    return databaseFailure(error ?? { message: 'missing row' }, 'Could not create the teacher link.');
  }

  const expiresAt = created.expires_at ?? new Date(sentAt + 30 * 60 * 1000).toISOString();
  return success('Link created. It expires in 30 minutes.', {
    link: `${siteUrl()}/invite/${token}`,
    expiresAt,
  });
}

export async function addClassAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult<{ teacherLink?: TeacherLink }>> {
  const guard = await resolveWriteContext(['owner']);
  if (!guard.ok) return failure(guard.message);

  const parsed = addClassSchema.safeParse({
    level: formData.get('level'),
    name: formData.get('name'),
    hasGroups: formData.get('hasGroups') === 'on',
    groupNames: formData.get('hasGroups') === 'on' ? parseGroupList(String(formData.get('groupNames') ?? '')) : [],
    teacherMode: formData.get('teacherMode') ?? 'none',
    teacherUserId: String(formData.get('teacherUserId') ?? ''),
    teacherEmail: String(formData.get('teacherEmail') ?? ''),
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const institutionId = guard.context.institutionId;
  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from('classes')
    .insert({
      institution_id: institutionId,
      name: parsed.data.name,
      level: parsed.data.level,
      has_groups: parsed.data.hasGroups,
    })
    .select('id')
    .single();

  if (error || !created) {
    return databaseFailure(error ?? { message: 'missing row' }, 'Could not create the class.');
  }

  if (parsed.data.hasGroups) {
    const { error: groupError } = await supabase.from('class_groups').insert(
      parsed.data.groupNames.map((name) => ({ institution_id: institutionId, class_id: created.id, name })),
    );
    if (groupError) {
      await supabase.from('classes').delete().eq('id', created.id);
      return databaseFailure(groupError, 'Could not add the groups.');
    }
  }

  if (parsed.data.teacherMode === 'existing') {
    const { error: teacherError } = await supabase.rpc('set_class_teacher_checked', {
      p_class_id: created.id,
      p_user_id: parsed.data.teacherUserId,
    });
    if (teacherError) {
      revalidatePath('/classes');
      return databaseFailure(teacherError, 'The class was saved, but the teacher could not be assigned.');
    }
  }

  let teacherLink: TeacherLink | undefined;
  if (parsed.data.teacherMode === 'invite') {
    const invite = await createClassTeacherInvite(institutionId, created.id, parsed.data.teacherEmail, guard.context.userId);
    if (!invite.ok || !invite.data) {
      revalidatePath('/classes');
      return failure(`The class was saved, but the teacher link could not be created. ${invite.message ?? ''}`.trim());
    }
    teacherLink = invite.data;
  }

  revalidatePath('/classes');
  revalidatePath('/students');
  return success(`Class “${parsed.data.name}” added.`, { teacherLink });
}

export async function editClassAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const guard = await resolveWriteContext(['owner']);
  if (!guard.ok) return failure(guard.message);

  const parsed = editClassSchema.safeParse({
    classId: formData.get('classId'),
    level: formData.get('level'),
    name: formData.get('name'),
    hasGroups: formData.get('hasGroups') === 'on',
    newGroupNames: parseGroupList(String(formData.get('newGroupNames') ?? '')),
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const institutionId = guard.context.institutionId;
  const supabase = await createClient();

  const { error } = await supabase
    .from('classes')
    .update({ name: parsed.data.name, level: parsed.data.level, has_groups: parsed.data.hasGroups })
    .eq('id', parsed.data.classId)
    .eq('institution_id', institutionId);
  if (error) return databaseFailure(error, 'Could not save the class.');

  if (parsed.data.hasGroups && parsed.data.newGroupNames.length > 0) {
    const { error: groupError } = await supabase.from('class_groups').insert(
      parsed.data.newGroupNames.map((name) => ({ institution_id: institutionId, class_id: parsed.data.classId, name })),
    );
    if (groupError) return databaseFailure(groupError, 'Could not add the groups.');
  }

  revalidatePath('/classes');
  revalidatePath('/students');
  return success('Class saved.');
}

export async function removeGroupAction(formData: FormData): Promise<void> {
  const guard = await resolveWriteContext(['owner']);
  if (!guard.ok) return;

  const groupId = String(formData.get('groupId') ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(groupId)) return;

  const supabase = await createClient();
  await supabase
    .from('class_groups')
    .delete()
    .eq('id', groupId)
    .eq('institution_id', guard.context.institutionId);

  revalidatePath('/classes');
  revalidatePath('/students');
}

export async function deleteClassAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const guard = await resolveWriteContext(['owner']);
  if (!guard.ok) return failure(guard.message);

  const classId = String(formData.get('classId') ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(classId)) return failure('Choose a class.');

  const supabase = await createClient();
  const { error } = await supabase
    .from('classes')
    .delete()
    .eq('id', classId)
    .eq('institution_id', guard.context.institutionId);
  if (error) return databaseFailure(error, 'Could not delete the class.');

  revalidatePath('/classes');
  revalidatePath('/students');
  return success('Class deleted.');
}

export async function assignTeacherAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const guard = await resolveWriteContext(['owner']);
  if (!guard.ok) return failure(guard.message);

  const parsed = assignTeacherSchema.safeParse({
    classId: formData.get('classId'),
    userId: String(formData.get('userId') ?? ''),
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const userId = parsed.data.userId === '' ? null : parsed.data.userId;
  const { error } = await supabase.rpc('set_class_teacher_checked', {
    p_class_id: parsed.data.classId,
    p_user_id: userId,
  });
  if (error) return databaseFailure(error, 'Could not update the class teacher.');

  revalidatePath('/classes');
  return success(userId ? 'Class teacher assigned.' : 'Class teacher removed.');
}

export async function createTeacherLinkAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult<TeacherLink>> {
  const guard = await resolveWriteContext(['owner']);
  if (!guard.ok) return failure(guard.message);

  const parsed = classTeacherSchema.safeParse({
    classId: formData.get('classId'),
    email: String(formData.get('email') ?? '').trim(),
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const result = await createClassTeacherInvite(
    guard.context.institutionId,
    parsed.data.classId,
    parsed.data.email,
    guard.context.userId,
  );
  if (result.ok) revalidatePath('/classes');
  return result;
}
