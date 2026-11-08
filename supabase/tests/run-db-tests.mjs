// Database test runner: applies migrations to an empty database, then runs the
// RLS, grading, insight, audit, and impersonation checks. Check-in was removed in migration 0012.
//
// Usage:
//   npm run db:test                      (local Supabase: supabase start, then db reset)
//   DATABASE_URL=... LOCAL_AUTH_SHIM=1 node supabase/tests/run-db-tests.mjs
//
// Each test runs inside its own transaction that is rolled back, so tests never
// affect each other.

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const IDS = {
  superAdmin: '00000000-0000-4000-8000-000000000001',
  ownerA: '00000000-0000-4000-8000-000000000002',
  staffA: '00000000-0000-4000-8000-000000000003',
  authorityA: '00000000-0000-4000-8000-000000000004',
  ownerB: '00000000-0000-4000-8000-000000000005',
  authorityB: '00000000-0000-4000-8000-000000000006',
  encyclopediaA: '00000000-0000-4000-8000-000000000007',
  schoolA: '10000000-0000-4000-8000-000000000001',
  schoolB: '10000000-0000-4000-8000-000000000002',
  classA: '20000000-0000-4000-8000-000000000001',
  classB: '20000000-0000-4000-8000-000000000002',
  subjectA: '30000000-0000-4000-8000-000000000001',
  subjectB: '30000000-0000-4000-8000-000000000002',
  termA: '40000000-0000-4000-8000-000000000001',
  termB: '40000000-0000-4000-8000-000000000002',
  studentA1: '50000000-0000-4000-8000-000000000001',
  studentA2: '50000000-0000-4000-8000-000000000002',
  studentB1: '50000000-0000-4000-8000-000000000003',
  assessmentA: '60000000-0000-4000-8000-000000000001',
  assessmentB: '60000000-0000-4000-8000-000000000002',
};

// ---------------------------------------------------------------------------
// Setup: migrations and committed fixtures
// ---------------------------------------------------------------------------

async function applyMigrations(client) {
  const existing = await client.query("select to_regclass('public.institutions') as t");
  if (existing.rows[0].t) {
    throw new Error('Database is not empty. Run `supabase db reset` (or recreate the database) first.');
  }

  if (process.env.LOCAL_AUTH_SHIM === '1') {
    await client.query(readFileSync(join(root, 'supabase/tests/setup/local_auth_shim.sql'), 'utf8'));
  }

  const dir = join(root, 'supabase/migrations');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    await client.query(readFileSync(join(dir, file), 'utf8'));
    console.log(`  applied ${file}`);
  }
}

async function seedFixtures(client) {
  await client.query('begin');
  const users = [
    [IDS.superAdmin, 'super@platform.test', 'Platform Admin'],
    [IDS.ownerA, 'owner.a@alpha.test', 'Alpha Owner'],
    [IDS.staffA, 'staff.a@alpha.test', 'Alpha Teacher'],
    [IDS.authorityA, 'authority.a@alpha.test', 'Alpha Authority'],
    [IDS.ownerB, 'owner.b@beta.test', 'Beta Owner'],
    [IDS.authorityB, 'authority.b@beta.test', 'Beta Authority'],
    [IDS.encyclopediaA, 'encyclopedia.a@alpha.test', 'Alpha Encyclopedia'],
  ];
  for (const [id, email, fullName] of users) {
    await client.query(
      'insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)',
      [id, email, JSON.stringify({ full_name: fullName })],
    );
  }
  await client.query('update public.profiles set is_super_admin = true where id = $1', [IDS.superAdmin]);

  await client.query(
    `insert into public.institutions (id, name, slug, school_start_time) values
       ($1, 'Alpha Academy', 'alpha-academy', '08:00'),
       ($2, 'Beta College', 'beta-college', '08:00')`,
    [IDS.schoolA, IDS.schoolB],
  );

  await client.query(
    `insert into public.memberships (user_id, institution_id, role) values
       ($1, $2, 'owner'), ($3, $2, 'staff'), ($4, $2, 'authority'),
       ($5, $6, 'owner'), ($7, $6, 'authority'), ($8, $2, 'school_admin')`,
    [IDS.ownerA, IDS.schoolA, IDS.staffA, IDS.authorityA, IDS.ownerB, IDS.schoolB, IDS.authorityB, IDS.encyclopediaA],
  );

  await client.query(
    `insert into public.classes (id, institution_id, name) values
       ($1, $2, 'Grade 5'), ($3, $4, 'Grade 5')`,
    [IDS.classA, IDS.schoolA, IDS.classB, IDS.schoolB],
  );
  await client.query(
    `insert into public.subjects (id, institution_id, name) values
       ($1, $2, 'Mathematics'), ($3, $4, 'Mathematics')`,
    [IDS.subjectA, IDS.schoolA, IDS.subjectB, IDS.schoolB],
  );
  await client.query(
    `insert into public.terms (id, institution_id, name, starts_on, ends_on) values
       ($1, $2, 'Term 1', '2026-09-01', '2026-12-18'),
       ($3, $4, 'Term 1', '2026-09-01', '2026-12-18')`,
    [IDS.termA, IDS.schoolA, IDS.termB, IDS.schoolB],
  );
  await client.query(
    `insert into public.students (id, institution_id, class_id, full_name, admission_number) values
       ($1, $2, $3, 'Ama Mensah', 'ALP-001'),
       ($4, $2, $3, 'Kofi Boateng', 'ALP-002'),
       ($5, $6, $7, 'Esi Owusu', 'BET-001')`,
    [IDS.studentA1, IDS.schoolA, IDS.classA, IDS.studentA2, IDS.studentB1, IDS.schoolB, IDS.classB],
  );
  await client.query(
    `insert into public.assessments (id, institution_id, class_id, subject_id, term_id, title, max_score) values
       ($1, $2, $3, $4, $5, 'Class Test 1', 20),
       ($6, $7, $8, $9, $10, 'Class Test 1', 20)`,
    [IDS.assessmentA, IDS.schoolA, IDS.classA, IDS.subjectA, IDS.termA,
      IDS.assessmentB, IDS.schoolB, IDS.classB, IDS.subjectB, IDS.termB],
  );
  await client.query('commit');
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

// Switches the session to an authenticated user (or back to the migrator when null).
async function asUser(c, userId) {
  if (userId === null) {
    await c.query('reset role');
    await c.query("select set_config('request.jwt.claims', '', true)");
    return;
  }
  await c.query('set local role authenticated');
  await c.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ sub: userId, role: 'authenticated' }),
  ]);
}

