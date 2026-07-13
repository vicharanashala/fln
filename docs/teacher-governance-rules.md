# Governance Rules for Teachers

These rules from the SRS are enforced in the server code.

---

## §6.5 — Delayed Submission Escalation

| Rule | Detail |
|---|---|
| **Submission Window** | 1 hour after exam ends |
| **Delayed Attempt** | Submission after `submissionWindowEnd` |
| **3 Delayed Attempts** | Teacher is **banned** (`isBanned: true`) — cannot generate worksheets |
| **All Teachers Banned** | School is **access locked** (`isAccessLocked: true`) — management reassigned to Block Admin / Volunteer |
| **Revival** | Superadmin/Admin/District Admin/Block Admin can revive a teacher via `POST /api/admin/revive-teacher` |

## §13.2 R-11 — Pairwise Generation Locks

| School Strength | Lock Pair | Effect |
|---|---|---|
| **High** | Teacher ↔ School | If Teacher generated, School cannot generate same class+cycle (and vice versa) |
| **Low** | Volunteer ↔ Block Admin | Teacher generates freely; Volunteer/Block Admin pair locks apply |

When locked, `POST /api/worksheets/generate` returns **423 Locked** with lock details.

## §13.2 R-6 — Aadhar Masking

- Teachers see only **last 4 digits** of Aadhar numbers (`XXXX-XXXX-4521`)
- Full Aadhar is visible only to **Superadmin**

## §3.2 A-3 — Password Complexity

Teacher passwords must:
- Be at least 8 characters
- Contain at least 1 uppercase letter
- Contain at least 1 digit
- Contain at least 1 special character (`!@#$%^&*(),.?":{}|<>`)

## §1.4 — Sequential Timing Windows

After worksheet generation, strict non-overlapping timings apply:

1. **Print Window:** 1 hour (teacher can download and print)
2. **Exam Window:** 45 minutes (students take the test)
3. **Submission Window:** 1 hour (teacher uploads/scans answers)

Windows are sequential and non-overlapping.

## Curriculum Feedback

Only **Teachers** and **Volunteers** can submit tickets of `type: 'curriculum'`.
