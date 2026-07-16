# MongoDB Schema Design

This document details the MongoDB schema and collection design configured for the Foundational Literacy & Numeracy (FLN) Assessment Portal. 

The application utilizes a dual-persistence strategy: it automatically connects to a MongoDB database if the `MONGO_URI` environment variable is defined, and gracefully falls back to a local structured JSON database (`data/db.json`) in its absence.

---

## Collections Overview

The database contains **11 primary collections** representing the core modules of the FLN system:

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