async function asAnon(c) {
  await c.query('set local role anon');
  await c.query("select set_config('request.jwt.claims', '', true)");
}

// Runs a statement that must fail, and asserts the error message matches.
// Uses a savepoint so the surrounding transaction stays usable.
async function expectFailure(c, sql, params, pattern) {
  await c.query('savepoint expect_failure');
  try {
    await c.query(sql, params);
  } catch (err) {
    await c.query('rollback to savepoint expect_failure');
    assert.match(err.message, pattern, `unexpected error: ${err.message}`);
    return;
  }
  await c.query('rollback to savepoint expect_failure');
  assert.fail(`expected failure matching ${pattern}, but the statement succeeded`);
}

async function scalar(c, sql, params = []) {
  const { rows } = await c.query(sql, params);
  return rows[0] ? Object.values(rows[0])[0] : null;
}

// ---------------------------------------------------------------------------
// Tests. Each receives a client inside a transaction that is rolled back afterwards.
// ---------------------------------------------------------------------------

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// --- Tenant isolation -------------------------------------------------------

test('owner sees only their own school', async (c) => {
  await asUser(c, IDS.ownerA);
  assert.equal(await scalar(c, 'select count(*) from public.institutions'), '1');
  assert.equal(await scalar(c, 'select count(*) from public.students'), '2');
  assert.equal(await scalar(c, 'select count(*) from public.students where institution_id = $1', [IDS.schoolB]), '0');
  assert.equal(await scalar(c, 'select count(*) from public.classes'), '1');
});

test('anon role can read nothing', async (c) => {
  await asAnon(c);
  await expectFailure(c, 'select * from public.students', [], /permission denied/);
  await expectFailure(c, 'select * from public.institutions', [], /permission denied/);
});

test('owner cannot change another school row', async (c) => {
  await asUser(c, IDS.ownerA);
  const { rowCount } = await c.query("update public.students set full_name = 'x' where institution_id = $1", [IDS.schoolB]);
  assert.equal(rowCount, 0);
  await expectFailure(
    c,
    `insert into public.classes (institution_id, name) values ($1, 'Intruder')`,
    [IDS.schoolB],
    /row-level security/,
  );
});

test('a user cannot promote themselves to super admin', async (c) => {
  await asUser(c, IDS.ownerA);
  await expectFailure(c, 'update public.profiles set is_super_admin = true where id = $1', [IDS.ownerA], /permission denied/);
});

test('owner cannot change their own institution status', async (c) => {
  await asUser(c, IDS.ownerA);
  const { rowCount } = await c.query("update public.institutions set status = 'suspended' where id = $1", [IDS.schoolA]);
  assert.equal(rowCount, 0);
});

// --- Roles ------------------------------------------------------------------

test('staff can enter scores but cannot create assessments', async (c) => {
  await asUser(c, IDS.staffA);
  await c.query(
    `insert into public.assessment_scores (institution_id, assessment_id, student_id, score)
     values ($1, $2, $3, 15)`,
    [IDS.schoolA, IDS.assessmentA, IDS.studentA1],
  );
  await expectFailure(
    c,
    `insert into public.assessments (institution_id, class_id, subject_id, term_id, title, max_score)
     values ($1, $2, $3, $4, 'Sneaky', 10)`,
    [IDS.schoolA, IDS.classA, IDS.subjectA, IDS.termA],
    /row-level security/,
  );
});

test('staff cannot write results or compute grades', async (c) => {
  await asUser(c, IDS.staffA);
  await expectFailure(c, 'insert into public.results (institution_id, term_id, subject_id, student_id, final_grade) values ($1,$2,$3,$4,50)',
    [IDS.schoolA, IDS.termA, IDS.subjectA, IDS.studentA1], /permission denied/);
  await expectFailure(c, 'select * from public.compute_final_grade($1, $2)', [IDS.termA, IDS.subjectA],
    /only the school owner/);
});

test('authority cannot read students, insights, or results', async (c) => {
  await asUser(c, IDS.authorityA);
  assert.equal(await scalar(c, 'select count(*) from public.students'), '0');
  assert.equal(await scalar(c, 'select count(*) from public.insights'), '0');
  assert.equal(await scalar(c, 'select count(*) from public.results'), '0');
});

test('check-in is removed: officers cannot write check-ins directly', async (c) => {
  await asUser(c, IDS.authorityA);
  await expectFailure(
    c,
    `insert into public.check_ins (institution_id, student_id, school_date, time_in, status)
     values ($1, $2, '2026-11-02', now(), 'on-time')`,
    [IDS.schoolA, IDS.studentA1],
    /permission denied/,
  );
});

test('check-in is removed: officers cannot call the check-in functions', async (c) => {
  await asUser(c, IDS.authorityA);
  await expectFailure(c, 'select * from public.list_students_for_check_in($1)', [IDS.schoolA], /permission denied/);
  await expectFailure(c, 'select * from public.record_check_in($1)', [IDS.studentA1], /permission denied/);
  await expectFailure(c, 'select * from public.record_absence($1)', [IDS.studentA1], /permission denied/);
});

// --- Fee tracking ------------------------------------------------------------
// Each test runs in its own transaction, so each one creates the data it needs.

