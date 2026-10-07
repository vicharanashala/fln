# ONBOARDING — Mahak

## 1. What is FLN?

I understand FLN to stand for Foundational Literacy and Numeracy — a learning initiative to develop foundational skills in children, such as an understanding of numbers, the basics of arithmetic,

and reading and comprehension.

The FLN project is an education platform to assist teachers and schools in assessing the learning level of the child, detecting learning gaps, and providing personalized assessment and practice. I believe the current implementation of the repository is focused on the mathematics/numeracy side of learning rather than literacy.

The one main takeaway I understood about this project is that assessment should not simply be a paper given to each student; the system should analyze the student's information and assessment to understand the current level of learning and support the next learning phase.


## 2. What do you understand by FLN (as a system)?

I understand FLN to be a complete assessment and learning-support system, rather than just a question-paper generator.

The major stakeholders are: students, teachers, administrators, and superadmins. The system keeps track of schools, students, assessments, worksheets, results, and certifications.

The main flow I can see is:

Teacher → assessment generation → printed paper → student submission → scanning/evaluation → student profile update → analysis/personalized support.

A teacher can manage students/classes, generate assessments, distribute worksheets, collect completed papers and use the system to evaluate the results. The student's profile can be updated according to the assessment result.

The repository contains separate responsibilities for the frontend, backend, and AI evaluation pipeline. The frontend is responsible for the interface, the backend is for the API/business logic, and `ai-services/` contains the Python-based evaluation/OCR pipeline.

---

## 3. Current State of the Repository — What Has Been Done So Far

The project is implemented as an npm workspaces monorepo with multiple parts.

### Frontend

The frontend is implemented using:

- React 19

- Vite

- Tailwind CSS

- TypeScript

The frontend contains dashboards, panels, workflows, student-facing interfaces, worksheet interfaces, and other user-facing components.

### Backend

The main backend is implemented using:

- Node.js

- Express

- TypeScript

- MongoDB (using the native MongoDB driver)

The repository also contains a local JSON database fallback for development. Backend routes and services are organized under `backend/src/`.

### AI / Evaluation

The `ai-services/` directory contains the Python evaluation/OCR pipeline, which is invoked by the backend when evaluation functionality is required.

### Features I observed

The repository contains the following functionality related to:

- Authentication and role-based access

- Student profiles

- Teacher dashboards

- Assessments

- Worksheet generation

- Scanning and evaluation

- Analytics

- Certification workflows

- Curriculum and level mapping

The repository is currently still evolving, particularly worksheet generation and the new curriculum/question-authoring pipeline.

---

## 4. Gaps Observed in the Code

While reviewing the repository and issue tracker, I saw several ways in which the implementation can still be enhanced.

### Gap 1 — Worksheet layout configuration

Where: `backend/src/paperGenerator.ts`

What: Worksheet/PDF layout values (e.g. font size, answer-space dimensions) are implemented as inline values rather than being centralized into reusable configuration.

Why it matters: When layout rules are duplicated inside of rendering code, it makes the print requirements harder to change and can lead to inconsistent output.

This is the reason I selected GitHub Issue #603 to propose the introduction of `worksheetLayoutRules.ts` containing reusable minimum layout rules.

### Gap 2 — Personalized worksheet question truncation

Where: `backend/src/paperGenerator.ts` and the worksheet generation flow

What: The existing personalized worksheet renderer has logic that limits the questions rendered onto the PDF, rather than ensuring all assigned questions are represented.

Why it matters: A teacher could receive an incomplete worksheet without an obvious indicator that questions were missing.

This is tracked separately in Issue #597, so I would treat it as a separate contribution rather than mixing it into the first PR.

### Gap 3 — Stale level limits in the UI

Where: Multiple frontend dashboard and profile components

What: Some parts of the frontend UI still contain hardcoded assumptions about the maximum curriculum level.

Why it matters: As the curriculum model evolves, hardcoded limits can cause progress calculation, dropdowns, and recommendations to show incorrect information.

This is tracked by Issue #570 and should be handled separately from the first contribution.

### Gap 4 — File database fallback reliability

Where: `backend/src/db.ts` and the routes/services that use the database store

What: The issue tracker identifies multiple database calls that can use the MongoDB connection without guarding against the local fallback state.

Why it matters: A route can fail to return a response when MongoDB is unavailable, rather than returning a proper error.

This is tracked separately in Issue #579 and is larger in scope than my initial worksheet configuration contribution.

### Gap 5 — Question authoring consistency

Where: Question-template authoring components and related backend types

What: Some parts of the question-authoring UI historically only reflected a subset of the question families supported by the backend.

Why it matters: The frontend and backend can become inconsistent, causing valid question configurations to be unavailable to authors.

This is already tracked in the issue tracker and demonstrates the need for the frontend and backend definitions to remain synchronized.

---

## 5. Ideas for the Project

### Idea 1 — Centralized worksheet configuration

What: Keep worksheet layout rules in reusable configuration rather than embedding values throughout rendering code.

Why: It makes the worksheet renderer easier to maintain and allows print requirements to be changed without requiring changes to rendering logic.

How: Create configuration modules containing layout minimums, page constraints, answer-space rules, and overflow policies.

### Idea 2 — Stronger automated testing for worksheet generation

What: Build more automated tests around worksheet generation and evaluation.

Why: Type-checking and linting alone do not prove that the application behavior works correctly.

How: Add focused tests for PDF generation, pagination, question counts, evaluation results, and important edge cases.

### Idea 3 — More consistent data-driven UI

What: Reduce hardcoded curriculum limits and UI assumptions.

Why: Curriculum data is expected to evolve, so UI behavior should be dependent on the source of truth rather than repeated numeric constants.

How: Read shared curriculum/configuration values and derive UI limits from those values.

---

## 6. Your Contribution

I contributed to the FLN project by implementing GitHub Issue #603, which introduces centralized worksheet layout rules for Balvatika print generation. I created the reusable layout configuration, verified its compatibility with the backend TypeScript code, checked for possible regressions and edge cases, and validated the implementation using the available project checks.

I also reviewed related worksheet-generation code to understand how the new configuration can be used by the rendering pipeline in future work.