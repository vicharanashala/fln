
# FLN Project Onboarding Document

**Contributor:** Suhruth 
**Date:** October 18, 2026  
**Repository:** [vicharanashala/fln](https://github.com/vicharanashala/fln)   

---

## 1. What is FLN?

**FLN** stands for **Foundational Literacy and Numeracy**. It is an open-source educational platform designed to help educators, administrators, and students manage, track, and evaluate fundamental literacy and numeracy skills. Rather than acting as just a digital textbook reader, it functions as a comprehensive ecosystem for tracking student competencies, managing classroom enrollments, generating question papers or assessments, and visualizing learning progress through structured conceptual prerequisite graphs.

### The Educational Problem Addressed
In traditional schooling systems, children are frequently promoted based on age or attendance rather than verified concept mastery. This creates cumulative learning deficits—for instance, a student who has not mastered foundational arithmetic struggles continuously with multi-digit problem-solving. FLN disrupts this pattern by:
- Conducting systematic diagnostic assessments.
- Tracking sub-level concept mastery granularly across hierarchical learning paths.
- Providing automated support for paper generation and optical scanning workflows.
- Dynamically generating targeted remediation paths for weak concepts.

### Purpose and Audience
FLN serves a multi-tier educational ecosystem:
1. **Students**: Interact with learning modules, assessments, and competency tests.
2. **Teachers/Instructors**: Register students, monitor concept progression, manage bulk imports, and evaluate performance data.
3. **Administrators**: Configure system metadata, oversee system vaults, manage concept dependency graphs, and monitor institutional compliance.
4. **Volunteers**: Support low-resource or low-connectivity schools with mobile assessment administration.

---

## 2. What do you understand by FLN as a system?

FLN functions as an interconnected, multi-role system governed by strict administrative hierarchies and data workflows.


```

```
                ┌────────────────────────┐
                │      SUPERADMIN        │ (Curriculum & System Config)
                └───────────┬────────────┘
                            │
                ┌───────────▼────────────┐
                │      STATE ADMIN       │ (Regional Analytics)
                └───────────┬────────────┘
                            │
                ┌───────────▼────────────┐
                │    DISTRICT ADMIN      │ (Institutional Oversight)
                └───────────┬────────────┘
                            │
                ┌───────────▼────────────┐
                │      BLOCK ADMIN       │ (Block Management & Deployment)
                └─────┬────────────┬─────┘
                      │            │
       ┌──────────────▼───┐    ┌───▼──────────────┐
       │     TEACHER      │    │    VOLUNTEER     │ (Paper Gen & Scanning)
       └──────────────┬───┘    └───┬──────────────┘
                      │            │
                ┌─────▼────────────▼─────┐
                │  CLASS & STUDENTS      │ (Diagnostic & Mastery Progression)
                └────────────────────────/

```

```

### Entities & User Roles
1. **Student**: Represented by records containing profile information, registration details, and learning states.
2. **Teacher / Volunteer**: Operational users responsible for paper generation, optical sheet scanning, and reviewing diagnostic reports.
3. **Admin Tiers (Block, District, State, Superadmin)**: Oversee institutional compliance, regional performance trends, user governance, and system-wide configurations.

### System Components & Interactions
- **Worksheets & Question Papers**: Diagnostic papers generated dynamically via backend templates and rendered for physical administration.
- **Competency Engine**: Found under modules like `competencyPrerequisites`, which parses and validates concept graphs (verifying nodes, directed edges, and cycle-free prerequisite paths).
- **Storage & Vault Layer**: Handles modular storage handlers, supporting MongoDB configurations and falling back to local file-based database storage when environment variables are absent.

---

## 3. Current State of the Repository — What Has Been Done So Far

### Technology Stack
- **Frontend & Server**: Built with modern web tooling (Vite, React, TypeScript, Tailwind CSS) and Express. Express mounts Vite development middleware for seamless client-server integration on port 3000.
- **Database Layer**: Modular storage handlers supporting MongoDB alongside a local JSON file-based database fallback mechanism (`db.json`).
- **Validation & Prerequisite Graphs**: The `competencyPrerequisites` module parses concept networks, verifying nodes, edges, and prerequisite dependencies.

### Implemented Features
- Multi-role workspace architecture supporting various administrative and teaching tiers.
- Local development server setup with automatic fallback handling when environment keys like `MONGODB_URI` or `LOCAL_DEV_MASTER_KEY` are unconfigured.
- Competency prerequisite graph parsing engine ensuring valid learning path structures.

---

## 4. Gaps Observed in the Code

During a line-by-line inspection of the codebase, two critical technical gaps were identified:

### Gap 1: Missing Environment Key Validation Graceful Handling
- **Where**: `server.js` / configuration initialization blocks (around vault and master key checks).
- **What is wrong or missing**: The server logs a warning (`[vault] Missing LOCAL_DEV_MASTER_KEY: student registration and bulk import will fail.`) but permits the app to boot into a state where core features like student registration break at runtime without clear user-facing UI indicators.
- **Why it matters**: Developers or contributors testing locally might attempt registration or bulk import workflows, encounter unexpected silent failures or unhandled exceptions, and assume the codebase is broken.

### Gap 2: Fallback Database Persistence Error Boundaries
- **Where**: Database connection and file-based fallback modules (`db.ts`).
- **What is wrong or missing**: When MongoDB is absent, the system switches to file storage without explicit synchronization or transaction safety checks for concurrent local writes.
- **Why it matters**: Concurrent writes during local testing can lead to race conditions or corrupted local state JSON files, disrupting the developer experience.

---

## 5. Ideas for the Project

Based on the identified gaps, the following practical improvements are proposed:

### Idea 1: Resolve Broken Documentation Links
- **What**: Audit all Markdown documentation files in the repository to identify and fix dead relative links or outdated repository reference URLs.
- **Why**: Ensures a seamless navigation experience for new contributors reading the onboarding guidelines and repository documentation.
- **How**: Manually inspect markdown files, verify anchor paths, and update references to point to correct current paths.

### Idea 2: Clean Up Startup Log Formatting for Environment Variables
- **What**: Refine console output messages when optional keys or local fallback databases are engaged.
- **Why**: Reduces developer confusion during local startup by providing clearer, more readable initialization logs.
- **How**: Standardize log messages in `server.js` and vault initialization modules.

### Idea 3: Add Explicit Input Validation for Local File Fallback States
- **What**: Introduce safety checks to prevent empty or malformed writes during file-based JSON state updates.
- **Why**: Safeguards the local database fallback against race conditions or unexpected crashes during local testing.
- **How**: Implement a try-catch serialization block around file write functions.

---

## 6. Your Contribution

As part of this onboarding, the following tangible tasks were completed:
1. Cloned and successfully set up the FLN repository locally on Windows PowerShell.
2. Resolved execution policy constraints (`RemoteSigned` scope) to execute local dependency installation (`npm install`).
3. Successfully booted the development server, verified middleware mounting, analyzed the local file-based database fallback behavior, and inspected the competency prerequisite graph logs.
4. Authored and finalized this comprehensive onboarding document adhering strictly to Markdown formatting requirements.

---
*Submitted with care for the FLN Project.*

```

---