async function createTuition(c) {
  await asUser(c, IDS.ownerA);
  const { rows } = await c.query(
    `insert into public.fee_items (institution_id, term_id, class_id, name, amount_pesewas, created_by)
     values ($1, $2, $3, 'Tuition', 15000, $4) returning id`,
    [IDS.schoolA, IDS.termA, IDS.classA, IDS.ownerA],
  );
  return rows[0].id;
}

async function recordPayment(c, amount = 5000, studentId = IDS.studentA1) {
  await asUser(c, IDS.encyclopediaA);
  const { rows } = await c.query(
    `insert into public.fee_payments (institution_id, student_id, term_id, amount_pesewas, paid_on, method, recorded_by)
     values ($1, $2, $3, $4, '2026-11-05', 'cash', $5) returning id`,
    [IDS.schoolA, studentId, IDS.termA, amount, IDS.encyclopediaA],
  );
  return rows[0].id;
}

async function balanceOf(c, studentId, termId = IDS.termA) {
  return Number(await scalar(c, 'select balance_pesewas from public.fee_balances where student_id = $1 and term_id = $2', [studentId, termId]));
}

test('a fee item creates one charge for each student in the class', async (c) => {
  const feeId = await createTuition(c);
  assert.equal(await scalar(c, 'select count(*) from public.fee_charges where fee_item_id = $1', [feeId]), '2');
});

test('encyclopedia can see balances but cannot create fee items', async (c) => {
  await createTuition(c);
  await asUser(c, IDS.encyclopediaA);
  assert.equal(await scalar(c, 'select count(*) from public.fee_balances'), '2');
  await expectFailure(
    c,
    `insert into public.fee_items (institution_id, term_id, class_id, name, amount_pesewas, created_by)
     values ($1, $2, $3, 'Sneaky', 100, $4)`,
    [IDS.schoolA, IDS.termA, IDS.classA, IDS.encyclopediaA],
    /row-level security/,
  );
});

test('encyclopedia records a payment and the balance falls', async (c) => {
  await createTuition(c);
  await recordPayment(c, 5000);
  assert.equal(await balanceOf(c, IDS.studentA1), 10000);
  assert.equal(await balanceOf(c, IDS.studentA2), 15000);
});

test('encyclopedia cannot reverse a payment', async (c) => {
  await createTuition(c);
  const paymentId = await recordPayment(c, 5000);
  await asUser(c, IDS.encyclopediaA);
  await expectFailure(
    c,
    `insert into public.fee_payments (institution_id, student_id, term_id, amount_pesewas, paid_on, method, note, reverses_id, recorded_by)
     values ($1, $2, $3, -5000, '2026-11-06', 'cash', 'Keyed in twice', $4, $5)`,
    [IDS.schoolA, IDS.studentA1, IDS.termA, paymentId, IDS.encyclopediaA],
    /row-level security/,
  );
});

test('owner reverses a payment; the reversal must match and can happen only once', async (c) => {
  await createTuition(c);
  const paymentId = await recordPayment(c, 5000);
  await asUser(c, IDS.ownerA);
  await expectFailure(
    c,
    `insert into public.fee_payments (institution_id, student_id, term_id, amount_pesewas, paid_on, method, note, reverses_id, recorded_by)
     values ($1, $2, $3, -4000, '2026-11-06', 'cash', 'Keyed in twice', $4, $5)`,
    [IDS.schoolA, IDS.studentA1, IDS.termA, paymentId, IDS.ownerA],
    /must equal the original/,
  );
  await c.query(
    `insert into public.fee_payments (institution_id, student_id, term_id, amount_pesewas, paid_on, method, note, reverses_id, recorded_by)
     values ($1, $2, $3, -5000, '2026-11-06', 'cash', 'Keyed in twice', $4, $5)`,
    [IDS.schoolA, IDS.studentA1, IDS.termA, paymentId, IDS.ownerA],
  );
  assert.equal(await balanceOf(c, IDS.studentA1), 15000);
  await expectFailure(
    c,
    `insert into public.fee_payments (institution_id, student_id, term_id, amount_pesewas, paid_on, method, note, reverses_id, recorded_by)
     values ($1, $2, $3, -5000, '2026-11-06', 'cash', 'Again', $4, $5)`,
    [IDS.schoolA, IDS.studentA1, IDS.termA, paymentId, IDS.ownerA],
    /duplicate key|fee_payments_one_reversal/,
  );
});

test('payments cannot be edited or deleted', async (c) => {
  await createTuition(c);
  const paymentId = await recordPayment(c, 5000);
  await asUser(c, IDS.ownerA);
  await expectFailure(c, 'update public.fee_payments set amount_pesewas = 1 where id = $1', [paymentId],
    /permission denied|cannot be edited/);
  await expectFailure(c, 'delete from public.fee_payments where id = $1', [paymentId],
    /permission denied|cannot be edited/);
});

test('owner waives a charge once, with a reason; the waived amount leaves the balance', async (c) => {
  await createTuition(c);
  await asUser(c, IDS.ownerA);
  await expectFailure(c, 'update public.fee_charges set waived_at = now() where student_id = $1', [IDS.studentA2],
    /check constraint/);
  await expectFailure(c, 'update public.fee_charges set amount_pesewas = 1 where student_id = $1', [IDS.studentA1],
    /Only a waiver/);
  const waived = await c.query(
    `update public.fee_charges set waived_at = now(), waive_reason = 'Scholarship award' where student_id = $1`,
    [IDS.studentA2],
  );
  assert.equal(waived.rowCount, 1);
  assert.equal(await balanceOf(c, IDS.studentA2), 0);
  await expectFailure(c, "update public.fee_charges set waive_reason = 'Changed' where student_id = $1", [IDS.studentA2],
    /already been waived/);
});

test('encyclopedia cannot waive charges', async (c) => {
  await createTuition(c);
  await asUser(c, IDS.encyclopediaA);
  const result = await c.query(
    "update public.fee_charges set waived_at = now(), waive_reason = 'Not allowed' where student_id = $1",
    [IDS.studentA1],
  );
  assert.equal(result.rowCount, 0);
  assert.equal(await balanceOf(c, IDS.studentA1), 15000);
});

