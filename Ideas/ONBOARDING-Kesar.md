# ONBOARDING - Antigravity

## 1. What is FLN?

Foundational Literacy and Numeracy (FLN) is a core educational priority aimed at ensuring children from pre-school to Grade 3 acquire basic reading comprehension and arithmetic skills. The fundamental problem it addresses is that millions of enrolled students progress through grades without grasping these basic skills, leading to a compounding learning gap that prevents them from engaging with future education.

## 2. What do you understand by FLN (as a system)?

As a system, FLN is a personalized assessment and tracking platform designed for the educational ecosystem. 
- **Users**: Students (who take assessments), Teachers (who generate and scan papers), Administrators/Superadmins (who author curriculum and manage access).
- **Core Entities**: Schools, classes, student profiles, question templates (bank), 109-level curriculum map, and generated worksheets.
- **Data Flow**: A teacher uses the dashboard to generate personalized worksheets for their class based on each student's current level. Students complete these on paper. The teacher scans the sheets, and the system auto-evaluates them using a Python AI-orchestrated pipeline. The results update the student's profile, issuing certifications for passes or scheduling lower-level remedial assessments for failures.

## 3. Current State of the Repository — What Has Been Done So Far:

The project is structured as an npm-workspaces monorepo featuring three main segments:
- **Frontend** (`@fln/frontend`): A React 19 application built with Vite and Tailwind CSS. It communicates exclusively with the real backend.
- **Backend** (`@fln/backend` & `fln-worksheet-backend`): A Node.js and Express API using TypeScript. It leverages the native MongoDB driver (with a local `db.json` fallback) for storage, implements real JWT/bcrypt authentication, and includes an in-process Aadhaar tokenization vault. 
- **AI Services** (`ai-services`): A Python-based OCR and evaluation pipeline invoked by the backend.

Implemented features include secure authentication, student rostering, Aadhaar tokenization, dynamic worksheet generation, and a question bank authoring panel.

## 4. Gaps Observed in the Code:

- **Where**: `frontend/src/components/panels/QuestionTemplatePanel.tsx`
  - **What**: The existing questions table lacked visibility into the `assessmentMode` of templates, and there was no way to filter questions by mode. 
  - **Why it matters**: Superadmins and authors need to know whether a question is meant for written or observed assessments to properly compose worksheets. Without this, the UI was incomplete and hindered the curriculum authoring experience.

- **Where**: `backend/tests/question-template-assessment-mode.test.cjs`
  - **What**: The testing methodology for frontend React components relies on brittle string/regex pattern matching of source files (`readSource(PANEL_SOURCE)`) rather than actual component rendering or DOM interaction.
  - **Why it matters**: This makes tests highly susceptible to breaking from simple syntax or formatting changes (like trailing whitespaces) and doesn't actually guarantee that the React logic executes correctly in the browser.

## 5. Ideas for the Project:

- **What**: Introduce a proper frontend testing framework (e.g., Vitest + React Testing Library).
  - **Why**: To replace the brittle regex-based source file tests with robust component tests that verify actual DOM outputs and user interactions.
  - **How**: Install Vitest in the `@fln/frontend` workspace, write `*.test.tsx` files for complex panels like `QuestionTemplatePanel.tsx`, and run them via `npm run test:frontend`.

- **What**: Complete the cleanup of deprecated mock references.
  - **Why**: To prevent contributor confusion regarding the architecture.
  - **How**: Sweep the codebase for any remaining hardcoded seed constants (`frontend/src/constants.ts`) and duplicate utilities (`frontend/src/utils/levelGenerator.ts`) mentioned in the `MIGRATION_PLAN.md` and remove them.

## 6. Your Contribution:

I resolved **Issue #703** by enhancing the `QuestionTemplatePanel.tsx`:
- Added a `Mode` filter to the existing questions table alongside Level, Skill, and Tag filters.
- Added a `Mode` column to the table to display the template's assessment mode in a styled badge.
- Ensured backward compatibility so that legacy templates missing an `assessmentMode` correctly default to `'written'` in both the display and the filtering logic.
- Expanded the existing testing suite in `backend/tests/question-template-assessment-mode.test.cjs` to strictly verify the legacy fallback expressions in the UI source.
