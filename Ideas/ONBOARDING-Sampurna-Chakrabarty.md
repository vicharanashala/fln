# Onboarding Document: Sampurna Chakrabarty

## What is FLN?
FLN (Foundational Literacy and Numeracy) is an AI-powered educational platform specifically designed to help young children (primarily in Classes 2–4) build essential mathematics and numeracy skills. It addresses a critical educational gap where students lack the basic foundational skills required to succeed at their current grade level. The project’s overall purpose is to systematically assess each child's current numeracy level, provide personalized, engaging printable worksheets to improve those skills, and track their progress over time. The platform serves students, teachers, and a hierarchy of administrators by rolling up performance data from the classroom level all the way to a national dashboard.

## What do you understand by FLN as a system?
As a system, FLN involves multiple entities and users interacting within a structured, data-driven workflow:
*   **Students:** The primary learners who take diagnostic assessments and solve personalized worksheets to improve their skills.
*   **Teachers & Volunteers:** The facilitators who manage classrooms, generate and print personalized worksheets, administer tests, and scan the completed sheets back into the system using ICR (Intelligent Character Recognition).
*   **Administrators (School, Block, District, National, Superadmin):** Stakeholders who monitor aggregated analytics, track performance trends across different regions, manage access, and oversee the program's overall effectiveness.
*   **Worksheets & Assessments:** The core learning mechanism. The system generates level-specific math problems that are printed, solved physically by students, and then scanned and evaluated by an AI pipeline.
*   **Certifications:** Milestones awarded to students upon demonstrating mastery of specific math concepts (e.g., reaching Level 5).

## Current State of the Repository — What Has Been Done So Far
The repository is structured as an npm-workspaces monorepo with three primary areas:
*   **Frontend (`frontend/`):** A modern React 19 application built with Vite and Tailwind CSS. It features comprehensive role-specific dashboards (Teacher, Volunteer, Admin, etc.) and various UI components for managing students and viewing analytics.
*   **Backend (`backend/`):** A Node.js/Express REST API written in TypeScript. It handles business logic, real authentication (JWT), data persistence (using MongoDB with a JSON fallback), PDF worksheet generation via Puppeteer, and integration with the AI services.
*   **AI Services (`ai-services/`):** A Python-based evaluation pipeline that handles the processing of scanned worksheets. It classifies, compares, evaluates, and reports on the student's answers using Google Gemini LLMs.
The system has recently transitioned from a mock-based frontend interceptor to a fully integrated, real backend API, ensuring data integrity and proper authorization scoping.

## Gaps Observed in the Code

### 1. Hardcoded Magic Numbers & Thresholds
*   **Where:** Scattered across various files, including `frontend/src/components/RoleDashboards.tsx` (e.g., lines checking `currentLevel >= 5`), `backend/src/index.ts`, and `frontend/src/components/PanelViews.tsx`.
*   **What:** Key business logic thresholds (like the maximum FLN level `59`, certification threshold `>= 5`, and score bands `80/60`) are hand-inlined across multiple frontend components and backend services instead of being centralized.
*   **Why it matters:** This severely impacts maintainability. If the certification requirement or maximum level changes, developers must hunt down every instance across both the frontend and backend, risking inconsistent behavior and difficult-to-track bugs.

### 2. Synchronous Execution of Python Scripts
*   **Where:** `backend/src/index.ts` (specifically where the backend invokes `run_pipeline.py`).
*   **What:** The Node.js backend uses `execSync` (synchronous execution) to run the heavy Python evaluation pipeline.
*   **Why it matters:** Synchronous execution blocks the single-threaded Node.js event loop. While the AI pipeline is evaluating a worksheet, the server cannot handle any other concurrent requests, leading to severe scalability, performance, and timeout issues in a production environment.

### 3. Duplication of Shared Logic
*   **Where:** Components like `TeacherDashboard.tsx` and `VolunteerDashboard.tsx` (or previously within `RoleDashboards.tsx`), and logic like `levelGenerator.ts`.
*   **What:** There is significant duplication of UI rendering logic (e.g., roster tables, student addition flows) and business logic across different roles.
*   **Why it matters:** Duplication leads to code drift. Fixing a bug or updating a feature in the Teacher dashboard might be missed in the Volunteer dashboard, leading to an inconsistent user experience and increased maintenance effort.

## Ideas for the Project

### Idea 1: Centralized Configuration Management
*   **What you are proposing:** Create a shared configuration package or directory (e.g., `shared/constants/` or a dedicated workspace package) that exports constants like max levels, score bands, and certification thresholds.
*   **Why it would help:** It ensures consistency across the frontend and backend. Updating a threshold will only require changing one single file, drastically improving maintainability and reducing the risk of errors.
*   **How to approach implementing it:** Extract all magic numbers from the frontend and backend into a shared TypeScript file. Update the build process to allow both workspaces to import from this shared location, and replace all inlined values with these imported constants.

### Idea 2: Asynchronous AI Pipeline Integration
*   **What you are proposing:** Replace the synchronous `execSync` calls for the Python pipeline with an asynchronous approach (using `child_process.spawn` or `exec`) or a lightweight job queue.
*   **Why it would help:** It unblocks the main Node.js event loop, allowing the server to handle high traffic and multiple concurrent worksheet evaluations without locking up or timing out.
*   **How to approach implementing it:** Refactor the evaluation endpoint to use asynchronous child process methods. The server can immediately return a "processing" status (HTTP 202), and the frontend can either poll for the result or rely on the existing bulk-job polling mechanism to update the UI when the evaluation completes.

## Your Contribution
During my onboarding and initial exploration of the project, I contributed to the security and user experience of the platform by implementing a **secure password reset flow**. This involved creating the necessary backend endpoints and frontend UI to allow users to securely recover their accounts. This contribution addresses critical authentication needs and ensures a smoother, safer experience for teachers and administrators using the FLN system. (Branch: `feat/password-reset`).
