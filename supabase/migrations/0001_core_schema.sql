-- Core tenant, academic, and operational tables.
-- Every tenant-owned row carries institution_id. Cross-table links use composite
-- foreign keys (institution_id, id) so a row can never reference another school's data.

create table public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  status text not null default 'active' check (status in ('active', 'suspended')),
  timezone text not null default 'Africa/Accra',
  school_start_time time not null default time '08:00',
  grace_period_minutes integer not null default 0 check (grace_period_minutes between 0 and 120),
  created_at timestamptz not null default now(),
  unique (id)
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  is_super_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  institution_id uuid not null references public.institutions (id) on delete cascade,
  role text not null check (role in ('owner', 'staff', 'authority')),
  created_at timestamptz not null default now(),
  unique (user_id, institution_id),
  unique (institution_id, id)
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  email text not null check (position('@' in email) > 1),
  role text not null default 'owner' check (role in ('owner')),
  invited_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (institution_id, id)
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now(),
  unique (institution_id, name),
  unique (institution_id, id)
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  class_id uuid not null,
  full_name text not null check (char_length(full_name) between 1 and 120),
  admission_number text not null check (char_length(admission_number) between 1 and 40),
  created_at timestamptz not null default now(),
  unique (institution_id, admission_number),
  unique (institution_id, id),
  foreign key (institution_id, class_id) references public.classes (institution_id, id) on delete restrict
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (institution_id, name),
  unique (institution_id, id)
);

create table public.terms (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  starts_on date not null,
  ends_on date not null,
  is_closed boolean not null default false,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  unique (institution_id, name),
  unique (institution_id, id)
);

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  class_id uuid not null,
  subject_id uuid not null,
  term_id uuid not null,
  title text not null check (char_length(title) between 1 and 120),
  max_score numeric(7, 2) not null check (max_score > 0),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (institution_id, id),
  foreign key (institution_id, class_id) references public.classes (institution_id, id) on delete restrict,
  foreign key (institution_id, subject_id) references public.subjects (institution_id, id) on delete restrict,
  foreign key (institution_id, term_id) references public.terms (institution_id, id) on delete restrict
);

create table public.assessment_scores (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  assessment_id uuid not null,
  student_id uuid not null,
  score numeric(7, 2) not null check (score >= 0),
  recorded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (assessment_id, student_id),
  unique (institution_id, id),
  foreign key (institution_id, assessment_id) references public.assessments (institution_id, id) on delete cascade,
  foreign key (institution_id, student_id) references public.students (institution_id, id) on delete cascade
);

create table public.exam_scores (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  class_id uuid not null,
  subject_id uuid not null,
  term_id uuid not null,
  student_id uuid not null,
  score numeric(7, 2) not null,
  max_score numeric(7, 2) not null check (max_score > 0),
  recorded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (score >= 0 and score <= max_score),
  unique (term_id, subject_id, student_id),
  unique (institution_id, id),
  foreign key (institution_id, class_id) references public.classes (institution_id, id) on delete restrict,
  foreign key (institution_id, subject_id) references public.subjects (institution_id, id) on delete restrict,
  foreign key (institution_id, term_id) references public.terms (institution_id, id) on delete restrict,
  foreign key (institution_id, student_id) references public.students (institution_id, id) on delete cascade
);

-- Weights are stored as JSONB, e.g. {"assessment": 40, "exam": 60}.
-- Shape and sum are enforced by a trigger in 0005_grading.sql.
create table public.grading_keys (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  weights jsonb not null check (jsonb_typeof(weights) = 'object'),
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (institution_id)
);

create table public.results (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  term_id uuid not null,
  subject_id uuid not null,
  student_id uuid not null,
  final_grade numeric(5, 2) check (final_grade between 0 and 100),
  computed_at timestamptz not null default now(),
  unique (term_id, subject_id, student_id),
  unique (institution_id, id),
  foreign key (institution_id, term_id) references public.terms (institution_id, id) on delete cascade,
  foreign key (institution_id, subject_id) references public.subjects (institution_id, id) on delete cascade,
  foreign key (institution_id, student_id) references public.students (institution_id, id) on delete cascade
);

-- Attendance is recorded as check_ins rows: 'on-time', 'late', or 'absent'.
create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  student_id uuid not null,
  school_date date not null,
  time_in timestamptz,
  status text not null check (status in ('on-time', 'late', 'absent')),
  recorded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check ((status = 'absent' and time_in is null) or (status <> 'absent' and time_in is not null)),
  unique (student_id, school_date),
  unique (institution_id, id),
  foreign key (institution_id, student_id) references public.students (institution_id, id) on delete cascade
);

create table public.insights (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  student_id uuid,
  kind text not null check (kind in ('consecutive_absence', 'missing_result')),
  severity text not null check (severity in ('low', 'medium', 'high')),
  title text not null,
  body text not null,
  dedupe_key text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  unique (institution_id, dedupe_key),
  unique (institution_id, id),
  foreign key (institution_id, student_id) references public.students (institution_id, id) on delete cascade
);

-- Platform-level impersonation sessions. Read-only; see 0003_rls_policies.sql.
create table public.impersonation_sessions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users (id) on delete cascade,
  target_user_id uuid not null,
  institution_id uuid not null references public.institutions (id) on delete cascade,
  reason text not null check (char_length(reason) between 5 and 200),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  check (expires_at > started_at),
  foreign key (target_user_id, institution_id) references public.memberships (user_id, institution_id) on delete cascade
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  institution_id uuid,
  table_name text not null,
  record_id text,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  actor_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index memberships_institution_idx on public.memberships (institution_id, role);
create index students_class_idx on public.students (institution_id, class_id);
create index check_ins_institution_date_idx on public.check_ins (institution_id, school_date);
create index check_ins_student_date_idx on public.check_ins (student_id, school_date desc);
create index audit_log_institution_idx on public.audit_log (institution_id, created_at desc);
create index impersonation_actor_idx on public.impersonation_sessions (actor_id, ended_at);
