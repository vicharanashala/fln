// Domain types: operational, certification and intervention records.

import type { UserRole } from './identity.types';

// --- SRS R-7: Certification Engine ---

export type MasteryLevel = 'Strong' | 'Satisfactory' | 'Needs Practice';

export interface CompetencyRequirement {
  classNumber: number;        // 2-4 (per SRS §3)
  level: number;              // typically 5
  topic: string;              // e.g. 'Number Operations'
  meetsThreshold: MasteryLevel;
  isMandatory: boolean;
}

export type CertificationStatus = 'active' | 'review_needed' | 'revoked';

export interface Certification {
  id: string;
  studentId: string;
  classNumber: number;
  level: number;
  decisionSnapshot: {
    outcome: 'eligible' | 'not_eligible' | 'insufficient_evidence';
    evaluatedAt: string;
    classNumber: number;
    level: number;
    metTopics: string[];
    missingTopics: string[];
    unassessedTopics: string[];
  };
  status: CertificationStatus;
  version: number;            // monotonic per (studentId, classNumber, level)
  certificateId?: string;
  issuedAt?: string;
  reviewReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Ticket {
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

export interface LogEntry {
  id: string;
  timestamp: string;
  schoolId: string;
  schoolName: string;
  userId: string;
  userEmail: string;
  userRole: UserRole;
  activityType:
    | 'download'
    | 'print'
    | 'conduct'
    | 'scan'
    | 'verify'
    | 'ticket'
    // Vault audit actions (the vault is the only writer of these
    // — see backend/src/modules/vault/audit/logbook-entry.ts). The
    // `logbook` collection is the single audit sink; there is no
    // separate `vault_audit_log` table. The Aadhaar vault command
    // and the surrounding route layer use the existing
    // `dbStore.addLog` / `dbStore.addLogInSession` path, so these
    // values are visible in the same `logbook` queries the rest
    // of the FLN backend already runs.
    | 'tokenize'
    | 'detokenize'
    | 'step_up_request'
    | 'step_up_approve'
    | 'mfa_enroll'
    | 'mfa_verify'
    // NEW (Wave 2A): account-level MFA enrollment lifecycle
    // events. The vault command and the FLN route layer both
    // write rows that carry these activityType values. The
    // mapping lives in
    // `backend/src/modules/vault/audit/logbook-entry.ts`.
    | 'mfa_enrollment_initiated'
    | 'mfa_enrollment_verified'
    | 'mfa_enrollment_failed'
    | 'mfa_enrollment_revoked';
  status: 'Success' | 'Failed' | 'Delayed';
  details: string;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  isUrgent: boolean;
  authorEmail: string;
  createdAt: string;
}

export type InterventionStrategyType = 'small_group' | 'one_on_one' | 'peer_tutoring' | 'visual_aids' | 'manipulatives' | 'worksheets' | 'game_based' | 'other';

export interface Intervention {
  id: string;
  studentId: string;
  studentName: string;
  teacherId: string;
  teacherName: string;
  schoolId: string;
  classId: string;
  className: string;
  section: string;
  weakCompetencies: string[];
  currentLevel: number;
  strategyType: InterventionStrategyType;
  strategyDescription: string;
  duration: string;
  startDate: string;
  endDate?: string;
  status: 'active' | 'completed' | 'pending_review';
  outcome?: {
    improved: boolean;
    previousLevel: number;
    newLevel?: number;
    improvementDetails?: string;
    assessmentId?: string;
    detectedAt?: string;
  };
  isPromoted: boolean;
  promotedAt?: string;
  createdAt: string;
}

export interface BestPractice {
  id: string;
  interventionId: string;
  teacherId: string;
  teacherName: string;
  schoolId: string;
  weakCompetencies: string[];
  strategyType: string;
  strategyDescription: string;
  levelBefore: number;
  levelAfter: number;
  levelJump: number;
  duration: string;
  tags: string[];
  viewCount: number;
  createdAt: string;
}
export interface MisconceptionCluster {
  id: string;
  name: string;
  description: string;
  teacherAction: string;
  forwardRisk: string;
  studentIds: string[];
  centroid?: number[];
  /**
   * The class this archetype belongs to. Archetypes never span classes: the
   * same-looking error means something different at each level (an off-by-one
   * in Class 2 counting is not the off-by-one of Class 4 regrouping), and a
   * teaching group a teacher can act on has to be one class they actually
   * teach. Optional only because clusters created before this field existed
   * carry no class; those are treated as belonging to no class and skipped.
   */
  classGroup?: string;
  /**
   * Who last renamed this archetype by hand, if anyone.
   *
   * Presence marks the name as human-authored, which is what stops automation
   * from taking it back: the deterministic re-naming pass skips these outright
   * rather than relying on the name merely not *looking* like a placeholder.
   *
   * Worth knowing when reading these: an archetype is scoped by `classGroup`
   * alone and carries no `schoolId`, so a rename is visible to every school
   * teaching that class — hence recording who did it.
   */
  nameSetBy?: string;
  nameSetByRole?: UserRole;
  nameSetAt?: string;
  createdAt: string;
  updatedAt: string;
}

