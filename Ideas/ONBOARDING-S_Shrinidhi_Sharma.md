# FLN Repository Onboarding Report

## 1. What is FLN?

FLN stands for **Foundational Literacy and Numeracy**. It focuses on ensuring that children develop the basic reading, writing, comprehension, and mathematical skills required for effective learning in later grades.

The FLN project addresses the problem of students progressing through school without achieving foundational competencies. Its purpose is to identify a student's actual FLN level, assess their weaknesses, provide an appropriate assessment and learning path, and continuously track their progress until they achieve the required grade-level competency.

The project is aligned with **NEP 2020** and **NIPUN Bharat**. NIPUN Bharat aims to ensure that children achieve grade-level foundational literacy and numeracy competencies by the end of Grade 3.

The platform is intended to support a continuous cycle of:

- Student assessment
- FLN-level diagnosis
- Personalized worksheet generation
- Reassessment
- Progress tracking
- Certification

---

## 2. What do you understand by FLN as a system?

I understand FLN as a **multi-level education, assessment, and progress-tracking system**, rather than simply a student-management application.

The major entities involved are:

```text
Government / FLN Framework
          |
        State
          |
       District
          |
        Block
          |
        School
          |
       Teacher
          |
    Class / Students
          |
      Assessment
          |
      Evaluation
          |
   Student Progress
          |
 Certification / Re-assessment
```

### Students

Students are the primary subjects of the system. Their profiles contain information related to their FLN level, assessment history, and learning progress.

### Teachers

Teachers are the main operational users. They manage classes, generate assessments, print worksheets, scan completed answer sheets, and access evaluation and analytics.

### Schools

Schools provide the institutional context for teachers, classes, and school-affiliated students.

### Classes

Classes group students within schools and associate them with teachers.

### Assessments and Worksheets

The intended workflow is:

```text
Generate Paper
      |
     Print
      |
Student Completes Paper
      |
 Teacher Scans Sheet
      |
 System Evaluates
      |
Student Profile Updated
```

### Evaluation and Progress

The evaluation determines the student's FLN competency. The result is used to update the student's learning level and determine whether the student should progress, receive certification, or undergo further assessment.

### Administrators and Superadmins

The backend recognizes multiple roles, including:

- Superadmin
- Admin
- District Admin
- Block Admin
- School
- Teacher
- Volunteer

These roles provide different levels of access to schools, classes, students, assessments, and analytics.

### Certification

Certification is part of the intended assessment cycle. Students who achieve the required FLN benchmark can progress and receive certification, while students who do not meet the benchmark can be reassessed after further diagnosis.

---

## 3. Current State of the Repository — What Has Been Done So Far

The repository currently contains an **early-stage MVP of a MERN-based FLN platform**. The implementation is a monolithic full-stack application in which the React frontend and Express backend are developed and served as part of the same project.

### Technology Stack

The project is outlined as a **MERN stack** application, with the current MVP using several additional technologies.

#### Frontend

- **React 19** with TypeScript
- **Vite** for development and frontend bundling
- **TailwindCSS** for styling
- **Framer Motion (`motion`)** for animations
- **Lucide React** for icons

The frontend operates as a **Single Page Application (SPA)**. `App.tsx` manages application-level state such as the current user, authentication token, and active view, and dynamically renders role-specific dashboards through a common layout structure.

#### Backend

The backend uses:

- **Node.js**
- **Express.js**
- **TypeScript**
- **tsx** for development execution
- **esbuild** for production bundling

The main backend entry point is:

```text
server/index.ts
```

The Express server handles API routing, application/business logic, document generation, AI interactions, and serving generated/static files.

#### AI and External Integrations

The project integrates Google's Gemini AI through:

```text
@google/genai
```

The AI functionality is used for capabilities such as:

- Diagnostic assessment generation
- AI-based evaluation
- Personalized worksheet generation

#### Document Generation

The project uses:

- **Puppeteer**
- **pdf-lib**

These are used for generating, rendering, and manipulating PDF worksheets and question papers.

---

### Architecture

The current MVP follows a **Monolithic Full-Stack Architecture**.

