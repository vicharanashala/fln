# Onboarding Document - Rachit Verma

## 1. What is FLN?

FLN (Foundational Literacy and Numeracy) is an educational platform designed to address the learning crisis in primary education. It targets early-grade students (up to Class 4) who often lack basic reading, writing, and math skills. By providing a structured framework for assessment and tracking, FLN helps educators identify learning gaps early and ensures that every child builds the foundational skills necessary for future academic success.

## 2. What do you understand by FLN (as a system)?

FLN is a comprehensive, multi-tiered assessment and tracking system:

- **Users:** The system serves multiple roles. Superadmins and State/District/Block Administrators oversee regional progress and manage the system. Teachers and Volunteers are the primary ground-level users who manage students, conduct assessments, and record progress. Students are the end-users whose learning outcomes are tracked.
- **Main Entities:** The core entities include Schools, Classes, Students, Questions, Worksheets, and Evaluation Reports. 
- **Data Flow:** Teachers or Volunteers register students into specific classes. The system generates personalized diagnostic worksheets based on the student's current FLN level. Once the student completes the worksheet, the answers are evaluated (either manually or via AI/OMR scanning), and an evaluation report is generated. This report updates the student's FLN level, and the aggregated data flows up to the administrators for regional monitoring and analytics.

## 3. Current State of the Repository — What Has Been Done So Far

- **Tech Stack:** 
  - **Frontend:** React with TypeScript, Vite, Tailwind CSS, and Lucide React for icons.
  - **Backend:** Node.js with Express and TypeScript.
  - **Database:** MongoDB Atlas for production, with a robust fallback to a local, lightweight JSON file (`data/db.json`) for local development and testing.
  - **Authentication:** JWT-based token authentication with bcrypt for password hashing.
- **Implemented Features:**
  - Role-Based Access Control (RBAC) with distinct dashboards for different user types.
  - Automated generation of personalized diagnostic worksheets using AI (Gemini).
  - Student management, including registration and profile tracking.
  - Analytics dashboards with geographical and performance charts.
  - Intervention tracking and a best practices repository for teachers.

## 4. Gaps Observed in the Code

1. **Lack of Bulk Student Registration (Issue #178):**
   - **Where:** `frontend/src/components/PanelViews.tsx` (Student Registration UI) and `backend/src/routes/students.ts` (API routes).
   - **What:** Students could only be registered one at a time through a manual form. There was no functionality to bulk-register an entire class from a spreadsheet (CSV).
   - **Why it matters:** A teacher with 40 new students would have to fill out the registration form 40 separate times, which is highly inefficient and prone to manual data entry errors. This significantly degraded the user experience for educators onboarding new classes.

## 5. Ideas for the Project

1. **Automated Database Seeding Script:**
   - **What:** Create a dedicated npm script (e.g., `npm run seed`) that populates the MongoDB database with realistic mock data (schools, teachers, students, and worksheets).
   - **Why:** Currently, the system relies on the JSON fallback or manual entry for testing. A robust seeding script would make it much easier for new developers to set up a fully populated local environment.
   - **How:** Write a script in the `backend/scripts` folder that connects to MongoDB, clears existing collections, and inserts the data from `getSeedData()` in `db.ts`.

## 6. Your Contribution

During my onboarding, I tackled **Issue #178: CSV student-registration ingestion endpoint** and fixed critical database fallback bugs:

- **Bulk Import Endpoint:** Implemented `POST /api/students/bulk-import` in `backend/src/routes/students.ts`. This endpoint accepts a parsed CSV payload, validates each row (ensuring required fields and unique Aadhar numbers), and bulk-inserts the valid students using the existing `createStudentFromData` logic. It returns a detailed per-row summary of successes and failures.
- **Frontend Bulk Import UI:** Added a CSV upload control in `frontend/src/components/PanelViews.tsx`. The UI parses the CSV, sends it to the backend, and displays a clear summary of valid vs. invalid rows. It also provides a "Download incorrect" button that generates a new CSV containing only the failed rows along with their specific error reasons.
- **UI Fixes & Enhancements:** 
  - Moved the "Register New Student" form from the main dashboard to the Student List panel for a more cohesive user experience.
  - Added new fields (`address`, `class group`, and `section`) to the "Register New Student" form to capture more comprehensive student data.
  - Resolved a UI problem for registering a student in dark mode (fixed text visibility issues by removing conflicting focus classes).
