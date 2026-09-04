# FLN Onboarding Document: System Overview, Architecture Audit & Teacher Diagnostic Dashboard

**Contributor Name:** Jiya Singh  
**File Location:** `Ideas/ONBOARDING-Jiya-Singh.md`  
**Target Feature:** Teacher Assessment Dashboard & Visual Progress Tracker  

---

## 1. What is FLN?

Foundational Literacy and Numeracy (FLN) represents the core ability of a child to read with basic comprehension and perform fundamental mathematical operations (such as counting, number recognition, addition, and subtraction) by the end of Grade 3 (Ages 5–9).

### The Educational Problem It Addresses
A critical challenge across primary education systems is that students often advance through grade levels without having solidified basic literacy and numeracy concepts. When foundational milestones are skipped, children struggle with higher-level academic learning. Structured FLN platforms operationalize frameworks (such as the national NIPUN Bharat guidelines) to help educators identify learning deficits early and deliver structured, targeted remediation.

### Purpose
The primary purpose of this FLN system is to provide a structured, level-wise digital framework for educators to evaluate student progress, identify competency gaps across distinct learning milestones, and offer data-driven instructional tools for both digital and offline classroom environments.

---

## 2. What do you understand by FLN as a system?

The FLN platform functions as an integrated educational hierarchy connecting administrative oversight with frontline classroom teaching:
              ┌────────────────────────────────────────┐
              │              SUPERADMIN                │
              │   (Curriculum, Global Taxonomy, Logs)   │
              └───────────────────┬────────────────────┘
                                  │
              ┌───────────────────▼────────────────────┐
              │             ADMIN / SCHOOL             │
              │      (Class & Teacher Management)      │
              └───────────────────┬────────────────────┘
                                  │
              ┌───────────────────▼────────────────────┐
              │                TEACHER                 │
              │ (Assessments, Diagnostic, Remediation) │
              └─────────┬────────────────────┬─────────┘
                        │                    │
      ┌─────────────────▼───┐            ┌───▼─────────────────┐
      │  DIGITAL ASSESSOR   │            │  PROGRESS TRACKER   │
      │  (Student Exam QA)  │            │(Visual Diagnostics) │
      └─────────────────┬───┘            └───┬─────────────────┘
                        │                    │
                        └─────────┬──────────┘
                                  ▼
                       ┌────────────────────┐
                       │      STUDENT       │
                       │(Mastery & Progress)│
                       └────────────────────┘
         ### Core Entities & Their Interactions
* **Students & Classes:** Students belong to specific class rosters (`test.classes.json`) associated with schools, and their historical progress is logged against discrete competency levels (`test.students.json`).
* **Teachers:** Frontline educators who conduct diagnostic assessments, identify struggling students, analyze performance trends, and assign remediation interventions.
* **School & State Administrators:** Track macro-level completion metrics across districts and monitor institutional FLN benchmark attainment.
* **Superadmins:** Manage global curriculum definitions, question banks, and system configurations.
* **Assessments & Competency Levels:** Structured question sequences (Level 1–10 for Number Sense, Level 16 for Basic Addition, Level 25 for Place Value, Level 31 for Time & Measurement) stored in `test.questions.json` that evaluate individual concept mastery.

---

## 3. Current State of the Repository — What Has Been Done So Far

* **Frontend Technology Stack:** Built with React, TypeScript, Vite, Tailwind CSS, and icon toolkits (`lucide-react`). It provides dedicated portal layouts for multiple user roles (`RoleDashboards.tsx`, `Layout.tsx`, `LoginView.tsx`).
* **Backend Architecture:** A Node.js and Express TypeScript backend (`backend/src/`) structured around modular routes, authentication controllers, and data endpoints.
* **Data Storage:** Uses JSON seed files inside `Database/` (`test.students.json`, `test.questions.json`, `test.classes.json`) to define mock state structures, alongside MongoDB models for live deployments.
* **Authentication & Session State:** Utilizes token-based authentication with localized state persistence in `localStorage` and centralized event dispatching for unauthorized sessions (`UNAUTHORIZED_EVENT`).
* **Role Views:** Interfaces implemented for Superadmins, Admins, Schools, Teachers, and Volunteers.

---

## 4. Gaps Observed in the Code