test('fee items cannot be edited, and removal is blocked once the term has payments', async (c) => {
  const feeId = await createTuition(c);
  await recordPayment(c, 5000);
  await asUser(c, IDS.ownerA);
  await expectFailure(c, 'update public.fee_items set amount_pesewas = 1 where id = $1', [feeId],
    /permission denied|cannot be edited/);
  await expectFailure(c, 'delete from public.fee_items where id = $1', [feeId], /locked/);
});

test('a fee item with no payments can be removed, and its charges go with it', async (c) => {
  await asUser(c, IDS.ownerB);
  const { rows } = await c.query(
    `insert into public.fee_items (institution_id, term_id, class_id, name, amount_pesewas, created_by)
     values ($1, $2, $3, 'Levy', 3000, $4) returning id`,
    [IDS.schoolB, IDS.termB, IDS.classB, IDS.ownerB],
  );
  assert.equal(await scalar(c, 'select count(*) from public.fee_charges where fee_item_id = $1', [rows[0].id]), '1');
  const removed = await c.query('delete from public.fee_items where id = $1', [rows[0].id]);
  assert.equal(removed.rowCount, 1);
  assert.equal(await scalar(c, 'select count(*) from public.fee_charges where fee_item_id = $1', [rows[0].id]), '0');
});

test('a student enrolled later is charged for fee items that apply to their class', async (c) => {
  await createTuition(c);
  await asUser(c, null);
  await c.query("update public.terms set ends_on = '2099-12-31' where id = $1", [IDS.termA]);
  await asUser(c, IDS.encyclopediaA);
  const { rows } = await c.query(
    `insert into public.students (institution_id, class_id, full_name, admission_number)
     values ($1, $2, 'Efua Tetteh', 'ALP-004') returning id`,
    [IDS.schoolA, IDS.classA],
  );
  assert.equal(await scalar(c, 'select count(*) from public.fee_charges where student_id = $1', [rows[0].id]), '1');
});

test('fee data is hidden from other schools and from staff and authority', async (c) => {
  await createTuition(c);
  await asUser(c, IDS.ownerB);
  assert.equal(await scalar(c, 'select count(*) from public.fee_items where institution_id = $1', [IDS.schoolA]), '0');
  assert.equal(await scalar(c, 'select count(*) from public.fee_charges where institution_id = $1', [IDS.schoolA]), '0');
  for (const user of [IDS.staffA, IDS.authorityA]) {
    await asUser(c, user);
    assert.equal(await scalar(c, 'select count(*) from public.fee_items'), '0');
    assert.equal(await scalar(c, 'select count(*) from public.fee_charges'), '0');
    assert.equal(await scalar(c, 'select count(*) from public.fee_payments'), '0');
    assert.equal(await scalar(c, 'select count(*) from public.fee_balances'), '0');
  }
});

// --- Report cards -----------------------------------------------------------

const BANDS = JSON.stringify([
  { letter: 'F', minScore: 0, label: 'Fail' },
  { letter: 'D', minScore: 40, label: 'Weak' },
  { letter: 'C', minScore: 50, label: 'Fair' },
  { letter: 'B', minScore: 60, label: 'Good' },
  { letter: 'A', minScore: 80, label: 'Excellent' },
]);

// Results for Alpha Academy class A in term A: Math and English, three students.
// Ama: Math 80, English 60 (average 70). Kofi: Math 70, English 60 (average 65).
// Yaw: Math 80, English 50 (average 65). Ties share positions.
async function seedClassResults(c) {
  await asUser(c, null);
  await c.query("select set_config('app.grading_engine', 'on', true)");
  const english = await c.query(
    "insert into public.subjects (institution_id, name) values ($1, 'English') returning id",
    [IDS.schoolA],
  );
  const yaw = await c.query(
    `insert into public.students (institution_id, class_id, full_name, admission_number)
     values ($1, $2, 'Yaw Asare', 'ALP-003') returning id`,
    [IDS.schoolA, IDS.classA],
  );
  const englishId = english.rows[0].id;
  const yawId = yaw.rows[0].id;
  await c.query(
    `insert into public.results (institution_id, term_id, subject_id, student_id, final_grade) values
       ($1, $2, $3, $4, 80), ($1, $2, $3, $5, 70), ($1, $2, $3, $6, 80),
       ($1, $2, $7, $4, 60), ($1, $2, $7, $5, 60), ($1, $2, $7, $6, 50)`,
    [IDS.schoolA, IDS.termA, IDS.subjectA, IDS.studentA1, IDS.studentA2, yawId, englishId],
  );
  return { englishId, yawId };
}

async function setBands(c) {
  await asUser(c, IDS.ownerA);
  await c.query('select public.set_grade_scale($1, $2::jsonb)', [IDS.schoolA, BANDS]);
}

test('owner sets a grade scale that starts at 0 with unique letters and scores', async (c) => {
  await asUser(c, IDS.ownerA);
  const { rows } = await c.query('select public.set_grade_scale($1, $2::jsonb) as n', [IDS.schoolA, BANDS]);
  assert.equal(Number(rows[0].n), 5);
  await expectFailure(c, 'select public.set_grade_scale($1, $2::jsonb)', [IDS.schoolA,
    JSON.stringify([{ letter: 'A', minScore: 10, label: 'High' }])], /must start at 0/);
  await expectFailure(c, 'select public.set_grade_scale($1, $2::jsonb)', [IDS.schoolA,
    JSON.stringify([{ letter: 'A', minScore: 0, label: 'One' }, { letter: 'A', minScore: 50, label: 'Two' }])],
  /used only once/);
  await expectFailure(c, 'select public.set_grade_scale($1, $2::jsonb)', [IDS.schoolA,
    JSON.stringify([{ letter: 'A', minScore: 0, label: 'One' }, { letter: 'B', minScore: 0, label: 'Two' }])],
  /same score/);
});

