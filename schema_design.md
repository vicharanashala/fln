# MongoDB Schema Design

This document details the MongoDB schema and collection design configured for the Foundational Literacy & Numeracy (FLN) Assessment Portal. 

The application utilizes a dual-persistence strategy: it automatically connects to a MongoDB database if the `MONGO_URI` environment variable is defined, and gracefully falls back to a local structured JSON database (`data/db.json`) in its absence.

---

## Collections Overview

The database contains **12 primary collections** representing the core modules of the FLN system:

1. `users` — Portal users across administrative hierarchies (Superadmin, Block Admin, Teachers, Volunteers, etc.).
2. `schools` — Basic education facility metadata (with Strength status & lockdown flags).
3. `classes` — Sub-divisions of grades (Class 2 to 4) under a school.
4. `students` — Child profiles with academic progression, math/reading level history, and streaks.
5. `questions` — Question bank with complexity levels, expected answers, and source math mappings.
6. `worksheets` — Generated paper packages/exams containing timelines, questions, and action logs.
7. `answerSubmissions` — Individual student answer scripts submitted via scanners/ICR tools.
8. `evaluationReports` — Child evaluation digests, mastery levels per topic, and recommended level transitions.
9. `tickets` — Support and curriculum dispute tickets.
10. `logbook` — Audit and compliance tracking logs.
11. `announcements` — System-wide broadcast alerts and urgent push notices.
12. `sets` — District-level administrative batches of students for bulk paper generation, printing, and tracking.

---

## Schema Reference

### 1. `users`
Represents the accounts authorized to use the platform.
```typescript
interface User {
  id: string;               // Unique user ID
  email: string;            // User login/contact email
  name: string;             // Display name
  role: UserRole;           // "superadmin" | "admin" | "district_admin" | "block_admin" | "school" | "teacher" | "volunteer"
  stateCode?: string;       // Admin hierarchical boundary (if applicable)
  districtCode?: string;    // Admin hierarchical boundary (if applicable)
  blockCode?: string;       // Admin hierarchical boundary (if applicable)
  schoolId?: string;        // Assigned School (for School-level / Teacher accounts)
  assignedSchools?: string[]; // Multiple schools (for Volunteers / Monitors)
  delayedAttemptsCount?: number; // Flag count for late paper uploads
  isBanned?: boolean;       // System lockdown access-banning flag
}
```

### 2. `schools`
Schools enrolled in the FLN initiative.
```typescript
interface School {
  id: string;               // Unique school code/ID
  name: string;             // School name
  stateCode: string;
  districtCode: string;
  blockCode: string;
  strength: 'high' | 'low'; // High-strength (>=150 students) vs. Low-strength (<150 students)
  teachersCount: number;
  isAccessLocked?: boolean; // Locked state if safety thresholds or submission guidelines are breached
}
```

### 3. `classes`
Grade divisions under schools.
```typescript
interface ClassGroup {
  id: string;               // Class ID
  schoolId: string;         // Parent school reference
  className: string;        // e.g., "Class 2", "Class 3", "Class 4"
  section: string;          // e.g., "A", "B", "C"
  teacherId: string;        // Classroom teacher reference
}
```

### 4. `students`
Detailed profiles of student learners.
```typescript
interface Student {
  id: string;               // Unique child ID
  name: string;             // Full name
  age: number;
  classGroup: string;       // "Class 2" | "Class 3" | "Class 4"
  section: string;          // Class section (A, B...)
  schoolId: string;         // Enrolled school reference
  teacherId?: string;       // Supervisor teacher ID
  currentLevel: number;     // Active mathematical FLN Level (1 to 59)
  currentSubLevel?: number; // Fine-grained sub-progression index
  targetLevel: number;      // Scheduled mathematical milestone
  aadharMasked: string;     // Compliant masked identity code (e.g. "XXXX-XXXX-1234")
  streak: number;           // Active performance/attendance streak
  levelHistory: Array<{
    level: number;
    subLevel?: number;
    date: string;           // ISO DateTime
    reason: string;         // Transition rationale (e.g., "Baseline Assessment recommendation")
  }>;
}
```

### 5. `questions`
Individual modular items inside the assessment bank.
```typescript
interface Question {
  question_id: string;      // Question code
  question: string;         // Visual question prompt text
  answer: string;           // Correct expected answer key
  answer_type: 'text' | 'number' | 'choice';
  choices?: string[];       // MCQ choices
  topic: string;            // Broad theme (e.g., "Number Sense")
  subtopic: string;         // Specific target skills (e.g., "Addition with carry")
  difficulty: 'easy' | 'medium' | 'hard';
  source_level: number;     // Math curriculum level origin
  svgAsset?: string;        // Optional visual symbol lookup path
}
```

