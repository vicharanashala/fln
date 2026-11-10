# FLN Onboarding Document — Jiya Singh

## 1. What is FLN?

Foundational Literacy and Numeracy (FLN) refers to the basic reading, writing, and mathematical skills children need to continue learning successfully. These skills include understanding written language, recognising numbers, counting, comparing quantities, and developing basic mathematical reasoning.

FLN is important because children build more advanced learning on these foundations. If a child struggles with basic concepts in the early years, it can become harder to understand later topics.

The FLN project aims to help teachers identify each child's current learning level, assess their understanding, and use assessment results to guide the next steps in learning. The goal is not only to conduct tests but also to understand what a child has learned and where additional support may be needed.

## 2. What do you understand by FLN as a system?

I understand FLN as a complete learning and assessment cycle rather than a collection of worksheets or tests.

A teacher needs to understand the current level of each student, assess their knowledge, interpret the results, and decide what should happen next. The assessment should help identify learning gaps instead of simply producing a score.

The system can be understood through these steps:

1. **Student profiling:** Maintain the student's relevant academic information and learning history.
2. **Assessment preparation:** Generate or select an appropriate assessment based on the curriculum and the student's learning needs.
3. **Assessment:** Let students attempt the questions, with teachers distributing and collecting the worksheets.
4. **Evaluation:** Process the answers and record the results.
5. **Diagnosis:** Identify the concepts the student has mastered and the areas where further learning may be needed.
6. **Next steps:** Use the results to guide further assessment or learning support.
7. **Progress tracking:** Keep a record of learning progress over time.

One important point is that assessment results should lead to meaningful action. A score alone does not explain why a student answered incorrectly. The system needs reliable curriculum mappings and assessment rules so that its conclusions are useful to teachers.

I also understand that the curriculum is not fixed permanently. The repository currently uses a 109-level framework, and level numbering and prerequisite relationships may continue to change as the curriculum is refined. Code should therefore rely on shared curriculum data wherever possible rather than scattered hardcoded assumptions.

## 3. Current State of the Repository — What Has Been Done So Far

The repository is an npm-workspaces monorepo with separate parts for the frontend, the main backend, worksheet-specific backend functionality, and AI-related services.

The README describes the following major parts of the project:

- **Frontend:** React, Vite, and Tailwind CSS, used for the platform's user interface and dashboards.
- **Main backend:** Node.js, Express, TypeScript, and the native MongoDB driver.
- **Worksheet backend:** A separate JavaScript workspace for worksheet-related functionality.
- **AI services:** Python-based evaluation and OCR functionality that the main backend can invoke.
- **Student and assessment workflows:** Functionality for student profiles, assessment preparation, scanning, evaluation, and progress tracking.
- **Curriculum mapping:** `backend/src/config/curriculumMap.ts` maintains mappings between curriculum levels, concepts, stages, age groups, and strands.
- **Question generation:** The question-generation pipeline consumes approved, concept-linked templates while retaining legacy generation paths where required.

### Curriculum and Balvatika

The repository describes a 109-level curriculum framework. Balvatika (Stage 3) covers levels 19–46. The curriculum and prerequisite design continue to evolve, and newer levels need careful validation as they are introduced.

The question-generation pipeline has begun consuming approved templates, but curriculum migration and real-world testing of newer levels remain ongoing areas of work.

An important design decision is that level numbers should not be treated as permanent concept identifiers. The curriculum and prerequisite relationships may change, so code should be designed to tolerate these changes.

### What I learned from working on the repository

My issue-linked contributions have helped me understand three practical areas of the project:

- Validation is important when creating student records, because invalid registration data can affect later workflows.
- Curriculum level limits need to remain consistent as the number of levels changes.
- Stage-related checks should use shared curriculum mapping rather than repeating the same condition in different places.

These changes also showed me the value of testing boundary cases and registering tests so they can run as part of the repository's automated checks.

## 4. Gaps Observed in the Code

The following observations are based on the curriculum configuration and the repository's documented design requirements. Gap 2 identifies a confirmed discrepancy between the curriculum comments and the readiness-band concept list. The intended behaviour should still be confirmed with maintainers; the other observations describe a content issue or design considerations that may warrant follow-up.

### Gap 1: A Balvatika assessment item may not test the intended concept

**Location:** `backend/src/config/curriculumMap.ts`, lines 58–67.

The comments around the S3.4 curriculum entry describe a pre-existing content issue. The worksheet item uses three sticks and asks the child to circle the longest one. According to the code comments, this tests perceptual comparison rather than the intended concept of transitive inference.

**Why it matters:** If a question tests a different skill from the concept it is mapped to, the assessment result may not accurately represent the child's understanding. This can affect how teachers interpret the result and decide what support may be needed.

The code comments already identify this as a follow-up. Before proposing a change, the corresponding worksheet specification and any related issue should be reviewed.

### Gap 2: The readiness-band concept list omits a required concept