test('encyclopedia cannot set the grade scale or assign class teachers', async (c) => {
  await asUser(c, IDS.encyclopediaA);
  await expectFailure(c, 'select public.set_grade_scale($1, $2::jsonb)', [IDS.schoolA, BANDS], /Only the school owner/);
  await expectFailure(c, 'select public.set_class_teacher($1, $2)', [IDS.classA, IDS.staffA], /Only the school owner/);
});

test('a class teacher is a staff member and writes remarks only for their own class', async (c) => {
  await asUser(c, IDS.ownerA);
  await c.query('select public.set_class_teacher($1, $2)', [IDS.classA, IDS.staffA]);
  await expectFailure(c, 'select public.set_class_teacher($1, $2)', [IDS.classA, IDS.authorityA], /must be a staff member/);

  await asUser(c, IDS.staffA);
  await c.query(
    `insert into public.report_remarks (institution_id, term_id, student_id, kind, body, written_by)
     values ($1, $2, $3, 'class_teacher', 'Works hard in class.', $4)`,
    [IDS.schoolA, IDS.termA, IDS.studentA1, IDS.staffA],
  );
  await expectFailure(c, `insert into public.report_remarks (institution_id, term_id, student_id, kind, body, written_by)
     values ($1, $2, $3, 'class_teacher', 'Not my class.', $4)`,
    [IDS.schoolB, IDS.termB, IDS.studentB1, IDS.staffA], /row-level security|violates/);
  await expectFailure(c, `insert into public.report_remarks (institution_id, term_id, student_id, kind, body, written_by)
     values ($1, $2, $3, 'headmaster', 'Not headmaster.', $4)`,
    [IDS.schoolA, IDS.termA, IDS.studentA2, IDS.staffA], /row-level security/);
});

test('the headmaster remark is written by the owner, or by a tagged headmaster only', async (c) => {
  await asUser(c, null);
  const membership = await scalar(c, "select id from public.memberships where user_id = $1", [IDS.staffA]);
  await asUser(c, IDS.ownerA);
  await c.query('select public.set_headmaster_tag($1, true)', [membership]);
  await c.query(
    `insert into public.report_remarks (institution_id, term_id, student_id, kind, body, written_by)
     values ($1, $2, $3, 'headmaster', 'Good progress this term.', $4)`,
    [IDS.schoolA, IDS.termA, IDS.studentA1, IDS.ownerA],
  );
  await asUser(c, IDS.staffA);
  await c.query(
    `insert into public.report_remarks (institution_id, term_id, student_id, kind, body, written_by)
     values ($1, $2, $3, 'headmaster', 'Headmaster view.', $4)`,
    [IDS.schoolA, IDS.termA, IDS.studentA2, IDS.staffA],
  );
  await asUser(c, IDS.ownerA);
  await expectFailure(c, 'select public.set_headmaster_tag($1, true)', [await scalar(c, "select id from public.memberships where user_id = $1", [IDS.authorityA]) ?? '00000000-0000-0000-0000-000000000000'],
    /Only a teacher|could not be found/);
});

test('only the owner can list staff with names and emails', async (c) => {
  await asUser(c, IDS.ownerA);
  const { rows } = await c.query('select email, role from public.list_school_staff($1)', [IDS.schoolA]);
  assert.ok(rows.some((r) => r.email === 'staff.a@alpha.test' && r.role === 'staff'));
  assert.ok(!rows.some((r) => r.role === 'authority'));
  await asUser(c, IDS.encyclopediaA);
  await expectFailure(c, 'select * from public.list_school_staff($1)', [IDS.schoolA], /Only the school owner/);
});

test('remarks are limited to 300 characters', async (c) => {
  await asUser(c, IDS.ownerA);
  await expectFailure(c, `insert into public.report_remarks (institution_id, term_id, student_id, kind, body, written_by)
     values ($1, $2, $3, 'headmaster', $4, $5)`,
    [IDS.schoolA, IDS.termA, IDS.studentA1, 'x'.repeat(301), IDS.ownerA], /check constraint/);
});

test('report card position: tied students share a position, and averages rank the class', async (c) => {
  await setBands(c);
  await seedClassResults(c);
  await asUser(c, IDS.ownerA);
  const { rows } = await c.query('select public.report_card_snapshot($1, $2) as card', [IDS.termA, IDS.studentA1]);
  const card = rows[0].card;
  assert.equal(card.subjects.length, 2);
  const math = card.subjects.find((x) => x.subject === 'Mathematics');
  assert.equal(math.letter, 'A');
  assert.equal(math.subjectPosition, 1);
  assert.equal(math.subjectOutOf, 3);
  assert.equal(card.average, 70);
  assert.equal(card.position, 1);
  assert.equal(card.classSize, 3);

  const kofi = await c.query('select public.report_card_snapshot($1, $2) as card', [IDS.termA, IDS.studentA2]);
  assert.equal(kofi.rows[0].card.position, 2);
  assert.equal(kofi.rows[0].card.subjects.find((x) => x.subject === 'Mathematics').subjectPosition, 3);
});

test('missing grades block generation and are listed by student and subject', async (c) => {
  await setBands(c);
  await seedClassResults(c);
  await asUser(c, IDS.ownerA);
  assert.equal(await scalar(c, 'select count(*) from public.report_missing_grades($1, $2)', [IDS.classA, IDS.termA]), '0');
  await c.query(
    `insert into public.assessments (institution_id, class_id, subject_id, term_id, title, max_score)
     values ($1, $2, (select id from public.subjects where institution_id = $1 and name = 'English'), $3, 'Essay', 20)`,
    [IDS.schoolA, IDS.classA, IDS.termA],
  );
  await asUser(c, null);
  await c.query(
    `delete from public.results where student_id = $1 and subject_id = (select id from public.subjects where institution_id = $2 and name = 'English')`,
    [IDS.studentA2, IDS.schoolA],
  );
  await asUser(c, IDS.ownerA);
  const { rows } = await c.query('select student_name, subject_name from public.report_missing_grades($1, $2)', [IDS.classA, IDS.termA]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].student_name, 'Kofi Boateng');
  assert.equal(rows[0].subject_name, 'English');
});