```text
                FLN Application
                      |
        +-------------+-------------+
        |                           |
     Frontend                    Backend
        |                           |
 React SPA                    Express API
        |                           |
 Role Dashboards          Business Logic
        |                    AI Integration
        |                 Document Generation
        |                           |
        +-------------+-------------+
                      |
                 File Database
```

### Client-Side Architecture

The frontend is implemented as a React SPA.

`App.tsx` manages application-level state such as:

- Current user
- Authentication token
- Active view

It then renders different dashboards depending on the user's role.

A common layout structure is used to maintain the overall application interface while allowing different roles to access different dashboard functionality.

### Server-Side Architecture

The Express backend in:

```text
server/index.ts
```

acts as the central backend entry point.

It handles:

- API routes
- Authentication helpers
- Business logic
- Student/class operations
- Assessment-related operations
- AI interactions
- PDF/document generation
- Static file serving

This means the current MVP keeps most backend responsibilities within a single server application rather than separating them into independent services.

---

### Authentication

The current authentication mechanism is a **simplified stateless mock implementation** intended primarily to demonstrate role-based access.

Instead of using production authentication mechanisms such as securely hashed passwords and JWT/session infrastructure, the current system uses an email-matching approach through `getAuthUser()` in:

```text
server/index.ts
```

Users can be assigned roles based on their email format. Examples include:

```text
superadmin@fln.org
        |
        v
   SUPERADMIN

admin.*@fln.org
        |
        v
      ADMIN

district.*@fln.org
        |
        v
  DISTRICT_ADMIN

block.*@fln.org
        |
        v
   BLOCK_ADMIN

*.t@fln.org
        |
        v
     TEACHER
```

The system also performs password-format validation, including requirements such as uppercase characters, numbers, and special characters. However, authentication is primarily intended for rapid development/testing rather than production security.

The current implementation returns the email as a mocked session token, which is stored in `localStorage` under the application's token mechanism.

---

### Dashboards and Role Management

The platform is strongly role-driven.

The dashboard implementation in:

```text
mvp/src/components/RoleDashboards.tsx
```

provides different interfaces depending on the authenticated user's role.

The current roles include:

#### Superadmin

Provides global-level oversight and functionality such as creating system announcements.

#### State / District / Block Administrators

Provide hierarchical administrative access and statistics at their respective geographical levels.

#### School

Provides school/principal-level management functionality.

#### Teacher

Provides operational functionality such as:

- Creating class assessments
- Evaluating scanned answers
- Viewing student FLN proficiency profiles

#### Volunteer

Provides functionality intended for supporting schools or working with specific subsets of students.

This role hierarchy reflects the multi-level structure expected in an FLN implementation.

---

### Implemented Features

Several major FLN-related features have already been scaffolded or implemented.

#### Automatic Worksheet Generation

The project contains:

```text
paperGenerator.ts
levelGenerator.ts
```

These components support generation of diagnostic papers and customized worksheets based on student proficiency levels.

#### AI-Powered Generation and Evaluation

The Gemini integration in:

```text
gemini.ts
```

supports AI-based capabilities including:

- Personalized worksheet generation
- Diagnostic generation
- AI evaluation

This provides the foundation for adapting assessments to individual student performance.

#### Ticketing and Feedback System

The application includes an in-app ticketing system for submitting feedback.

Curriculum-related feedback is restricted to appropriate roles such as:

- Teachers
- Volunteers

This provides a mechanism for users to communicate issues or curriculum-related feedback through the platform.

#### Announcements

The application includes an announcements system.

The frontend polls for announcements approximately every 15 seconds and can display urgent announcements through a prominent alert/banner mechanism.

This provides a mechanism for communicating important information to users across the platform.

#### Assessment Calendar and Logbook

The application also contains interfaces for:

- Tracking assessment schedules
- Viewing assessment-related activities
- Maintaining system logs

These features support administrative monitoring of the assessment process.

---

### Database

Although the overall project is designed around a MERN architecture and the README identifies **MongoDB** as the intended database, the current MVP uses a **local file-based JSON database**.

The implementation is located around:

```text
server/db.ts
```

and stores data in:

```text
data/db.json
```

The database layer provides TypeScript interfaces representing the application's major entities, including:

```text
User
School
ClassGroup
Student
Question
Worksheet
AnswerSubmission
EvaluationReport
Ticket
Announcement
```