**Relevant files and references:**
- `backend/src/config/curriculumMap.ts`, lines 71–77.
- `backend/src/services/readinessBand.ts`, line 14 — `NIPUN_BALVATIKA_CONCEPTS` (PR #733).
- PR #733.

The comments in `curriculumMap.ts` explain that the NIPUN Bharat Balvatika competency for sequencing covers both `S3.6` and `S1.8`. They state that the “Ready for Class 1” readiness band must require both concepts.

However, the `NIPUN_BALVATIKA_CONCEPTS` list in `readinessBand.ts` includes `S3.1` through `S3.7` but omits `S1.8`.

**Why it matters:** If readiness is calculated using this list, the required `S1.8` concept may not be included in the readiness calculation. This could lead to a readiness result that does not reflect the documented requirement.

**Suggested follow-up:** Confirm the authoritative concept requirements with the maintainers, then align the readiness-band calculation and tests with the agreed specification. Include tests for the expected behaviour of both `S3.6` and `S1.8`.

### Gap 3: Code should preserve the distinction between concept identity and level numbering

**Location:** `backend/src/config/curriculumMap.ts`, lines 17–21.

The code comments describe `conceptId` as the durable identity of a curriculum concept and explain that level numbers can change when the curriculum is reordered.

**Why it matters:** If future code treats a level number as a permanent concept identifier, curriculum changes may create inconsistencies in assessment mappings or other level-dependent functionality.

This is a design consideration rather than a confirmed bug. A concrete implementation that relies on level numbers as permanent identifiers should be identified before reporting an active defect.

## 5. Ideas for the Project

The following ideas connect to the observations in Section 4. They are possible areas for future work and should be prioritised according to active issues and maintainer guidance.

### Idea 1: Validate curriculum-dependent workflows when levels change

**What:** Add or strengthen regression checks for workflows that depend on curriculum levels.

**Why:** Curriculum changes can affect several parts of the application, and a change that works in one component may leave another using outdated assumptions.

**How:** Review existing tests and identify important boundaries, including the Balvatika range, levels above the older 93-level limit, the current maximum, and values above the current maximum. Add focused tests where coverage is missing and use shared curriculum data instead of introducing new hardcoded limits. This should be tied to an existing issue or agreed with a maintainer before implementation.

### Idea 2: Verify that readiness decisions follow the documented curriculum requirements

**What:** Check the “Ready for Class 1” readiness calculation against the requirement documented for S3.6 and S1.8.

**Why:** Readiness results should reflect the full competency described by the curriculum, not just one part of it.

**How:** Inspect the readiness calculation and its tests, then compare their behaviour with the curriculum requirement. If a mismatch is confirmed, discuss the expected behaviour with maintainers and add targeted tests before changing the implementation.

### Idea 3: Help evaluate an appropriate Balvatika diagnostic length

**What:** Contribute to the existing discussion about how many questions are needed to assess mastery of a Balvatika concept.

**Why:** A diagnostic should collect enough evidence to support a useful conclusion while remaining manageable for young learners.

**How:** Work with maintainers on the assessment-design question. If requested, help organise test cases or document the implications of different approaches. Any implementation should follow an agreed educational and technical design rather than assuming an arbitrary fixed number of questions per concept.

## 6. Your Contribution

My contributions to the FLN repository have focused on issue-linked changes, validation, curriculum consistency, and testing.

### PR #586 — Student registration validation tests

**Issue:** #397  
**PR:** https://github.com/vicharanashala/fln/pull/586

I added test coverage for student registration validation. The tests cover required fields, including `schoolId`, class-group validation, date-of-birth and age validation, Aadhaar normalization, and duplicate detection, including duplicates within bulk import.

Following review feedback, I added tests for a date of birth that results in an age above 20 and for a future date of birth. I also registered the test file through the `test:student-create` script so it could be run through the backend's test workflow.

The PR was merged. This work helped me understand how registration validation protects downstream workflows and why tests should verify behaviour rather than only implementation details.

### PR #607 — Replace the hardcoded FLN level ceiling

**Issue:** #570  
**PR:** https://github.com/vicharanashala/fln/pull/607

I worked on replacing hardcoded assumptions about the 93-level curriculum with a limit derived from the current curriculum data. The changes covered multiple areas, including dashboard and reporting components, diagnostic workflow, scanning-related UI, and question-bank validation and tests.

I also updated relevant boundary tests to verify that levels above 93 could be handled and that the current maximum was accepted while values above it were rejected.

This contribution helped me understand how a curriculum change can affect multiple parts of a large repository and why shared configuration and regression tests are important.

### PR #629 — Add the Balvatika stage helper

**Issue:** #612  
**PR:** https://github.com/vicharanashala/fln/pull/629

I added `isBalvatikaStage(level)` in `backend/src/config/curriculumMap.ts`. The helper uses the existing `CURRICULUM_MAPPING` stage data to determine whether a level belongs to Stage 3, Balvatika.

I also added tests for the helper across the curriculum and, following review feedback, added an explicit check for the expected Balvatika range of levels 19–46. I registered the test through the `test:balvatika-stage` script.

This contribution helped me understand the importance of centralising shared curriculum logic and writing tests that verify expected behaviour.

### What I learned

Across these contributions, I learned to:

- Read the relevant code and issue requirements before making changes.
- Check how a small change can affect multiple parts of a repository.
- Use review feedback to identify missing test cases and improve validation.
- Test boundary conditions rather than relying only on normal inputs.
- Register tests so they can run through the project's automated checks.
- Prefer shared configuration and reusable helpers over repeated hardcoded rules.
- Keep proposed changes aligned with the repository's current priorities and ask maintainers before making assumptions about curriculum or assessment design.

I plan to continue contributing through issue-linked work, with a focus on understanding the existing design, testing changes carefully, and keeping implementation decisions grounded in the repository's current design.
