import {
  ICompetencyRequirement,
  MasteryLevel,
} from '../../../interfaces/competency/competency.interface';
import { CompetencyRequirement } from '../../../models/competency/competencyRequirement.model';
import { decideEligibility, EligibilityDecision } from './eligibility.service';
import { CertificationRepository } from '../repositories/certification.repository';

/**
 * Orchestration stub for SRS R-7 certification in the NEW (Mongoose) backend.
 *
 * WHY A STUB: this backend has no evaluation-creation flow today — all
 * EvaluationReports are still created by the legacy backend
 * (backend/src/index.ts:825 and :1376). The full write path lives there.
 *
 * This stub does two things:
 *   1. Exposes `loadRequirementsFor(classNumber, level)` so the future
 *      controller can fetch mandatory requirements.
 *   2. Exposes `evaluateStudent(studentId, classNumber, level)` that returns
 *      a decision based on whatever conceptMastery is passed in. The caller
 *      supplies the mastery map; this stub does not (yet) read from any
 *      EvaluationReport collection because none exists in this backend.
 *
 * When the evaluation flow migrates to this backend, replace the `mastery`
 * parameter with a Mongoose-side lookup mirroring `dbStore.getLatestConceptMastery`
 * in legacy db.ts, and add an upsert helper to CertificationRepository.
 */
export class CertificationService {
  private readonly repo = new CertificationRepository();

  async loadRequirementsFor(
    classNumber: number,
    level: number
  ): Promise<ICompetencyRequirement[]> {
    const docs = await CompetencyRequirement.find({
      classNumber,
      level,
      isMandatory: true,
    }).exec();
    return docs.map((d) => d.toObject() as ICompetencyRequirement);
  }

  async evaluateStudent(
    studentId: string,
    classNumber: number,
    level: number,
    conceptMastery: Record<string, MasteryLevel>,
    evaluatedAt: string = new Date().toISOString()
  ): Promise<EligibilityDecision> {
    const requirements = await this.loadRequirementsFor(classNumber, level);
    const decision = decideEligibility(requirements, conceptMastery, evaluatedAt);
    // TODO: enable when new backend owns evaluation creation.
    // await this.persistDecision(studentId, decision);
    return decision;
  }

  async getCertificationsByStudent(studentId: string) {
    return this.repo.findByStudent(studentId);
  }

  async getActiveCertificationsByStudent(studentId: string) {
    return this.repo.findActiveByStudent(studentId);
  }
}