### 6. `worksheets`
Assessment packages issued by administrators.
```typescript
interface Worksheet {
  id: string;               // Unique sheet ID / Exam ID
  classId: string;          // ClassGroup ID
  className: string;        // Class Name
  section: string;
  schoolId: string;
  generatedByRole: UserRole;
  generatedByEmail: string;
  cycle: 'Baseline' | 'Mid-year' | 'End-of-year';
  date: string;             // Generation date
  questions: Question[];    // Included question bank items
  locks: {
    locked: boolean;        // Submission-locked status
    lockedByRole: UserRole | null;
    lockedByEmail: string | null;
    timestamp: string | null;
  };
  timing: {
    examDate: string;           // scheduled exam date ("YYYY-MM-DD")
    printWindowStart: string;   // ISO Timestamps
    printWindowEnd: string;
    examWindowStart: string;
    examWindowEnd: string;
    submissionWindowEnd: string;// Cut-off threshold for scanning and verification
  };
  delayLogs: {
    delayedAttemptsCount: number;
    submittingTeachers: string[];
  };
}
```

### 7. `answerSubmissions`
Scanned/submitted child student responses.
```typescript
interface AnswerSubmission {
  id: string;               // Submission ID
  worksheetId: string;      // Related exam paper reference
  studentId: string;        // Related student reference
  studentName: string;
  schoolId: string;
  classId: string;
  submittedAt: string;      // ISO Timestamp
  isDelayed: boolean;       // Marked delayed if submitted after 'timing.submissionWindowEnd'
  answers: {                // Key-Value of question IDs to submitted string answers
    [questionId: string]: string; 
  };
}
```

### 8. `evaluationReports`
Automated performance digests computed upon submission.
```typescript
interface EvaluationReport {
  id: string;               // Unique report ID
  studentId: string;        // Related student reference
  worksheetId: string;      // Related exam paper reference
  score: number;            // Earned score
  totalQuestions: number;   // Max score
  conceptMastery: {         // Breakdown by topic area
    [topic: string]: 'Strong' | 'Needs Practice' | 'Satisfactory';
  };
  narrative: string;        // Humanized performance narrative
  recommendedLevel: number; // Suggested math level progress
  recommendedSubLevel?: number;
  timestamp: string;        // Assessment compilation time
}
```

### 9. `tickets`
Administrative and dispute issues raised.
```typescript
interface Ticket {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  userRole: UserRole;
  type: 'general' | 'curriculum';
  subject: string;
  description: string;
  status: 'Open' | 'Reviewed' | 'Resolved';
  createdAt: string;
}
```

### 10. `logbook`
Complete audit trail of sensitive user actions.
```typescript
interface LogEntry {
  id: string;
  timestamp: string;        // ISO Timestamp
  schoolId: string;         // Related institution ID
  schoolName: string;
  userId: string;           // Performing user ID
  userEmail: string;
  userRole: UserRole;
  activityType: 'download' | 'print' | 'conduct' | 'scan' | 'verify' | 'ticket';
  status: 'Success' | 'Failed' | 'Delayed';
  details: string;          // Short contextual summary
}
```

### 11. `announcements`
Platform bulletins.
```typescript
interface Announcement {
  id: string;
  message: string;          // Bulletin prompt
  timestamp: string;        // Release timestamp
  isUrgent: boolean;        // High priority banner flag
}
```

### 12. `sets`
District-Level Set (Batch) — an administrative grouping of students for bulk paper generation, printing, and lifecycle tracking.
```typescript
type SetStatus =
  | 'Created'
  | 'Question Papers Generated'
  | 'Printed'
  | 'Dispatched'
  | 'Delivered to School'
  | 'Assessment Conducted'
  | 'Answer Sheets Returned'
  | 'Scanning Completed'
  | 'Evaluation Completed';

interface Set {
  id: string;               // e.g. "SET-001"
  name: string;             // Human-readable set label
  assessmentName: string;   // Name of the linked assessment/exam
  schoolId: string;         // Target school reference
  classGroup: string;       // Reuses the same grade/class values as the `classes` collection (e.g., "Class 2", "Class 3", "Class 4")
  studentIds: string[];     // Ordered list of student IDs — printing order must match this order
  status: SetStatus;        // Current forward-only lifecycle stage
  createdAt: string;        // ISO timestamp
  createdByEmail: string;   // Email of the district admin who created the set
}

// In-memory Ephemeral Job tracking the generation progress of a Set:
interface SetGenerationJob {
  jobId: string;            // Unique generation job UUID
  setId: string;            // Linked Set ID
  total: number;            // Total students in the set
  completed: number;        // Number of successfully generated PDFs
  status: 'running' | 'completed' | 'failed';
  pdfPaths: string[];       // Individual student PDF paths
  packagePath?: string;     // Final merged PDF package path
  failures: Array<{ studentId: string; error: string }>; // Tracked generation failures
  startedAt: string;        // ISO Timestamp
  completedAt: string;      // ISO Timestamp
}
```

---

## Known Limitations

- **In-Memory Job Tracking:** Set generation jobs (tracked via `SetGenerationJob`) are tracked in-memory and are lost on server restart, similar to the existing `/api/diagnostic/bulk` bulk generation jobs. Active generation loops and cached PDF package references will not persist across service restarts.