test('a final card is locked: remarks cannot change until it is unlocked', async (c) => {
  await setBands(c);
  await seedClassResults(c);
  await asUser(c, IDS.ownerA);
  await c.query(
    `insert into public.report_remarks (institution_id, term_id, student_id, kind, body, written_by)
     values ($1, $2, $3, 'headmaster', 'Keep it up.', $4)`,
    [IDS.schoolA, IDS.termA, IDS.studentA1, IDS.ownerA],
  );
  const snapshot = await c.query('select public.report_card_snapshot($1, $2) as card', [IDS.termA, IDS.studentA1]);
  await c.query(
    'insert into public.report_finals (institution_id, term_id, student_id, snapshot, marked_by) values ($1, $2, $3, $4::jsonb, $5)',
    [IDS.schoolA, IDS.termA, IDS.studentA1, JSON.stringify(snapshot.rows[0].card), IDS.ownerA],
  );
  await expectFailure(c, "update public.report_remarks set body = 'Changed' where student_id = $1", [IDS.studentA1],
    /This report card is final/);
  await expectFailure(c, 'select public.set_grade_scale($1, $2::jsonb)', [IDS.schoolA, BANDS], /already final/);
  const removed = await c.query('delete from public.report_finals where student_id = $1', [IDS.studentA1]);
  assert.equal(removed.rowCount, 1);
  const changed = await c.query("update public.report_remarks set body = 'Changed' where student_id = $1", [IDS.studentA1]);
  assert.equal(changed.rowCount, 1);
});

test('only the owner can mark a card final', async (c) => {
  await setBands(c);
  await seedClassResults(c);
  await asUser(c, IDS.encyclopediaA);
  await expectFailure(c,
    'insert into public.report_finals (institution_id, term_id, student_id, snapshot, marked_by) values ($1, $2, $3, $4::jsonb, $5)',
    [IDS.schoolA, IDS.termA, IDS.studentA1, '{}', IDS.encyclopediaA], /row-level security/);
});

// --- Encyclopedia role (school_admin) --------------------------------------

test('encyclopedia sees the same students, scores, and results as the owner for its school', async (c) => {
  await asUser(c, IDS.encyclopediaA);
  assert.equal(await scalar(c, 'select count(*) from public.students'), '2');
  const adminScores = await scalar(c, 'select count(*) from public.assessment_scores');
  const adminResults = await scalar(c, 'select count(*) from public.results');
  await asUser(c, IDS.ownerA);
  assert.equal(adminScores, await scalar(c, 'select count(*) from public.assessment_scores'));
  assert.equal(adminResults, await scalar(c, 'select count(*) from public.results'));
});

test('encyclopedia can add and edit students in its school', async (c) => {
  await asUser(c, IDS.encyclopediaA);
  await c.query(
    `insert into public.students (institution_id, class_id, full_name, admission_number)
     values ($1, $2, 'Yaw Asare', 'ALP-003')`,
    [IDS.schoolA, IDS.classA],
  );
  const updated = await c.query("update public.students set full_name = 'Yaw A. Asare' where admission_number = 'ALP-003'");
  assert.equal(updated.rowCount, 1);
});

test('encyclopedia cannot delete students or scores', async (c) => {
  await asUser(c, IDS.encyclopediaA);
  const students = await c.query('delete from public.students where id = $1', [IDS.studentA2]);
  assert.equal(students.rowCount, 0);
  const scores = await c.query('delete from public.assessment_scores where student_id = $1', [IDS.studentA1]);
  assert.equal(scores.rowCount, 0);
});

test('encyclopedia can enter and edit scores', async (c) => {
  await asUser(c, IDS.encyclopediaA);
  await c.query(
    `insert into public.assessment_scores (institution_id, assessment_id, student_id, score)
     values ($1, $2, $3, 12)`,
    [IDS.schoolA, IDS.assessmentA, IDS.studentA2],
  );
  const updated = await c.query(
    'update public.assessment_scores set score = 13 where student_id = $1 and assessment_id = $2',
    [IDS.studentA2, IDS.assessmentA],
  );
  assert.equal(updated.rowCount, 1);
});

test('encyclopedia cannot change classes, subjects, or terms', async (c) => {
  await asUser(c, IDS.encyclopediaA);
  await expectFailure(c, "insert into public.classes (institution_id, name) values ($1, 'Grade 9')", [IDS.schoolA], /row-level security/);
  await expectFailure(c, "insert into public.subjects (institution_id, name) values ($1, 'Science')", [IDS.schoolA], /row-level security/);
  await expectFailure(c, "insert into public.terms (institution_id, name, starts_on, ends_on) values ($1, 'Term 9', '2027-01-01', '2027-03-01')", [IDS.schoolA], /row-level security/);
});

test('encyclopedia cannot compute grades, read grading keys, or read the audit log', async (c) => {
  await asUser(c, IDS.encyclopediaA);
  await expectFailure(c, 'select * from public.compute_final_grade($1, $2)', [IDS.termA, IDS.subjectA], /only the school owner/);
  assert.equal(await scalar(c, 'select count(*) from public.grading_keys'), '0');
  assert.equal(await scalar(c, 'select count(*) from public.audit_log'), '0');
});