### Gap 1: Absence of Visual Diagnostic Analytics for Teachers
* **Where:** `frontend/src/components/RoleDashboards.tsx` (Teacher workspace component).
* **What:** While student score data exists in the schema, the teacher dashboard previously displayed raw lists without visual summaries or aggregate mastery distributions.
* **Why it matters:** Teachers cannot easily scan 30+ raw numerical student records to determine what percentage of their class has mastered a specific competency versus how many require immediate intervention.

### Gap 2: Lack of Targeted Student Grouping for Remediation
* **Where:** `frontend/src/hooks/` and `frontend/src/components/` (Missing analytics hook).
* **What:** The application lacked an automated calculation engine to categorize students according to NIPUN Bharat benchmark thresholds (Needs Intervention `<50%`, Progressing `50–74%`, Proficient `≥75%`).
* **Why it matters:** Without automated classification, teachers must manually evaluate each score, slowing down timely instructional interventions.

### Gap 3: Missing Correlation Tracking Between Attendance and Learning Outcomes
* **Where:** `Database/test.students.json` and dashboard views.
* **What:** Attendance percentages and assessment scores were stored independently without correlation modeling.
* **Why it matters:** Correlating attendance trends with proficiency allows educators to distinguish between students struggling due to chronic absenteeism versus those needing conceptual clarification.

---

## 5. Ideas for the Project

### Idea 1: Visual Competency Distribution & Scatter Analytics
* **Proposal:** Integrate lightweight charting (`recharts`) to present interactive bar charts of student mastery distributions alongside attendance vs. score scatter plots.
* **Why it helps:** Provides instant visual clarity on overall class health for any selected grade or FLN competency level.
* **Implementation Approach:** Built a custom data hook (`useStudentAnalytics.ts`) that transforms raw student records into reactive dataset arrays consumed by responsive SVG chart components.

### Idea 2: Actionable Remediation Queue with Direct Worksheet Linking
* **Proposal:** Add a filtered table beneath the visual charts listing only students who fall below baseline thresholds (`<50%`), paired with direct action buttons.
* **Why it helps:** Closes the feedback loop by turning visual analytics into immediate remediation tasks (e.g., generating tailored offline practice sheets).
* **Implementation Approach:** Dynamically filter students by `scores[selectedLevel] < 50` and attach trigger handlers for assignment workflows.

### Idea 3: Offline-First Synchronized Progress Persistence
* **Proposal:** Implement IndexedDB or local storage sync for assessment sessions to prevent data loss during power or network disruptions in rural classrooms.
* **Why it helps:** Guarantees assessment data integrity in low-connectivity schools.
* **Implementation Approach:** Cache unfinished assessment snapshots locally and flush batches via background sync when internet connectivity is re-established.

---

## 6. Your Contribution

During this onboarding stage, I implemented the **Teacher Assessment Dashboard & Visual Progress Tracker** module:

### 1. Analytics & Aggregation Hook (`frontend/src/hooks/useStudentAnalytics.ts`)
* Implemented reactive filtering for student records by grade and FLN competency level.
* Built dynamic classification algorithms grouping student performance into benchmark tiers (`<50%`, `50–74%`, `≥75%`).
* Added scatter plot aggregation pairing student attendance percentages with aggregate assessment scores.
* Included resilient fallback datasets to ensure graceful degradation.

### 2. Dashboard Component (`frontend/src/components/TeacherDashboard.tsx`)
* Developed an interactive analytics dashboard featuring:
  * Metric summary cards (Total Assessed, Needs Intervention, Proficient).
  * Recharts-powered responsive bar chart depicting level-specific competency breakdowns.
  * Scatter plot visualizing attendance vs. overall performance correlations.
  * Filter controls for dynamic switching across grades (1–3) and FLN levels (Level 10, Level 16, Level 25, Level 31).
  * Targeted remediation table isolating struggling learners with direct action triggers.

### 3. Modular Styling (`frontend/src/components/TeacherDashboard.css`)
* Designed a clean, accessible layout with distinct alert badges, structured card elevation, and responsive flex/grid wrappers.

### 4. Verification & Testing
* Verified dynamic chart updates upon changing grade and competency level selectors.
* Tested responsive rendering on both desktop and mobile viewports.              