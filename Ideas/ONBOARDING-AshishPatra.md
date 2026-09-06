**1. What is FLN?**

FLN (Foundational Literacy and Numeracy) helps young students Preschool through Class 4 tobuild core reading and math skills early, before gaps compound.

This platform:

- Assesses where a student stands against a curriculum
- Identifies specific weak skills
- Provides worksheets/diagnostics/practice to close gaps
- Gives dashboards for teachers and admins to track progress

**2. What do you understand by FLN as a system?**

Roles: Students (tracked unit, has level + weak areas) → Teachers (own roster, generate/evaluate) → Schools (aggregate their teachers/students) → Block/District Admins (aggregate schools) → Superadmins (full platform).

Key entities:

- Diagnostics : formal tests, graded via OCR/AI, produce EvaluationReport (per-topic mastery + new level)
- Worksheets : printable practice from a shared generation engine
- Certifications : exists as a concept in the codebase; didn't investigate,so I won't claim to understand it

Cycle : Diagnose → weak areas recorded → practice targeted at those areas → re-assess → repeat. Admins see rolled-up versions of the same data.

**3. Current State - What's Been Done**

Based on what I actually hit while building, not a full read-through.

- Stack: React/Vite frontend, Node/Express backend, MongoDB Atlas, separate Python ai-services/ for OCR/AI grading.

- Backend was one 4,000+ line file (index.ts) most of my onboarding — hard to navigate, real risk of route-ordering bugs. Mid-onboarding, team split it into backend/src/routes/*.ts.

- Auth: JWT + role-based guards (getAuthUser/canAccessStudent). Several recent branches hardening this area.

- Dashboards: Studied the Superadmin dashboard closely to match its style. Learned: few large panels beat many small cards; charts are hand-rolled SVG, no library. Reused both in my own work.

- Question generation - three separate, disconnected systems, not one:
  - levels_main.html - 59 levels, 244 real generators. Only one that fully works — built my feature on this.

  - class2/3/4.html - separate diagnostic templates, independently styled.

  - proposed-levels/ - newer templates with real word-problems, disconnected from both. Frontend preview shows this; actual diagnostic generation still uses the older files.

- Evaluation: Real OCR pipeline (blue-pen isolation → EasyOCR/PaddleOCR/Ollama).

**4. Gaps Observed**

1. Three disconnected level-numbering systems

- Where : RoleDashboards.tsx (93 entries) · levels_main.html (59 entries) · skillProgressionMap.ts (new, L1-L93)
- What : "Level 45" means three different things depending on the system. Only 59/93 official levels have real content.
- Why it matters: Easy to build against the wrong space, I nearly did, had to trace real code to confirm.

2. Duplicate questions in shared generators

- Where : levels_main.html, e.g. fraction-identify-visual, odd-one-out, money-buy-object
- What : Some pick randomly from a fixed bank with no exclusion check, guaranteed repeats past bank size.
- Why it matters : Weaker practice value. I fixed the ~19 generators my feature reaches; ~225 others unaudited.

3. No evaluation path for drawing-based questions

- Where : answerType: 'draw-count'/'trace' generators (e.g. frequency-tally-table)
- What : Freehand answers, no way to grade via text/multiple-choice.
- Why it matters : Silently blocked entire topics (e.g. Data Handling's easiest level) from being practiced at all.

**5. Ideas for the Project**

1. A real 59↔93 level mapping file Link each working level to its real curriculum counterpart, flag gaps. Needs domain knowledge more than code one authoritative source instead of every contributor rediscovering the gap.

2. Automated duplicate-question audit Script that calls all 244 generators, flags exact duplicates. Could run in CI, not just a one-time manual pass.

**6. My Contribution**

Built Micro-Practice and Spaced Repition Engine end-to-end.

- The problem it solves : After a formal diagnostic, we know a student's weak topics but there was no lightweight way to give them repeated, targeted practice between diagnostics. Formal diagnostics are broad, infrequent, and measure standing; they don't help a student actually improve day to day.

- What it does : For each weak competency a student is flagged in, the system finds the easiest real level for that topic and generates a small, focused paper (3-5 questions) not a full worksheet. It reuses the platform's existing 244-generator question engine rather than inventing new content, just pulling small, targeted slices from it.

- How difficulty actually progresses : A student always starts at the easiest level/variation for a weak topic. Good scores move them forward, first through the different variations built into that level, then to the next, harder level for that topic once those are exhausted. Poor or middling scores hold them in place until they're ready. Once a topic has no further real content left (some topics, like Money, only have one level built), it's marked mastered.

- Scheduling : Spaced repetition - good performance means longer gaps before that topic comes up again (doubling, capped at 30 days); poor performance shortens the gap (halving, floor of 1 day). This runs independently per competency, so a student can be due for Fractions tomorrow and Shapes in three weeks at the same time.

- Evaluation : A teacher uploads a photo or PDF of the completed paper. A QR code on the paper identifies the student and links back to the exact questions that were generated, so grading shows real question text next to the photo. For questions with a typed answer, the correct answer is shown as reference. For drawing-based questions (which have no typeable answer), I designed a new answer type: the teacher sees a rendered reference image of the correct drawing and simply confirms yes/no by comparison.

- Bulk workflows : Since this is meant to be used often, not just once, I built class-scoped bulk generation (one action, whole class, grouped/filtered by class) and bulk evaluation (upload many completed papers - including multi-page PDFs with several students - identify and grade them as a batch, with a persistent "papers awaiting grading" queue that survives across sessions).

- What I built, concretely : Level-mapped question generation, including multi-competency papers QR-based identification, photo/PDF upload (multi-page merging), manual answer entry with real question context
New "visual-confirm" answer type for drawing questions
Class-scoped bulk generation + evaluation, batch grouping, live progress
Three-tier spaced-repetition scheduling, incl. a real timezone fix (due-dates now reset at midnight, not the exact grading time)
Redesigned analytics view matching the Superadmin dashboard's style
