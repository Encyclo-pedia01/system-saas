#!/usr/bin/env python3
"""Live RLS check against a Supabase project (run after a migration, never in CI).

Needs: .env.local with NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and
SUPABASE_SERVICE_ROLE_KEY; a credentials file with lines "email password";
env INSTITUTION_ID, and the teacher/owner emails below.
Only reads, plus one blocked write attempt. Exit code 1 if any check fails.
"""
import json, os, re, sys, urllib.request, urllib.error

ENV_FILE = os.environ.get("ENV_FILE", ".env.local")
CREDS_FILE = os.environ.get("CREDS_FILE", os.path.expanduser("~/.test-creds/dev-accounts.txt"))
INSTITUTION_ID = os.environ["INSTITUTION_ID"]
TEACHER = os.environ.get("TEACHER_EMAIL", "teacher.a.test@example.com")
OWNER = os.environ.get("OWNER_EMAIL", "trial1.owner.test@example.com")

env = {}
for line in open(ENV_FILE):
    m = re.match(r"^([A-Z_]+)=(.*)$", line.strip())
    if m:
        env[m.group(1)] = m.group(2).strip().strip('"').strip("'")
URL = env["NEXT_PUBLIC_SUPABASE_URL"]
ANON = env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
SERVICE = env["SUPABASE_SERVICE_ROLE_KEY"]
creds = {p[0]: p[1] for p in (l.split() for l in open(CREDS_FILE)) if len(p) >= 2}


def call(method, path, body=None, token=None, key=None, prefer=None):
    h = {"apikey": key or ANON, "Authorization": "Bearer " + (token or key or ANON),
         "Content-Type": "application/json"}
    if prefer:
        h["Prefer"] = prefer
    req = urllib.request.Request(URL + path, method=method, headers=h,
                                 data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read().decode()
            return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]


def login(email):
    s, b = call("POST", "/auth/v1/token?grant_type=password", {"email": email, "password": creds[email]})
    if s != 200:
        raise SystemExit(f"login failed for {email}: {s}")
    return b["access_token"]


def svc(path):
    s, b = call("GET", path, key=SERVICE)
    if s != 200:
        raise SystemExit(f"service read failed {path}: {s}")
    return b


failures = []


def check(name, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + name + (f"  [{detail}]" if detail else ""))
    if not ok:
        failures.append(name)


# Ground truth from the service role (bypasses RLS, used only to know what should be hidden).
classes = {c["id"]: c["name"] for c in svc(f"/rest/v1/classes?select=id,name&institution_id=eq.{INSTITUTION_ID}")}
students = svc(f"/rest/v1/students?select=id,class_id&institution_id=eq.{INSTITUTION_ID}")
assessments = svc(f"/rest/v1/assessments?select=id,class_id&institution_id=eq.{INSTITUTION_ID}")
kg_students = [s["id"] for s in students if "Kindergarten" in classes.get(s["class_id"], "")]
kg_ids = set(kg_students)

# Teacher
t_tok = login(TEACHER)
t_uid = call("GET", "/auth/v1/user", token=t_tok)[1]["id"]
own = {r["class_id"] for r in svc(f"/rest/v1/class_teachers?select=class_id&user_id=eq.{t_uid}")}
own_students = [s["id"] for s in students if s["class_id"] in own]
other_students = [s["id"] for s in students if s["class_id"] not in own]

s, rows = call("GET", f"/rest/v1/students?select=id,class_id&institution_id=eq.{INSTITUTION_ID}", token=t_tok)
seen = {r["id"] for r in rows} if s == 200 else set()
check("teacher sees own-class students", set(own_students) <= seen, f"{len(seen)} visible")
check("teacher sees no other-class students", not (seen & set(other_students)), f"other visible {len(seen & set(other_students))}")

s, rows = call("GET", f"/rest/v1/assessment_scores?select=student_id&institution_id=eq.{INSTITUTION_ID}", token=t_tok)
sc_students = {r["student_id"] for r in rows} if s == 200 else set()
check("teacher scores limited to own classes", not (sc_students & set(other_students)), f"{len(sc_students)} students with scores visible")

# Blocked write: teacher writes a score for a KG student using an own-class assessment.
own_assessment = next((a["id"] for a in assessments if a["class_id"] in own), None)
if kg_students and own_assessment:
    s, body = call("POST", "/rest/v1/assessment_scores", {
        "institution_id": INSTITUTION_ID, "assessment_id": own_assessment,
        "student_id": kg_students[0], "score": 1, "recorded_by": t_uid,
    }, token=t_tok, prefer="return=representation")
    leaked = svc(f"/rest/v1/assessment_scores?select=id&student_id=eq.{kg_students[0]}&assessment_id=eq.{own_assessment}")
    check("teacher cannot write a score for another class's student", s >= 400 and not leaked,
          f"status {s}, rows created {len(leaked)}")
else:
    check("write check prerequisites present", False, "no KG student or own assessment")

# Owner
o_tok = login(OWNER)
s, rows = call("GET", f"/rest/v1/students?select=id&institution_id=eq.{INSTITUTION_ID}", token=o_tok)
check("owner sees every student", s == 200 and len(rows) == len(students), f"{len(rows) if s == 200 else s} of {len(students)}")

print(f"\n{len(failures)} failure(s)")
sys.exit(1 if failures else 0)