The `dbStore` reads and writes these records directly to the filesystem.

This approach makes the MVP easy to run locally without requiring a MongoDB server, but it is a prototype-oriented persistence mechanism rather than the final scalable database architecture.

---

### Deployment and Build Setup

The current project is configured for a basic Node-based deployment rather than a containerized/cloud-native deployment.

#### Development

The development environment is started using:

```bash
npm run dev
```

This executes the TypeScript backend through:

```text
tsx server/index.ts
```

and supports the Vite-based frontend development environment.

#### Production Build

The production build is performed using:

```bash
npm run build
```

The build process:

1. Builds the React frontend using Vite.
2. Bundles the Express backend using esbuild.
3. Produces the backend bundle:

```text
dist/server.cjs
```

#### Production Start

The production application can then be started using:

```bash
npm start
```

which executes:

```text
node dist/server.cjs
```

### Current Deployment Limitations

The current deployment setup is suitable for the MVP/development stage but would require additional infrastructure before large-scale production deployment.

---

## 4. Gaps Observed in the Code

### Gap: Ad-hoc ID Generation

**Where:**  
`server/index.ts`, particularly the existing user and student creation logic.

**What:**  
The current backend generates IDs independently at different points in the application using random-generation expressions. For example, student creation uses a format similar to:

```text
STD_ + random number
```

while users can be generated using another random format such as:

```text
u_ + random string
```

This means there is no centralized ID-generation strategy shared across the application.

**Why it matters:**

This creates several problems:

- Different entities can have different ID-generation strategies.
- The structure of an ID is not standardized.
- The generation logic is coupled to individual endpoints.
- Future changes to the ID format would require modifying multiple parts of the backend.
- Random generation alone does not provide an authoritative uniqueness guarantee.
- The current approach does not provide a clear long-term identity strategy for students and teachers.

This becomes particularly important for an FLN platform because student and teacher records are expected to persist across assessments, school transfers, and changes in affiliation.


---

## 5. Ideas for the Project

### Idea: Centralized Permanent ID Generation

**What:**  
Create a dedicated `idGenerator.ts` module responsible for generating Teacher and Student IDs.

**Why:**  
This provides a single source of truth for identity generation and prevents different API endpoints from using different random-ID mechanisms.

**How:**  

The generator should:

1. Generate a cryptographically secure random identifier.
2. Encode the random value using Crockford Base32.
3. Include an entity marker for Teacher or Student.
4. Include a scheme version.
5. Add a checksum for structural/transcription validation.
6. Provide functions for parsing and validating generated IDs.

The resulting structure can follow the pattern:

```text
Version + Random Identifier + Entity Type + Checksum
```

---

### Idea: Database-Level Uniqueness

**What:**  
Use a database-level unique constraint for the final identity field.

**Why:**  
A random generator can make collisions extremely unlikely, but it cannot mathematically guarantee that a generated value has never been used.

**How:**

```text
Generate ID
     |
     v
Attempt database insertion
     |
     +---- Success ----> Store ID
     |
     +---- Duplicate --> Generate another ID
                              |
                              v
                           Retry
```

The database should have a unique index/constraint on the permanent Student and Teacher ID fields.

---


## 6. My Contribution

During onboarding, my main contribution was the **design and implementation of a centralized ID-generation system**.

The repository originally contained ad-hoc ID generation in backend endpoints. I analyzed this approach and designed a dedicated `idGenerator.ts` module to establish a consistent identity-generation mechanism.


The current ID-generation design focuses on:

- Cryptographically secure random ID generation
- Crockford Base32 encoding
- Teacher/Student entity identification
- ID scheme versioning
- Checksum-based validation
- Offline structural validation
- Separation of permanent identity from school affiliation

The design also recognizes that the generator itself should not be treated as the final authority for uniqueness. Database-level unique constraints and collision handling should be used when the identity is persisted.

The main contribution was therefore not only the creation of an ID generator, but the identification and implementation of a more flexible identity architecture in which **Student and Teacher IDs represent permanent identities while school or independent affiliation is maintained separately**.

This allows the platform to support school transfers, independent learners, and independent mentors without changing the underlying identity or losing historical assessment and progress records.
