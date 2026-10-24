import { LearnerSkillState, ModelRun, SkillBeliefState } from '../db';

/** Default window (in days) after which unobserved skill evidence is treated as stale */
export const DEFAULT_STALENESS_DAYS = 180;

export interface SkillAttemptRecord {
  isCorrect: boolean;
  timestamp?: string;
  assessmentId?: string;
  errorPattern?: string;
}

/**
  * Determines whether a skill observation is stale based on last observed timestamp.
  */
export function isSkillStateStale(
  lastObservedAt?: string,
  maxAgeDays: number = DEFAULT_STALENESS_DAYS,
  referenceDate: Date = new Date()
): boolean {
  if (!lastObservedAt) return true;
  const observedDate = new Date(lastObservedAt);
  if (isNaN(observedDate.getTime())) return true;

  const diffMs = referenceDate.getTime() - observedDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays > maxAgeDays;
}

/**
  * Returns the effective belief state, returning 'insufficient_recent_evidence' if the observation is stale.
  */
export function getEffectiveSkillState(
  record: LearnerSkillState,
  maxAgeDays: number = DEFAULT_STALENESS_DAYS,
  referenceDate: Date = new Date()
): SkillBeliefState {
  if (record.evidenceCount === 0) {
    return 'unobserved';
  }

  if (isSkillStateStale(record.lastObservedAt, maxAgeDays, referenceDate)) {
    return 'insufficient_recent_evidence';
  }

  return record.state;
}

/**
  * Rebuilds a LearnerSkillState purely from an array of raw attempt records.
  * Guaranteeing algorithm independence and full deterministic rebuildability.
  */
export function rebuildLearnerSkillState(
  studentId: string,
  skillId: string,
  attempts: SkillAttemptRecord[],
  modelVersion: string = '1.0.0'
): LearnerSkillState {
  if (!attempts || attempts.length === 0) {
    return {
      studentId,
      skillId,
      state: 'unobserved',
      confidence: 0,
      evidenceCount: 0,
      correctCount: 0,
      incorrectCount: 0,
      modelVersion,
      updatedAt: new Date().toISOString(),
    };
  }

  // Sort attempts by timestamp ascending
  const sorted = [...attempts].sort((a, b) => {
    const tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return tA - tB;
  });

  const correctCount = sorted.filter(a => a.isCorrect).length;
  const incorrectCount = sorted.filter(a => !a.isCorrect).length;
  const total = sorted.length;

  const firstObservedAt = sorted[0].timestamp || new Date().toISOString();
  const lastAttempt = sorted[sorted.length - 1];
  const lastObservedAt = lastAttempt.timestamp || new Date().toISOString();
  const lastAssessmentId = lastAttempt.assessmentId;
  const recentErrorPattern = lastAttempt.errorPattern;

  const accuracy = correctCount / total;
  let state: SkillBeliefState = 'learning';
  let confidence = Math.min(1, total * 0.2);

  if (total >= 3 && accuracy >= 0.8) {
    state = 'mastered';
    confidence = Math.min(1.0, 0.7 + total * 0.05);
  } else if (total >= 2 && accuracy < 0.5) {
    state = 'struggling';
    confidence = Math.min(1.0, 0.6 + total * 0.05);
  }

  return {
    studentId,
    skillId,
    state,
    confidence,
    evidenceCount: total,
    firstObservedAt,
    lastObservedAt,
    correctCount,
    incorrectCount,
    recentErrorPattern,
    lastAssessmentId,
    modelVersion,
    updatedAt: new Date().toISOString(),
  };
}

/**
  * Helper to record a model-specific run output into ModelRun schema.
  */
export function createModelRunRecord(
  studentId: string,
  skillId: string,
  modelType: string,
  modelVersion: string,
  inputEvidenceCount: number,
  outputState: SkillBeliefState,
  parameters?: Record<string, any>
): ModelRun {
  return {
    id: `mr_${studentId}_${skillId}_${Date.now()}`,
    studentId,
    skillId,
    modelType,
    modelVersion,
    inputEvidenceCount,
    outputState,
    parameters,
    createdAt: new Date().toISOString(),
  };
}
