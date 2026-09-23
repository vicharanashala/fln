# FLN Project Onboarding Document

**Contributor:** Vishal Soni  
**Date:** September 15, 2026  
**Repository:** [vicharanashala/fln](https://github.com/vicharanashala/fln)  
**Fork:** [vishalsoni18/fln](https://github.com/vishalsoni18/fln)  

---

## 1. What is FLN?

**FLN** stands for **Foundational Literacy and Numeracy**. It is an open-source, AI-powered educational assessment and remediation platform developed under the guidance of Vicharanashala Lab / IIT Ropar. The platform addresses a critical challenge in primary education: ensuring that young learners (from Pre-school through Class 4) build solid, foundational competencies in basic mathematics, reading comprehension, and logical reasoning before progressing to higher academic levels.

### The Educational Problem Addressed
In many traditional schooling systems, children are promoted based on age or general attendance rather than proven concept mastery. This creates cumulative learning deficits—for instance, a child in Class 3 who has not mastered single-digit addition struggle continuously with multi-digit arithmetic and word problems. FLN disrupts this pattern by:
- Conducting systematic diagnostic assessments 3 times per academic year (Term 1, Term 2, Term 3).
- Tracking sub-level concept mastery granularly (e.g., Level 1: Quantity Comparison, Level 4: Numbers 1-10, Level 12: Addition with Regrouping).
- Utilizing automated optical scanning (ICR) for instant feedback on printed answer sheets.
- Dynamically generating targeted, personalized remediation worksheets for weak topics.

### Purpose and Audience
FLN serves a multi-tier educational ecosystem:
1. **Students**: Receive personalized learning paths, sub-level mastery tracking, and mastery certificates upon clearing level benchmarks.
2. **Teachers**: Gain automated tools for paper generation, instant ICR optical grading, class-wide analytics, and diagnostic reporting.
3. **Administrators (Block, District, State)**: Monitor institutional compliance, learning outcomes, volunteer deployment, and regional performance trends.
4. **Volunteers**: Support low-resource or low-connectivity schools with mobile assessment administration.
5. **Superadmins**: Oversee global curriculum standards, system configurations, user governance, and ticket resolution.

---

## 2. What do you understand by FLN as a system?

FLN functions as an interconnected, multi-role system governed by strict administrative hierarchies and data workflows.

```
                  ┌────────────────────────┐
                  │       SUPERADMIN       │ (Curriculum, System Config, Roles)
                  └───────────┬────────────┘
                              │
                  ┌───────────▼────────────┐
                  │      STATE ADMIN       │ (State Policy, Regional Analytics)
                  └───────────┬────────────┘
                              │
                  ┌───────────▼────────────┐
                  │     DISTRICT ADMIN     │ (District Oversight & School Audits)
                  └───────────┬────────────┘
                              │
                  ┌───────────▼────────────┐
                  │      BLOCK ADMIN       │ (Block Management, Volunteer Deploy)
                  └─────┬────────────┬─────┘
                        │            │
         ┌──────────────▼───┐    ┌───▼──────────────┐
         │     TEACHER      │    │    VOLUNTEER     │ (Paper Gen, ICR Scanning)
         └──────────────┬───┘    └───┬──────────────┘
                        │            │
                  ┌─────▼────────────▼─────┐
                  │   CLASS & STUDENTS     │ (Diagnostic & Mastery Progression)
                  └────────────────────────┘
```

### Entities & User Roles
1. **Student**: Represented by a unique identifier, age, class group (Class 1–4), section, assigned school, current level/sub-level, mastery score, weak concepts array, and streak history.
2. **Teacher**: Primary operational user responsible for paper generation, ICR answer sheet scanning, reviewing AI diagnostic reports, triggering re-assessments, and issuing grade certificates.
3. **School**: Institutional entity categorized as **High-Strength** (managed directly by teachers) or **Low-Strength** (supported by assigned volunteers), with lock mechanisms to prevent duplicate paper generation.
4. **Block Admin**: Manages schools within a specific block, handles volunteer allocations, monitors assessment compliance, and triggers block-level paper generation.
5. **District Admin & State Admin**: Regional oversight roles monitoring macro metrics, certified student ratios, school participation, and state curriculum distribution.
6. **Superadmin**: Top-tier administrator managing platform credentials, system logs, state admin accounts, and central question banks.
7. **Volunteers**: Facilitators deployed to low-bandwidth or understaffed rural schools to conduct paper-based assessments and submit digitized evaluations.

### System Components & Interactions
- **Worksheets & Question Papers**: Diagnostic papers are generated dynamically in HTML format using structured templates (`masterTemplate.html`), compiled into A4 PDFs via Puppeteer, and printed for physical administration.
- **Assessments & ICR Optical Scanning**: Students complete paper assessments. Teachers or volunteers scan the sheets using the built-in ICR (Intelligent Character Recognition) scanner interface.
- **AI Evaluation Pipeline**: Optical scan data or manual inputs are processed through a multi-stage Python evaluation pipeline (`classify -> compare -> evaluate -> report`), interfacing with Google Gemini API for personalized diagnostic reports.
- **Certifications & Sub-level Progression**: If a student clears level requirements (e.g., ≥80% score), their profile updates to the next sub-level and a certificate is generated. If they fail, weak topics are flagged, triggering targeted remediation worksheets and scheduled re-assessments.

---

## 3. Current State of the Repository — What Has Been Done So Far

### Technology Stack
- **Frontend**: Built with React 18, Vite, TypeScript, and Tailwind CSS. Employs Lucide React for UI iconography, alongside `html2canvas` and `jsPDF` for client-side PDF document generation.
- **Backend**: Node.js REST API with Express and TypeScript (`mvp/server/index.ts`). Data persistence is handled via a local file-based JSON store (`mvp/data/db.json` via `mvp/server/db.ts`) with MongoDB-compatible schema definitions conforming to SRS §10.
- **AI & Evaluation Pipeline**: Python 3 backend components located in `mvp/evaluation_metrics/`, utilizing a 4-step execution flow:
  1. `0_auto_classify_questions.py`: Maps assessment items against syllabus standards.
  2. `1_compare_answers.py`: Evaluates student submissions against correct answer keys.
  3. `2_evaluate_child.py`: Computes concept mastery percentages and identifies learning gaps.
  4. `3_generate_report.py`: Calls Google Gemini API (`mvp/server/gemini.ts`) to produce natural language diagnostic feedback.
- **PDF Rendering**: Server-side Puppeteer pipeline (`mvp/server/paperGenerator.ts`, `worksheetRenderer.ts`) rendering HTML templates to A4 PDF files stored under `/output` and `/public/worksheets`.

### Implemented Features
1. **Multi-Role Workspaces**: Interactive dashboards for Superadmin, State Admin, District Admin, Block Admin, School, Teacher, Volunteer, and Student roles in `mvp/src/components/RoleDashboards.tsx`.
2. **Stateless Authentication**: Express middleware resolving user identity via `Bearer <email>` header lookup with mock pre-seeded users.
3. **ICR Scanner Component**: `IcrScanner.tsx` supporting camera/upload capture of student answer sheets and client-side processing feedback.
4. **Generation Locks**: Server-side concurrency control preventing simultaneous paper generation by both Block Admins and Teachers for the same class.
5. **Support & Communication**: Integrated assessment calendar (`AssessmentCalendar.tsx`), ticket submission log (`TicketSubmission.tsx`), and real-time announcement feed (`App.tsx`).

---

## 4. Gaps Observed in the Code

During a line-by-line inspection of the codebase, five critical technical gaps were identified:

### Gap 1: Insecure Authentication & Password Verification Bypass
- **Where**: [`mvp/server/index.ts`](file:///c:/Users/visha/OneDrive/Desktop/Fln/mvp/server/index.ts#L91-L110) (Lines 91–110)
- **What**: In `POST /api/auth/login`, the handler validates password complexity via regular expressions (min 8 chars, uppercase, number, special char), but **never compares the password against any stored bcrypt hash**. The code explicitly contains a comment: `// In a real production app we'd hash and compare, here we return JWT-like email token`. Furthermore, authentication helper `getAuthUser` uses raw unhashed email strings as Bearer tokens.
- **Why it matters**: Any user in the database can be logged into with *any arbitrary password* that satisfies the regex pattern. This represents a critical vulnerability allowing total account compromise across admin and teacher accounts.

### Gap 2: Monolithic Dashboard Architecture
- **Where**: [`mvp/src/components/RoleDashboards.tsx`](file:///c:/Users/visha/OneDrive/Desktop/Fln/mvp/src/components/RoleDashboards.tsx#L1-L2703) (Lines 1–2,703)
- **What**: A single monolithic file containing 2,703 lines of code hosting all 8 user role dashboards (`SuperadminDashboard`, `AdminDashboard`, `SchoolDashboard`, `TeacherDashboard`, `VolunteerDashboard`, etc.), custom metrics, modals, and tables.
- **Why it matters**: Severely hinders maintainability, code readability, and multi-developer collaboration. Any edit to a single teacher view re-renders unnecessary components, inflates bundle size, and increases regression risk.

### Gap 3: Non-Deterministic Local Database Directory Resolution
- **Where**: [`mvp/server/db.ts`](file:///c:/Users/visha/OneDrive/Desktop/Fln/mvp/server/db.ts#L4-L5) (Lines 4–5)
- **What**: The local JSON database directory is initialized as `path.resolve(process.cwd(), 'data')`.
- **Why it matters**: `process.cwd()` depends on the current working directory of the process invocation. Launching the server from `c:/Users/.../Fln/mvp` versus `c:/Users/.../Fln` causes `dbStore` to look in different filesystem locations, resulting in silent initialization of empty databases or `ENOENT` runtime crashes.

### Gap 4: Unhandled Async Rejections & Silent Swallowing in Server Loop
- **Where**: [`mvp/server/index.ts`](file:///c:/Users/visha/OneDrive/Desktop/Fln/mvp/server/index.ts#L1570-L1580) (Lines 1570–1580)
- **What**: Server initialization lacks centralized Express error handling middleware and global `unhandledRejection` handlers. Async endpoint failures (e.g., failed Puppeteer PDF renders or missing Gemini API keys) trigger silent console logs without returning structured JSON error payloads.
- **Why it matters**: Frontend clients remain in infinite loading states when backend operations fail, frustrating teachers during live classroom assessments.

### Gap 5: Missing Throttling & Rate Limiting on Heavy Data Endpoints
- **Where**: [`mvp/server/index.ts`](file:///c:/Users/visha/OneDrive/Desktop/Fln/mvp/server/index.ts#L120-L300) (Lines 120–300)
- **What**: API routes responsible for fetching complete student datasets, generating diagnostic PDFs, and retrieving system log records operate without rate limiting, pagination, or request throttling.
- **Why it matters**: Exposes the application to Denial-of-Service (DoS) risks and server memory exhaustion when processing bulk PDF generation requests for large school blocks.

---

## 5. Ideas for the Project

Based on the identified gaps, the following practical improvements are proposed:

### Idea 1: Enterprise JWT Authentication with Bcrypt Hashing
- **Proposed Change**: Replace email-token scheme with standard JSON Web Tokens (JWT) signed via secret key, combined with `bcryptjs` password hashing during registration/seed loading.
- **Why it helps**: Fully resolves **Gap 1**, securing user accounts against unauthorized access, enforcing token expiration (e.g., 24h), and enabling proper role-based route middleware (`authorizeRoles(['superadmin', 'admin'])`).
- **Implementation Approach**:
  1. Add `jsonwebtoken` and `bcryptjs` to `mvp/package.json`.
  2. Implement `hashPassword` and `verifyPassword` functions in `mvp/server/db.ts`.
  3. Refactor `POST /api/auth/login` in `mvp/server/index.ts` to verify hashes.
  4. Implement `authenticateToken` middleware decoding Bearer JWT tokens.

### Idea 2: Modular Component Extraction for Role Dashboards
- **Proposed Change**: Split `RoleDashboards.tsx` (2,703 lines) into modular domain components under `src/components/dashboards/`:
  - `TeacherDashboard.tsx`
  - `SuperadminDashboard.tsx`
  - `AdminDashboard.tsx`
  - `SchoolDashboard.tsx`
  - `VolunteerDashboard.tsx`
- **Why it helps**: Resolves **Gap 2**, dramatically improving codebase organization, unit testability, developer onboarding speed, and enabling React `React.lazy()` route splitting.
- **Implementation Approach**:
  1. Create directory `mvp/src/components/dashboards/`.
  2. Extract each dashboard function into its respective file along with required imports.
  3. Create `index.ts` re-export file to maintain backward compatibility for existing imports in `App.tsx`.

### Idea 3: Deterministic Absolute Path Resolution in Data Layer
- **Proposed Change**: Anchor `DB_DIR` in `mvp/server/db.ts` relative to `import.meta.url` rather than `process.cwd()`.
- **Why it helps**: Resolves **Gap 3**, guaranteeing consistent reading and writing of `db.json` regardless of where the terminal command `npm run dev` or `node index.js` is executed.
- **Implementation Approach**:
  ```typescript
  import { fileURLToPath } from 'url';
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const DB_DIR = path.resolve(__dirname, '..', 'data');
  ```

### Idea 4: Offline-First Service Worker PWA for Rural Classroom Evaluation
- **Proposed Change**: Introduce Progressive Web App (PWA) offline capabilities with Service Worker caching and IndexedDB queueing.
- **Why it helps**: Teachers operating in rural schools with unstable internet can scan ICR answer sheets and enter diagnostic scores offline. Submissions automatically sync to the server when network connectivity is re-established.
- **Implementation Approach**:
  1. Integrate `vite-plugin-pwa` in `mvp/vite.config.ts`.
  2. Create a background sync queue in `IcrScanner.tsx` leveraging browser IndexedDB.
  3. Implement network listener in `App.tsx` notifying teachers of offline/online sync status.

---

## 6. Your Contribution

During the onboarding phase, I executed the following contributions:

1. **Repository Synchronization & Cleanup**:
   - Synced local workspace and origin fork (`vishalsoni18/fln`) directly with upstream `vicharanashala/fln:main`.
   - Cleaned up merge conflicts and established a clean development branch (`onboarding/vishal-soni`).

2. **Codebase Exploration & Gap Audit**:
   - Conducted a deep-dive technical audit of the FLN MERN stack, Express API routes, file database abstraction, and Python evaluation pipeline.
   - Formulated detailed technical documentation identifying 5 structural gaps with exact line references, root cause analysis, and implementation strategies.

3. **Onboarding Documentation**:
   - Authored this formal Onboarding Document (`Ideas/ONBOARDING-Vishal-Soni.md`) adhering strictly to all six required sections and submission formatting guidelines.

4. **Preparation for Feature Enhancements**:
   - Prepared the baseline codebase for upcoming feature pull requests, including Evaluation tab enhancements, strict mastery calculation logic, class-wise difficulty analytics, and optimized PDF report downloads.

---
*Submitted with care for the FLN Project.*