test('encyclopedia can invite staff only, not owners or other encyclopedia accounts', async (c) => {
  await asUser(c, IDS.encyclopediaA);
  await c.query(
    `insert into public.invitations (institution_id, email, role, invited_by, token_hash)
     values ($1, 'new.teacher@alpha.test', 'staff', $2, 'hash-staff-1')`,
    [IDS.schoolA, IDS.encyclopediaA],
  );
  await expectFailure(
    c,
    `insert into public.invitations (institution_id, email, role, invited_by, token_hash)
     values ($1, 'new.owner@alpha.test', 'owner', $2, 'hash-owner-1')`,
    [IDS.schoolA, IDS.encyclopediaA],
    /row-level security/,
  );
  await expectFailure(
    c,
    `insert into public.invitations (institution_id, email, role, invited_by, token_hash)
     values ($1, 'new.admin@alpha.test', 'school_admin', $2, 'hash-admin-1')`,
    [IDS.schoolA, IDS.encyclopediaA],
    /row-level security/,
  );
});

test('encyclopedia cannot see or change another school\'s data', async (c) => {
  await asUser(c, IDS.encyclopediaA);
  const { rows } = await c.query('select institution_id from public.students');
  assert.ok(rows.every((row) => row.institution_id === IDS.schoolA));
  const updated = await c.query('update public.students set full_name = \'Changed\' where id = $1', [IDS.studentB1]);
  assert.equal(updated.rowCount, 0);
});

// --- Grading ----------------------------------------------------------------

async function setGradingWeights(c, weights) {
  await c.query(
    `insert into public.grading_keys (institution_id, weights, updated_by) values ($1, $2, $3)
     on conflict (institution_id) do update set weights = excluded.weights`,
    [IDS.schoolA, JSON.stringify(weights), IDS.ownerA],
  );
}

test('compute fails until the owner sets grading weights', async (c) => {
  await asUser(c, IDS.ownerA);
  await expectFailure(c, 'select * from public.compute_final_grade($1, $2)', [IDS.termA, IDS.subjectA],
    /grading weights have not been set/);
});

test('grading weights must total 100 and use the expected keys', async (c) => {
  await asUser(c, IDS.ownerA);
  await expectFailure(c, `insert into public.grading_keys (institution_id, weights) values ($1, '{"assessment":30,"exam":60}')`,
    [IDS.schoolA], /must add up to 100/);
  await expectFailure(c, `insert into public.grading_keys (institution_id, weights) values ($1, '{"assessment":50,"quiz":50}')`,
    [IDS.schoolA], /exactly the keys/);
  await expectFailure(c, `insert into public.grading_keys (institution_id, weights) values ($1, '[40,60]')`,
    [IDS.schoolA], /must be a JSON object/);
});

test('owner-computed final grade is weighted correctly and teachers cannot edit it', async (c) => {
  await asUser(c, null);
  await setGradingWeights(c, { assessment: 40, exam: 60 });
  await c.query(
    `insert into public.assessment_scores (institution_id, assessment_id, student_id, score)
     values ($1, $2, $3, 16)`,
    [IDS.schoolA, IDS.assessmentA, IDS.studentA1], // 80% of 20
  );
  await c.query(
    `insert into public.exam_scores (institution_id, class_id, subject_id, term_id, student_id, score, max_score)
     values ($1, $2, $3, $4, $5, 70, 100)`,
    [IDS.schoolA, IDS.classA, IDS.subjectA, IDS.termA, IDS.studentA1],
  );

  await asUser(c, IDS.ownerA);
  const { rows } = await c.query('select * from public.compute_final_grade($1, $2)', [IDS.termA, IDS.subjectA]);
  assert.equal(rows[0].computed_count, 1);
  assert.equal(rows[0].skipped_count, 0);

  const grade = await scalar(c, 'select final_grade from public.results where student_id = $1', [IDS.studentA1]);
  assert.equal(Number(grade), 74); // 80 * 0.40 + 70 * 0.60

  await expectFailure(c, 'update public.results set final_grade = 100', [], /permission denied/);

  await asUser(c, IDS.staffA);
  await expectFailure(c, 'update public.results set final_grade = 100', [], /permission denied/);
});

test('final_grade is protected by the trigger even for privileged sessions', async (c) => {
  await asUser(c, null);
  await expectFailure(
    c,
    `insert into public.results (institution_id, term_id, subject_id, student_id, final_grade)
     values ($1, $2, $3, $4, 60)`,
    [IDS.schoolA, IDS.termA, IDS.subjectA, IDS.studentA2],
    /final_grade can only be set by the grading engine/,
  );
});

test('exam scores cannot exceed their maximum', async (c) => {
  await asUser(c, null);
  await expectFailure(
    c,
    `insert into public.exam_scores (institution_id, class_id, subject_id, term_id, student_id, score, max_score)
     values ($1, $2, $3, $4, $5, 120, 100)`,
    [IDS.schoolA, IDS.classA, IDS.subjectA, IDS.termA, IDS.studentA1],
    /check constraint/,
  );
});

test('assessment scores cannot exceed the assessment maximum', async (c) => {
  await asUser(c, IDS.staffA);
  await expectFailure(
    c,
    `insert into public.assessment_scores (institution_id, assessment_id, student_id, score)
     values ($1, $2, $3, 25)`,
    [IDS.schoolA, IDS.assessmentA, IDS.studentA2],
    /exceeds the assessment maximum/,
  );
});

// --- Insights ---------------------------------------------------------------

test('absence rows no longer create insights (check-in removed)', async (c) => {
  await asUser(c, null);
  await c.query(
    `insert into public.check_ins (institution_id, student_id, school_date, time_in, status) values
       ($1, $2, current_date - 2, null, 'absent'),
       ($1, $2, current_date - 1, null, 'absent'),
       ($1, $2, current_date, null, 'absent')`,
    [IDS.schoolA, IDS.studentA2],
  );
  assert.equal(
    await scalar(c, "select count(*) from public.insights where student_id = $1 and kind = 'consecutive_absence'", [IDS.studentA2]),
    '0',
  );
});

test('closing a term creates missing-result insights for students without grades', async (c) => {
  await asUser(c, null);
  await c.query("select set_config('app.grading_engine', 'on', true)");
  await c.query(
    `insert into public.results (institution_id, term_id, subject_id, student_id, final_grade)
     values ($1, $2, $3, $4, 70)`,
    [IDS.schoolA, IDS.termA, IDS.subjectA, IDS.studentA1],
  );
  await c.query(
    `insert into public.assessments (institution_id, class_id, subject_id, term_id, title, max_score)
     values ($1, $2, $3, $4, 'Quiz', 10)`,
    [IDS.schoolA, IDS.classA, IDS.subjectA, IDS.termA],
  );
  await asUser(c, IDS.ownerA);
  await c.query('update public.terms set is_closed = true where id = $1', [IDS.termA]);

  const missing = await c.query(
    "select student_id from public.insights where kind = 'missing_result'",
  );
  assert.deepEqual(missing.rows.map((r) => r.student_id), [IDS.studentA2]);
});

// --- Audit ------------------------------------------------------------------

test('audit log records before and after JSON and is visible only to the owning school', async (c) => {
  await asUser(c, IDS.ownerA);
  await c.query("update public.classes set name = 'Grade 6' where id = $1", [IDS.classA]);

  const entry = await c.query(
    "select before_data ->> 'name' as before, after_data ->> 'name' as after, actor_id from public.audit_log where table_name = 'classes' and record_id = $1 and operation = 'UPDATE'",
    [IDS.classA],
  );
  assert.equal(entry.rows[0].before, 'Grade 5');
  assert.equal(entry.rows[0].after, 'Grade 6');
  assert.equal(entry.rows[0].actor_id, IDS.ownerA);

  await asUser(c, IDS.ownerB);
  assert.equal(await scalar(c, 'select count(*) from public.audit_log where institution_id = $1', [IDS.schoolA]), '0');
});

test('audit log cannot be written, edited, or deleted by clients', async (c) => {
  await asUser(c, IDS.superAdmin);
  await expectFailure(c, "insert into public.audit_log (table_name, operation) values ('x', 'INSERT')", [], /permission denied/);
  await expectFailure(c, 'delete from public.audit_log', [], /permission denied/);
  await expectFailure(c, "update public.audit_log set table_name = 'x'", [], /permission denied/);
});

// --- Super admin, suspension, and impersonation -----------------------------

test('super admin can list all institutions and suspend one', async (c) => {
  await asUser(c, IDS.superAdmin);
  assert.equal(await scalar(c, 'select count(*) from public.institutions'), '2');
  const { rowCount } = await c.query("update public.institutions set status = 'suspended' where id = $1", [IDS.schoolB]);
  assert.equal(rowCount, 1);
});

test('a suspended school\'s members lose access to tenant data', async (c) => {
  await asUser(c, null);
  await c.query("update public.institutions set status = 'suspended' where id = $1", [IDS.schoolB]);

  await asUser(c, IDS.ownerB);
  const visible = await c.query('select status from public.institutions');
  assert.equal(visible.rows[0].status, 'suspended');
  assert.equal(await scalar(c, 'select count(*) from public.students'), '0');
});

test('super admin sees no school data without an active impersonation session', async (c) => {
  await asUser(c, IDS.superAdmin);
  assert.equal(await scalar(c, 'select count(*) from public.students'), '0');
  assert.equal(await scalar(c, 'select count(*) from public.classes'), '0');
});

test('impersonation grants read-only access while the session is live', async (c) => {
  await asUser(c, IDS.superAdmin);
  await c.query(
    `insert into public.impersonation_sessions (actor_id, target_user_id, institution_id, reason, expires_at)
     values ($1, $2, $3, 'Support ticket 4411 review', now() + interval '1 hour')`,
    [IDS.superAdmin, IDS.ownerA, IDS.schoolA],
  );
  assert.equal(await scalar(c, 'select count(*) from public.students'), '2');
  await expectFailure(c, `insert into public.classes (institution_id, name) values ($1, 'Injected')`,
    [IDS.schoolA], /row-level security/);
  const { rowCount } = await c.query(`update public.students set full_name = 'Changed' where institution_id = $1`, [IDS.schoolA]);
  assert.equal(rowCount, 0, 'impersonation must not grant write access');
});

test('impersonation expires and grants nothing afterwards', async (c) => {
  await asUser(c, null);
  await c.query(
    `insert into public.impersonation_sessions (actor_id, target_user_id, institution_id, reason, started_at, expires_at)
     values ($1, $2, $3, 'Expired session check', now() - interval '2 hours', now() - interval '1 hour')`,
    [IDS.superAdmin, IDS.ownerA, IDS.schoolA],
  );
  await asUser(c, IDS.superAdmin);
  assert.equal(await scalar(c, 'select count(*) from public.students'), '0');
});

test('only a super admin can start an impersonation session', async (c) => {
  await asUser(c, IDS.ownerA);
  await expectFailure(
    c,
    `insert into public.impersonation_sessions (actor_id, target_user_id, institution_id, reason, expires_at)
     values ($1, $2, $3, 'Owner trying to escalate', now() + interval '1 hour')`,
    [IDS.ownerA, IDS.ownerA, IDS.schoolA],
    /row-level security/,
  );
});

test('impersonation can target only a school owner', async (c) => {
  await asUser(c, IDS.superAdmin);
  await expectFailure(
    c,
    `insert into public.impersonation_sessions (actor_id, target_user_id, institution_id, reason, expires_at)
     values ($1, $2, $3, 'Targeting a staff member', now() + interval '1 hour')`,
    [IDS.superAdmin, IDS.staffA, IDS.schoolA],
    /row-level security/,
  );
});

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function main() {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  console.log('Applying migrations');
  await applyMigrations(client);

  console.log('Seeding fixtures');
  await seedFixtures(client);

  let passed = 0;
  let failed = 0;
  for (const { name, fn } of tests) {
    await client.query('begin');
    try {
      await fn(client);
      passed += 1;
      console.log(`  ok    ${name}`);
    } catch (err) {
      failed += 1;
      console.log(`  FAIL  ${name}\n        ${err.message}`);
    } finally {
      await client.query('rollback');
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  await client.end();
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
